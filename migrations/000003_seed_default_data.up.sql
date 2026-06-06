-- Seed default users for testing
INSERT INTO users (id, name, email, phone, role) VALUES
('00000000-0000-0000-0000-000000000001', 'System Admin', 'admin@rideit.com', '+15550001', 'admin'),
('00000000-0000-0000-0000-000000000002', 'John Doe (Rider)', 'rider@rideit.com', '+15550002', 'rider'),
('00000000-0000-0000-0000-000000000003', 'Alice (Approved Driver)', 'driver1@rideit.com', '+15550003', 'driver'),
('00000000-0000-0000-0000-000000000004', 'Bob (Pending Driver)', 'driver2@rideit.com', '+15550004', 'driver')
ON CONFLICT (id) DO NOTHING;

-- Seed default driver records matching the user accounts
INSERT INTO drivers (id, vehicle_type, vehicle_number, status, base_fare, per_km_rate, vehicle_image, is_approved) VALUES
('00000000-0000-0000-0000-000000000003', 'sedan', 'CAB-1234', 'available', 4.50, 1.80, 'sedan', true),
('00000000-0000-0000-0000-000000000004', 'bike', 'MOTO-5678', 'offline', 2.00, 0.90, 'bike', false)
ON CONFLICT (id) DO NOTHING;
