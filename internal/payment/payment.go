package payment

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"

	"github.com/google/uuid"
)

// PaymentGateway handles holds and captures.
type PaymentGateway interface {
	CreateAuthorizationHold(ctx context.Context, riderID string, amount float64) (holdID string, err error)
	CapturePayment(ctx context.Context, holdID string, finalAmount float64) error
	RefundHold(ctx context.Context, holdID string) error
}

// HoldRecord logs transaction states in-memory.
type HoldRecord struct {
	RiderID string
	Amount  float64
	Status  string // "authorized", "captured", "refunded"
}

// MockPaymentGateway simulates Stripe/Razorpay payment flows.
type MockPaymentGateway struct {
	holds sync.Map // maps holdID -> *HoldRecord
}

// NewMockPaymentGateway initializes a MockPaymentGateway.
func NewMockPaymentGateway() *MockPaymentGateway {
	return &MockPaymentGateway{}
}

// CreateAuthorizationHold blocks/authorizes the ride fare on booking request.
func (g *MockPaymentGateway) CreateAuthorizationHold(ctx context.Context, riderID string, amount float64) (string, error) {
	holdID := "hold_" + uuid.New().String()
	record := &HoldRecord{
		RiderID: riderID,
		Amount:  amount,
		Status:  "authorized",
	}

	g.holds.Store(holdID, record)
	log.Printf("[Payment] Created Authorization Hold %s for Rider %s. Amount: $%.2f", holdID, riderID, amount)
	return holdID, nil
}

// CapturePayment captures the held funds upon trip completion.
func (g *MockPaymentGateway) CapturePayment(ctx context.Context, holdID string, finalAmount float64) error {
	val, ok := g.holds.Load(holdID)
	if !ok {
		return errors.New("authorization hold not found")
	}

	record := val.(*HoldRecord)
	if record.Status != "authorized" {
		return fmt.Errorf("cannot capture hold. Current status: %s", record.Status)
	}

	// Clean up hold to prevent in-memory map leak
	g.holds.Delete(holdID)

	log.Printf("[Payment] Captured Hold %s for Rider %s. Final Amount: $%.2f", holdID, record.RiderID, finalAmount)
	return nil
}

// RefundHold releases the held authorization if the booking is cancelled.
func (g *MockPaymentGateway) RefundHold(ctx context.Context, holdID string) error {
	val, ok := g.holds.Load(holdID)
	if !ok {
		return errors.New("authorization hold not found")
	}

	record := val.(*HoldRecord)
	if record.Status != "authorized" {
		return fmt.Errorf("cannot refund hold. Current status: %s", record.Status)
	}

	// Clean up hold to prevent in-memory map leak
	g.holds.Delete(holdID)

	log.Printf("[Payment] Released/Refunded Hold %s for Rider %s", holdID, record.RiderID)
	return nil
}
