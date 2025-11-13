-- Production Seed Data Script
-- This script seeds the database with production-ready initial data
-- Run after migrations: psql -U clinic_user -d clinic_management -f seed_production.sql

-- Seed initial admin user (change password before production!)
-- Password: Admin@123 (change immediately!)
INSERT INTO users (id, username, email, name, role, password_hash, is_active, email_verified, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'admin@sethmedicalclinic.com',
    'System Administrator',
    'admin',
    '$argon2id$v=19$m=65536,t=3,p=4$YourSaltHere$YourHashHere', -- Replace with actual hash
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Seed sample roles/permissions (if using separate permissions table)
-- INSERT INTO permissions (role, permission, created_at)
-- VALUES
--     ('admin', 'all', NOW()),
--     ('clinician', 'patients:read', NOW()),
--     ('clinician', 'patients:write', NOW()),
--     ('nurse', 'patients:read', NOW()),
--     ('pharmacist', 'medicines:read', NOW()),
--     ('pharmacist', 'medicines:write', NOW()),
--     ('receptionist', 'patients:read', NOW()),
--     ('receptionist', 'patients:write', NOW()),
--     ('receptionist', 'appointments:read', NOW()),
--     ('receptionist', 'appointments:write', NOW())
-- ON CONFLICT DO NOTHING;

-- Seed system settings (if using settings table)
-- INSERT INTO settings (key, value, description, created_at, updated_at)
-- VALUES
--     ('system_name', 'Seth Medical Clinic', 'System name', NOW(), NOW()),
--     ('system_version', '2.0.0', 'System version', NOW(), NOW()),
--     ('max_file_size', '10485760', 'Maximum file upload size in bytes', NOW(), NOW()),
--     ('session_timeout', '1800', 'Session timeout in seconds', NOW(), NOW())
-- ON CONFLICT (key) DO NOTHING;

-- Seed sample medicine categories (if using categories)
-- INSERT INTO medicine_categories (id, name, description, created_at)
-- VALUES
--     ('00000000-0000-0000-0000-000000000010', 'Antibiotics', 'Antibiotic medications', NOW()),
--     ('00000000-0000-0000-0000-000000000011', 'Pain Relief', 'Pain relief medications', NOW()),
--     ('00000000-0000-0000-0000-000000000012', 'Vitamins', 'Vitamin supplements', NOW())
-- ON CONFLICT (id) DO NOTHING;

-- Verify seed data
SELECT 
    (SELECT COUNT(*) FROM users WHERE role = 'admin') as admin_users,
    (SELECT COUNT(*) FROM users) as total_users;

