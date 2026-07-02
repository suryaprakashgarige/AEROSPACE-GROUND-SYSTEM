-- database/schema.sql

-- Drop tables if they exist
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS telemetry CASCADE;
DROP TABLE IF EXISTS configurations CASCADE;
DROP TABLE IF EXISTS satellites CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table (RBAC)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Administrator', 'Operator', 'Viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Satellites Table
CREATE TABLE satellites (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    launch_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

-- Telemetry Table (Partitioned by range of timestamp in production, standard table here)
CREATE TABLE telemetry (
    id BIGSERIAL PRIMARY KEY,
    satellite_id VARCHAR(50) REFERENCES satellites(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    orbit_number INT NOT NULL,
    temperature NUMERIC(6,2) NOT NULL,
    battery_level NUMERIC(5,2) NOT NULL,
    solar_panel_voltage NUMERIC(5,2) NOT NULL,
    power_consumption NUMERIC(6,2) NOT NULL,
    cpu_usage NUMERIC(5,2) NOT NULL,
    memory_usage NUMERIC(5,2) NOT NULL,
    signal_strength NUMERIC(5,2) NOT NULL,
    altitude NUMERIC(10,2) NOT NULL,
    velocity NUMERIC(6,3) NOT NULL,
    latitude NUMERIC(9,6) NOT NULL,
    longitude NUMERIC(9,6) NOT NULL,
    roll NUMERIC(6,3) NOT NULL,
    pitch NUMERIC(6,3) NOT NULL,
    yaw NUMERIC(6,3) NOT NULL,
    fuel_remaining NUMERIC(5,2) NOT NULL,
    radiation_level NUMERIC(6,2) NOT NULL,
    communication_status VARCHAR(20) NOT NULL,
    gps_lock BOOLEAN NOT NULL,
    health_status VARCHAR(20) NOT NULL,
    error_code INT NOT NULL,
    packet_loss NUMERIC(5,2) NOT NULL,
    uplink_delay INT NOT NULL,
    downlink_delay INT NOT NULL
);

-- Indices for telemetry performance
CREATE INDEX idx_telemetry_sat_time ON telemetry (satellite_id, timestamp DESC);
CREATE INDEX idx_telemetry_time ON telemetry (timestamp DESC);

-- Alerts Table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    satellite_id VARCHAR(50) REFERENCES satellites(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    metric_name VARCHAR(50) NOT NULL,
    metric_value NUMERIC(10,2) NOT NULL,
    threshold_value NUMERIC(10,2) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('Info', 'Warning', 'Critical', 'Emergency')),
    message TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_alerts_resolved ON alerts (resolved);
CREATE INDEX idx_alerts_time ON alerts (timestamp DESC);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target VARCHAR(100) NOT NULL,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System Logs Table
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL,
    log_level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Configurations Table
CREATE TABLE configurations (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);
