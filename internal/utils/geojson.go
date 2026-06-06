package utils

import (
	"errors"
	"fmt"
	"strings"
)

// GeoJSONPolygon represents a GeoJSON Polygon type.
type GeoJSONPolygon struct {
	Type        string         `json:"type"`
	Coordinates [][][2]float64 `json:"coordinates"` // [Polygon][Ring][Coordinate Pair] -> [lng, lat]
}

// ToWKT converts the GeoJSON coordinates into an OGC Well-Known Text (WKT) representation.
func (g *GeoJSONPolygon) ToWKT() (string, error) {
	if g.Type != "Polygon" {
		return "", fmt.Errorf("invalid geometry type: %q. Only 'Polygon' is supported", g.Type)
	}

	if len(g.Coordinates) == 0 {
		return "", errors.New("empty coordinates array in polygon definition")
	}

	var sb strings.Builder
	sb.WriteString("POLYGON(")

	for i, ring := range g.Coordinates {
		if len(ring) < 4 {
			return "", fmt.Errorf("linear ring %d must have at least 4 coordinate pairs to form a closed polygon", i)
		}

		// Verify that the polygon ring loop is properly closed
		first := ring[0]
		last := ring[len(ring)-1]
		if first[0] != last[0] || first[1] != last[1] {
			return "", fmt.Errorf("linear ring %d is not closed: first coordinate (%f, %f) must equal last coordinate (%f, %f)", i, first[0], first[1], last[0], last[1])
		}

		if i > 0 {
			sb.WriteString(",")
		}
		sb.WriteString("(")

		var coords []string
		for _, pair := range ring {
			// GeoJSON specifies [longitude, latitude] matching standard GIS coordinates order (x, y)
			coords = append(coords, fmt.Sprintf("%f %f", pair[0], pair[1]))
		}
		sb.WriteString(strings.Join(coords, ","))
		sb.WriteString(")")
	}

	sb.WriteString(")")
	return sb.String(), nil
}
