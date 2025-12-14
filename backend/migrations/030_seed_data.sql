-- Seed data for Seth Medical Clinic Management System
-- Migration: 002_seed_data.sql

-- Insert default users (passwords are hashed versions of username123)
INSERT INTO users (id, username, email, password_hash, role, name, department, permissions, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin', 'admin@clinic.com', '$argon2id$v=19$m=19456,t=2,p=1$dGVzdC1zYWx0$test-hash', 'admin', 'System Administrator', 'Administration', '["all"]', true),
('550e8400-e29b-41d4-a716-446655440002', 'receptionist', 'receptionist@clinic.com', '$argon2id$v=19$m=19456,t=2,p=1$dGVzdC1zYWx0$test-hash', 'receptionist', 'Reception Staff', 'Reception', '["patients:read", "patients:write", "appointments:read", "appointments:write"]', true),
('550e8400-e29b-41d4-a716-446655440003', 'nurse', 'nurse@clinic.com', '$argon2id$v=19$m=19456,t=2,p=1$dGVzdC1zYWx0$test-hash', 'nurse', 'Nursing Staff', 'Nursing', '["patients:read", "consultations:read", "consultations:write"]', true),
('550e8400-e29b-41d4-a716-446655440004', 'clinician', 'clinician@clinic.com', '$argon2id$v=19$m=19456,t=2,p=1$dGVzdC1zYWx0$test-hash', 'clinician', 'Medical Doctor', 'Medical', '["patients:read", "consultations:read", "consultations:write", "prescriptions:write"]', true);

-- Insert sample patients
INSERT INTO patients (id, patient_number, first_name, last_name, date_of_birth, gender, phone, email, address, emergency_contact, emergency_phone, blood_type, allergies, medical_history, insurance_type, insurance_number) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'P001', 'John', 'Doe', '1990-01-01', 'Male', '1234567890', 'john.doe@email.com', '123 Main St, City', 'Jane Doe', '0987654321', 'O+', '["Penicillin"]', 'No significant history', 'Private', 'INS123456'),
('650e8400-e29b-41d4-a716-446655440002', 'P002', 'Jane', 'Smith', '1985-05-15', 'Female', '1234567891', 'jane.smith@email.com', '456 Oak Ave, City', 'John Smith', '0987654322', 'A+', '[]', 'Diabetes Type 2', 'Public', 'PUB789012'),
('650e8400-e29b-41d4-a716-446655440003', 'P003', 'Bob', 'Johnson', '1980-03-20', 'Male', '1234567892', 'bob.johnson@email.com', '789 Pine St, City', 'Alice Johnson', '0987654323', 'B+', '[]', 'Hypertension', 'Private', 'INS345678');

-- Insert sample medicines
INSERT INTO medicines (id, name, generic_name, dosage_form, strength, manufacturer, batch_number, expiry_date, current_stock, minimum_stock, unit_price) VALUES
('750e8400-e29b-41d4-a716-446655440001', 'Paracetamol', 'Acetaminophen', 'Tablet', '500mg', 'PharmaCorp', 'BATCH001', '2025-12-31', 100, 20, 5.50),
('750e8400-e29b-41d4-a716-446655440002', 'Ibuprofen', 'Ibuprofen', 'Tablet', '400mg', 'MediCorp', 'BATCH002', '2025-11-30', 50, 10, 8.75),
('750e8400-e29b-41d4-a716-446655440003', 'Amoxicillin', 'Amoxicillin', 'Capsule', '250mg', 'AntibioCorp', 'BATCH003', '2025-10-15', 75, 15, 12.00);

-- Insert sample consultations
INSERT INTO consultations (id, patient_id, doctor_id, date, time, chief_complaint, diagnosis, treatment_plan, notes, status) VALUES
('850e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', '2024-01-15', '10:00:00', 'Headache', 'Tension headache', 'Rest and pain medication', 'Patient reports stress at work', 'completed'),
('850e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', '2024-01-16', '14:00:00', 'Fever and cough', 'Common cold', 'Rest, fluids, and over-the-counter medication', 'Patient has been symptomatic for 2 days', 'completed');

-- Insert sample appointments
INSERT INTO appointments (id, patient_id, doctor_id, date, time, duration, status, notes) VALUES
('950e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', '2024-01-20', '09:00:00', 30, 'scheduled', 'Follow-up appointment'),
('950e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', '2024-01-25', '11:00:00', 45, 'scheduled', 'Annual checkup');

-- Insert sample prescriptions
INSERT INTO prescriptions (id, patient_id, doctor_id, consultation_id, medicines, instructions, status) VALUES
('a50e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', '850e8400-e29b-41d4-a716-446655440001', '[{"medicine_id": "750e8400-e29b-41d4-a716-446655440001", "medicine_name": "Paracetamol", "dosage": "500mg", "frequency": "Twice daily", "duration": "7 days", "quantity": 14}]', 'Take with food. Complete the full course.', 'active'),
('a50e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', '850e8400-e29b-41d4-a716-446655440002', '[{"medicine_id": "750e8400-e29b-41d4-a716-446655440002", "medicine_name": "Ibuprofen", "dosage": "400mg", "frequency": "Three times daily", "duration": "5 days", "quantity": 15}]', 'Take with food. Do not exceed recommended dose.', 'active');

-- Insert sample invoices
INSERT INTO invoices (id, patient_id, invoice_number, date, items, subtotal, tax_amount, total_amount, payment_status, payment_method) VALUES
('b50e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'INV-2024-001', '2024-01-15', '[{"description": "Consultation Fee", "quantity": 1, "unit_price": 50.00, "total": 50.00}, {"description": "Medication", "quantity": 14, "unit_price": 5.50, "total": 77.00}]', 127.00, 12.70, 139.70, 'paid', 'cash'),
('b50e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', 'INV-2024-002', '2024-01-16', '[{"description": "Follow-up Consultation", "quantity": 1, "unit_price": 30.00, "total": 30.00}]', 30.00, 3.00, 33.00, 'pending', NULL);
