package postgres_test

import (
	"context"
	"os"
	"rideit/internal/db"
	"rideit/internal/domain"
	"rideit/internal/repository/postgres"
	"testing"
)

func TestGetActiveCityByLocation(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("Skipping integration test: DATABASE_URL not set")
	}

	ctx := context.Background()
	database, err := db.Connect(ctx, dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	repo := postgres.NewCityRepository(database.Pool)

	// Create a test city (square boundary: x=longitude, y=latitude)
	city := &domain.City{
		Name:                "Test Geofence City",
		BoundaryWKT:         "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))",
		BaseFare:            5.00,
		PerKmRate:           2.00,
		CommissionRate:      15.00,
		AllowedVehicleTypes: []domain.VehicleType{domain.VehicleSedan, domain.VehicleSUV},
		IsActive:            true,
	}

	// Clean up any existing records
	_, _ = database.Pool.Exec(ctx, "DELETE FROM cities WHERE name = $1", city.Name)

	err = repo.CreateCity(ctx, city)
	if err != nil {
		t.Fatalf("Failed to create test city: %v", err)
	}
	defer func() {
		_, _ = database.Pool.Exec(ctx, "DELETE FROM cities WHERE name = $1", city.Name)
	}()

	tests := []struct {
		name         string
		location     domain.Location
		expectActive bool
		expectedName string
	}{
		{
			name:         "Inside active boundary",
			location:     domain.Location{Latitude: 5.0, Longitude: 5.0}, // (lng: 5.0, lat: 5.0) -> inside square
			expectActive: true,
			expectedName: "Test Geofence City",
		},
		{
			name:         "Outside active boundary",
			location:     domain.Location{Latitude: 15.0, Longitude: 15.0}, // (lng: 15.0, lat: 15.0) -> outside square
			expectActive: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := repo.GetActiveCityByLocation(ctx, tt.location)
			if err != nil {
				t.Fatalf("Failed to get active city: %v", err)
			}

			if tt.expectActive {
				if res == nil {
					t.Fatalf("Expected active city, got nil")
				}
				if res.Name != tt.expectedName {
					t.Errorf("Expected city name %q, got %q", tt.expectedName, res.Name)
				}
				if len(res.AllowedVehicleTypes) != 2 {
					t.Errorf("Expected 2 allowed vehicle types, got %d", len(res.AllowedVehicleTypes))
				}
			} else {
				if res != nil {
					t.Fatalf("Expected nil, got active city: %v", res.Name)
				}
			}
		})
	}
}
