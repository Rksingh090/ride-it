package handler

import (
	"encoding/json"
	"net/http"
	"rideit/internal/domain"
	"rideit/internal/repository"
	"rideit/internal/utils"
)

// AdminHandler manages administrative operational routes like geofencing cities.
type AdminHandler struct {
	cityRepo   repository.CityRepository
	driverRepo repository.DriverRepository
}

// NewAdminHandler returns a new AdminHandler.
func NewAdminHandler(cityRepo repository.CityRepository, driverRepo repository.DriverRepository) *AdminHandler {
	return &AdminHandler{
		cityRepo:   cityRepo,
		driverRepo: driverRepo,
	}
}

// CreateCity handles requests to spin up a new operational city with boundary coordinates.
func (h *AdminHandler) CreateCity(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name                string               `json:"name"`
		Boundary            utils.GeoJSONPolygon `json:"boundary"`
		BaseFare            float64              `json:"base_fare"`
		PerKmRate           float64              `json:"per_km_rate"`
		CommissionRate      float64              `json:"commission_rate"`
		AllowedVehicleTypes []string             `json:"allowed_vehicle_types"`
		IsActive            bool                 `json:"is_active"`
		Currency            string               `json:"currency"`
		MatchingRadiusKM    float64              `json:"matching_radius_km"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.BaseFare < 0 || req.PerKmRate < 0 || req.CommissionRate < 0 {
		http.Error(w, "Missing or invalid config parameters", http.StatusBadRequest)
		return
	}

	// 1. Convert GeoJSON boundaries to WKT Polygon format
	wkt, err := req.Boundary.ToWKT()
	if err != nil {
		http.Error(w, "Invalid boundary GeoJSON format: "+err.Error(), http.StatusBadRequest)
		return
	}

	// 2. Parse vehicle types
	vehicleTypes := make([]domain.VehicleType, len(req.AllowedVehicleTypes))
	for i, vt := range req.AllowedVehicleTypes {
		vehicleTypes[i] = domain.VehicleType(vt)
	}

	if req.Currency == "" {
		req.Currency = "USD"
	}
	if req.MatchingRadiusKM <= 0 {
		req.MatchingRadiusKM = 5.0
	}

	city := &domain.City{
		Name:                req.Name,
		BoundaryWKT:         wkt,
		BaseFare:            req.BaseFare,
		PerKmRate:           req.PerKmRate,
		CommissionRate:      req.CommissionRate,
		AllowedVehicleTypes: vehicleTypes,
		IsActive:            req.IsActive,
		Currency:            req.Currency,
		MatchingRadiusKM:    req.MatchingRadiusKM,
	}

	// 3. Persist city settings and geofence in PostgreSQL
	err = h.cityRepo.CreateCity(r.Context(), city)
	if err != nil {
		http.Error(w, "Failed to register city boundary: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(city)
}

// ListCities retrieves active cities configured in the system.
func (h *AdminHandler) ListCities(w http.ResponseWriter, r *http.Request) {
	cities, err := h.cityRepo.ListCities(r.Context())
	if err != nil {
		http.Error(w, "Failed to retrieve operational cities: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(cities)
}

// ListDrivers lists all drivers with registration details.
func (h *AdminHandler) ListDrivers(w http.ResponseWriter, r *http.Request) {
	drivers, err := h.driverRepo.ListDrivers(r.Context())
	if err != nil {
		http.Error(w, "Failed to retrieve registered drivers: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(drivers)
}

// ApproveDriver activates a pending driver profile.
func (h *AdminHandler) ApproveDriver(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		DriverID string `json:"driver_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.DriverID == "" {
		http.Error(w, "Missing driver_id", http.StatusBadRequest)
		return
	}

	err := h.driverRepo.ApproveDriver(r.Context(), req.DriverID)
	if err != nil {
		http.Error(w, "Failed to approve driver account: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"approved"}`))
}
