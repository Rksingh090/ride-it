package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"rideit/internal/domain"
	"rideit/internal/maps"
	"rideit/internal/payment"
	"rideit/internal/repository"
	"rideit/internal/ws"
)

// RideEngineService coordinates ride creation and lifecycle state transitions.
type RideEngineService struct {
	cityRepo        repository.CityRepository
	driverRepo      repository.DriverRepository
	tripRepo        repository.TripRepository
	mapsClient      maps.MapsClient
	matchingService *MatchingService
	wsHub           *ws.Hub
	paymentGateway  payment.PaymentGateway
}

// NewRideEngineService initializes a RideEngineService.
func NewRideEngineService(
	cityRepo repository.CityRepository,
	driverRepo repository.DriverRepository,
	tripRepo repository.TripRepository,
	mapsClient maps.MapsClient,
	matchingService *MatchingService,
	wsHub *ws.Hub,
	paymentGateway payment.PaymentGateway,
) *RideEngineService {
	return &RideEngineService{
		cityRepo:        cityRepo,
		driverRepo:      driverRepo,
		tripRepo:        tripRepo,
		mapsClient:      mapsClient,
		matchingService: matchingService,
		wsHub:           wsHub,
		paymentGateway:  paymentGateway,
	}
}

// RequestRide validates the pickup coordinates and initializes the ride booking, triggering matching.
func (s *RideEngineService) RequestRide(ctx context.Context, riderID string, pickup, dropoff domain.Location, vehicleType domain.VehicleType) (*domain.Trip, error) {
	// 1. Geofence boundary verification
	activeCity, err := s.cityRepo.GetActiveCityByLocation(ctx, pickup)
	if err != nil {
		return nil, fmt.Errorf("geofence check failed: %w", err)
	}
	if activeCity == nil {
		return nil, errors.New("pickup location is outside our operational geofenced cities")
	}

	// 2. Fetch routing telemetry estimates
	distanceKm, _, err := s.mapsClient.CalculateRoute(ctx, pickup, dropoff)
	if err != nil {
		return nil, fmt.Errorf("routing distance estimation failed: %w", err)
	}

	// 3. Fare computation based on city configuration rates
	estimatedFare := activeCity.BaseFare + (distanceKm * activeCity.PerKmRate)

	// 3b. Authorize payment hold on booking request
	holdID, err := s.paymentGateway.CreateAuthorizationHold(ctx, riderID, estimatedFare)
	if err != nil {
		return nil, fmt.Errorf("payment authorization hold failed: %w", err)
	}

	// 4. Save trip to database with searching status
	trip := &domain.Trip{
		RiderID:       riderID,
		CityID:        activeCity.ID,
		Status:        domain.TripSearching,
		PickupLat:     pickup.Latitude,
		PickupLng:     pickup.Longitude,
		DropoffLat:    dropoff.Latitude,
		DropoffLng:    dropoff.Longitude,
		Fare:          &estimatedFare,
		PaymentHoldID: &holdID,
	}

	err = s.tripRepo.CreateTrip(ctx, trip)
	if err != nil {
		return nil, fmt.Errorf("failed to save trip request: %w", err)
	}

	// 5. Fire off driver matching task in background
	go func() {
		// Use detached context since the HTTP request returns immediately
		bgCtx := context.Background()
		if err := s.matchingService.MatchDriverForTrip(bgCtx, trip, vehicleType, activeCity.MatchingRadiusKM); err != nil {
			log.Printf("[RideEngine] Matching routine error for trip %s: %v", trip.ID, err)
		}
	}()

	return trip, nil
}

// AcceptRide transitions a searching trip to accepted. It uses conditional where checks to prevent race bookings.
func (s *RideEngineService) AcceptRide(ctx context.Context, tripID, driverID string) (*domain.Trip, error) {
	// Retrieve driver custom rates
	driver, err := s.driverRepo.GetDriverByID(ctx, driverID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve driver details: %w", err)
	}
	if driver == nil {
		return nil, errors.New("driver not found")
	}

	// Retrieve existing trip details
	trip, err := s.tripRepo.GetTripByID(ctx, tripID)
	if err != nil {
		return nil, err
	}
	if trip == nil {
		return nil, errors.New("trip not found")
	}

	// Recalculate routing distance using Maps client
	pickup := domain.Location{Latitude: trip.PickupLat, Longitude: trip.PickupLng}
	dropoff := domain.Location{Latitude: trip.DropoffLat, Longitude: trip.DropoffLng}
	distanceKm, _, err := s.mapsClient.CalculateRoute(ctx, pickup, dropoff)
	if err != nil {
		return nil, fmt.Errorf("recalculating distance failed: %w", err)
	}

	// Calculate final fare based on driver's custom pricing rates
	driverFare := driver.BaseFare + (distanceKm * driver.PerKmRate)

	// 1. Atomic DB state transition check
	err = s.tripRepo.AcceptTrip(ctx, tripID, driverID)
	if err != nil {
		return nil, fmt.Errorf("failed to accept trip: %w", err)
	}

	// 1b. Update final fare in database to driver custom rate
	err = s.tripRepo.UpdateTripFare(ctx, tripID, driverFare)
	if err != nil {
		log.Printf("[RideEngine] Failed to update trip fare with driver rates for trip %s: %v", tripID, err)
	}

	// 2. Update driver availability state to busy in database
	err = s.driverRepo.UpdateDriverStatus(ctx, driverID, domain.DriverBusy)
	if err != nil {
		return nil, fmt.Errorf("failed to set driver status to busy: %w", err)
	}

	// 3. Register pairing in WebSockets Hub to stream live telemetry coordinate updates
	s.wsHub.SetMatch(driverID, trip.RiderID)

	// 4. Broadcast state transition to Rider
	notifyRider := struct {
		Event    string  `json:"event"`
		TripID   string  `json:"trip_id"`
		DriverID string  `json:"driver_id"`
		Status   string  `json:"status"`
		Fare     float64 `json:"fare"`
	}{
		Event:    "ride_accepted",
		TripID:   tripID,
		DriverID: driverID,
		Status:   "accepted",
		Fare:     driverFare,
	}

	msgBytes, _ := json.Marshal(notifyRider)
	s.wsHub.SendMessage("rider", trip.RiderID, msgBytes)

	return s.tripRepo.GetTripByID(ctx, tripID)
}

// ArriveAtPickup notifies the rider that the driver has arrived.
func (s *RideEngineService) ArriveAtPickup(ctx context.Context, tripID string) error {
	err := s.tripRepo.UpdateTripStatus(ctx, tripID, domain.TripArrived)
	if err != nil {
		return err
	}

	trip, err := s.tripRepo.GetTripByID(ctx, tripID)
	if err != nil {
		return err
	}

	payload := struct {
		Event  string `json:"event"`
		TripID string `json:"trip_id"`
		Status string `json:"status"`
	}{
		Event:  "driver_arrived",
		TripID: tripID,
		Status: "arrived",
	}
	msgBytes, _ := json.Marshal(payload)
	s.wsHub.SendMessage("rider", trip.RiderID, msgBytes)

	return nil
}

// StartRide transitions the trip to en route.
func (s *RideEngineService) StartRide(ctx context.Context, tripID string) error {
	err := s.tripRepo.UpdateTripStatus(ctx, tripID, domain.TripEnRoute)
	if err != nil {
		return err
	}

	trip, err := s.tripRepo.GetTripByID(ctx, tripID)
	if err != nil {
		return err
	}

	payload := struct {
		Event  string `json:"event"`
		TripID string `json:"trip_id"`
		Status string `json:"status"`
	}{
		Event:  "ride_started",
		TripID: tripID,
		Status: "en_route",
	}
	msgBytes, _ := json.Marshal(payload)
	s.wsHub.SendMessage("rider", trip.RiderID, msgBytes)

	return nil
}

// CompleteRide completes the trip, releases the driver back to available, and terminates the WebSocket match.
func (s *RideEngineService) CompleteRide(ctx context.Context, tripID string) (*domain.Trip, error) {
	trip, err := s.tripRepo.GetTripByID(ctx, tripID)
	if err != nil {
		return nil, err
	}

	if trip.DriverID == nil {
		return nil, errors.New("cannot complete a trip without an assigned driver")
	}

	driverID := *trip.DriverID

	// 1. Capture payment hold from gateway
	if trip.PaymentHoldID != nil {
		err = s.paymentGateway.CapturePayment(ctx, *trip.PaymentHoldID, *trip.Fare)
		if err != nil {
			log.Printf("[RideEngine] Payment capture failed for trip %s, hold %s: %v", tripID, *trip.PaymentHoldID, err)
			// Proceed so we don't block DB lifecycle update on API failures
		}
	}

	// 2. Mark trip completed in DB
	err = s.tripRepo.CompleteTrip(ctx, tripID, *trip.Fare)
	if err != nil {
		return nil, err
	}

	// 2. Free driver in DB
	err = s.driverRepo.UpdateDriverStatus(ctx, driverID, domain.DriverAvailable)
	if err != nil {
		return nil, err
	}

	// 3. Remove live coordinates streaming match association
	s.wsHub.RemoveMatch(driverID)

	// 4. Send receipt notifications to both rider and driver
	payload := struct {
		Event  string  `json:"event"`
		TripID string  `json:"trip_id"`
		Status string  `json:"status"`
		Fare   float64 `json:"fare"`
	}{
		Event:  "ride_completed",
		TripID: tripID,
		Status: "completed",
		Fare:   *trip.Fare,
	}
	msgBytes, _ := json.Marshal(payload)
	s.wsHub.SendMessage("rider", trip.RiderID, msgBytes)
	s.wsHub.SendMessage("driver", driverID, msgBytes)

	return s.tripRepo.GetTripByID(ctx, tripID)
}
