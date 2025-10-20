-- Audit logs table for tracking all system activities
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'failure', 'partial')),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(255),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit logs performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_result ON audit_logs(result);

-- Composite indexes for common queries
CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp);
CREATE INDEX idx_audit_logs_action_timestamp ON audit_logs(action, timestamp);
CREATE INDEX idx_audit_logs_resource_timestamp ON audit_logs(resource, timestamp);

-- Add updated_at column to existing tables if not present
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- Add patient_number column to patients table if not present
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'patient_number') THEN
        ALTER TABLE patients ADD COLUMN patient_number VARCHAR(20) UNIQUE;
    END IF;
END $$;

-- Add emergency_contact and emergency_phone to patients table if not present
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'emergency_contact') THEN
        ALTER TABLE patients ADD COLUMN emergency_contact VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'emergency_phone') THEN
        ALTER TABLE patients ADD COLUMN emergency_phone VARCHAR(20);
    END IF;
END $$;

-- Add additional columns to medications table if not present
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'generic_name') THEN
        ALTER TABLE medications ADD COLUMN generic_name VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'category') THEN
        ALTER TABLE medications ADD COLUMN category VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'manufacturer') THEN
        ALTER TABLE medications ADD COLUMN manufacturer VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'batch_number') THEN
        ALTER TABLE medications ADD COLUMN batch_number VARCHAR(100) UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'reorder_level') THEN
        ALTER TABLE medications ADD COLUMN reorder_level INT NOT NULL DEFAULT 10;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'location') THEN
        ALTER TABLE medications ADD COLUMN location VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'description') THEN
        ALTER TABLE medications ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'side_effects') THEN
        ALTER TABLE medications ADD COLUMN side_effects TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'dosage_form') THEN
        ALTER TABLE medications ADD COLUMN dosage_form VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'strength') THEN
        ALTER TABLE medications ADD COLUMN strength VARCHAR(100);
    END IF;
END $$;

-- Create prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    clinician_id UUID NOT NULL REFERENCES users(id),
    prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
    diagnosis TEXT,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create prescription_items table
CREATE TABLE IF NOT EXISTS prescription_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES medications(id),
    quantity INT NOT NULL,
    dosage VARCHAR(255) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration_days INT,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for prescriptions
CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_clinician_id ON prescriptions(clinician_id);
CREATE INDEX idx_prescriptions_date ON prescriptions(prescription_date);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);
CREATE INDEX idx_prescription_items_prescription_id ON prescription_items(prescription_id);
CREATE INDEX idx_prescription_items_medication_id ON prescription_items(medication_id);

-- Add triggers for updated_at columns
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prescription_items_updated_at BEFORE UPDATE ON prescription_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create system_settings table for configuration
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100),
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO system_settings (key, value, description, category) VALUES
('clinic_name', 'Seth Medical Clinic', 'Name of the medical clinic', 'general'),
('clinic_address', '123 Medical Street, Nairobi, Kenya', 'Physical address of the clinic', 'general'),
('clinic_phone', '+254 20 123 4567', 'Main phone number of the clinic', 'general'),
('clinic_email', 'info@sethclinic.com', 'Main email address of the clinic', 'general'),
('business_hours_start', '08:00', 'Business hours start time', 'schedule'),
('business_hours_end', '18:00', 'Business hours end time', 'schedule'),
('appointment_duration', '30', 'Default appointment duration in minutes', 'schedule'),
('tax_rate', '16', 'VAT rate percentage', 'billing'),
('currency', 'KES', 'Default currency code', 'billing'),
('low_stock_threshold', '10', 'Default low stock threshold', 'inventory'),
('session_timeout', '3600', 'Session timeout in seconds', 'security'),
('max_login_attempts', '5', 'Maximum login attempts before lockout', 'security'),
('password_min_length', '8', 'Minimum password length', 'security'),
('audit_retention_days', '365', 'Number of days to retain audit logs', 'audit')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for system_settings
CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_system_settings_key ON system_settings(key);

-- Add trigger for system_settings updated_at
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
