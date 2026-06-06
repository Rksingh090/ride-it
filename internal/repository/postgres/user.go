package postgres

import (
	"context"
	"errors"
	"fmt"
	"rideit/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepository implements storage interface using pgxpool for users.
type UserRepository struct {
	pool *pgxpool.Pool
}

// NewUserRepository creates a new instance of UserRepository.
func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// CreateUser persists a user record.
func (r *UserRepository) CreateUser(ctx context.Context, user *domain.User) error {
	query := `
		INSERT INTO users (name, email, phone, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		RETURNING id, created_at, updated_at;
	`
	err := r.pool.QueryRow(
		ctx,
		query,
		user.Name,
		user.Email,
		user.Phone,
		string(user.Role),
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}

// GetUserByID retrieves a user record by ID.
func (r *UserRepository) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	query := `
		SELECT id, name, email, phone, role, created_at, updated_at
		FROM users
		WHERE id = $1;
	`
	var user domain.User
	var role string

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Phone,
		&role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to check user by ID: %w", err)
	}

	user.Role = domain.UserRole(role)
	return &user, nil
}

// GetUserByEmail retrieves a user record by Email.
func (r *UserRepository) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `
		SELECT id, name, email, phone, role, created_at, updated_at
		FROM users
		WHERE email = $1;
	`
	var user domain.User
	var role string

	err := r.pool.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Phone,
		&role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to check user by email: %w", err)
	}

	user.Role = domain.UserRole(role)
	return &user, nil
}
