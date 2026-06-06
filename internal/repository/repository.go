package repository

import (
	"context"
	"rideit/internal/domain"
)

// UserRepository defines operations for users.
type UserRepository interface {
	CreateUser(ctx context.Context, user *domain.User) error
	GetUserByID(ctx context.Context, id string) (*domain.User, error)
	GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
}

// CityRepository defines operations for the cities geofencing database storage.
type CityRepository interface {
	GetActiveCityByLocation(ctx context.Context, loc domain.Location) (*domain.City, error)
	CreateCity(ctx context.Context, city *domain.City) error
	ListCities(ctx context.Context) ([]*domain.City, error)
}

// DriverRepository defines operations for checking availability and vehicle types.
type DriverRepository interface {
	GetDriverByID(ctx context.Context, id string) (*domain.Driver, error)
	UpdateDriverStatus(ctx context.Context, driverID string, status domain.DriverStatus) error
	GetAvailableDriversByIDs(ctx context.Context, ids []string, vehicleType domain.VehicleType) ([]*domain.Driver, error)
	CreateDriver(ctx context.Context, driver *domain.Driver) error
	ListDrivers(ctx context.Context) ([]*domain.Driver, error)
	ApproveDriver(ctx context.Context, driverID string) error
}

// TripRepository defines lifecycle state transitions and booking updates.
type TripRepository interface {
	CreateTrip(ctx context.Context, trip *domain.Trip) error
	GetTripByID(ctx context.Context, id string) (*domain.Trip, error)
	UpdateTripStatus(ctx context.Context, tripID string, status domain.TripStatus) error
	AcceptTrip(ctx context.Context, tripID string, driverID string) error
	CompleteTrip(ctx context.Context, tripID string, fare float64) error
	UpdateTripFare(ctx context.Context, tripID string, fare float64) error
}
