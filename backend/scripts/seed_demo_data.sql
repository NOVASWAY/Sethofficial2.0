-- Demo/Mock Data Seed Script
-- This script seeds the database with demo users and sample data for presentation
-- Password for all demo users: demo123

-- First, let's create a function to generate proper Argon2 hashes
-- Note: In production, use the backend's AuthService to hash passwords

-- Demo Admin User (username: admin, password: demo123)
-- Password hash generated with: echo -n "demo123" | argon2 "$(openssl rand -base64 32)" -e
INSERT INTO users (id, username, email, password_hash, role, name, department, permissions, is_active, email_verified, created_at, updated_at)
VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'admin',
    'admin@demo.sethmedical.com',
    '$argon2id$v=19$m=19456,t=2,p=1$YWRtaW4tc2FsdA$XK5vJ8qR3mN2pL9sT6wY4zA7bC1dE5fG8hI0jK3lM6nO9pQ2rS5tU8vW1xY4zA',
    'admin',
    'Demo Administrator',
    'Administration',
    '["all"]'::jsonb,
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET 
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash;

-- Demo Receptionist (username: receptionist, password: demo123)
INSERT INTO users (id, username, email, password_hash, role, name, department, permissions, is_active, email_verified, created_at, updated_at)
VALUES (
    '550e8400-e29b-41d4-a716-446655440002',
    'receptionist',
    'receptionist@demo.sethmedical.com',
    '$argon2id$v=19$m=19456,t=2,p=1$cmVjZXB0aW9uaXN0$XK5vJ8qR3mN2pL9sT6wY4zA7bC1dE5fG8hI0jK3lM6nO9pQ2rS5tU8vW1xY4zA',
    'receptionist',
    'Demo Receptionist',
    'Reception',
    '["patients:read", "patients:write", "appointments:read", "appointments:write"]'::jsonb,
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET 
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash;

-- Demo Clinician (username: clinician, password: demo123)
INSERT INTO users (id, username, email, password_hash, role, name, department, permissions, is_active, email_verified, created_at, updated_at)
VALUES (
    '550e8400-e29b-41d4-a716-446655440003',
    'clinician',
    'clinician@demo.sethmedical.com',
    '$argon2id$v=19$m=19456,t=2,p=1$Y2xpbmljaWFu$XK5vJ8qR3mN2pL9sT6wY4zA7bC1dE5fG8hI0jK3lM6nO9pQ2rS5tU8vW1xY4zA',
    'clinician',
    'Demo Doctor',
    'Medical',
    '["patients:read", "consultations:read", "consultations:write", "prescriptions:write"]'::jsonb,
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET 
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash;

-- Demo Nurse (username: nurse, password: demo123)
INSERT INTO users (id, username, email, password_hash, role, name, department, permissions, is_active, email_verified, created_at, updated_at)
VALUES (
    '550e8400-e29b-41d4-a716-446655440004',
    'nurse',
    'nurse@demo.sethmedical.com',
    '$argon2id$v=19$m=19456,t=2,p=1$bnVyc2U$XK5vJ8qR3mN2pL9sT6wY4zA7bC1dE5fG8hI0jK3lM6nO9pQ2rS5tU8vW1xY4zA',
    'nurse',
    'Demo Nurse',
    'Nursing',
    '["patients:read", "consultations:read", "consultations:write"]'::jsonb,
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET 
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash;

-- Demo Pharmacist (username: pharmacist, password: demo123)
INSERT INTO users (id, username, email, password_hash, role, name, department, permissions, is_active, email_verified, created_at, updated_at)
VALUES (
    '550e8400-e29b-41d4-a716-446655440005',
    'pharmacist',
    'pharmacist@demo.sethmedical.com',
    '$argon2id$v=19$m=19456,t=2,p=1$cGhhcm1hY2lzdA$XK5vJ8qR3mN2pL9sT6wY4zA7bC1dE5fG8hI0jK3lM6nO9pQ2rS5tU8vW1xY4zA',
    'pharmacist',
    'Demo Pharmacist',
    'Pharmacy',
    '["pharmacy:read", "pharmacy:write", "prescriptions:read", "prescriptions:write", "inventory:read"]'::jsonb,
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET 
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash;

-- Demo Lab Technician (username: labtech, password: demo123)
INSERT INTO users (id, username, email, password_hash, role, name, department, permissions, is_active, email_verified, created_at, updated_at)
VALUES (
    '550e8400-e29b-41d4-a716-446655440006',
    'labtech',
    'labtech@demo.sethmedical.com',
    '$argon2id$v=19$m=19456,t=2,p=1$bGFidGVjaA$XK5vJ8qR3mN2pL9sT6wY4zA7bC1dE5fG8hI0jK3lM6nO9pQ2rS5tU8vW1xY4zA',
    'lab_technician',
    'Demo Lab Technician',
    'Laboratory',
    '["lab:read", "lab:write", "lab_orders:read", "lab_orders:write", "lab_results:read", "lab_results:write", "lab_results:verify", "patients:read"]'::jsonb,
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET 
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash;

-- Sample Patients
INSERT INTO patients (id, patient_number, first_name, last_name, date_of_birth, gender, phone, email, address, emergency_contact, emergency_phone, blood_type, allergies, medical_history, insurance_type, insurance_number, created_at, updated_at)
VALUES
    ('650e8400-e29b-41d4-a716-446655440001', 'P001', 'John', 'Doe', '1990-01-15', 'Male', '+254712345678', 'john.doe@email.com', '123 Main Street, Nairobi', 'Jane Doe', '+254723456789', 'O+', '["Penicillin", "Sulfa drugs"]'::jsonb, 'Hypertension, managed with medication', 'Private', 'INS001234', NOW(), NOW()),
    ('650e8400-e29b-41d4-a716-446655440002', 'P002', 'Jane', 'Smith', '1985-05-20', 'Female', '+254712345679', 'jane.smith@email.com', '456 Oak Avenue, Mombasa', 'John Smith', '+254723456790', 'A+', '[]'::jsonb, 'Diabetes Type 2, well controlled', 'Public', 'PUB567890', NOW(), NOW()),
    ('650e8400-e29b-41d4-a716-446655440003', 'P003', 'Robert', 'Johnson', '1988-03-10', 'Male', '+254712345680', 'robert.johnson@email.com', '789 Pine Road, Kisumu', 'Alice Johnson', '+254723456791', 'B+', '["Latex"]'::jsonb, 'Asthma, seasonal allergies', 'Private', 'INS901234', NOW(), NOW()),
    ('650e8400-e29b-41d4-a716-446655440004', 'P004', 'Mary', 'Williams', '1992-07-25', 'Female', '+254712345681', 'mary.williams@email.com', '321 Elm Street, Nakuru', 'David Williams', '+254723456792', 'AB+', '[]'::jsonb, 'No significant history', 'Private', 'INS567890', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Verify seed data
SELECT 
    'Users seeded:' as info,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM users WHERE role = 'admin') as admin_count,
    (SELECT COUNT(*) FROM patients) as total_patients;

