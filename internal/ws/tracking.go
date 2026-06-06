package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// LocationPayload represents the telemetry format sent by clients and streamed to riders.
type LocationPayload struct {
	Event     string    `json:"event"`
	DriverID  string    `json:"driver_id"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Timestamp time.Time `json:"timestamp"`
}

// HandleDriverLocation handles transient location pings from drivers.
func HandleDriverLocation(ctx context.Context, hub *Hub, driverID string, lat, lng float64) error {
	// 1. Write telemetry coordinates to Redis Geospatial Index (GEOADD)
	// Key: "drivers:locations", Member: driverID, Order: Longitude first, then Latitude
	err := hub.RedisClient.GeoAdd(ctx, "drivers:locations", &redis.GeoLocation{
		Name:      driverID,
		Longitude: lng,
		Latitude:  lat,
	}).Err()

	if err != nil {
		return fmt.Errorf("failed to save driver location to Redis: %w", err)
	}

	log.Printf("[Tracking] Saved location for driver %s: (lng: %f, lat: %f) in Redis", driverID, lng, lat)

	// 2. Broadcast telemetry to the matched rider if a trip is active
	riderClient, matched := hub.GetMatchedRider(driverID)
	if !matched {
		// Driver is not currently matched with a rider on an active trip; no broadcast needed
		return nil
	}

	payload := LocationPayload{
		Event:     "driver_location",
		DriverID:  driverID,
		Latitude:  lat,
		Longitude: lng,
		Timestamp: time.Now(),
	}

	msgBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal location broadcast payload: %w", err)
	}

	// Send to rider's socket
	sent := hub.SendMessage("rider", riderClient.ID, msgBytes)
	if sent {
		log.Printf("[Tracking] Telemetry broadcasted from driver %s to rider %s", driverID, riderClient.ID)
	} else {
		log.Printf("[Tracking] Matched rider %s is offline or buffer full; broadcast skipped", riderClient.ID)
	}

	return nil
}
