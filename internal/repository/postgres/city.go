package postgres

import (
	"context"
	"errors"
	"fmt"
	"rideit/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CityRepository implements storage interface using pgxpool and PostGIS.
type CityRepository struct {
	pool *pgxpool.Pool
}

// NewCityRepository creates a new instance of CityRepository.
func NewCityRepository(pool *pgxpool.Pool) *CityRepository {
	return &CityRepository{pool: pool}
}

// GetActiveCityByLocation checks if the provided coordinates lie within any active city boundary.
// It executes a PostGIS spatial query utilizing the gist indexed boundary column.
// Note: ST_MakePoint(lng, lat) uses longitude as the first coordinate (x) and latitude as the second (y).
func (r *CityRepository) GetActiveCityByLocation(ctx context.Context, loc domain.Location) (*domain.City, error) {
	query := `
		SELECT id, name, base_fare, per_km_rate, commission_rate, allowed_vehicle_types, is_active, currency, matching_radius_km, created_at, updated_at
		FROM cities
		WHERE is_active = true
		  AND ST_Contains(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
		LIMIT 1;
	`

	var city domain.City
	var vehicleTypes []string

	err := r.pool.QueryRow(ctx, query, loc.Longitude, loc.Latitude).Scan(
		&city.ID,
		&city.Name,
		&city.BaseFare,
		&city.PerKmRate,
		&city.CommissionRate,
		&vehicleTypes,
		&city.IsActive,
		&city.Currency,
		&city.MatchingRadiusKM,
		&city.CreatedAt,
		&city.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // Coordinate does not fall into any active geofenced city
		}
		return nil, fmt.Errorf("failed to check active geofence location: %w", err)
	}

	// Map string database representations to typed VehicleType enums
	city.AllowedVehicleTypes = make([]domain.VehicleType, len(vehicleTypes))
	for i, t := range vehicleTypes {
		city.AllowedVehicleTypes[i] = domain.VehicleType(t)
	}

	return &city, nil
}

// CreateCity persists a new city boundary using a Well-Known Text (WKT) representation of the polygon.
func (r *CityRepository) CreateCity(ctx context.Context, city *domain.City) error {
	query := `
		INSERT INTO cities (name, boundary, base_fare, per_km_rate, commission_rate, allowed_vehicle_types, is_active, currency, matching_radius_km, created_at, updated_at)
		VALUES ($1, ST_GeomFromText($2, 4326), $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		RETURNING id, created_at, updated_at;
	`

	vehicleTypes := make([]string, len(city.AllowedVehicleTypes))
	for i, t := range city.AllowedVehicleTypes {
		vehicleTypes[i] = string(t)
	}

	err := r.pool.QueryRow(
		ctx,
		query,
		city.Name,
		city.BoundaryWKT,
		city.BaseFare,
		city.PerKmRate,
		city.CommissionRate,
		vehicleTypes,
		city.IsActive,
		city.Currency,
		city.MatchingRadiusKM,
	).Scan(&city.ID, &city.CreatedAt, &city.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create city boundary: %w", err)
	}

	return nil
}

// ListCities fetches all configured operational geofenced cities.
func (r *CityRepository) ListCities(ctx context.Context) ([]*domain.City, error) {
	query := `
		SELECT id, name, ST_AsGeoJSON(boundary), base_fare, per_km_rate, commission_rate, allowed_vehicle_types, is_active, currency, matching_radius_km, created_at, updated_at
		FROM cities
		ORDER BY name ASC;
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list cities: %w", err)
	}
	defer rows.Close()

	var cities []*domain.City
	for rows.Next() {
		var city domain.City
		var vehicleTypes []string
		var boundaryGeoJSON []byte

		err := rows.Scan(
			&city.ID,
			&city.Name,
			&boundaryGeoJSON,
			&city.BaseFare,
			&city.PerKmRate,
			&city.CommissionRate,
			&vehicleTypes,
			&city.IsActive,
			&city.Currency,
			&city.MatchingRadiusKM,
			&city.CreatedAt,
			&city.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan city: %w", err)
		}

		city.BoundaryGeoJSON = boundaryGeoJSON
		city.AllowedVehicleTypes = make([]domain.VehicleType, len(vehicleTypes))
		for i, t := range vehicleTypes {
			city.AllowedVehicleTypes[i] = domain.VehicleType(t)
		}
		cities = append(cities, &city)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error in city listing: %w", err)
	}

	return cities, nil
}
