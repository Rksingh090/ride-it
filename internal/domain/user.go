package domain

import (
	"time"
)

// UserRole defines the access role of a user.
type UserRole string

const (
	RoleRider  UserRole = "rider"
	RoleDriver UserRole = "driver"
	RoleAdmin  UserRole = "admin"
)

// User represents the base system user.
type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	Role      UserRole  `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// DriverStatus defines the availability state of a driver.
type DriverStatus string

const (
	DriverOffline   DriverStatus = "offline"
	DriverAvailable DriverStatus = "available"
	DriverBusy      DriverStatus = "busy"
)

// Driver contains details specific to driver accounts.
type Driver struct {
	ID            string       `json:"id"`
	User          User         `json:"user,omitempty"`
	VehicleType   VehicleType  `json:"vehicle_type"`
	VehicleNumber string       `json:"vehicle_number"`
	Status        DriverStatus `json:"status"`
	LastKnownLat  *float64     `json:"last_known_lat,omitempty"`
	LastKnownLng  *float64     `json:"last_known_lng,omitempty"`
	BaseFare      float64      `json:"base_fare"`
	PerKmRate     float64      `json:"per_km_rate"`
	VehicleImage  string       `json:"vehicle_image"`
	IsApproved    bool         `json:"is_approved"`
	UpdatedAt     time.Time    `json:"updated_at"`
}
