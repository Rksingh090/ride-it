package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"rideit/internal/domain"

	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
)

var (
	jwtSecret  []byte
	secretOnce sync.Once
)

// getSecret retrieves signing secret or provides development fallback.
func getSecret() []byte {
	secretOnce.Do(func() {
		_ = godotenv.Load()
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			jwtSecret = []byte("rideit-secret-key-change-in-prod")
		} else {
			jwtSecret = []byte(secret)
		}
	})
	return jwtSecret
}

// Claims encapsulates standard and custom user claims.
type Claims struct {
	UserID string          `json:"user_id"`
	Role   domain.UserRole `json:"role"`
	jwt.RegisteredClaims
}

type contextKey string

const (
	// UserIDKey context identifier.
	UserIDKey contextKey = "user_id"
	// RoleKey context identifier.
	RoleKey contextKey = "role"
)

// GenerateToken generates a signed JWT.
func GenerateToken(userID string, role domain.UserRole) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getSecret())
}

// VerifyToken parses and validates a signed token.
func VerifyToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return getSecret(), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid or expired token")
	}

	return claims, nil
}

// AuthMiddleware filters requests and registers token claims inside Request Context.
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing authorization header", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
			return
		}

		claims, err := VerifyToken(parts[1])
		if err != nil {
			http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
		ctx = context.WithValue(ctx, RoleKey, claims.Role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole enforces route protection by checking injected Context Roles.
func RequireRole(role domain.UserRole, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctxRole, ok := r.Context().Value(RoleKey).(domain.UserRole)
		if !ok || ctxRole != role {
			http.Error(w, "Forbidden: insufficient permissions", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	}
}

// GetUserFromContext extracts claims details safely.
func GetUserFromContext(ctx context.Context) (string, domain.UserRole, error) {
	userID, ok1 := ctx.Value(UserIDKey).(string)
	role, ok2 := ctx.Value(RoleKey).(domain.UserRole)
	if !ok1 || !ok2 {
		return "", "", errors.New("user context not resolved")
	}
	return userID, role, nil
}
