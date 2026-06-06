-- Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create Enums
CREATE TYPE user_role AS ENUM ('rider', 'driver', 'admin');
CREATE TYPE driver_status AS ENUM ('offline', 'available', 'busy');
CREATE TYPE trip_status AS ENUM ('searching', 'accepted', 'arrived', 'en_route', 'completed', 'cancelled');
CREATE TYPE vehicle_type AS ENUM ('bike', 'sedan', 'suv', 'auto');

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Drivers Table (Extension of Users table with driver specific details)
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type vehicle_type NOT NULL,
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    status driver_status DEFAULT 'offline' NOT NULL,
    last_known_lat DOUBLE PRECISION,
    last_known_lng DOUBLE PRECISION,
    last_known_geom GEOMETRY(Point, 4326),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Cities Table (Geofencing Boundaries & Config)
CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    boundary GEOMETRY(Polygon, 4326) NOT NULL,
    base_fare NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    per_km_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    allowed_vehicle_types vehicle_type[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    driver_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
    status trip_status NOT NULL DEFAULT 'searching',
    pickup_lat DOUBLE PRECISION NOT NULL,
    pickup_lng DOUBLE PRECISION NOT NULL,
    pickup_geom GEOMETRY(Point, 4326) NOT NULL,
    dropoff_lat DOUBLE PRECISION NOT NULL,
    dropoff_lng DOUBLE PRECISION NOT NULL,
    dropoff_geom GEOMETRY(Point, 4326) NOT NULL,
    fare NUMERIC(10, 2),
    payment_hold_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for Geospatial Performance (GIST)
CREATE INDEX IF NOT EXISTS idx_cities_boundary ON cities USING gist(boundary);
CREATE INDEX IF NOT EXISTS idx_drivers_last_known_geom ON drivers USING gist(last_known_geom);
CREATE INDEX IF NOT EXISTS idx_trips_pickup_geom ON trips USING gist(pickup_geom);
CREATE INDEX IF NOT EXISTS idx_trips_dropoff_geom ON trips USING gist(dropoff_geom);

-- standard B-Tree indexes for relational queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_trips_rider ON trips(rider_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
