package domain

import (
	"encoding/json"
	"time"
)

// Location represents geographic coordinates.
type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// VehicleType defines the category of vehicle.
type VehicleType string

const (
	VehicleBike  VehicleType = "bike"
	VehicleSedan VehicleType = "sedan"
	VehicleSUV   VehicleType = "suv"
	VehicleAuto  VehicleType = "auto"
)

// City represents a geofenced operating area with configurations.
type City struct {
	ID                  string          `json:"id"`
	Name                string          `json:"name"`
	BoundaryWKT         string          `json:"boundary_wkt,omitempty"`
	BoundaryGeoJSON     json.RawMessage `json:"boundary_geojson,omitempty"`
	BaseFare            float64         `json:"base_fare"`
	PerKmRate           float64         `json:"per_km_rate"`
	CommissionRate      float64         `json:"commission_rate"`
	AllowedVehicleTypes []VehicleType   `json:"allowed_vehicle_types"`
	IsActive            bool            `json:"is_active"`
	Currency            string          `json:"currency"`
	MatchingRadiusKM    float64         `json:"matching_radius_km"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

// SearchResult represents a geocoded location match.
type SearchResult struct {
	Name      string  `json:"name"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}
