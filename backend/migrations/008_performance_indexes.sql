-- Performance Optimization Indexes
-- This migration adds indexes to improve query performance

-- Patient indexes for search optimization
CREATE INDEX IF NOT EXISTS idx_patients_first_name ON patients(first_name);
CREATE INDEX IF NOT EXISTS idx_patients_last_name ON patients(last_name);
CREATE INDEX IF NOT EXISTS idx_patients_patient_number ON patients(patient_number);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);

-- Composite index for common patient search pattern
CREATE INDEX IF NOT EXISTS idx_patients_name_search ON patients USING gin(to_tsvector('english', first_name || ' ' || last_name));

-- Appointment indexes
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(date, time);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at DESC);

-- Composite index for date-based appointment queries
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(date, status);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- Consultation indexes
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_consultation_date ON consultations(consultation_date);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at DESC);

-- Medicine indexes
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_current_stock ON medicines(current_stock);
CREATE INDEX IF NOT EXISTS idx_medicines_minimum_stock ON medicines(minimum_stock);
CREATE INDEX IF NOT EXISTS idx_medicines_expiry_date ON medicines(expiry_date);

-- Composite index for low stock queries
CREATE INDEX IF NOT EXISTS idx_medicines_stock_alert ON medicines(current_stock, minimum_stock) WHERE current_stock <= minimum_stock;

-- Prescription indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation_id ON prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at DESC);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- M-Pesa transaction indexes
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_invoice_id ON mpesa_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout_request_id ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_status ON mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_created_at ON mpesa_transactions(created_at DESC);

-- Audit log indexes (if table exists)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);

-- Notifications indexes (if table exists)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- SHA Claims indexes (if table exists)
CREATE INDEX IF NOT EXISTS idx_sha_claims_patient_id ON sha_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_sha_claims_invoice_id ON sha_claims(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sha_claims_status ON sha_claims(status);
CREATE INDEX IF NOT EXISTS idx_sha_claims_claim_date ON sha_claims(claim_date);

COMMENT ON INDEX idx_patients_name_search IS 'Full-text search index for patient names';
COMMENT ON INDEX idx_medicines_stock_alert IS 'Partial index for low stock alerts - only indexes rows where stock is low';
