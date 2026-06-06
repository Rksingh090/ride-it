package ws

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"rideit/internal/middleware"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow cross-origin requests for local development/testing
		return true
	},
}

// wsConnection encapsulates a connection session.
type wsConnection struct {
	client *Client
	conn   *websocket.Conn
}

// ServeWebSocket upgrades HTTP requests to WebSocket connection based on roles.
func ServeWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request, role string) {
	userID := r.URL.Query().Get("id")
	if userID == "" {
		http.Error(w, "Missing 'id' query parameter", http.StatusBadRequest)
		return
	}

	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Missing 'token' query parameter", http.StatusUnauthorized)
		return
	}

	// Validate JWT Token and extract claims
	claims, err := middleware.VerifyToken(token)
	if err != nil {
		http.Error(w, "Unauthorized token: "+err.Error(), http.StatusUnauthorized)
		return
	}

	// Assert UserID matches query ID to prevent impersonation
	if claims.UserID != userID {
		http.Error(w, "Forbidden: token user ID mismatch", http.StatusForbidden)
		return
	}

	// Assert Role matches expected WS endpoint role to prevent spoofing
	if string(claims.Role) != role {
		http.Error(w, "Forbidden: token role mismatch", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS Upgrade Error] Failed to upgrade for user %s: %v", userID, err)
		return
	}

	client := &Client{
		ID:   userID,
		Role: role,
		Hub:  hub,
		Send: make(chan []byte, 256),
	}

	hub.Register(client)

	wc := &wsConnection{
		client: client,
		conn:   conn,
	}

	// Spin off asynchronous read/write pumps
	go wc.writePump()
	go wc.readPump()
}

// readPump pumps messages from the websocket connection to the hub.
func (wc *wsConnection) readPump() {
	defer func() {
		wc.client.Hub.Unregister(wc.client)
		_ = wc.conn.Close()
	}()

	wc.conn.SetReadLimit(maxMessageSize)
	_ = wc.conn.SetReadDeadline(time.Now().Add(pongWait))
	wc.conn.SetPongHandler(func(string) error {
		_ = wc.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := wc.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS Read Error] clientID: %s, error: %v", wc.client.ID, err)
			}
			break
		}

		// Telemetry coordinate tracking applies only to drivers
		if wc.client.Role == "driver" {
			var coords struct {
				Latitude  float64 `json:"latitude"`
				Longitude float64 `json:"longitude"`
			}
			if err := json.Unmarshal(message, &coords); err != nil {
				log.Printf("[WS Parse Error] failed to decode location update from driver %s: %v", wc.client.ID, err)
				continue
			}

			// Process driver location update
			ctx := context.Background()
			if err := HandleDriverLocation(ctx, wc.client.Hub, wc.client.ID, coords.Latitude, coords.Longitude); err != nil {
				log.Printf("[WS Process Error] failed to handle driver %s location: %v", wc.client.ID, err)
			}
		}
	}
}

// writePump pumps messages from the hub's send channel to the websocket connection.
func (wc *wsConnection) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = wc.conn.Close()
	}()

	for {
		select {
		case message, ok := <-wc.client.Send:
			_ = wc.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				_ = wc.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := wc.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)

			// Flush buffered messages in queue
			n := len(wc.client.Send)
			for i := 0; i < n; i++ {
				_, _ = w.Write([]byte{'\n'})
				_, _ = w.Write(<-wc.client.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			_ = wc.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := wc.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
