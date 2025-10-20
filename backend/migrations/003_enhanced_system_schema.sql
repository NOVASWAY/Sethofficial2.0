-- Enhanced System Schema for Complete Clinic Management System
-- This migration adds missing tables and enhances existing ones

-- Add patient role to user_role enum (for patient portal access)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'patient';

-- Create consultation/visit records table
CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultation_number VARCHAR(20) UNIQUE NOT NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    clinician_id UUID REFERENCES users(id),
    appointment_id UUID REFERENCES appointments(id),
    visit_date DATE NOT NULL,
    visit_time TIME NOT NULL,
    chief_complaint TEXT NOT NULL,
    vital_signs JSONB, -- { temperature, blood_pressure, pulse, weight, height }
    physical_examination TEXT,
    diagnosis TEXT,
    icd_11_codes JSONB, -- Array of ICD-11 diagnostic codes
    treatment_plan TEXT,
    notes TEXT,
    follow_up_date DATE,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_number VARCHAR(20) UNIQUE NOT NULL,
    consultation_id UUID REFERENCES consultations(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    clinician_id UUID REFERENCES users(id),
    medication_id UUID REFERENCES medications(id),
    medication_name VARCHAR(100) NOT NULL,
    dosage VARCHAR(50) NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    duration_days INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    instructions TEXT,
    dispensed BOOLEAN DEFAULT false,
    dispensed_by UUID REFERENCES users(id),
    dispensed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'dispensed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create services/procedures pricing table
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_code VARCHAR(20) UNIQUE NOT NULL,
    service_name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL, -- consultation, lab, imaging, procedure, etc.
    description TEXT,
    unit_price DECIMAL(10,2) NOT NULL,
    sha_approved BOOLEAN DEFAULT false,
    sha_price DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stock movements table (for inventory tracking)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID REFERENCES medications(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'return', 'expired', 'damaged')),
    quantity INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    reference_id UUID, -- Can reference invoice_id, prescription_id, etc.
    reference_type VARCHAR(50), -- 'invoice', 'prescription', 'purchase_order', etc.
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create SHA claims table (for insurance claims management)
CREATE TABLE IF NOT EXISTS sha_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_number VARCHAR(20) UNIQUE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id),
    patient_name VARCHAR(100) NOT NULL,
    patient_sha_number VARCHAR(50) NOT NULL,
    claim_date DATE NOT NULL,
    service_date DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    approved_amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'paid')),
    submission_date DATE,
    approval_date DATE,
    payment_date DATE,
    rejection_reason TEXT,
    documents JSONB, -- Array of uploaded document URLs
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create financial transactions table (for cash flow tracking)
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(20) UNIQUE NOT NULL,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('revenue', 'expense', 'refund', 'adjustment')),
    category VARCHAR(50) NOT NULL, -- patient_payment, salary, supplies, utilities, etc.
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20), -- cash, mpesa, bank_transfer, sha, etc.
    reference_id UUID, -- Can reference invoice_id, expense_id, etc.
    reference_type VARCHAR(50),
    description TEXT NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing invoice_type for mixed payments
ALTER TYPE invoice_type ADD VALUE IF NOT EXISTS 'mixed';

-- Enhance invoices table with consultation reference
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES consultations(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Create invoice_items table (more flexible than invoice_services)
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('service', 'medication', 'procedure')),
    item_id UUID, -- Reference to service_id or medication_id
    description VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    sha_covered BOOLEAN DEFAULT false,
    sha_amount DECIMAL(10,2) DEFAULT 0,
    patient_amount DECIMAL(10,2)
);

-- Create payment allocations table (for mixed payments)
CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('sha', 'cash', 'mpesa')),
    amount DECIMAL(10,2) NOT NULL,
    payment_reference VARCHAR(100),
    payment_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reports metadata table (for storing generated reports)
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type VARCHAR(50) NOT NULL, -- financial, sha_claims, audit, inventory, etc.
    report_name VARCHAR(200) NOT NULL,
    report_period VARCHAR(50), -- daily, weekly, monthly, yearly, custom
    start_date DATE,
    end_date DATE,
    parameters JSONB, -- Filters and parameters used
    file_path VARCHAR(500),
    file_format VARCHAR(20), -- pdf, excel, csv
    generated_by UUID REFERENCES users(id),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for new tables
CREATE INDEX idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX idx_consultations_clinician_id ON consultations(clinician_id);
CREATE INDEX idx_consultations_visit_date ON consultations(visit_date);
CREATE INDEX idx_consultations_status ON consultations(status);

CREATE INDEX idx_prescriptions_consultation_id ON prescriptions(consultation_id);
CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_medication_id ON prescriptions(medication_id);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);
CREATE INDEX idx_prescriptions_dispensed ON prescriptions(dispensed);

CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_sha_approved ON services(sha_approved);
CREATE INDEX idx_services_is_active ON services(is_active);

CREATE INDEX idx_stock_movements_medication_id ON stock_movements(medication_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);

CREATE INDEX idx_sha_claims_patient_id ON sha_claims(patient_id);
CREATE INDEX idx_sha_claims_invoice_id ON sha_claims(invoice_id);
CREATE INDEX idx_sha_claims_status ON sha_claims(status);
CREATE INDEX idx_sha_claims_claim_date ON sha_claims(claim_date);

CREATE INDEX idx_financial_transactions_date ON financial_transactions(transaction_date);
CREATE INDEX idx_financial_transactions_type ON financial_transactions(transaction_type);
CREATE INDEX idx_financial_transactions_category ON financial_transactions(category);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_type ON invoice_items(item_type);

CREATE INDEX idx_payment_allocations_invoice_id ON payment_allocations(invoice_id);
CREATE INDEX idx_payment_allocations_type ON payment_allocations(payment_type);

CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_generated_at ON reports(generated_at);

-- Create triggers for updated_at on new tables
CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON consultations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sha_claims_updated_at BEFORE UPDATE ON sha_claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default services
INSERT INTO services (service_code, service_name, category, unit_price, sha_approved, sha_price) VALUES
('CONSULT-001', 'General Consultation', 'consultation', 500.00, true, 450.00),
('CONSULT-002', 'Specialist Consultation', 'consultation', 1000.00, true, 900.00),
('CONSULT-003', 'Follow-up Visit', 'consultation', 300.00, true, 250.00),
('LAB-001', 'Complete Blood Count', 'laboratory', 800.00, true, 700.00),
('LAB-002', 'Urinalysis', 'laboratory', 400.00, true, 350.00),
('LAB-003', 'Blood Sugar (Random)', 'laboratory', 200.00, true, 180.00),
('PROC-001', 'Wound Dressing', 'procedure', 500.00, true, 400.00),
('PROC-002', 'Injection (IM/IV)', 'procedure', 200.00, true, 150.00),
('IMG-001', 'X-Ray (Single View)', 'imaging', 1500.00, true, 1200.00)
ON CONFLICT (service_code) DO NOTHING;

