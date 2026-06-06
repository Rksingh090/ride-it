package handler

import (
	"encoding/json"
	"net/http"
	"rideit/internal/domain"
	"rideit/internal/maps"
	"rideit/internal/service"
)

// RideHandler handles HTTP API requests for the ride lifecycle.
type RideHandler struct {
	rideEngine *service.RideEngineService
	mapsClient maps.MapsClient
}

// NewRideHandler returns a new RideHandler.
func NewRideHandler(rideEngine *service.RideEngineService, mapsClient maps.MapsClient) *RideHandler {
	return &RideHandler{
		rideEngine: rideEngine,
		mapsClient: mapsClient,
	}
}

// RequestRide creates a trip request and triggers driver matching in the geofenced area.
func (h *RideHandler) RequestRide(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		RiderID     string  `json:"rider_id"`
		PickupLat   float64 `json:"pickup_lat"`
		PickupLng   float64 `json:"pickup_lng"`
		DropoffLat  float64 `json:"dropoff_lat"`
		DropoffLng  float64 `json:"dropoff_lng"`
		VehicleType string  `json:"vehicle_type"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	if req.RiderID == "" || req.PickupLat == 0 || req.PickupLng == 0 || req.DropoffLat == 0 || req.DropoffLng == 0 || req.VehicleType == "" {
		http.Error(w, "Missing mandatory parameters", http.StatusBadRequest)
		return
	}

	pickup := domain.Location{Latitude: req.PickupLat, Longitude: req.PickupLng}
	dropoff := domain.Location{Latitude: req.DropoffLat, Longitude: req.DropoffLng}

	trip, err := h.rideEngine.RequestRide(r.Context(), req.RiderID, pickup, dropoff, domain.VehicleType(req.VehicleType))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(trip)
}

// AcceptRide assigns a driver to the ride request using atomic state transitions.
func (h *RideHandler) AcceptRide(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TripID   string `json:"trip_id"`
		DriverID string `json:"driver_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	if req.TripID == "" || req.DriverID == "" {
		http.Error(w, "Missing trip_id or driver_id", http.StatusBadRequest)
		return
	}

	trip, err := h.rideEngine.AcceptRide(r.Context(), req.TripID, req.DriverID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusConflict) // Conflict indicates the ride has already been accepted
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(trip)
}

// ArriveAtPickup transitions the ride status to Arrived.
func (h *RideHandler) ArriveAtPickup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TripID string `json:"trip_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	if req.TripID == "" {
		http.Error(w, "Missing trip_id", http.StatusBadRequest)
		return
	}

	err := h.rideEngine.ArriveAtPickup(r.Context(), req.TripID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"arrived"}`))
}

// StartRide marks the trip status as En Route.
func (h *RideHandler) StartRide(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TripID string `json:"trip_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	if req.TripID == "" {
		http.Error(w, "Missing trip_id", http.StatusBadRequest)
		return
	}

	err := h.rideEngine.StartRide(r.Context(), req.TripID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"en_route"}`))
}

// CompleteRide records ride termination details and updates driver availability.
func (h *RideHandler) CompleteRide(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TripID string `json:"trip_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	if req.TripID == "" {
		http.Error(w, "Missing trip_id", http.StatusBadRequest)
		return
	}

	trip, err := h.rideEngine.CompleteRide(r.Context(), req.TripID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(trip)
}

// SearchLocation geocodes a query string to return exact coordinates.
func (h *RideHandler) SearchLocation(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Missing query parameter 'q'", http.StatusBadRequest)
		return
	}

	results, err := h.mapsClient.SearchAddress(r.Context(), query)
	if err != nil {
		http.Error(w, "Geocoding search failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(results)
}
