package ws

import (
	"log"
	"sync"

	"github.com/redis/go-redis/v9"
)

// Client represents a connected rider or driver websocket session.
type Client struct {
	ID   string
	Role string // "rider" or "driver"
	Hub  *Hub
	Send chan []byte
}

// Hub coordinates all active WebSocket connections and active trip matches.
type Hub struct {
	drivers       map[string]*Client
	riders        map[string]*Client
	activeMatches map[string]string // Maps driver_id -> rider_id for live trip updates
	mutex         sync.RWMutex
	RedisClient   *redis.Client
}

// NewHub initializes and returns a Hub instance.
func NewHub(redisClient *redis.Client) *Hub {
	return &Hub{
		drivers:       make(map[string]*Client),
		riders:        make(map[string]*Client),
		activeMatches: make(map[string]string),
		RedisClient:   redisClient,
	}
}

// Register registers a new client session based on role.
func (h *Hub) Register(c *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if c.Role == "driver" {
		if old, exists := h.drivers[c.ID]; exists {
			log.Printf("[Hub] Overwriting active driver client: %s. Closing old connection.", c.ID)
			close(old.Send)
		}
		h.drivers[c.ID] = c
		log.Printf("[Hub] Registered driver client: %s", c.ID)
	} else if c.Role == "rider" {
		if old, exists := h.riders[c.ID]; exists {
			log.Printf("[Hub] Overwriting active rider client: %s. Closing old connection.", c.ID)
			close(old.Send)
		}
		h.riders[c.ID] = c
		log.Printf("[Hub] Registered rider client: %s", c.ID)
	}
}

// Unregister deletes a client connection and cleans up associated matches.
func (h *Hub) Unregister(c *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if c.Role == "driver" {
		if h.drivers[c.ID] == c {
			delete(h.drivers, c.ID)
			delete(h.activeMatches, c.ID)
			close(c.Send)
			log.Printf("[Hub] Unregistered driver client: %s", c.ID)
		} else {
			log.Printf("[Hub] Unregister ignored for driver client: %s (connection was already overwritten)", c.ID)
		}
	} else if c.Role == "rider" {
		if h.riders[c.ID] == c {
			delete(h.riders, c.ID)
			// Prune any trip match linking to this rider
			for dID, rID := range h.activeMatches {
				if rID == c.ID {
					delete(h.activeMatches, dID)
					break
				}
			}
			close(c.Send)
			log.Printf("[Hub] Unregistered rider client: %s", c.ID)
		} else {
			log.Printf("[Hub] Unregister ignored for rider client: %s (connection was already overwritten)", c.ID)
		}
	}
}

// SetMatch pairs a driver with a rider for tracking events.
func (h *Hub) SetMatch(driverID, riderID string) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.activeMatches[driverID] = riderID
	log.Printf("[Hub] Matched driver %s with rider %s for live updates", driverID, riderID)
}

// RemoveMatch breaks a tracking association.
func (h *Hub) RemoveMatch(driverID string) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	delete(h.activeMatches, driverID)
	log.Printf("[Hub] Removed tracking match for driver %s", driverID)
}

// GetMatchedRider returns the active client struct of a driver's matched rider.
func (h *Hub) GetMatchedRider(driverID string) (*Client, bool) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	riderID, matched := h.activeMatches[driverID]
	if !matched {
		return nil, false
	}

	riderClient, online := h.riders[riderID]
	return riderClient, online
}

// SendMessage delivers raw bytes to a specific user session if online.
func (h *Hub) SendMessage(role, userID string, msg []byte) bool {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	var client *Client
	var online bool

	if role == "driver" {
		client, online = h.drivers[userID]
	} else {
		client, online = h.riders[userID]
	}

	if online {
		select {
		case client.Send <- msg:
			return true
		default:
			log.Printf("[Hub] Send buffer full for %s %s, dropping message", role, userID)
			return false
		}
	}
	return false
}
