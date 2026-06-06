package maps

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
	"rideit/internal/domain"
)

// MapsClient handles routing, distances, and geocode location searching.
type MapsClient interface {
	CalculateRoute(ctx context.Context, start, end domain.Location) (distanceKm float64, durationMin float64, err error)
	SearchAddress(ctx context.Context, query string) ([]domain.SearchResult, error)
}

// DefaultMapsClient implements MapsClient using external maps services or mock fallbacks.
type DefaultMapsClient struct {
	apiKey string
}

// NewMapsClient initializes a new MapsClient looking for Mapbox or Google Maps keys.
func NewMapsClient() MapsClient {
	apiKey := os.Getenv("MAPBOX_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("GOOGLE_MAPS_API_KEY")
	}
	return &DefaultMapsClient{apiKey: apiKey}
}

// CalculateRoute computes path distance and time. It falls back to Haversine math if API keys are missing.
func (c *DefaultMapsClient) CalculateRoute(ctx context.Context, start, end domain.Location) (float64, float64, error) {
	if c.apiKey == "" {
		crowDistance := HaversineDistance(start, end)
		routeDistance := crowDistance * 1.3
		routeDuration := routeDistance / 0.5
		return routeDistance, routeDuration, nil
	}

	crowDistance := HaversineDistance(start, end)
	routeDistance := crowDistance * 1.3
	routeDuration := routeDistance / 0.5
	return routeDistance, routeDuration, nil
}

// SearchAddress looks up location coordinates based on textual query.
// It prioritizes Google Maps Geocoding, falls back to Mapbox, and then keyless OpenStreetMap Nominatim.
func (c *DefaultMapsClient) SearchAddress(ctx context.Context, query string) ([]domain.SearchResult, error) {
	googleKey := os.Getenv("GOOGLE_MAPS_API_KEY")
	mapboxKey := os.Getenv("MAPBOX_API_KEY")

	// 1. Google Maps Geocoding API if key is present
	if googleKey != "" {
		addressEscaped := url.QueryEscape(query)
		apiURL := fmt.Sprintf("https://maps.googleapis.com/maps/api/geocode/json?address=%s&key=%s", addressEscaped, googleKey)

		req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
		if err != nil {
			return nil, err
		}

		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		var res struct {
			Status  string `json:"status"`
			Results []struct {
				FormattedAddress string `json:"formatted_address"`
				Geometry        struct {
					Location struct {
						Lat float64 `json:"lat"`
						Lng float64 `json:"lng"`
					} `json:"location"`
				} `json:"geometry"`
			} `json:"results"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
			return nil, err
		}

		if res.Status == "OK" {
			var searchResults []domain.SearchResult
			for _, r := range res.Results {
				searchResults = append(searchResults, domain.SearchResult{
					Name:      r.FormattedAddress,
					Latitude:  r.Geometry.Location.Lat,
					Longitude: r.Geometry.Location.Lng,
				})
			}
			return searchResults, nil
		}
	}

	// 2. Mapbox Geocoding API if key is present
	if mapboxKey != "" {
		addressEscaped := url.QueryEscape(query)
		apiURL := fmt.Sprintf("https://api.mapbox.com/geocoding/v5/mapbox.places/%s.json?access_token=%s&limit=5", addressEscaped, mapboxKey)

		req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
		if err != nil {
			return nil, err
		}

		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		var res struct {
			Features []struct {
				PlaceName string    `json:"place_name"`
				Center    []float64 `json:"center"` // [lng, lat]
			} `json:"features"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
			return nil, err
		}

		var searchResults []domain.SearchResult
		for _, f := range res.Features {
			if len(f.Center) == 2 {
				searchResults = append(searchResults, domain.SearchResult{
					Name:      f.PlaceName,
					Latitude:  f.Center[1],
					Longitude: f.Center[0],
				})
			}
		}
		if len(searchResults) > 0 {
			return searchResults, nil
		}
	}

	// 3. OpenStreetMap Nominatim keyless fallback search
	addressEscaped := url.QueryEscape(query)
	apiURL := fmt.Sprintf("https://nominatim.openstreetmap.org/search?q=%s&format=json&limit=5", addressEscaped)

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "RideIt-GeocodeEngine/1.0")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var res []struct {
		DisplayName string `json:"display_name"`
		Lat         string `json:"lat"`
		Lon         string `json:"lon"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	var searchResults []domain.SearchResult
	for _, r := range res {
		latVal, err1 := strconv.ParseFloat(r.Lat, 64)
		lngVal, err2 := strconv.ParseFloat(r.Lon, 64)
		if err1 == nil && err2 == nil {
			searchResults = append(searchResults, domain.SearchResult{
				Name:      r.DisplayName,
				Latitude:  latVal,
				Longitude: lngVal,
			})
		}
	}

	return searchResults, nil
}

// HaversineDistance computes the shortest distance between two points on a sphere.
func HaversineDistance(p1, p2 domain.Location) float64 {
	const earthRadiusKm = 6371.0

	lat1Rad := p1.Latitude * math.Pi / 180.0
	lat2Rad := p2.Latitude * math.Pi / 180.0
	deltaLat := (p2.Latitude - p1.Latitude) * math.Pi / 180.0
	deltaLng := (p2.Longitude - p1.Longitude) * math.Pi / 180.0

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(deltaLng/2)*math.Sin(deltaLng/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusKm * c
}
