package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"rideit/internal/config"
	"rideit/internal/db"
	"rideit/internal/domain"
	"rideit/internal/handler"
	"rideit/internal/maps"
	"rideit/internal/middleware"
	"rideit/internal/payment"
	"rideit/internal/repository/postgres"
	"rideit/internal/service"
	"rideit/internal/ws"
)

func main() {
	// Setup termination signal handling for graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	log.Println("Starting RideIt API service...")

	// 1. Load Configurations
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("failed to load configuration: %v", err)
	}

	// 2. Setup Database Connection Pool
	database, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer func() {
		log.Println("Closing database connection pool...")
		database.Close()
	}()
	log.Println("Database connection pool established successfully.")

	// 2b. Setup Redis Client
	redisClient, err := db.ConnectRedis(ctx)
	if err != nil {
		log.Fatalf("failed to connect to Redis: %v", err)
	}
	defer func() {
		log.Println("Closing Redis connection...")
		_ = redisClient.Close()
	}()
	log.Println("Redis connection established successfully.")

	// 2c. Setup WebSocket Hub
	hub := ws.NewHub(redisClient.Client)

	// 2d. Setup Repositories
	cityRepo := postgres.NewCityRepository(database.Pool)
	driverRepo := postgres.NewDriverRepository(database.Pool)
	tripRepo := postgres.NewTripRepository(database.Pool)
	userRepo := postgres.NewUserRepository(database.Pool)

	// 2e. Setup Services
	mapsClient := maps.NewMapsClient()
	paymentGateway := payment.NewMockPaymentGateway()
	matchingService := service.NewMatchingService(redisClient.Client, driverRepo, hub)
	rideEngine := service.NewRideEngineService(cityRepo, driverRepo, tripRepo, mapsClient, matchingService, hub, paymentGateway)

	// 2f. Setup Handlers
	rideHandler := handler.NewRideHandler(rideEngine, mapsClient)
	adminHandler := handler.NewAdminHandler(cityRepo, driverRepo)
	authHandler := handler.NewAuthHandler(userRepo, driverRepo)

	// 3. Routing & Server Setup
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"healthy"}`))
	})

	mux.HandleFunc("/ws/driver", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWebSocket(hub, w, r, "driver")
	})

	mux.HandleFunc("/ws/rider", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWebSocket(hub, w, r, "rider")
	})

	// Session Auth Endpoints
	mux.HandleFunc("/api/auth/login", authHandler.Login)
	mux.HandleFunc("/api/auth/register-rider", authHandler.RegisterRider)
	mux.HandleFunc("/api/auth/register-driver", authHandler.RegisterDriver)

	// Public endpoint to query active cities
	mux.HandleFunc("/api/cities", adminHandler.ListCities)

	// Admin Endpoints (protected by Auth and RequireRole middleware)
	mux.Handle("/api/admin/cities", middleware.AuthMiddleware(http.HandlerFunc(middleware.RequireRole(domain.RoleAdmin, adminHandler.CreateCity))))
	mux.Handle("/api/admin/drivers", middleware.AuthMiddleware(http.HandlerFunc(middleware.RequireRole(domain.RoleAdmin, adminHandler.ListDrivers))))
	mux.Handle("/api/admin/drivers/approve", middleware.AuthMiddleware(http.HandlerFunc(middleware.RequireRole(domain.RoleAdmin, adminHandler.ApproveDriver))))

	// Ride Engine Endpoints
	mux.HandleFunc("/api/maps/search", rideHandler.SearchLocation)
	mux.HandleFunc("/api/rides/request", rideHandler.RequestRide)
	mux.HandleFunc("/api/rides/accept", rideHandler.AcceptRide)
	mux.HandleFunc("/api/rides/arrive", rideHandler.ArriveAtPickup)
	mux.HandleFunc("/api/rides/start", rideHandler.StartRide)
	mux.HandleFunc("/api/rides/complete", rideHandler.CompleteRide)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server asynchronously
	serverErrors := make(chan error, 1)
	go func() {
		log.Printf("API server listening on port %s", cfg.Port)
		serverErrors <- server.ListenAndServe()
	}()

	// Graceful shutdown sequence
	select {
	case err := <-serverErrors:
		if err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start/run: %v", err)
		}
	case <-ctx.Done():
		log.Println("Initiating graceful shutdown sequence...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Fatalf("Server graceful shutdown failed: %v", err)
		}
		log.Println("Server gracefully stopped.")
	}
}
