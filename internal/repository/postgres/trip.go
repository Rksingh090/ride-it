package postgres

import (
	"context"
	"errors"
	"fmt"
	"rideit/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TripRepository implements repository.TripRepository using pgxpool.
type TripRepository struct {
	pool *pgxpool.Pool
}

// NewTripRepository creates a new TripRepository.
func NewTripRepository(pool *pgxpool.Pool) *TripRepository {
	return &TripRepository{pool: pool}
}

// CreateTrip registers a new trip, inserting pick/drop coordinates converted to PostGIS geometry points.
// Note: ST_MakePoint order is ST_MakePoint(longitude, latitude).
func (r *TripRepository) CreateTrip(ctx context.Context, trip *domain.Trip) error {
	query := `
		INSERT INTO trips (
			rider_id, city_id, status, pickup_lat, pickup_lng, pickup_geom, 
			dropoff_lat, dropoff_lng, dropoff_geom, fare, payment_hold_id, created_at, updated_at
		)
		VALUES (
			$1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($5, $4), 4326), 
			$6, $7, ST_SetSRID(ST_MakePoint($7, $6), 4326), $8, $9, NOW(), NOW()
		)
		RETURNING id, created_at, updated_at;
	`

	err := r.pool.QueryRow(
		ctx,
		query,
		trip.RiderID,
		trip.CityID,
		string(trip.Status),
		trip.PickupLat,
		trip.PickupLng,
		trip.DropoffLat,
		trip.DropoffLng,
		trip.Fare,
		trip.PaymentHoldID,
	).Scan(&trip.ID, &trip.CreatedAt, &trip.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create trip: %w", err)
	}
	return nil
}

// GetTripByID returns a trip based on ID.
func (r *TripRepository) GetTripByID(ctx context.Context, id string) (*domain.Trip, error) {
	query := `
		SELECT id, rider_id, driver_id, city_id, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, fare, payment_hold_id, created_at, updated_at
		FROM trips
		WHERE id = $1;
	`

	var trip domain.Trip
	var status string

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&trip.ID,
		&trip.RiderID,
		&trip.DriverID,
		&trip.CityID,
		&status,
		&trip.PickupLat,
		&trip.PickupLng,
		&trip.DropoffLat,
		&trip.DropoffLng,
		&trip.Fare,
		&trip.PaymentHoldID,
		&trip.CreatedAt,
		&trip.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query trip: %w", err)
	}

	trip.Status = domain.TripStatus(status)
	return &trip, nil
}

// UpdateTripStatus updates a trip state.
func (r *TripRepository) UpdateTripStatus(ctx context.Context, tripID string, status domain.TripStatus) error {
	query := `
		UPDATE trips
		SET status = $1, updated_at = NOW()
		WHERE id = $2;
	`

	_, err := r.pool.Exec(ctx, query, string(status), tripID)
	if err != nil {
		return fmt.Errorf("failed to update trip status: %w", err)
	}
	return nil
}

// AcceptTrip uses an atomic update with conditional verification to guarantee that only one
// driver can successfully transition a searching trip to accepted.
func (r *TripRepository) AcceptTrip(ctx context.Context, tripID string, driverID string) error {
	query := `
		UPDATE trips
		SET status = 'accepted', driver_id = $1, updated_at = NOW()
		WHERE id = $2 AND status = 'searching';
	`

	cmdTag, err := r.pool.Exec(ctx, query, driverID, tripID)
	if err != nil {
		return fmt.Errorf("failed to accept trip atomically: %w", err)
	}

	if cmdTag.RowsAffected() == 0 {
		return fmt.Errorf("trip %s has already been accepted by another driver or cancelled", tripID)
	}

	return nil
}

// CompleteTrip marks the trip as completed and updates final fares.
func (r *TripRepository) CompleteTrip(ctx context.Context, tripID string, fare float64) error {
	query := `
		UPDATE trips
		SET status = 'completed', fare = $1, updated_at = NOW()
		WHERE id = $2;
	`

	_, err := r.pool.Exec(ctx, query, fare, tripID)
	if err != nil {
		return fmt.Errorf("failed to complete trip record: %w", err)
	}
	return nil
}

// UpdateTripFare updates the trip fare amount.
func (r *TripRepository) UpdateTripFare(ctx context.Context, tripID string, fare float64) error {
	query := `
		UPDATE trips
		SET fare = $1, updated_at = NOW()
		WHERE id = $2;
	`
	_, err := r.pool.Exec(ctx, query, fare, tripID)
	if err != nil {
		return fmt.Errorf("failed to update trip fare: %w", err)
	}
	return nil
}
