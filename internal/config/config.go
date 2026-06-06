package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds environment and application settings.
type Config struct {
	DatabaseURL string
	Port        string
}

// LoadConfig retrieves values from environment variables or applies dev defaults.
func LoadConfig() (*Config, error) {
	// Attempt to load .env file. We ignore errors because in production
	// env variables are often directly injected into the container/runtime.
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// Default development fallback
		dbURL = "postgres://postgres:postgres@localhost:5432/rideit?sslmode=disable"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	return &Config{
		DatabaseURL: dbURL,
		Port:        port,
	}, nil
}
