package postgres

import (
	"context"
	"errors"
	"fmt"
	"rideit/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DriverRepository implements repository.DriverRepository using pgxpool.
type DriverRepository struct {
	pool *pgxpool.Pool
}

// NewDriverRepository creates a new DriverRepository.
func NewDriverRepository(pool *pgxpool.Pool) *DriverRepository {
	return &DriverRepository{pool: pool}
}

// GetDriverByID retrieves a driver's details.
func (r *DriverRepository) GetDriverByID(ctx context.Context, id string) (*domain.Driver, error) {
	query := `
		SELECT id, vehicle_type, vehicle_number, status, last_known_lat, last_known_lng, updated_at, base_fare, per_km_rate, vehicle_image, is_approved
		FROM drivers
		WHERE id = $1;
	`

	var driver domain.Driver
	var vehicleType string
	var status string

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&driver.ID,
		&vehicleType,
		&driver.VehicleNumber,
		&status,
		&driver.LastKnownLat,
		&driver.LastKnownLng,
		&driver.UpdatedAt,
		&driver.BaseFare,
		&driver.PerKmRate,
		&driver.VehicleImage,
		&driver.IsApproved,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get driver: %w", err)
	}

	driver.VehicleType = domain.VehicleType(vehicleType)
	driver.Status = domain.DriverStatus(status)

	// Fetch user details too
	queryUser := `SELECT name, email, phone FROM users WHERE id = $1`
	_ = r.pool.QueryRow(ctx, queryUser, id).Scan(&driver.User.Name, &driver.User.Email, &driver.User.Phone)
	driver.User.ID = driver.ID
	driver.User.Role = domain.RoleDriver

	return &driver, nil
}

// UpdateDriverStatus updates the driver's current availability state.
func (r *DriverRepository) UpdateDriverStatus(ctx context.Context, driverID string, status domain.DriverStatus) error {
	query := `
		UPDATE drivers
		SET status = $1, updated_at = NOW()
		WHERE id = $2;
	`

	_, err := r.pool.Exec(ctx, query, string(status), driverID)
	if err != nil {
		return fmt.Errorf("failed to update driver status: %w", err)
	}
	return nil
}

// GetAvailableDriversByIDs queries database status to filter list of drivers by vehicle compatibility.
func (r *DriverRepository) GetAvailableDriversByIDs(ctx context.Context, ids []string, vehicleType domain.VehicleType) ([]*domain.Driver, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	query := `
		SELECT id, vehicle_type, vehicle_number, status, last_known_lat, last_known_lng, updated_at, base_fare, per_km_rate, vehicle_image, is_approved
		FROM drivers
		WHERE id = ANY($1)
		  AND status = 'available'
		  AND is_approved = true
		  AND vehicle_type = $2;
	`

	rows, err := r.pool.Query(ctx, query, ids, string(vehicleType))
	if err != nil {
		return nil, fmt.Errorf("failed to query available drivers by IDs: %w", err)
	}
	defer rows.Close()

	var drivers []*domain.Driver
	for rows.Next() {
		var driver domain.Driver
		var vType string
		var status string

		err := rows.Scan(
			&driver.ID,
			&vType,
			&driver.VehicleNumber,
			&status,
			&driver.LastKnownLat,
			&driver.LastKnownLng,
			&driver.UpdatedAt,
			&driver.BaseFare,
			&driver.PerKmRate,
			&driver.VehicleImage,
			&driver.IsApproved,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan driver: %w", err)
		}

		driver.VehicleType = domain.VehicleType(vType)
		driver.Status = domain.DriverStatus(status)
		drivers = append(drivers, &driver)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error in driver lookup: %w", err)
	}

	return drivers, nil
}

// CreateDriver persists a new driver record.
func (r *DriverRepository) CreateDriver(ctx context.Context, driver *domain.Driver) error {
	query := `
		INSERT INTO drivers (id, vehicle_type, vehicle_number, status, base_fare, per_km_rate, vehicle_image, is_approved, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());
	`
	_, err := r.pool.Exec(
		ctx,
		query,
		driver.ID,
		string(driver.VehicleType),
		driver.VehicleNumber,
		string(driver.Status),
		driver.BaseFare,
		driver.PerKmRate,
		driver.VehicleImage,
		driver.IsApproved,
	)
	if err != nil {
		return fmt.Errorf("failed to create driver: %w", err)
	}
	return nil
}

// ListDrivers lists all drivers with details.
func (r *DriverRepository) ListDrivers(ctx context.Context) ([]*domain.Driver, error) {
	query := `
		SELECT d.id, d.vehicle_type, d.vehicle_number, d.status, d.last_known_lat, d.last_known_lng, d.base_fare, d.per_km_rate, d.vehicle_image, d.is_approved, d.updated_at,
		       u.name, u.email, u.phone, u.role
		FROM drivers d
		JOIN users u ON d.id = u.id
		ORDER BY u.name ASC;
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list drivers: %w", err)
	}
	defer rows.Close()

	var drivers []*domain.Driver
	for rows.Next() {
		var driver domain.Driver
		var vType string
		var status string
		var role string

		err := rows.Scan(
			&driver.ID,
			&vType,
			&driver.VehicleNumber,
			&status,
			&driver.LastKnownLat,
			&driver.LastKnownLng,
			&driver.BaseFare,
			&driver.PerKmRate,
			&driver.VehicleImage,
			&driver.IsApproved,
			&driver.UpdatedAt,
			&driver.User.Name,
			&driver.User.Email,
			&driver.User.Phone,
			&role,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan driver: %w", err)
		}
		driver.User.ID = driver.ID
		driver.User.Role = domain.UserRole(role)
		driver.VehicleType = domain.VehicleType(vType)
		driver.Status = domain.DriverStatus(status)
		drivers = append(drivers, &driver)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error in driver listing: %w", err)
	}

	return drivers, nil
}

// ApproveDriver sets driver approval status to true.
func (r *DriverRepository) ApproveDriver(ctx context.Context, driverID string) error {
	query := `
		UPDATE drivers
		SET is_approved = true, updated_at = NOW()
		WHERE id = $1;
	`
	_, err := r.pool.Exec(ctx, query, driverID)
	if err != nil {
		return fmt.Errorf("failed to approve driver: %w", err)
	}
	return nil
}
