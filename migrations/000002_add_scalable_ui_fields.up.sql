-- Alter cities table to support currency and custom matching range
ALTER TABLE cities ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD' NOT NULL;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS matching_radius_km NUMERIC(5, 2) DEFAULT 5.00 NOT NULL;

-- Alter drivers table to support custom pricing, approval state, and vehicle image
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS base_fare NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS per_km_rate NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_image VARCHAR(255) DEFAULT '' NOT NULL;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false NOT NULL;
