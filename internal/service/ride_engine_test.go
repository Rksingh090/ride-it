package service_test

import (
	"context"
	"errors"
	"rideit/internal/domain"
	"rideit/internal/payment"
	"rideit/internal/service"
	"rideit/internal/ws"
	"testing"
)

// Mock CityRepository
type mockCityRepo struct {
	GetActiveCityFn func(ctx context.Context, loc domain.Location) (*domain.City, error)
}

func (m *mockCityRepo) GetActiveCityByLocation(ctx context.Context, loc domain.Location) (*domain.City, error) {
	return m.GetActiveCityFn(ctx, loc)
}

func (m *mockCityRepo) CreateCity(ctx context.Context, city *domain.City) error {
	return nil
}

func (m *mockCityRepo) ListCities(ctx context.Context) ([]*domain.City, error) {
	return nil, nil
}

// Mock DriverRepository
type mockDriverRepo struct {
	UpdateDriverStatusFn       func(ctx context.Context, driverID string, status domain.DriverStatus) error
	GetAvailableDriversByIDsFn func(ctx context.Context, ids []string, vehicleType domain.VehicleType) ([]*domain.Driver, error)
}

func (m *mockDriverRepo) GetDriverByID(ctx context.Context, id string) (*domain.Driver, error) {
	return &domain.Driver{
		ID:           id,
		VehicleType:  domain.VehicleSedan,
		BaseFare:     4.50,
		PerKmRate:    1.80,
		VehicleImage: "sedan",
		IsApproved:   true,
	}, nil
}

func (m *mockDriverRepo) UpdateDriverStatus(ctx context.Context, driverID string, status domain.DriverStatus) error {
	return m.UpdateDriverStatusFn(ctx, driverID, status)
}

func (m *mockDriverRepo) GetAvailableDriversByIDs(ctx context.Context, ids []string, vehicleType domain.VehicleType) ([]*domain.Driver, error) {
	return m.GetAvailableDriversByIDsFn(ctx, ids, vehicleType)
}

func (m *mockDriverRepo) CreateDriver(ctx context.Context, driver *domain.Driver) error {
	return nil
}

func (m *mockDriverRepo) ListDrivers(ctx context.Context) ([]*domain.Driver, error) {
	return nil, nil
}

func (m *mockDriverRepo) ApproveDriver(ctx context.Context, driverID string) error {
	return nil
}

// Mock TripRepository
type mockTripRepo struct {
	CreateTripFn       func(ctx context.Context, trip *domain.Trip) error
	GetTripFn          func(ctx context.Context, id string) (*domain.Trip, error)
	UpdateTripStatusFn func(ctx context.Context, tripID string, status domain.TripStatus) error
	AcceptTripFn       func(ctx context.Context, tripID string, driverID string) error
	CompleteTripFn     func(ctx context.Context, tripID string, fare float64) error
}

func (m *mockTripRepo) CreateTrip(ctx context.Context, trip *domain.Trip) error {
	return m.CreateTripFn(ctx, trip)
}

func (m *mockTripRepo) GetTripByID(ctx context.Context, id string) (*domain.Trip, error) {
	return m.GetTripFn(ctx, id)
}

func (m *mockTripRepo) UpdateTripStatus(ctx context.Context, tripID string, status domain.TripStatus) error {
	return m.UpdateTripStatusFn(ctx, tripID, status)
}

func (m *mockTripRepo) AcceptTrip(ctx context.Context, tripID string, driverID string) error {
	return m.AcceptTripFn(ctx, tripID, driverID)
}

func (m *mockTripRepo) CompleteTrip(ctx context.Context, tripID string, fare float64) error {
	return m.CompleteTripFn(ctx, tripID, fare)
}

func (m *mockTripRepo) UpdateTripFare(ctx context.Context, tripID string, fare float64) error {
	return nil
}

// Mock MapsClient
type mockMapsClient struct {
	CalculateRouteFn func(ctx context.Context, start, end domain.Location) (float64, float64, error)
}

func (m *mockMapsClient) CalculateRoute(ctx context.Context, start, end domain.Location) (float64, float64, error) {
	return m.CalculateRouteFn(ctx, start, end)
}

func (m *mockMapsClient) SearchAddress(ctx context.Context, query string) ([]domain.SearchResult, error) {
	return nil, nil
}

func TestRequestRide(t *testing.T) {
	ctx := context.Background()

	// 1. Setup mock functions
	cityRepo := &mockCityRepo{
		GetActiveCityFn: func(ctx context.Context, loc domain.Location) (*domain.City, error) {
			return &domain.City{
				ID:             "city-123",
				Name:           "San Francisco",
				BaseFare:       5.00,
				PerKmRate:      2.00,
				CommissionRate: 10.00,
				IsActive:       true,
			}, nil
		},
	}

	mapsClient := &mockMapsClient{
		CalculateRouteFn: func(ctx context.Context, start, end domain.Location) (float64, float64, error) {
			return 10.0, 20.0, nil // 10 km, 20 min
		},
	}

	tripRepo := &mockTripRepo{
		CreateTripFn: func(ctx context.Context, trip *domain.Trip) error {
			trip.ID = "trip-456"
			return nil
		},
	}

	hub := ws.NewHub(nil)
	matchingSvc := service.NewMatchingService(nil, nil, hub)
	engine := service.NewRideEngineService(cityRepo, nil, tripRepo, mapsClient, matchingSvc, hub, payment.NewMockPaymentGateway())

	// Test requesting ride
	pickup := domain.Location{Latitude: 37.7749, Longitude: -122.4194}
	dropoff := domain.Location{Latitude: 37.7858, Longitude: -122.4008}

	trip, err := engine.RequestRide(ctx, "rider-789", pickup, dropoff, domain.VehicleSedan)
	if err != nil {
		t.Fatalf("RequestRide failed: %v", err)
	}

	if trip.ID != "trip-456" {
		t.Errorf("Expected trip ID 'trip-456', got %q", trip.ID)
	}

	// Estimated fare should be: base_fare (5.00) + distance (10.0) * per_km_rate (2.00) = 25.00
	if trip.Fare == nil || *trip.Fare != 25.00 {
		t.Errorf("Expected estimated fare 25.00, got %v", trip.Fare)
	}

	if trip.Status != domain.TripSearching {
		t.Errorf("Expected status %q, got %q", domain.TripSearching, trip.Status)
	}
}

func TestRequestRide_OutsideOperationalGeofence(t *testing.T) {
	ctx := context.Background()

	cityRepo := &mockCityRepo{
		GetActiveCityFn: func(ctx context.Context, loc domain.Location) (*domain.City, error) {
			return nil, nil // Outside operational area
		},
	}

	engine := service.NewRideEngineService(cityRepo, nil, nil, nil, nil, nil, payment.NewMockPaymentGateway())

	pickup := domain.Location{Latitude: 0, Longitude: 0}
	dropoff := domain.Location{Latitude: 1, Longitude: 1}

	_, err := engine.RequestRide(ctx, "rider-1", pickup, dropoff, domain.VehicleSedan)
	if err == nil {
		t.Fatal("Expected error requesting ride outside operational area, got nil")
	}

	expectedErr := "pickup location is outside our operational geofenced cities"
	if err.Error() != expectedErr {
		t.Errorf("Expected error message %q, got %q", expectedErr, err.Error())
	}
}

func TestAcceptRide(t *testing.T) {
	ctx := context.Background()

	driverID := "driver-888"
	riderID := "rider-789"
	tripID := "trip-456"

	tripRepo := &mockTripRepo{
		AcceptTripFn: func(ctx context.Context, tID string, dID string) error {
			if tID != tripID || dID != driverID {
				return errors.New("invalid arguments")
			}
			return nil
		},
		GetTripFn: func(ctx context.Context, id string) (*domain.Trip, error) {
			return &domain.Trip{
				ID:        tripID,
				RiderID:   riderID,
				DriverID:  &driverID,
				Status:    domain.TripAccepted,
				PickupLat: 1,
				PickupLng: 2,
				Fare:      nil,
			}, nil
		},
	}

	driverRepo := &mockDriverRepo{
		UpdateDriverStatusFn: func(ctx context.Context, dID string, status domain.DriverStatus) error {
			if dID != driverID || status != domain.DriverBusy {
				return errors.New("incorrect status transition")
			}
			return nil
		},
	}

	hub := ws.NewHub(nil)

	// Register rider as online so Hub queries match successfully
	riderClient := &ws.Client{
		ID:   riderID,
		Role: "rider",
		Hub:  hub,
	}
	hub.Register(riderClient)

	mapsClient := &mockMapsClient{
		CalculateRouteFn: func(ctx context.Context, start, end domain.Location) (float64, float64, error) {
			return 10.0, 20.0, nil
		},
	}
	engine := service.NewRideEngineService(nil, driverRepo, tripRepo, mapsClient, nil, hub, payment.NewMockPaymentGateway())

	trip, err := engine.AcceptRide(ctx, tripID, driverID)
	if err != nil {
		t.Fatalf("AcceptRide failed: %v", err)
	}

	if trip.Status != domain.TripAccepted {
		t.Errorf("Expected status %q, got %q", domain.TripAccepted, trip.Status)
	}

	// Verify WebSocket hub match setup
	_, exists := hub.GetMatchedRider(driverID)
	if !exists {
		t.Error("Expected driver and rider to be registered as matched in the WebSocket Hub")
	}
}

func TestCompleteRide(t *testing.T) {
	ctx := context.Background()

	driverID := "driver-888"
	riderID := "rider-789"
	tripID := "trip-456"
	fare := 30.00

	tripRepo := &mockTripRepo{
		GetTripFn: func(ctx context.Context, id string) (*domain.Trip, error) {
			return &domain.Trip{
				ID:       tripID,
				RiderID:  riderID,
				DriverID: &driverID,
				Status:   domain.TripCompleted,
				Fare:     &fare,
			}, nil
		},
		CompleteTripFn: func(ctx context.Context, tID string, f float64) error {
			if tID != tripID || f != fare {
				return errors.New("invalid complete arguments")
			}
			return nil
		},
	}

	driverRepo := &mockDriverRepo{
		UpdateDriverStatusFn: func(ctx context.Context, dID string, status domain.DriverStatus) error {
			if dID != driverID || status != domain.DriverAvailable {
				return errors.New("incorrect driver status transition on completion")
			}
			return nil
		},
	}

	hub := ws.NewHub(nil)

	// Register rider as online so Hub queries match successfully
	riderClient := &ws.Client{
		ID:   riderID,
		Role: "rider",
		Hub:  hub,
	}
	hub.Register(riderClient)
	hub.SetMatch(driverID, riderID) // Setup active match first

	mapsClient := &mockMapsClient{}
	engine := service.NewRideEngineService(nil, driverRepo, tripRepo, mapsClient, nil, hub, payment.NewMockPaymentGateway())

	trip, err := engine.CompleteRide(ctx, tripID)
	if err != nil {
		t.Fatalf("CompleteRide failed: %v", err)
	}

	if trip.Status != domain.TripCompleted {
		t.Errorf("Expected status %q, got %q", domain.TripCompleted, trip.Status)
	}

	// Verify WebSocket hub match teardown
	_, exists := hub.GetMatchedRider(driverID)
	if exists {
		t.Error("Expected driver and rider match to be unregistered from the WebSocket Hub on completion")
	}
}
