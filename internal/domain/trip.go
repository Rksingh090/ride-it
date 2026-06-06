package domain

import (
	"time"
)

// TripStatus defines the states of a trip's lifecycle.
type TripStatus string

const (
	TripSearching TripStatus = "searching"
	TripAccepted  TripStatus = "accepted"
	TripArrived   TripStatus = "arrived"
	TripEnRoute   TripStatus = "en_route"
	TripCompleted TripStatus = "completed"
	TripCancelled TripStatus = "cancelled"
)

// Trip represents an individual ride booking.
type Trip struct {
	ID         string     `json:"id"`
	RiderID    string     `json:"rider_id"`
	DriverID   *string    `json:"driver_id,omitempty"`
	CityID     string     `json:"city_id"`
	Status     TripStatus `json:"status"`
	PickupLat  float64    `json:"pickup_lat"`
	PickupLng  float64    `json:"pickup_lng"`
	DropoffLat float64    `json:"dropoff_lat"`
	DropoffLng float64    `json:"dropoff_lng"`
	Fare          *float64   `json:"fare,omitempty"`
	PaymentHoldID *string    `json:"payment_hold_id,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}
