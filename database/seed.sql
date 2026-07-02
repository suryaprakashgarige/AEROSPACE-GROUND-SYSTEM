-- database/seed.sql

-- Insert seed users
-- Passwords:
-- admin / admin123  -> $2b$12$E5M.wToxY7/i9J1y3G3h.uFqj7hE.2TzYmK99XWn1k6Z9b8qP4c8W
-- operator / operator123 -> $2b$12$r.z9wV2wW1pA2R7wG3y3h.g6Yg2yW2eTzYmK99XWn1k6Z9b8qP4c8W
-- viewer / viewer123 -> $2b$12$y.z9wV2wW1pA2R7wG3y3h.h6Yg2yW2eTzYmK99XWn1k6Z9b8qP4c8W

INSERT INTO users (username, password_hash, role) VALUES
('admin', '$2b$12$E5M.wToxY7/i9J1y3G3h.uFqj7hE.2TzYmK99XWn1k6Z9b8qP4c8W', 'Administrator'),
('operator', '$2b$12$r.z9wV2wW1pA2R7wG3y3h.g6Yg2yW2eTzYmK99XWn1k6Z9b8qP4c8W', 'Operator'),
('viewer', '$2b$12$y.z9wV2wW1pA2R7wG3y3h.h6Yg2yW2eTzYmK99XWn1k6Z9b8qP4c8W', 'Viewer');

-- Insert seed satellites
INSERT INTO satellites (id, name, type, launch_date, status) VALUES
('SAT-001', 'Solvrex-Aero 1', 'LEO Telemetry', '2024-03-15', 'ACTIVE'),
('SAT-002', 'Solvrex-Aero 2', 'GEO Weather', '2024-11-20', 'ACTIVE'),
('SAT-003', 'Solvrex-Aero 3', 'MEO Navigation', '2025-06-01', 'ACTIVE');

-- Insert default configurations
INSERT INTO configurations (key, value, description) VALUES
('SIMULATION_INTERVAL_SEC', '1', 'Interval in seconds between telemetry generations'),
('BATTERY_LOW_THRESHOLD', '20.0', 'Percentage below which a critical battery alert is generated'),
('TEMP_HIGH_THRESHOLD', '85.0', 'Celsius above which an emergency temperature alert is generated'),
('TEMP_LOW_THRESHOLD', '-40.0', 'Celsius below which a warning temperature alert is generated'),
('CPU_HIGH_THRESHOLD', '90.0', 'Percentage above which a critical CPU alert is generated'),
('SIGNAL_MIN_THRESHOLD', '-110.0', 'dBm below which a critical signal loss alert is generated');

-- Insert default audit log
INSERT INTO audit_logs (user_id, action, target, details) VALUES
(1, 'SYSTEM_INITIALIZATION', 'DATABASE', 'Seeded initial users, satellites, and configurations.');
