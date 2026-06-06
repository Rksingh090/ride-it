package service

import (
	"context"
	"encoding/json"
	"log"
	"rideit/internal/domain"
	"rideit/internal/repository"
	"rideit/internal/ws"

	"github.com/redis/go-redis/v9"
)

// MatchingService coordinates the search and notification of drivers for requested rides.
type MatchingService struct {
	redisClient *redis.Client
	driverRepo  repository.DriverRepository
	wsHub       *ws.Hub
}

// NewMatchingService initializes a new MatchingService.
func NewMatchingService(redisClient *redis.Client, driverRepo repository.DriverRepository, wsHub *ws.Hub) *MatchingService {
	return &MatchingService{
		redisClient: redisClient,
		driverRepo:  driverRepo,
		wsHub:       wsHub,
	}
}

// MatchDriverForTrip performs geosearches in Redis and validates against PostgreSQL status.
func (s *MatchingService) MatchDriverForTrip(ctx context.Context, trip *domain.Trip, vehicleType domain.VehicleType, radiusKM float64) error {
	log.Printf("[Matching] Matching drivers for trip %s (lat: %f, lng: %f) within %.2f km", trip.ID, trip.PickupLat, trip.PickupLng, radiusKM)

	if s.redisClient == nil {
		log.Printf("[Matching] Redis client not initialized, skipping geospatial driver search")
		return nil
	}

	// 1. Search Redis for driver IDs within city-configured radius of pickup coordinate
	searchResult, err := s.redisClient.GeoSearch(ctx, "drivers:locations", &redis.GeoSearchQuery{
		Longitude:  trip.PickupLng,
		Latitude:   trip.PickupLat,
		Radius:     radiusKM,
		RadiusUnit: "km",
		Sort:       "ASC",
	}).Result()

	if err != nil {
		return err
	}

	if len(searchResult) == 0 {
		log.Printf("[Matching] No drivers located in Redis range for trip %s", trip.ID)
		return nil
	}

	// Compile list of driver IDs
	driverIDs := searchResult

	// 2. Validate database states (must be active, 'available' status, and matching vehicle selection)
	availableDrivers, err := s.driverRepo.GetAvailableDriversByIDs(ctx, driverIDs, vehicleType)
	if err != nil {
		return err
	}

	if len(availableDrivers) == 0 {
		log.Printf("[Matching] Nearby driver IDs %v found, but none are available or match vehicle type %s", driverIDs, vehicleType)
		return nil
	}

	// Create JSON WS dispatch offer
	offerPayload := struct {
		Event      string  `json:"event"`
		TripID     string  `json:"trip_id"`
		PickupLat  float64 `json:"pickup_lat"`
		PickupLng  float64 `json:"pickup_lng"`
		DropoffLat float64 `json:"dropoff_lat"`
		DropoffLng float64 `json:"dropoff_lng"`
		Fare       float64 `json:"fare"`
	}{
		Event:      "ride_offer",
		TripID:     trip.ID,
		PickupLat:  trip.PickupLat,
		PickupLng:  trip.PickupLng,
		DropoffLat: trip.DropoffLat,
		DropoffLng: trip.DropoffLng,
		Fare:       *trip.Fare,
	}

	msgBytes, err := json.Marshal(offerPayload)
	if err != nil {
		return err
	}

	// 3. Broadcast notifications to matched drivers
	for _, driver := range availableDrivers {
		sent := s.wsHub.SendMessage("driver", driver.ID, msgBytes)
		if sent {
			log.Printf("[Matching] Successfully broadcasted trip %s offer to driver %s", trip.ID, driver.ID)
		} else {
			log.Printf("[Matching] Driver %s is offline, skipped offer", driver.ID)
		}
	}

	return nil
}
