package db

import (
	"context"
	"fmt"
	"os"

	"github.com/redis/go-redis/v9"
)

// RedisClient wraps the go-redis client.
type RedisClient struct {
	Client *redis.Client
}

// ConnectRedis initializes a Redis client connection based on the REDIS_URL environment variable.
func ConnectRedis(ctx context.Context) (*RedisClient, error) {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		// Default development fallback
		redisURL = "redis://localhost:6379/0"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse redis URL: %w", err)
	}

	client := redis.NewClient(opt)

	// Verify connectivity
	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		return nil, fmt.Errorf("unable to connect to redis: %w", err)
	}

	return &RedisClient{Client: client}, nil
}

// Close gracefully closes the Redis client connection.
func (r *RedisClient) Close() error {
	if r.Client != nil {
		return r.Client.Close()
	}
	return nil
}
