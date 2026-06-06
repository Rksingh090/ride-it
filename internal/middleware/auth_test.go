package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"rideit/internal/domain"
	"rideit/internal/middleware"
	"testing"
)

func TestJWTTokenGenerationAndVerification(t *testing.T) {
	userID := "user-123"
	role := domain.RoleRider

	token, err := middleware.GenerateToken(userID, role)
	if err != nil {
		t.Fatalf("Failed to generate JWT: %v", err)
	}

	claims, err := middleware.VerifyToken(token)
	if err != nil {
		t.Fatalf("Failed to parse/verify JWT: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("Expected claim UserID %q, got %q", userID, claims.UserID)
	}

	if claims.Role != role {
		t.Errorf("Expected claim Role %q, got %q", role, claims.Role)
	}
}

func TestAuthMiddleware(t *testing.T) {
	userID := "admin-123"
	role := domain.RoleAdmin

	token, err := middleware.GenerateToken(userID, role)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctxUserID, ctxRole, err := middleware.GetUserFromContext(r.Context())
		if err != nil {
			t.Fatalf("Failed to retrieve user from request context: %v", err)
		}
		if ctxUserID != userID {
			t.Errorf("Context UserID mismatch: expected %q, got %q", userID, ctxUserID)
		}
		if ctxRole != role {
			t.Errorf("Context Role mismatch: expected %q, got %q", role, ctxRole)
		}
		w.WriteHeader(http.StatusOK)
	})

	handlerToTest := middleware.AuthMiddleware(nextHandler)

	// Test case 1: Missing Authorization header
	reqMissing := httptest.NewRequest("GET", "/api/admin/cities", nil)
	rrMissing := httptest.NewRecorder()
	handlerToTest.ServeHTTP(rrMissing, reqMissing)
	if rrMissing.Code != http.StatusUnauthorized {
		t.Errorf("Expected Unauthorized code (401), got %d", rrMissing.Code)
	}

	// Test case 2: Valid Bearer token
	reqValid := httptest.NewRequest("GET", "/api/admin/cities", nil)
	reqValid.Header.Set("Authorization", "Bearer "+token)
	rrValid := httptest.NewRecorder()
	handlerToTest.ServeHTTP(rrValid, reqValid)
	if rrValid.Code != http.StatusOK {
		t.Errorf("Expected OK code (200) for valid token, got %d", rrValid.Code)
	}
}
