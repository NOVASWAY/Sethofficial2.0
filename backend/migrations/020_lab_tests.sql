-- Migration: Lab Test Orders and Results
-- Created: 2025-01-XX
-- Description: Add tables for lab test orders and results to support lab technician workflow

-- Create enum for lab test order status
CREATE TYPE lab_order_status AS ENUM ('pending', 'collected', 'in_progress', 'completed', 'cancelled');

-- Create enum for lab test result status
CREATE TYPE lab_result_status AS ENUM ('pending', 'verified', 'reviewed', 'cancelled');

-- Create enum for lab test priority
CREATE TYPE lab_test_priority AS ENUM ('routine', 'urgent', 'stat');

-- Lab test orders table
CREATE TABLE IF NOT EXISTS lab_test_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    ordering_clinician_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    test_type VARCHAR(100) NOT NULL, -- CBC, Urinalysis, Blood Glucose, etc.
    test_code VARCHAR(50), -- LAB_CBC_001, LAB_URINE_001, etc.
    test_name VARCHAR(255) NOT NULL, -- Full test name
    priority lab_test_priority NOT NULL DEFAULT 'routine',
    clinical_indication TEXT,
    sample_type VARCHAR(50), -- blood, urine, stool, etc.
    sample_collection_date TIMESTAMP WITH TIME ZONE,
    status lab_order_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    ordered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    collected_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Lab test results table
CREATE TABLE IF NOT EXISTS lab_test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES lab_test_orders(id) ON DELETE CASCADE,
    result_number VARCHAR(50) UNIQUE NOT NULL,
    test_type VARCHAR(100) NOT NULL,
    test_code VARCHAR(50),
    test_name VARCHAR(255) NOT NULL,
    test_values JSONB NOT NULL, -- Actual test results (varies by test type)
    reference_ranges JSONB, -- Normal ranges for comparison
    abnormal_flags JSONB, -- Which values are abnormal
    result_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    verified_by UUID REFERENCES users(id), -- Lab technician who verified
    verified_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id), -- Clinician who reviewed (optional)
    reviewed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    attachments JSONB, -- Array of file paths/URLs for lab report PDFs
    status lab_result_status NOT NULL DEFAULT 'pending',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_patient_id ON lab_test_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_consultation_id ON lab_test_orders(consultation_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_ordering_clinician_id ON lab_test_orders(ordering_clinician_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_status ON lab_test_orders(status);
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_order_number ON lab_test_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_ordered_at ON lab_test_orders(ordered_at);
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_test_type ON lab_test_orders(test_type);

CREATE INDEX IF NOT EXISTS idx_lab_test_results_order_id ON lab_test_results(order_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_results_result_number ON lab_test_results(result_number);
CREATE INDEX IF NOT EXISTS idx_lab_test_results_status ON lab_test_results(status);
CREATE INDEX IF NOT EXISTS idx_lab_test_results_result_date ON lab_test_results(result_date);
CREATE INDEX IF NOT EXISTS idx_lab_test_results_verified_by ON lab_test_results(verified_by);
CREATE INDEX IF NOT EXISTS idx_lab_test_results_reviewed_by ON lab_test_results(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_lab_test_results_test_type ON lab_test_results(test_type);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_patient_status ON lab_test_orders(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_status_ordered_at ON lab_test_orders(status, ordered_at);
CREATE INDEX IF NOT EXISTS idx_lab_test_results_order_status ON lab_test_results(order_id, status);

-- Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_lab_test_orders_updated_at
    BEFORE UPDATE ON lab_test_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lab_test_results_updated_at
    BEFORE UPDATE ON lab_test_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Note: user_role is VARCHAR(50) in users table, not an enum
-- Lab technician role can be used directly as 'lab_technician' string value

-- Add comments for documentation
COMMENT ON TABLE lab_test_orders IS 'Stores lab test orders placed by clinicians';
COMMENT ON TABLE lab_test_results IS 'Stores lab test results entered by lab technicians';

COMMENT ON COLUMN lab_test_orders.order_number IS 'Unique order number (e.g., LAB-20250115-001)';
COMMENT ON COLUMN lab_test_orders.test_code IS 'Service catalog code (e.g., LAB_CBC_001)';
COMMENT ON COLUMN lab_test_orders.priority IS 'Test priority: routine, urgent, or stat';
COMMENT ON COLUMN lab_test_orders.sample_type IS 'Type of sample: blood, urine, stool, etc.';
COMMENT ON COLUMN lab_test_orders.status IS 'Order status: pending, collected, in_progress, completed, cancelled';

COMMENT ON COLUMN lab_test_results.result_number IS 'Unique result number (e.g., RES-20250115-001)';
COMMENT ON COLUMN lab_test_results.test_values IS 'JSONB object containing actual test values (varies by test type)';
COMMENT ON COLUMN lab_test_results.reference_ranges IS 'JSONB object containing normal reference ranges';
COMMENT ON COLUMN lab_test_results.abnormal_flags IS 'JSONB array of field names that are outside normal range';
COMMENT ON COLUMN lab_test_results.attachments IS 'JSONB array of file paths/URLs for lab report PDFs or images';
COMMENT ON COLUMN lab_test_results.status IS 'Result status: pending, verified, reviewed, cancelled';

