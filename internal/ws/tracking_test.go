package ws_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"rideit/internal/db"
	"rideit/internal/domain"
	"rideit/internal/middleware"
	"rideit/internal/ws"

	"github.com/gorilla/websocket"
)

func TestWebSocketLiveTracking(t *testing.T) {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		t.Skip("Skipping live tracking integration test: REDIS_URL not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Initialize Redis
	rdb, err := db.ConnectRedis(ctx)
	if err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer func() {
		_ = rdb.Close()
	}()

	// Initialize WebSocket Hub
	hub := ws.NewHub(rdb.Client)

	// Setup mock WebSocket server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/ws/driver") {
			ws.ServeWebSocket(hub, w, r, "driver")
		} else if strings.HasPrefix(r.URL.Path, "/ws/rider") {
			ws.ServeWebSocket(hub, w, r, "rider")
		}
	}))
	defer server.Close()

	// Convert http url to ws url
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	driverID := "test-driver-1"
	riderID := "test-rider-1"

	// Register match in hub
	hub.SetMatch(driverID, riderID)

	// Generate JWT authentication tokens
	riderToken, err := middleware.GenerateToken(riderID, domain.RoleRider)
	if err != nil {
		t.Fatalf("Failed to generate rider JWT: %v", err)
	}

	driverToken, err := middleware.GenerateToken(driverID, domain.RoleDriver)
	if err != nil {
		t.Fatalf("Failed to generate driver JWT: %v", err)
	}

	// 1. Connect Rider WebSocket Client
	riderConn, _, err := websocket.DefaultDialer.Dial(wsURL+"/ws/rider?id="+riderID+"&token="+riderToken, nil)
	if err != nil {
		t.Fatalf("Failed to connect Rider client: %v", err)
	}
	defer func() {
		_ = riderConn.Close()
	}()

	// 2. Connect Driver WebSocket Client
	driverConn, _, err := websocket.DefaultDialer.Dial(wsURL+"/ws/driver?id="+driverID+"&token="+driverToken, nil)
	if err != nil {
		t.Fatalf("Failed to connect Driver client: %v", err)
	}
	defer func() {
		_ = driverConn.Close()
	}()

	// Allow websocket handshakes to settle
	time.Sleep(100 * time.Millisecond)

	// 3. Driver sends telemetry coordinates
	locationPayload := struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	}{
		Latitude:  12.9716,
		Longitude: 77.5946,
	}

	err = driverConn.WriteJSON(locationPayload)
	if err != nil {
		t.Fatalf("Failed to send driver location update: %v", err)
	}

	// 4. Verify Rider receives location broadcast
	var riderReceived ws.LocationPayload
	err = riderConn.ReadJSON(&riderReceived)
	if err != nil {
		t.Fatalf("Rider failed to read location update: %v", err)
	}

	if riderReceived.Event != "driver_location" {
		t.Errorf("Expected event name 'driver_location', got '%s'", riderReceived.Event)
	}
	if riderReceived.DriverID != driverID {
		t.Errorf("Expected driver ID '%s', got '%s'", driverID, riderReceived.DriverID)
	}
	if riderReceived.Latitude != locationPayload.Latitude || riderReceived.Longitude != locationPayload.Longitude {
		t.Errorf("Expected coordinates (%f, %f), got (%f, %f)", locationPayload.Latitude, locationPayload.Longitude, riderReceived.Latitude, riderReceived.Longitude)
	}

	// 5. Verify coordinate storage inside Redis geospatial index
	positions, err := rdb.Client.GeoPos(ctx, "drivers:locations", driverID).Result()
	if err != nil {
		t.Fatalf("Failed to retrieve driver location from Redis: %v", err)
	}

	if len(positions) == 0 || positions[0] == nil {
		t.Fatalf("Driver %s location was not indexed inside Redis geospatial index", driverID)
	}

	// Check spatial coordinate match (allowing small floating point delta due to grid compression)
	latDelta := positions[0].Latitude - locationPayload.Latitude
	lngDelta := positions[0].Longitude - locationPayload.Longitude
	if latDelta < -0.01 || latDelta > 0.01 || lngDelta < -0.01 || lngDelta > 0.01 {
		t.Errorf("Stored coordinates (%f, %f) differ too much from sent coordinates (%f, %f)", positions[0].Latitude, positions[0].Longitude, locationPayload.Latitude, locationPayload.Longitude)
	}
}

func TestHubReconnectionCleanup(t *testing.T) {
	hub := ws.NewHub(nil)

	c1 := &ws.Client{
		ID:   "driver-1",
		Role: "driver",
		Hub:  hub,
		Send: make(chan []byte, 10),
	}

	// 1. Register first client connection
	hub.Register(c1)

	// Verify c1 is online
	if !hub.SendMessage("driver", "driver-1", []byte("hello")) {
		t.Fatal("Expected driver-1 to be online")
	}

	// 2. Register second client connection (reconnection)
	c2 := &ws.Client{
		ID:   "driver-1",
		Role: "driver",
		Hub:  hub,
		Send: make(chan []byte, 10),
	}
	hub.Register(c2)

	// Verify that c1's Send channel was closed
	// Drain any buffered messages first
	for len(c1.Send) > 0 {
		<-c1.Send
	}
	select {
	case _, ok := <-c1.Send:
		if ok {
			t.Error("Expected c1.Send to be closed on reconnection, but it was not")
		}
	default:
		t.Error("Expected c1.Send to be closed on reconnection, but it is blocking/open")
	}

	// Verify c2 is online (and messages go to c2)
	if !hub.SendMessage("driver", "driver-1", []byte("hello-again")) {
		t.Fatal("Expected driver-1 to be online after reconnection")
	}

	select {
	case msg := <-c2.Send:
		if string(msg) != "hello-again" {
			t.Errorf("Expected msg 'hello-again', got %q", string(msg))
		}
	default:
		t.Error("Expected c2.Send to receive message")
	}

	// 3. Unregister the OLD client c1 (as if its readPump/writePump finally exited)
	hub.Unregister(c1)

	// Verify that the active client c2 is STILL registered (i.e. c1's unregister did not delete c2)
	if !hub.SendMessage("driver", "driver-1", []byte("still-here")) {
		t.Error("Expected driver-1 to remain online after old connection unregisters")
	}

	// 4. Unregister the ACTIVE client c2
	hub.Unregister(c2)

	// Verify it is offline now
	if hub.SendMessage("driver", "driver-1", []byte("offline")) {
		t.Error("Expected driver-1 to be offline after active connection unregisters")
	}
}

