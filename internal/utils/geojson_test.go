package utils_test

import (
	"rideit/internal/utils"
	"testing"
)

func TestToWKT(t *testing.T) {
	tests := []struct {
		name        string
		input       utils.GeoJSONPolygon
		expectWKT   string
		expectError bool
	}{
		{
			name: "Valid single ring polygon",
			input: utils.GeoJSONPolygon{
				Type: "Polygon",
				Coordinates: [][][2]float64{
					{
						{0.0, 0.0},
						{0.0, 10.0},
						{10.0, 10.0},
						{10.0, 0.0},
						{0.0, 0.0},
					},
				},
			},
			expectWKT:   "POLYGON((0.000000 0.000000,0.000000 10.000000,10.000000 10.000000,10.000000 0.000000,0.000000 0.000000))",
			expectError: false,
		},
		{
			name: "Invalid geometry type",
			input: utils.GeoJSONPolygon{
				Type: "MultiPoint",
				Coordinates: [][][2]float64{
					{{0.0, 0.0}},
				},
			},
			expectError: true,
		},
		{
			name: "Unclosed ring boundary",
			input: utils.GeoJSONPolygon{
				Type: "Polygon",
				Coordinates: [][][2]float64{
					{
						{0.0, 0.0},
						{0.0, 10.0},
						{10.0, 10.0},
						{10.0, 0.0},
						{1.0, 1.0}, // does not close the loop back to (0.0, 0.0)
					},
				},
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := tt.input.ToWKT()
			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error from invalid input, got nil")
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected conversion error: %v", err)
				}
				if res != tt.expectWKT {
					t.Errorf("Expected WKT string %q, got %q", tt.expectWKT, res)
				}
			}
		})
	}
}
