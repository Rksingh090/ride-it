package handler

import (
	"encoding/json"
	"net/http"
	"rideit/internal/domain"
	"rideit/internal/middleware"
	"rideit/internal/repository"
)

// AuthHandler provides session login and registration services.
type AuthHandler struct {
	userRepo   repository.UserRepository
	driverRepo repository.DriverRepository
}

// NewAuthHandler returns a new AuthHandler.
func NewAuthHandler(userRepo repository.UserRepository, driverRepo repository.DriverRepository) *AuthHandler {
	return &AuthHandler{
		userRepo:   userRepo,
		driverRepo: driverRepo,
	}
}

// Login verifies a user exists by email and issues a signed JWT.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Email == "" {
		http.Error(w, "Missing email parameter", http.StatusBadRequest)
		return
	}

	user, err := h.userRepo.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		http.Error(w, "Database lookup error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if user == nil {
		http.Error(w, "User not found. Please register first.", http.StatusNotFound)
		return
	}

	// Generate signed JWT
	token, err := middleware.GenerateToken(user.ID, user.Role)
	if err != nil {
		http.Error(w, "Failed to sign session token: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var driverInfo *domain.Driver
	if user.Role == domain.RoleDriver {
		driverInfo, err = h.driverRepo.GetDriverByID(r.Context(), user.ID)
		if err != nil {
			http.Error(w, "Failed to fetch driver details: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	resp := struct {
		Token  string         `json:"token"`
		User   *domain.User   `json:"user"`
		Driver *domain.Driver `json:"driver,omitempty"`
	}{
		Token:  token,
		User:   user,
		Driver: driverInfo,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

// RegisterRider creates a passenger profile in the database.
func (h *AuthHandler) RegisterRider(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name  string `json:"name"`
		Email string `json:"email"`
		Phone string `json:"phone"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Email == "" || req.Phone == "" {
		http.Error(w, "Missing mandatory parameters", http.StatusBadRequest)
		return
	}

	user := &domain.User{
		Name:  req.Name,
		Email: req.Email,
		Phone: req.Phone,
		Role:  domain.RoleRider,
	}

	err := h.userRepo.CreateUser(r.Context(), user)
	if err != nil {
		http.Error(w, "Failed to register user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(user)
}

// RegisterDriver creates a driver and vehicle profile awaiting approval.
func (h *AuthHandler) RegisterDriver(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name          string  `json:"name"`
		Email         string  `json:"email"`
		Phone         string  `json:"phone"`
		VehicleType   string  `json:"vehicle_type"`
		VehicleNumber string  `json:"vehicle_number"`
		BaseFare      float64 `json:"base_fare"`
		PerKmRate     float64 `json:"per_km_rate"`
		VehicleImage  string  `json:"vehicle_image"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Email == "" || req.Phone == "" || req.VehicleType == "" || req.VehicleNumber == "" || req.BaseFare < 0 || req.PerKmRate < 0 {
		http.Error(w, "Missing mandatory parameters", http.StatusBadRequest)
		return
	}

	// 1. Create Base User record first
	user := &domain.User{
		Name:  req.Name,
		Email: req.Email,
		Phone: req.Phone,
		Role:  domain.RoleDriver,
	}

	err := h.userRepo.CreateUser(r.Context(), user)
	if err != nil {
		http.Error(w, "Failed to register driver user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Create Driver Details record (is_approved = false)
	driver := &domain.Driver{
		ID:            user.ID,
		VehicleType:   domain.VehicleType(req.VehicleType),
		VehicleNumber: req.VehicleNumber,
		Status:        domain.DriverOffline,
		BaseFare:      req.BaseFare,
		PerKmRate:     req.PerKmRate,
		VehicleImage:  req.VehicleImage,
		IsApproved:    false,
	}

	err = h.driverRepo.CreateDriver(r.Context(), driver)
	if err != nil {
		http.Error(w, "Failed to register driver profile details: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(driver)
}
