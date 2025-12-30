-- Combined migration file for manual execution
-- Initial database schema for Seth Medical Clinic Management System
-- Migration: 001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    emergency_contact VARCHAR(100),
    emergency_phone VARCHAR(15),
    blood_type VARCHAR(10),
    allergies JSONB DEFAULT '[]',
    medical_history TEXT,
    insurance_type VARCHAR(50),
    insurance_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Consultations table
CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time TIME NOT NULL,
    chief_complaint TEXT NOT NULL,
    diagnosis TEXT,
    treatment_plan TEXT,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time TIME NOT NULL,
    duration INTEGER NOT NULL DEFAULT 30,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Medicines table
CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    generic_name VARCHAR(100) NOT NULL,
    dosage_form VARCHAR(50) NOT NULL,
    strength VARCHAR(50) NOT NULL,
    manufacturer VARCHAR(100) NOT NULL,
    batch_number VARCHAR(50),
    expiry_date DATE,
    current_stock INTEGER NOT NULL DEFAULT 0,
    minimum_stock INTEGER NOT NULL DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    medicines JSONB NOT NULL DEFAULT '[]',
    instructions TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    date DATE NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance (if they don't exist)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patients_patient_number ON patients(patient_number);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patients_name ON patients(first_name, last_name);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_consultations_date ON consultations(date);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON consultations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medicines_updated_at BEFORE UPDATE ON medicines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Audit logs table for tracking all system activities
CREATE TABLE IF NOT EXISTS audit_logs (
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_result ON audit_logs(result);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs(action, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_timestamp ON audit_logs(resource, timestamp);

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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medicines' AND column_name = 'generic_name') THEN
        ALTER TABLE medicines ADD COLUMN generic_name VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medicines' AND column_name = 'category') THEN
        ALTER TABLE medicines ADD COLUMN category VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medicines' AND column_name = 'manufacturer') THEN
        ALTER TABLE medicines ADD COLUMN manufacturer VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medicines' AND column_name = 'batch_number') THEN
        ALTER TABLE medicines ADD COLUMN batch_number VARCHAR(100) UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medicines' AND column_name = 'reorder_level') THEN
        ALTER TABLE medicines ADD COLUMN reorder_level INT NOT NULL DEFAULT 10;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medicines' AND column_name = 'location') THEN
        ALTER TABLE medicines ADD COLUMN location VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medicines' AND column_name = 'description') THEN
        ALTER TABLE medicines ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medicines' AND column_name = 'side_effects') THEN
        ALTER TABLE medicines ADD COLUMN side_effects TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medicines' AND column_name = 'dosage_form') THEN
        ALTER TABLE medicines ADD COLUMN dosage_form VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medicines' AND column_name = 'strength') THEN
        ALTER TABLE medicines ADD COLUMN strength VARCHAR(100);
    END IF;
END $$;

-- Create prescription_items table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS prescription_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES medicines(id),
    quantity INT NOT NULL,
    dosage VARCHAR(255) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration_days INT,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for prescriptions
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinician_id ON prescriptions(clinician_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_date ON prescriptions(prescription_date);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription_id ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_medication_id ON prescription_items(medication_id);

-- Add triggers for updated_at columns
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prescription_items_updated_at BEFORE UPDATE ON prescription_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create system_settings table for configuration
CREATE TABLE IF NOT EXISTS IF NOT EXISTS system_settings (
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
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Add trigger for system_settings updated_at
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Audit Events Table for HIPAA/GDPR Compliance
CREATE TABLE IF NOT EXISTS IF NOT EXISTS audit_events (
    id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    user_id VARCHAR(255),
    user_name VARCHAR(255),
    user_role VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    additional_context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit events for better query performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_events_timestamp ON audit_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_events_user_id ON audit_events (user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_events_event_type ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_events_severity ON audit_events (severity);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_events_resource ON audit_events (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_events_success ON audit_events (success);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_events_session_id ON audit_events (session_id);

-- Compliance Configuration Table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS compliance_config (
    id SERIAL PRIMARY KEY,
    config_type VARCHAR(50) NOT NULL, -- 'hipaa' or 'gdpr'
    config_data JSONB NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    version INTEGER DEFAULT 1
);

-- Data Retention Policies Table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS data_retention_policies (
    id SERIAL PRIMARY KEY,
    policy_name VARCHAR(255) NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    retention_period_days INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'delete', 'anonymize', 'archive'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default data retention policies
INSERT INTO data_retention_policies (policy_name, table_name, retention_period_days, action) VALUES
('Audit Events Retention', 'audit_events', 2555, 'delete'), -- 7 years
('Patient Data Anonymization', 'patients', 2190, 'anonymize'), -- 6 years
('Session Data Retention', 'sessions', 90, 'delete'), -- 3 months
('User Activity Logs', 'user_activities', 365, 'delete') -- 1 year
ON CONFLICT DO NOTHING;

-- Consent Management Table for GDPR
CREATE TABLE IF NOT EXISTS IF NOT EXISTS consent_records (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    consent_type VARCHAR(100) NOT NULL, -- 'data_processing', 'marketing', 'analytics'
    consent_given BOOLEAN NOT NULL,
    consent_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    consent_withdrawn_at TIMESTAMP WITH TIME ZONE,
    consent_method VARCHAR(100), -- 'explicit', 'opt_in', 'opt_out'
    consent_version VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    additional_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for consent records
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_consent_records_user_id ON consent_records (user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_consent_records_type ON consent_records (consent_type);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_consent_records_timestamp ON consent_records (consent_timestamp);

-- Data Breach Incidents Table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS data_breach_incidents (
    id VARCHAR(255) PRIMARY KEY,
    incident_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    affected_data_types TEXT[],
    affected_users_count INTEGER,
    discovered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'investigating', -- 'investigating', 'contained', 'resolved'
    remediation_actions TEXT[],
    regulatory_notification_required BOOLEAN DEFAULT false,
    regulatory_notification_sent_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for data breach incidents
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_breach_incidents_discovered_at ON data_breach_incidents (discovered_at);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_breach_incidents_status ON data_breach_incidents (status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_breach_incidents_severity ON data_breach_incidents (severity);

-- Privacy Impact Assessment Table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS privacy_impact_assessments (
    id VARCHAR(255) PRIMARY KEY,
    assessment_name VARCHAR(255) NOT NULL,
    system_component VARCHAR(255) NOT NULL,
    data_types_processed TEXT[],
    processing_purposes TEXT[],
    legal_basis VARCHAR(100),
    data_subjects_affected INTEGER,
    data_retention_period INTEGER, -- in days
    security_measures TEXT[],
    risk_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high'
    mitigation_measures TEXT[],
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    assessor_name VARCHAR(255),
    approval_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for privacy impact assessments
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_pia_assessment_date ON privacy_impact_assessments (assessment_date);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_pia_risk_level ON privacy_impact_assessments (risk_level);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_pia_approval_status ON privacy_impact_assessments (approval_status);

-- Create a function to automatically log data access events
CREATE OR REPLACE FUNCTION log_data_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the data access event
    INSERT INTO audit_events (
        id, event_type, severity, timestamp, user_id, user_name, user_role,
        resource_type, resource_id, action, description, success
    ) VALUES (
        gen_random_uuid()::text,
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'PatientDataCreated'
            WHEN TG_OP = 'UPDATE' THEN 'PatientDataUpdated'
            WHEN TG_OP = 'DELETE' THEN 'PatientDataDeleted'
            ELSE 'PatientDataAccessed'
        END,
        'Medium',
        CURRENT_TIMESTAMP,
        current_setting('app.current_user_id', true),
        current_setting('app.current_user_name', true),
        current_setting('app.current_user_role', true),
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        'Data ' || TG_OP || ' operation on ' || TG_TABLE_NAME,
        true
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic audit logging on sensitive tables
-- Note: These triggers will be created when the tables exist
-- CREATE TRIGGER audit_patients_trigger
--     AFTER INSERT OR UPDATE OR DELETE ON patients
--     FOR EACH ROW EXECUTE FUNCTION log_data_access();

-- CREATE TRIGGER audit_users_trigger
--     AFTER INSERT OR UPDATE OR DELETE ON users
--     FOR EACH ROW EXECUTE FUNCTION log_data_access();

-- Create a view for compliance dashboard
CREATE OR REPLACE VIEW compliance_dashboard AS
SELECT 
    'audit_events' as metric_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN timestamp >= CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) as last_24h,
    COUNT(CASE WHEN timestamp >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as last_7d,
    COUNT(CASE WHEN severity = 'Critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN severity = 'High' THEN 1 END) as high_count,
    COUNT(CASE WHEN success = false THEN 1 END) as failed_count
FROM audit_events
UNION ALL
SELECT 
    'consent_records' as metric_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN consent_timestamp >= CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) as last_24h,
    COUNT(CASE WHEN consent_timestamp >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as last_7d,
    0 as critical_count,
    0 as high_count,
    COUNT(CASE WHEN consent_given = false THEN 1 END) as failed_count
FROM consent_records
UNION ALL
SELECT 
    'data_breach_incidents' as metric_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN discovered_at >= CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) as last_24h,
    COUNT(CASE WHEN discovered_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as last_7d,
    COUNT(CASE WHEN severity = 'Critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN severity = 'High' THEN 1 END) as high_count,
    COUNT(CASE WHEN status != 'resolved' THEN 1 END) as failed_count
FROM data_breach_incidents;

-- Create a function to check compliance status
CREATE OR REPLACE FUNCTION get_compliance_status()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    audit_count INTEGER;
    consent_count INTEGER;
    breach_count INTEGER;
    pia_count INTEGER;
BEGIN
    -- Get counts
    SELECT COUNT(*) INTO audit_count FROM audit_events WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days';
    SELECT COUNT(*) INTO consent_count FROM consent_records WHERE consent_timestamp >= CURRENT_DATE - INTERVAL '30 days';
    SELECT COUNT(*) INTO breach_count FROM data_breach_incidents WHERE status != 'resolved';
    SELECT COUNT(*) INTO pia_count FROM privacy_impact_assessments WHERE approval_status = 'approved';
    
    -- Build result
    result := jsonb_build_object(
        'audit_events_last_30d', audit_count,
        'consent_records_last_30d', consent_count,
        'unresolved_breaches', breach_count,
        'approved_pias', pia_count,
        'compliance_score', CASE 
            WHEN breach_count = 0 AND pia_count > 0 THEN 95
            WHEN breach_count = 0 THEN 85
            WHEN breach_count <= 2 THEN 70
            ELSE 50
        END,
        'last_updated', CURRENT_TIMESTAMP
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;
-- Create files table for document management
CREATE TABLE IF NOT EXISTS IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'document', 'image', 'report', 'avatar', etc.
    entity_type VARCHAR(50), -- 'patient', 'consultation', 'invoice', 'user', etc.
    entity_id UUID, -- ID of the related entity
    uploaded_by UUID REFERENCES users(id),
    description TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_files_entity_type_id ON files(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_files_file_type ON files(file_type);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_files_created_at ON files(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE FUNCTION update_files_updated_at();
-- Create notification types enum
CREATE TYPE notification_type AS ENUM ('email', 'sms', 'push', 'in_app');

-- Create notification priority enum
CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Create notification status enum
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'cancelled');

-- Create notification template enum
CREATE TYPE notification_template AS ENUM (
    'appointment_reminder',
    'appointment_confirmation',
    'appointment_cancellation',
    'payment_confirmation',
    'payment_reminder',
    'prescription_ready',
    'test_results_ready',
    'welcome_message',
    'password_reset',
    'account_activation',
    'custom'
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),
    notification_type notification_type NOT NULL,
    template notification_template NOT NULL,
    subject VARCHAR(500),
    content TEXT NOT NULL,
    priority notification_priority NOT NULL DEFAULT 'normal',
    status notification_status NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_email ON notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_phone ON notifications(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_template ON notifications(template);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);

-- Create notification settings table for user preferences
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type notification_type NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    sms_enabled BOOLEAN NOT NULL DEFAULT true,
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    in_app_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, notification_type)
);

-- Create indexes for notification settings
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_type ON notification_settings(notification_type);

-- Create notification templates table for customizable templates
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_type notification_template NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject_template TEXT NOT NULL,
    content_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_type, name)
);

-- Create indexes for notification templates
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active);

-- Create notification logs table for audit trail
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'created', 'sent', 'delivered', 'failed', 'retried'
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for notification logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_id ON notification_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_action ON notification_logs(action);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);

-- Create notification queue table for scheduled notifications
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for notification queue
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_retry_count ON notification_queue(retry_count);

-- Create triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_queue_updated_at
    BEFORE UPDATE ON notification_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification templates
INSERT INTO notification_templates (template_type, name, subject_template, content_template, variables) VALUES
('appointment_reminder', 'Default Appointment Reminder', 'Appointment Reminder - {{clinic_name}}', 
'Dear {{patient_name}},

This is a reminder that you have an appointment scheduled for {{appointment_date}} at {{appointment_time}} with Dr. {{doctor_name}}.

Please arrive 15 minutes early.

If you need to reschedule, please contact us at {{clinic_phone}}.

Best regards,
{{clinic_name}}', 
'["patient_name", "appointment_date", "appointment_time", "doctor_name", "clinic_name", "clinic_phone"]'),

('payment_confirmation', 'Default Payment Confirmation', 'Payment Confirmation - {{clinic_name}}',
'Dear {{patient_name}},

Your payment of KES {{amount}} has been received successfully.

Payment Details:
- Invoice: {{invoice_number}}
- Date: {{payment_date}}
- Method: {{payment_method}}

Thank you for your payment.

Best regards,
{{clinic_name}}',
'["patient_name", "amount", "invoice_number", "payment_date", "payment_method", "clinic_name"]'),

('prescription_ready', 'Default Prescription Ready', 'Prescription Ready - {{clinic_name}}',
'Dear {{patient_name}},

Your prescription is ready for collection at our pharmacy.

Prescription Details:
- Doctor: Dr. {{doctor_name}}
- Date: {{prescription_date}}
- Prescription ID: {{prescription_id}}

Please bring a valid ID when collecting.

Best regards,
{{clinic_name}}',
'["patient_name", "doctor_name", "prescription_date", "prescription_id", "clinic_name"]'),

('welcome_message', 'Default Welcome Message', 'Welcome to {{clinic_name}}',
'Dear {{patient_name}},

Welcome to {{clinic_name}}! We''re excited to have you as our patient.

Your account has been created successfully. You can now:
- Book appointments online
- View your medical records
- Receive appointment reminders
- Access your prescriptions

If you have any questions, please don''t hesitate to contact us.

Best regards,
{{clinic_name}} Team',
'["patient_name", "clinic_name"]');

-- Insert default notification settings for existing users
INSERT INTO notification_settings (user_id, notification_type, enabled, email_enabled, sms_enabled, push_enabled, in_app_enabled)
SELECT 
    u.id,
    nt.notification_type,
    true,
    true,
    true,
    true,
    true
FROM users u
CROSS JOIN (
    SELECT unnest(enum_range(NULL::notification_type)) as notification_type
) nt
WHERE NOT EXISTS (
    SELECT 1 FROM notification_settings ns 
    WHERE ns.user_id = u.id AND ns.notification_type = nt.notification_type
);

-- Add comments for documentation
COMMENT ON TABLE notifications IS 'Stores all notification records and their status';
COMMENT ON TABLE notification_settings IS 'User preferences for different notification types';
COMMENT ON TABLE notification_templates IS 'Customizable templates for different notification types';
COMMENT ON TABLE notification_logs IS 'Audit trail for notification actions';
COMMENT ON TABLE notification_queue IS 'Queue for scheduled and retry notifications';

COMMENT ON COLUMN notifications.recipient_id IS 'ID of the user receiving the notification (optional)';
COMMENT ON COLUMN notifications.recipient_email IS 'Email address of the recipient';
COMMENT ON COLUMN notifications.recipient_phone IS 'Phone number of the recipient';
COMMENT ON COLUMN notifications.notification_type IS 'Type of notification (email, sms, push, in_app)';
COMMENT ON COLUMN notifications.template IS 'Template used for the notification';
COMMENT ON COLUMN notifications.priority IS 'Priority level of the notification';
COMMENT ON COLUMN notifications.status IS 'Current status of the notification';
COMMENT ON COLUMN notifications.scheduled_at IS 'When the notification should be sent (for scheduled notifications)';
COMMENT ON COLUMN notifications.sent_at IS 'When the notification was actually sent';
COMMENT ON COLUMN notifications.delivered_at IS 'When the notification was delivered (for trackable notifications)';
COMMENT ON COLUMN notifications.failed_at IS 'When the notification failed to send';
COMMENT ON COLUMN notifications.error_message IS 'Error message if the notification failed';
COMMENT ON COLUMN notifications.metadata IS 'Additional metadata for the notification';
-- Migration: Backup System
-- Description: Creates tables and types for automated backup and recovery system

-- Create backup type enum
CREATE TYPE backup_type AS ENUM (
    'full',
    'incremental', 
    'schema',
    'data'
);

-- Create backup status enum
CREATE TYPE backup_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'cancelled'
);

-- Create backup jobs table
CREATE TABLE IF NOT EXISTS backup_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type backup_type NOT NULL,
    status backup_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    file_path TEXT,
    file_size_bytes BIGINT,
    error_message TEXT,
    created_by UUID REFERENCES users(id),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create backup configuration table
CREATE TABLE IF NOT EXISTS backup_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN NOT NULL DEFAULT true,
    schedule TEXT NOT NULL DEFAULT '0 2 * * *', -- Cron expression
    retention_days INTEGER NOT NULL DEFAULT 30,
    backup_path TEXT NOT NULL DEFAULT './backups',
    compression BOOLEAN NOT NULL DEFAULT true,
    include_files BOOLEAN NOT NULL DEFAULT true,
    max_backup_size_mb BIGINT NOT NULL DEFAULT 1024,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create restore jobs table
CREATE TABLE IF NOT EXISTS restore_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id UUID NOT NULL REFERENCES backup_jobs(id),
    restore_type TEXT NOT NULL, -- 'full', 'schema', 'data', 'files'
    status backup_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create backup schedules table for automated backups
CREATE TABLE IF NOT EXISTS backup_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    backup_type backup_type NOT NULL,
    schedule TEXT NOT NULL, -- Cron expression
    enabled BOOLEAN NOT NULL DEFAULT true,
    retention_days INTEGER NOT NULL DEFAULT 30,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_backup_jobs_status ON backup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_started_at ON backup_jobs(started_at);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_type ON backup_jobs(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_created_by ON backup_jobs(created_by);

CREATE INDEX IF NOT EXISTS idx_restore_jobs_status ON restore_jobs(status);
CREATE INDEX IF NOT EXISTS idx_restore_jobs_backup_id ON restore_jobs(backup_id);
CREATE INDEX IF NOT EXISTS idx_restore_jobs_created_by ON restore_jobs(created_by);

CREATE INDEX IF NOT EXISTS idx_backup_schedules_enabled ON backup_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON backup_schedules(next_run);

-- Insert default backup configuration
INSERT INTO backup_config (enabled, schedule, retention_days, backup_path, compression, include_files, max_backup_size_mb)
VALUES (true, '0 2 * * *', 30, './backups', true, true, 1024);

-- Insert default backup schedules
INSERT INTO backup_schedules (name, backup_type, schedule, enabled, retention_days)
VALUES 
    ('Daily Full Backup', 'full', '0 2 * * *', true, 7),
    ('Weekly Schema Backup', 'schema', '0 3 * * 0', true, 30),
    ('Hourly Incremental Backup', 'incremental', '0 * * * *', false, 1);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_backup_jobs_updated_at
    BEFORE UPDATE ON backup_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backup_config_updated_at
    BEFORE UPDATE ON backup_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restore_jobs_updated_at
    BEFORE UPDATE ON restore_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backup_schedules_updated_at
    BEFORE UPDATE ON backup_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate next backup run time
CREATE OR REPLACE FUNCTION calculate_next_backup_run(schedule_text TEXT, last_run TIMESTAMP WITH TIME ZONE DEFAULT NULL)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    next_run TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Simple implementation - in production, use a proper cron parser
    -- For now, assume daily at 2 AM
    next_run := COALESCE(last_run, NOW()) + INTERVAL '1 day';
    next_run := date_trunc('day', next_run) + INTERVAL '2 hours';
    
    RETURN next_run;
END;
$$ LANGUAGE plpgsql;

-- Create function to get backup statistics
CREATE OR REPLACE FUNCTION get_backup_statistics()
RETURNS TABLE (
    total_backups BIGINT,
    total_size_bytes BIGINT,
    last_backup TIMESTAMP WITH TIME ZONE,
    oldest_backup TIMESTAMP WITH TIME ZONE,
    failed_backups BIGINT,
    successful_backups BIGINT,
    pending_backups BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_backups,
        COALESCE(SUM(file_size_bytes), 0) as total_size_bytes,
        MAX(completed_at) as last_backup,
        MIN(started_at) as oldest_backup,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_backups,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_backups,
        COUNT(*) FILTER (WHERE status = 'pending' OR status = 'in_progress') as pending_backups
    FROM backup_jobs;
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old backups
CREATE OR REPLACE FUNCTION cleanup_old_backups(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM backup_jobs 
    WHERE started_at < NOW() - INTERVAL '1 day' * retention_days 
    AND status = 'completed';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE backup_jobs IS 'Tracks all backup operations and their status';
COMMENT ON TABLE backup_config IS 'Global backup configuration settings';
COMMENT ON TABLE restore_jobs IS 'Tracks restore operations from backups';
COMMENT ON TABLE backup_schedules IS 'Automated backup schedules';

COMMENT ON COLUMN backup_jobs.backup_type IS 'Type of backup: full, incremental, schema, or data only';
COMMENT ON COLUMN backup_jobs.status IS 'Current status of the backup operation';
COMMENT ON COLUMN backup_jobs.file_path IS 'Path to the backup file on disk';
COMMENT ON COLUMN backup_jobs.file_size_bytes IS 'Size of the backup file in bytes';

COMMENT ON COLUMN backup_config.schedule IS 'Cron expression for automated backups';
COMMENT ON COLUMN backup_config.retention_days IS 'Number of days to keep backup files';
COMMENT ON COLUMN backup_config.backup_path IS 'Directory path where backups are stored';

COMMENT ON COLUMN backup_schedules.schedule IS 'Cron expression for this specific schedule';
COMMENT ON COLUMN backup_schedules.next_run IS 'Calculated next run time for this schedule';
-- Monitoring and Logging System Migration
-- This migration creates tables for comprehensive application monitoring, logging, and alerting

-- Create enum types for monitoring system
CREATE TYPE log_level AS ENUM ('trace', 'debug', 'info', 'warn', 'error', 'fatal');
CREATE TYPE health_status AS ENUM ('healthy', 'degraded', 'unhealthy', 'unknown');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE alert_type AS ENUM (
    'system_error', 
    'performance_degradation', 
    'security_violation', 
    'resource_exhaustion', 
    'business_rule_violation', 
    'data_integrity', 
    'external_service_failure'
);

-- Application logs table for structured logging
CREATE TABLE IF NOT EXISTS application_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level log_level NOT NULL,
    message TEXT NOT NULL,
    module VARCHAR(255) NOT NULL,
    function VARCHAR(255),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    trace_id VARCHAR(255),
    span_id VARCHAR(255),
    context JSONB DEFAULT '{}',
    error_details JSONB,
    performance_metrics JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Health checks table for system health monitoring
CREATE TABLE IF NOT EXISTS health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status health_status NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    response_time_ms DECIMAL(10,3) NOT NULL DEFAULT 0,
    last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert configurations table
CREATE TABLE IF NOT EXISTS alert_configs (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    alert_type alert_type NOT NULL,
    severity alert_severity NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    threshold DECIMAL(10,3),
    condition TEXT NOT NULL,
    notification_channels TEXT[] NOT NULL DEFAULT '{}',
    cooldown_minutes INTEGER NOT NULL DEFAULT 15,
    last_triggered TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alerts table for triggered alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id VARCHAR(255) NOT NULL REFERENCES alert_configs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity alert_severity NOT NULL,
    alert_type alert_type NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    context JSONB DEFAULT '{}',
    notifications_sent TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System metrics table for storing historical metrics
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_labels JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance monitoring table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_name VARCHAR(255) NOT NULL,
    duration_ms DECIMAL(10,3) NOT NULL,
    memory_usage_mb DECIMAL(10,3),
    cpu_usage_percent DECIMAL(5,2),
    database_queries INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    context JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log retention policies table
CREATE TABLE IF NOT EXISTS log_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_type VARCHAR(255) NOT NULL,
    retention_days INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_cleanup TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_application_logs_timestamp ON application_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_application_logs_level ON application_logs(level);
CREATE INDEX IF NOT EXISTS idx_application_logs_user_id ON application_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_session_id ON application_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_request_id ON application_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_trace_id ON application_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_module ON application_logs(module);

CREATE INDEX IF NOT EXISTS idx_health_checks_name ON health_checks(name);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_last_checked ON health_checks(last_checked DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_config_id ON alerts(config_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_alert_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_at ON alerts(resolved_at);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged_by ON alerts(acknowledged_by);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_operation ON performance_metrics(operation_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_health_checks_updated_at 
    BEFORE UPDATE ON health_checks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_configs_updated_at 
    BEFORE UPDATE ON alert_configs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at 
    BEFORE UPDATE ON alerts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_log_retention_policies_updated_at 
    BEFORE UPDATE ON log_retention_policies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default alert configurations
INSERT INTO alert_configs (id, name, alert_type, severity, condition, notification_channels, cooldown_minutes) VALUES
('high_error_rate', 'High Error Rate', 'system_error', 'high', 'error_rate > 0.05', ARRAY['email', 'slack'], 15),
('database_connection_failure', 'Database Connection Failure', 'external_service_failure', 'critical', 'database_connections_active == 0', ARRAY['email', 'sms'], 5),
('high_memory_usage', 'High Memory Usage', 'resource_exhaustion', 'medium', 'memory_usage > 0.85', ARRAY['email'], 30),
('slow_response_time', 'Slow Response Time', 'performance_degradation', 'medium', 'avg_response_time > 2000', ARRAY['email'], 20),
('security_violation', 'Security Violation', 'security_violation', 'high', 'security_events > 0', ARRAY['email', 'sms'], 10),
('low_disk_space', 'Low Disk Space', 'resource_exhaustion', 'medium', 'disk_usage > 0.9', ARRAY['email'], 60),
('failed_login_attempts', 'Failed Login Attempts', 'security_violation', 'medium', 'failed_logins > 5', ARRAY['email'], 15),
('data_integrity_issue', 'Data Integrity Issue', 'data_integrity', 'high', 'integrity_errors > 0', ARRAY['email', 'sms'], 5);

-- Insert default log retention policies
INSERT INTO log_retention_policies (log_type, retention_days, enabled) VALUES
('application_logs', 30, true),
('audit_logs', 90, true),
('performance_metrics', 7, true),
('system_metrics', 14, true),
('alerts', 60, true),
('health_checks', 7, true);

-- Create a function to clean up old logs based on retention policies
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
    policy RECORD;
    deleted_count INTEGER := 0;
    total_deleted INTEGER := 0;
BEGIN
    FOR policy IN SELECT * FROM log_retention_policies WHERE enabled = true LOOP
        CASE policy.log_type
            WHEN 'application_logs' THEN
                DELETE FROM application_logs 
                WHERE created_at < NOW() - INTERVAL '1 day' * policy.retention_days;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                
            WHEN 'audit_logs' THEN
                DELETE FROM audit_logs 
                WHERE created_at < NOW() - INTERVAL '1 day' * policy.retention_days;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                
            WHEN 'performance_metrics' THEN
                DELETE FROM performance_metrics 
                WHERE created_at < NOW() - INTERVAL '1 day' * policy.retention_days;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                
            WHEN 'system_metrics' THEN
                DELETE FROM system_metrics 
                WHERE created_at < NOW() - INTERVAL '1 day' * policy.retention_days;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                
            WHEN 'alerts' THEN
                DELETE FROM alerts 
                WHERE created_at < NOW() - INTERVAL '1 day' * policy.retention_days
                AND resolved_at IS NOT NULL;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                
            WHEN 'health_checks' THEN
                DELETE FROM health_checks 
                WHERE created_at < NOW() - INTERVAL '1 day' * policy.retention_days;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
        END CASE;
        
        total_deleted := total_deleted + deleted_count;
        
        -- Update last cleanup time
        UPDATE log_retention_policies 
        SET last_cleanup = NOW() 
        WHERE id = policy.id;
    END LOOP;
    
    RETURN total_deleted;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get system health summary
CREATE OR REPLACE FUNCTION get_system_health_summary()
RETURNS JSON AS $$
DECLARE
    result JSON;
    health_checks JSON;
    overall_status TEXT;
BEGIN
    -- Get latest health checks
    SELECT json_agg(
        json_build_object(
            'name', name,
            'status', status,
            'message', message,
            'response_time_ms', response_time_ms,
            'last_checked', last_checked
        )
    ) INTO health_checks
    FROM health_checks
    WHERE last_checked > NOW() - INTERVAL '5 minutes'
    ORDER BY name;
    
    -- Determine overall status
    SELECT CASE 
        WHEN EXISTS(SELECT 1 FROM health_checks WHERE status = 'unhealthy' AND last_checked > NOW() - INTERVAL '5 minutes') 
        THEN 'unhealthy'
        WHEN EXISTS(SELECT 1 FROM health_checks WHERE status = 'degraded' AND last_checked > NOW() - INTERVAL '5 minutes') 
        THEN 'degraded'
        ELSE 'healthy'
    END INTO overall_status;
    
    result := json_build_object(
        'overall_status', overall_status,
        'health_checks', COALESCE(health_checks, '[]'::json),
        'last_updated', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get log statistics
CREATE OR REPLACE FUNCTION get_log_statistics(hours_back INTEGER DEFAULT 24)
RETURNS JSON AS $$
DECLARE
    result JSON;
    level_stats JSON;
    module_stats JSON;
    error_stats JSON;
BEGIN
    -- Get log level statistics
    SELECT json_object_agg(level::text, count) INTO level_stats
    FROM (
        SELECT level, COUNT(*) as count
        FROM application_logs
        WHERE timestamp > NOW() - INTERVAL '1 hour' * hours_back
        GROUP BY level
        ORDER BY count DESC
    ) stats;
    
    -- Get module statistics
    SELECT json_object_agg(module, count) INTO module_stats
    FROM (
        SELECT module, COUNT(*) as count
        FROM application_logs
        WHERE timestamp > NOW() - INTERVAL '1 hour' * hours_back
        GROUP BY module
        ORDER BY count DESC
        LIMIT 10
    ) stats;
    
    -- Get error statistics
    SELECT json_build_object(
        'total_errors', COUNT(*),
        'unique_errors', COUNT(DISTINCT message),
        'most_common_error', (
            SELECT message 
            FROM application_logs 
            WHERE level IN ('error', 'fatal') 
            AND timestamp > NOW() - INTERVAL '1 hour' * hours_back
            GROUP BY message 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        )
    ) INTO error_stats
    FROM application_logs
    WHERE level IN ('error', 'fatal')
    AND timestamp > NOW() - INTERVAL '1 hour' * hours_back;
    
    result := json_build_object(
        'level_statistics', COALESCE(level_stats, '{}'::json),
        'module_statistics', COALESCE(module_stats, '{}'::json),
        'error_statistics', COALESCE(error_stats, '{}'::json),
        'time_range_hours', hours_back,
        'generated_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a view for recent critical events
CREATE VIEW recent_critical_events AS
SELECT 
    'error' as event_type,
    timestamp,
    level,
    message,
    module,
    user_id,
    context
FROM application_logs
WHERE level IN ('error', 'fatal')
AND timestamp > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
    'alert' as event_type,
    triggered_at as timestamp,
    severity::text as level,
    message,
    'alerting' as module,
    acknowledged_by as user_id,
    context
FROM alerts
WHERE triggered_at > NOW() - INTERVAL '24 hours'
AND resolved_at IS NULL

ORDER BY timestamp DESC;

-- Create a view for system performance summary
CREATE VIEW system_performance_summary AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    COUNT(*) as total_operations,
    AVG(duration_ms) as avg_duration_ms,
    MAX(duration_ms) as max_duration_ms,
    AVG(memory_usage_mb) as avg_memory_mb,
    AVG(cpu_usage_percent) as avg_cpu_percent,
    SUM(database_queries) as total_db_queries,
    SUM(cache_hits) as total_cache_hits,
    SUM(cache_misses) as total_cache_misses
FROM performance_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;

-- Add comments for documentation
COMMENT ON TABLE application_logs IS 'Structured application logs with context and performance metrics';
COMMENT ON TABLE health_checks IS 'System health check results and status';
COMMENT ON TABLE alert_configs IS 'Alert configuration and rules';
COMMENT ON TABLE alerts IS 'Triggered alerts and their status';
COMMENT ON TABLE system_metrics IS 'Historical system metrics data';
COMMENT ON TABLE performance_metrics IS 'Application performance metrics';
COMMENT ON TABLE log_retention_policies IS 'Log retention and cleanup policies';

COMMENT ON FUNCTION cleanup_old_logs() IS 'Cleans up old logs based on retention policies';
COMMENT ON FUNCTION get_system_health_summary() IS 'Returns current system health status';
COMMENT ON FUNCTION get_log_statistics(INTEGER) IS 'Returns log statistics for the specified time range';

COMMENT ON VIEW recent_critical_events IS 'Recent critical events including errors and unresolved alerts';
COMMENT ON VIEW system_performance_summary IS 'Hourly system performance summary';
-- Performance Optimization Indexes
-- This migration adds indexes to improve query performance

-- Patient indexes for search optimization
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patients_first_name ON patients(first_name);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patients_last_name ON patients(last_name);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patients_patient_number ON patients(patient_number);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);

-- Composite index for common patient search pattern
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patients_name_search ON patients USING gin(to_tsvector('english', first_name || ' ' || last_name));

-- Appointment indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_date_time ON appointments(date, time);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_created_at ON appointments(created_at DESC);

-- Composite index for date-based appointment queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_date_status ON appointments(date, status);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- Consultation indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_consultations_consultation_date ON consultations(consultation_date);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_consultations_created_at ON consultations(created_at DESC);

-- Medicine indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medicines_current_stock ON medicines(current_stock);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medicines_minimum_stock ON medicines(minimum_stock);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medicines_expiry_date ON medicines(expiry_date);

-- Composite index for low stock queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medicines_stock_alert ON medicines(current_stock, minimum_stock) WHERE current_stock <= minimum_stock;

-- Prescription indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prescriptions_consultation_id ON prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at DESC);

-- User indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_users_email ON users(email);

-- M-Pesa transaction indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mpesa_transactions_invoice_id ON mpesa_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mpesa_transactions_checkout_request_id ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mpesa_transactions_status ON mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mpesa_transactions_created_at ON mpesa_transactions(created_at DESC);

-- Audit log indexes (if table exists)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);

-- Notifications indexes (if table exists)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- SHA Claims indexes (if table exists)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sha_claims_patient_id ON sha_claims(patient_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sha_claims_invoice_id ON sha_claims(invoice_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sha_claims_status ON sha_claims(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sha_claims_claim_date ON sha_claims(claim_date);

COMMENT ON INDEX idx_patients_name_search IS 'Full-text search index for patient names';
COMMENT ON INDEX idx_medicines_stock_alert IS 'Partial index for low stock alerts - only indexes rows where stock is low';
-- Multi-Factor Authentication (MFA/2FA) System
-- Migration: 009_mfa_system.sql

-- Add MFA columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_method VARCHAR(20), -- 'totp', 'sms', 'email'
ADD COLUMN IF NOT EXISTS mfa_secret TEXT, -- Encrypted TOTP secret
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20), -- For SMS-based MFA
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- MFA recovery codes table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS mfa_recovery_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL, -- Hashed recovery code
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '1 year')
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mfa_recovery_codes_user_id ON mfa_recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mfa_recovery_codes_code_hash ON mfa_recovery_codes(code_hash);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mfa_recovery_codes_unused ON mfa_recovery_codes(user_id, used) WHERE used = false;

-- MFA verification sessions (for temporary sessions after password verification, before MFA)
CREATE TABLE IF NOT EXISTS IF NOT EXISTS mfa_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL, -- Temporary token for MFA verification
    mfa_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    ip_address INET,
    user_agent TEXT,
    verified_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mfa_sessions_token ON mfa_sessions(session_token);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mfa_sessions_user_id ON mfa_sessions(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mfa_sessions_expires_at ON mfa_sessions(expires_at);

-- MFA verification attempts (for rate limiting and security)
CREATE TABLE IF NOT EXISTS IF NOT EXISTS mfa_verification_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255), -- Associated MFA session
    attempt_type VARCHAR(20) NOT NULL, -- 'totp', 'sms', 'recovery_code'
    success BOOLEAN NOT NULL DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mfa_verification_attempts_user_id ON mfa_verification_attempts(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mfa_verification_attempts_session ON mfa_verification_attempts(session_token);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_mfa_verification_attempts_created_at ON mfa_verification_attempts(created_at);

-- Cleanup function for expired MFA sessions (can be called by a scheduled job)
CREATE OR REPLACE FUNCTION cleanup_expired_mfa_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM mfa_sessions WHERE expires_at < NOW();
    DELETE FROM mfa_verification_attempts WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Password Reset System
-- Migration: 010_password_reset_system.sql

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_password_reset_tokens_unused ON password_reset_tokens(user_id, used, expires_at) WHERE used = false;

-- Email verification tokens table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);

-- Cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL '24 hours';
    DELETE FROM email_verification_tokens WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Migration: Import Tracking and Audit Trail
-- Created: 2025-01-XX
-- Description: Add tables for tracking patient import operations, progress, and audit trail

-- Create enum for import status
CREATE TYPE import_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'partial');

-- Import sessions table for tracking import operations
CREATE TABLE IF NOT EXISTS IF NOT EXISTS import_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    total_records INTEGER NOT NULL DEFAULT 0,
    imported_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    status import_status NOT NULL DEFAULT 'pending',
    batch_size INTEGER NOT NULL DEFAULT 100,
    total_batches INTEGER NOT NULL DEFAULT 0,
    current_batch INTEGER NOT NULL DEFAULT 0,
    progress_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_summary JSONB,
    batch_results JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Import audit log table for detailed tracking
CREATE TABLE IF NOT EXISTS IF NOT EXISTS import_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_session_id UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'started', 'batch_completed', 'record_imported', 'record_failed', 'completed', 'cancelled'
    record_index INTEGER,
    record_data JSONB,
    result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'failure', 'skipped', 'duplicate')),
    error_message TEXT,
    error_details JSONB,
    batch_number INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Import statistics table for aggregated metrics
CREATE TABLE IF NOT EXISTS IF NOT EXISTS import_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_session_id UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    metric_unit VARCHAR(50),
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_sessions_user_id ON import_sessions(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_sessions_status ON import_sessions(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_sessions_created_at ON import_sessions(created_at);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_sessions_file_name ON import_sessions(file_name);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_audit_logs_session_id ON import_audit_logs(import_session_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_audit_logs_user_id ON import_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_audit_logs_action ON import_audit_logs(action);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_audit_logs_timestamp ON import_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_audit_logs_result ON import_audit_logs(result);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_statistics_session_id ON import_statistics(import_session_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_statistics_metric_name ON import_statistics(metric_name);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_statistics_recorded_at ON import_statistics(recorded_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_sessions_user_created ON import_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_audit_logs_session_timestamp ON import_audit_logs(import_session_id, timestamp DESC);

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
CREATE TABLE IF NOT EXISTS IF NOT EXISTS lab_test_orders (
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
CREATE TABLE IF NOT EXISTS IF NOT EXISTS lab_test_results (
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
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_orders_patient_id ON lab_test_orders(patient_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_orders_consultation_id ON lab_test_orders(consultation_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_orders_ordering_clinician_id ON lab_test_orders(ordering_clinician_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_orders_status ON lab_test_orders(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_orders_order_number ON lab_test_orders(order_number);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_orders_ordered_at ON lab_test_orders(ordered_at);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_orders_test_type ON lab_test_orders(test_type);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_results_order_id ON lab_test_results(order_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_results_result_number ON lab_test_results(result_number);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_results_status ON lab_test_results(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_results_result_date ON lab_test_results(result_date);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_results_verified_by ON lab_test_results(verified_by);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_results_reviewed_by ON lab_test_results(reviewed_by);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_results_test_type ON lab_test_results(test_type);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_orders_patient_status ON lab_test_orders(patient_id, status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_orders_status_ordered_at ON lab_test_orders(status, ordered_at);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_test_results_order_status ON lab_test_results(order_id, status);

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

-- Migration: Add age column to patients table
-- Created: 2025-01-XX
-- Description: Add age field to patients table and make date_of_birth nullable
-- This allows the system to store only age instead of requiring date_of_birth

-- Add age column to patients table
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS age INTEGER;

-- Make date_of_birth nullable (for backward compatibility with existing data)
ALTER TABLE patients 
ALTER COLUMN date_of_birth DROP NOT NULL;

-- Add index on age for faster queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patients_age ON patients(age);

-- Add comment for documentation
COMMENT ON COLUMN patients.age IS 'Patient age in years. Primary field for age information.';
COMMENT ON COLUMN patients.date_of_birth IS 'Date of birth (optional, deprecated - use age instead)';

-- For existing records, calculate age from date_of_birth if age is NULL
UPDATE patients 
SET age = EXTRACT(YEAR FROM AGE(date_of_birth))
WHERE age IS NULL AND date_of_birth IS NOT NULL;

-- Migration: Add diagnosis fields to invoice_items table
-- Created: 2025-01-XX
-- Description: Add diagnosis_code and diagnosis_description to invoice_items for proper service-diagnosis linkage

-- Add diagnosis fields to invoice_items table
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS diagnosis_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS diagnosis_description VARCHAR(255);

-- Add index for diagnosis queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_invoice_items_diagnosis_code ON invoice_items(diagnosis_code);

-- Add comment
COMMENT ON COLUMN invoice_items.diagnosis_code IS 'ICD-11 diagnosis code linked to this service';
COMMENT ON COLUMN invoice_items.diagnosis_description IS 'Full diagnosis description linked to this service';

-- Migration: Enhance services table for complete pricing
-- Created: 2025-01-XX
-- Description: Add cash_price and nhif_price columns, rename unit_price for clarity

-- Add missing price columns
ALTER TABLE services
ADD COLUMN IF NOT EXISTS cash_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS nhif_price DECIMAL(10,2);

-- If unit_price exists but cash_price doesn't, migrate data
UPDATE services
SET cash_price = unit_price
WHERE cash_price IS NULL AND unit_price IS NOT NULL;

-- Make cash_price NOT NULL (set default if needed)
ALTER TABLE services
ALTER COLUMN cash_price SET DEFAULT 0.00;

-- Update existing records to have cash_price = unit_price if still null
UPDATE services
SET cash_price = COALESCE(unit_price, 0.00)
WHERE cash_price IS NULL;

-- Make cash_price NOT NULL
ALTER TABLE services
ALTER COLUMN cash_price SET NOT NULL;

-- Add requires_prescription field
ALTER TABLE services
ADD COLUMN IF NOT EXISTS requires_prescription BOOLEAN DEFAULT false;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_services_active ON services(is_active);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_services_code ON services(service_code);

-- Add comments
COMMENT ON COLUMN services.cash_price IS 'Price for cash-paying patients';
COMMENT ON COLUMN services.nhif_price IS 'Price for NHIF-insured patients';
COMMENT ON COLUMN services.sha_price IS 'Price for SHA-insured patients';
COMMENT ON COLUMN services.unit_price IS 'Legacy field - use cash_price instead';
COMMENT ON COLUMN services.requires_prescription IS 'Whether this service requires a prescription';

-- User Notes System for Collaborative Communication
-- This migration creates a flexible notes system where users can add notes to any record
-- Migration: 025_user_notes_system.sql

-- Create notes table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type VARCHAR(50) NOT NULL, -- 'patient', 'consultation', 'prescription', 'lab_order', 'invoice', 'appointment', etc.
    resource_id UUID NOT NULL, -- ID of the resource this note is attached to
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_important BOOLEAN DEFAULT false, -- Mark important notes
    is_urgent BOOLEAN DEFAULT false, -- Mark urgent notes
    is_private BOOLEAN DEFAULT false, -- Private notes (only visible to creator and admins)
    tags TEXT[], -- Array of tags for categorization
    metadata JSONB DEFAULT '{}', -- Additional metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notes_resource ON notes(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_important ON notes(is_important) WHERE is_important = true;
CREATE INDEX IF NOT EXISTS idx_notes_urgent ON notes(is_urgent) WHERE is_urgent = true;
CREATE INDEX IF NOT EXISTS idx_notes_not_deleted ON notes(resource_type, resource_id) WHERE deleted_at IS NULL;

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_notes_resource_created ON notes(resource_type, resource_id, created_at DESC) WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON TABLE notes IS 'User notes system for collaborative communication. Notes can be attached to any resource (patient, consultation, prescription, etc.)';
COMMENT ON COLUMN notes.resource_type IS 'Type of resource this note is attached to (patient, consultation, prescription, etc.)';
COMMENT ON COLUMN notes.resource_id IS 'UUID of the resource this note is attached to';
COMMENT ON COLUMN notes.is_important IS 'Mark note as important for easy filtering';
COMMENT ON COLUMN notes.is_urgent IS 'Mark note as urgent for priority display';
COMMENT ON COLUMN notes.is_private IS 'Private notes are only visible to creator and admins';
COMMENT ON COLUMN notes.tags IS 'Array of tags for categorizing notes';

-- Internal Notifications System for Staff Collaboration
-- This migration enhances the notifications table for internal staff notifications
-- Migration: 026_internal_notifications.sql

-- Add columns for internal notifications
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS action_url VARCHAR(500), -- URL to navigate when notification is clicked
ADD COLUMN IF NOT EXISTS action_label VARCHAR(100); -- Label for the action button

-- Add index for unread notifications (most common query)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, is_read, created_at DESC) 
WHERE is_read = false AND recipient_id IS NOT NULL;

-- Add index for internal notifications (in_app type)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notifications_internal ON notifications(recipient_id, notification_type, is_read, created_at DESC)
WHERE notification_type = 'in_app' AND recipient_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN notifications.is_read IS 'Whether the notification has been read by the recipient';
COMMENT ON COLUMN notifications.read_at IS 'Timestamp when the notification was read';
COMMENT ON COLUMN notifications.action_url IS 'URL to navigate to when notification is clicked';
COMMENT ON COLUMN notifications.action_label IS 'Label for the action button (e.g., "View Patient", "Review Lab Result")';

-- Update notification_template enum to include internal notification types
DO $$ 
BEGIN
    -- Add new internal notification templates if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'task_assigned' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_template')) THEN
        ALTER TYPE notification_template ADD VALUE 'task_assigned';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'patient_arrival' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_template')) THEN
        ALTER TYPE notification_template ADD VALUE 'patient_arrival';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'lab_result_ready' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_template')) THEN
        ALTER TYPE notification_template ADD VALUE 'lab_result_ready';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'prescription_ready' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_template')) THEN
        ALTER TYPE notification_template ADD VALUE 'prescription_ready';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'urgent_alert' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_template')) THEN
        ALTER TYPE notification_template ADD VALUE 'urgent_alert';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'system_announcement' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_template')) THEN
        ALTER TYPE notification_template ADD VALUE 'system_announcement';
    END IF;
END $$;

-- Task Assignment System for Multi-User Collaboration
-- This migration creates tables for assigning tasks/patients to users
-- Migration: 027_task_assignment_system.sql

-- Create task status enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled', 'on_hold');
    END IF;
END $$;

-- Create task priority enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'urgent');
    END IF;
END $$;

-- Create task types enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
        CREATE TYPE task_type AS ENUM (
            'patient_consultation',
            'lab_test_review',
            'prescription_dispense',
            'follow_up',
            'documentation',
            'billing',
            'appointment',
            'custom'
        );
    END IF;
END $$;

-- Create tasks table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type task_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status task_status NOT NULL DEFAULT 'pending',
    priority task_priority NOT NULL DEFAULT 'normal',
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Related entity references (flexible linking)
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
    lab_order_id UUID REFERENCES lab_orders(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tasks_status ON tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tasks_priority ON tasks(priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tasks_type ON tasks(task_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tasks_patient_id ON tasks(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tasks_active ON tasks(assigned_to, status, priority, due_date) 
    WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');

-- Create task comments/updates table for collaboration
CREATE TABLE IF NOT EXISTS IF NOT EXISTS task_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    status_change task_status, -- If this update changed the status
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for task updates
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_task_updates_task_id ON task_updates(task_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_task_updates_user_id ON task_updates(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_task_updates_created_at ON task_updates(created_at DESC);

-- Create task assignments history table (for audit trail)
CREATE TABLE IF NOT EXISTS IF NOT EXISTS task_assignments_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    previous_assignee UUID REFERENCES users(id) ON DELETE SET NULL,
    new_assignee UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for task assignments history
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_task_assignments_history_task_id ON task_assignments_history(task_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_task_assignments_history_new_assignee ON task_assignments_history(new_assignee);

-- Create triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_tasks_updated_at();

CREATE TRIGGER update_task_updates_updated_at
    BEFORE UPDATE ON task_updates
    FOR EACH ROW
    EXECUTE FUNCTION update_tasks_updated_at();

-- Add comments for documentation
COMMENT ON TABLE tasks IS 'Tasks assigned to users for collaboration and workflow management';
COMMENT ON TABLE task_updates IS 'Comments and status updates on tasks';
COMMENT ON TABLE task_assignments_history IS 'Audit trail of task assignment changes';

COMMENT ON COLUMN tasks.task_type IS 'Type of task (consultation, lab review, prescription, etc.)';
COMMENT ON COLUMN tasks.assigned_to IS 'User ID of the person assigned to complete this task';
COMMENT ON COLUMN tasks.assigned_by IS 'User ID of the person who created/assigned this task';
COMMENT ON COLUMN tasks.status IS 'Current status of the task';
COMMENT ON COLUMN tasks.priority IS 'Priority level of the task';
COMMENT ON COLUMN tasks.due_date IS 'When the task should be completed';
COMMENT ON COLUMN tasks.patient_id IS 'Related patient (if task is patient-related)';
COMMENT ON COLUMN tasks.consultation_id IS 'Related consultation (if task is consultation-related)';
COMMENT ON COLUMN tasks.prescription_id IS 'Related prescription (if task is prescription-related)';
COMMENT ON COLUMN tasks.lab_order_id IS 'Related lab order (if task is lab-related)';
COMMENT ON COLUMN tasks.invoice_id IS 'Related invoice (if task is billing-related)';
COMMENT ON COLUMN tasks.appointment_id IS 'Related appointment (if task is appointment-related)';

-- Announcements System for System-Wide and Department-Wide Messages
-- This migration creates tables for announcements
-- Migration: 028_announcements_system.sql

-- Create announcement priority enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_priority') THEN
        CREATE TYPE announcement_priority AS ENUM ('low', 'normal', 'high', 'urgent');
    END IF;
END $$;

-- Create announcement status enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_status') THEN
        CREATE TYPE announcement_status AS ENUM ('draft', 'published', 'archived', 'cancelled');
    END IF;
END $$;

-- Create announcement scope enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_scope') THEN
        CREATE TYPE announcement_scope AS ENUM ('system', 'department', 'role', 'custom');
    END IF;
END $$;

-- Create announcements table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority announcement_priority NOT NULL DEFAULT 'normal',
    status announcement_status NOT NULL DEFAULT 'draft',
    scope announcement_scope NOT NULL DEFAULT 'system',
    
    -- Target audience (based on scope)
    target_departments TEXT[], -- For department scope
    target_roles TEXT[], -- For role scope
    target_user_ids UUID[], -- For custom scope
    
    -- Scheduling
    published_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    is_pinned BOOLEAN DEFAULT false,
    requires_acknowledgment BOOLEAN DEFAULT false,
    allow_comments BOOLEAN DEFAULT false,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    
    -- Creator
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create announcement acknowledgments table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS announcement_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(announcement_id, user_id)
);

-- Create announcement comments table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS announcement_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES announcement_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcements_status ON announcements(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcements_scope ON announcements(scope) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcements_published_at ON announcements(published_at DESC) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcements_is_pinned ON announcements(is_pinned) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcements_priority ON announcements(priority) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcements_target_departments ON announcements USING GIN(target_departments) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcements_target_roles ON announcements USING GIN(target_roles) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcements_target_user_ids ON announcements USING GIN(target_user_ids) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcement_acknowledgments_announcement_id ON announcement_acknowledgments(announcement_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcement_acknowledgments_user_id ON announcement_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcement_acknowledgments_acknowledged_at ON announcement_acknowledgments(acknowledged_at DESC);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcement_comments_announcement_id ON announcement_comments(announcement_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcement_comments_user_id ON announcement_comments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcement_comments_parent_comment_id ON announcement_comments(parent_comment_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_announcement_comments_created_at ON announcement_comments(created_at DESC) WHERE deleted_at IS NULL;

-- Create triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

CREATE TRIGGER update_announcement_comments_updated_at
    BEFORE UPDATE ON announcement_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- Add comments for documentation
COMMENT ON TABLE announcements IS 'System-wide and department-wide announcements';
COMMENT ON TABLE announcement_acknowledgments IS 'User acknowledgments of announcements';
COMMENT ON TABLE announcement_comments IS 'Comments on announcements';

COMMENT ON COLUMN announcements.scope IS 'Scope of announcement: system (all users), department, role, or custom';
COMMENT ON COLUMN announcements.target_departments IS 'Target departments (for department scope)';
COMMENT ON COLUMN announcements.target_roles IS 'Target roles (for role scope)';
COMMENT ON COLUMN announcements.target_user_ids IS 'Target user IDs (for custom scope)';
COMMENT ON COLUMN announcements.is_pinned IS 'Whether announcement should be pinned to top';
COMMENT ON COLUMN announcements.requires_acknowledgment IS 'Whether users must acknowledge this announcement';
COMMENT ON COLUMN announcements.allow_comments IS 'Whether users can comment on this announcement';
COMMENT ON COLUMN announcements.published_at IS 'When the announcement was published';
COMMENT ON COLUMN announcements.expires_at IS 'When the announcement expires (optional)';

-- Migration: Add card, bank_transfer, and cheque payment types
-- This allows integration with payment gateways like Stripe, PayPal, etc.

-- Update payment_allocations table to support new payment types
ALTER TABLE payment_allocations 
DROP CONSTRAINT IF EXISTS payment_allocations_payment_type_check;

ALTER TABLE payment_allocations
ADD CONSTRAINT payment_allocations_payment_type_check 
CHECK (payment_type IN ('sha', 'cash', 'mpesa', 'card', 'bank_transfer', 'cheque'));

-- Add payment gateway fields to payment_allocations for card payments
ALTER TABLE payment_allocations
ADD COLUMN IF NOT EXISTS gateway_name VARCHAR(50), -- e.g., 'stripe', 'paypal', 'pesapal'
ADD COLUMN IF NOT EXISTS gateway_transaction_id VARCHAR(255), -- Transaction ID from gateway
ADD COLUMN IF NOT EXISTS gateway_response JSONB, -- Full response from payment gateway
ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4), -- Last 4 digits of card (for display)
ADD COLUMN IF NOT EXISTS card_brand VARCHAR(20), -- e.g., 'visa', 'mastercard'
ADD COLUMN IF NOT EXISTS card_expiry_month INTEGER,
ADD COLUMN IF NOT EXISTS card_expiry_year INTEGER,
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100), -- For bank transfers
ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50), -- For bank transfers
ADD COLUMN IF NOT EXISTS cheque_number VARCHAR(50); -- For cheque payments

-- Create index for gateway transaction lookups
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_payment_allocations_gateway_txn 
ON payment_allocations(gateway_name, gateway_transaction_id);

-- Update financial_transactions to support new payment methods
ALTER TABLE financial_transactions
DROP CONSTRAINT IF EXISTS financial_transactions_payment_method_check;

-- Note: financial_transactions.payment_method is VARCHAR(20) without explicit constraint
-- But we should document the supported values
COMMENT ON COLUMN financial_transactions.payment_method IS 
'Payment method: cash, mpesa, sha, card, bank_transfer, cheque';

-- Create payment gateway settings table (for storing API keys, etc.)
CREATE TABLE IF NOT EXISTS IF NOT EXISTS payment_gateway_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway_name VARCHAR(50) UNIQUE NOT NULL, -- 'stripe', 'paypal', 'pesapal', etc.
    is_enabled BOOLEAN DEFAULT false,
    is_test_mode BOOLEAN DEFAULT true, -- Use test/sandbox mode
    public_key TEXT, -- Public key for frontend
    secret_key_encrypted TEXT, -- Encrypted secret key (never expose to frontend)
    webhook_secret TEXT, -- For verifying webhook calls
    currency VARCHAR(3) DEFAULT 'KES', -- Default currency
    settings JSONB, -- Additional gateway-specific settings
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payment gateway transactions table (for tracking all gateway interactions)
CREATE TABLE IF NOT EXISTS IF NOT EXISTS payment_gateway_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    payment_allocation_id UUID REFERENCES payment_allocations(id) ON DELETE SET NULL,
    gateway_name VARCHAR(50) NOT NULL,
    gateway_transaction_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'pending', 'processing', 'succeeded', 'failed', 'refunded'
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    gateway_response JSONB, -- Full response from gateway
    error_message TEXT, -- Error message if failed
    metadata JSONB, -- Additional metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(gateway_name, gateway_transaction_id)
);

-- Create indexes for payment gateway transactions
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_payment_gateway_txn_invoice 
ON payment_gateway_transactions(invoice_id);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_payment_gateway_txn_status 
ON payment_gateway_transactions(status);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_payment_gateway_txn_created 
ON payment_gateway_transactions(created_at DESC);

COMMENT ON TABLE payment_gateway_settings IS 
'Stores configuration for payment gateways (Stripe, PayPal, Pesapal, etc.)';

COMMENT ON TABLE payment_gateway_transactions IS 
'Tracks all interactions with payment gateways for auditing and reconciliation';

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
-- Enhanced System Schema for Complete Clinic Management System
-- This migration adds missing tables and enhances existing ones

-- Add patient role to user_role enum (for patient portal access)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'patient';

-- Create consultation/visit records table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS consultations (
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
CREATE TABLE IF NOT EXISTS IF NOT EXISTS prescriptions (
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
CREATE TABLE IF NOT EXISTS IF NOT EXISTS services (
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
CREATE TABLE IF NOT EXISTS IF NOT EXISTS stock_movements (
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
CREATE TABLE IF NOT EXISTS IF NOT EXISTS sha_claims (
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
CREATE TABLE IF NOT EXISTS IF NOT EXISTS financial_transactions (
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
CREATE TABLE IF NOT EXISTS IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('service', 'medicine', 'procedure')),
    item_id UUID, -- Reference to service_id or medicine_id
    description VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    sha_covered BOOLEAN DEFAULT false,
    sha_amount DECIMAL(10,2) DEFAULT 0,
    patient_amount DECIMAL(10,2)
);

-- Inventory management enhancements
CREATE TABLE IF NOT EXISTS IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicine_id UUID NOT NULL REFERENCES medicines(id),
    quantity INT NOT NULL,
    adjustment_type VARCHAR(50) NOT NULL, -- 'restock', 'spoilage', 'theft', 'correction', 'dispensed'
    reason TEXT,
    performed_by UUID REFERENCES users(id),
    reference_id UUID, -- e.g., prescription_id or purchase_order_id
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_stock_adjustments_medicine_id ON stock_adjustments(medicine_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_stock_adjustments_created_at ON stock_adjustments(created_at);

-- Stock alerts table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS stock_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicine_id UUID NOT NULL REFERENCES medicines(id),
    alert_type VARCHAR(50) NOT NULL, -- 'low_stock', 'expiring_soon', 'expired'
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create payment allocations table (for mixed payments)
CREATE TABLE IF NOT EXISTS IF NOT EXISTS payment_allocations (
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
CREATE TABLE IF NOT EXISTS IF NOT EXISTS reports (
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
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_clinician_id ON consultations(clinician_id);
CREATE INDEX IF NOT EXISTS idx_consultations_visit_date ON consultations(visit_date);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);

CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation_id ON prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_medication_id ON prescriptions(medication_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_dispensed ON prescriptions(dispensed);

CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_sha_approved ON services(sha_approved);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);

CREATE INDEX IF NOT EXISTS idx_stock_movements_medication_id ON stock_movements(medication_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

CREATE INDEX IF NOT EXISTS idx_sha_claims_patient_id ON sha_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_sha_claims_invoice_id ON sha_claims(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sha_claims_status ON sha_claims(status);
CREATE INDEX IF NOT EXISTS idx_sha_claims_claim_date ON sha_claims(claim_date);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_category ON financial_transactions(category);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_type ON invoice_items(item_type);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id ON payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_type ON payment_allocations(payment_type);

CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports(generated_at);

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

-- Enhanced Dashboard Features Database Schema
-- Migration: 004_enhanced_dashboard_schema.sql
-- Description: Adds tables for user preferences, activity logging, and data isolation

-- User Dashboard Preferences Table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS user_dashboard_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    layout_config JSONB NOT NULL DEFAULT '{}',
    custom_metrics TEXT[] DEFAULT '{}',
    favorite_modules TEXT[] DEFAULT '{}',
    refresh_interval INTEGER DEFAULT 30,
    auto_refresh BOOLEAN DEFAULT true,
    theme VARCHAR(20) DEFAULT 'auto',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- User Activity Logs Table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data Isolation Rules Table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS data_isolation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    filter_rules JSONB NOT NULL DEFAULT '{}',
    permissions JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, entity_type)
);

-- Dashboard Metrics Cache Table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS dashboard_metrics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50),
    department VARCHAR(100),
    metrics_data JSONB NOT NULL DEFAULT '{}',
    cache_key VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cache_key)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_dashboard_preferences_user_id ON user_dashboard_preferences(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_dashboard_preferences_updated_at ON user_dashboard_preferences(updated_at);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_activity_logs_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_activity_logs_module ON user_activity_logs(module);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_activity_logs_entity_type ON user_activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_activity_logs_entity_id ON user_activity_logs(entity_id);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_data_isolation_rules_role ON data_isolation_rules(role);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_data_isolation_rules_entity_type ON data_isolation_rules(entity_type);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_data_isolation_rules_active ON data_isolation_rules(is_active);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_dashboard_metrics_cache_user_id ON dashboard_metrics_cache(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_dashboard_metrics_cache_role ON dashboard_metrics_cache(role);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_dashboard_metrics_cache_department ON dashboard_metrics_cache(department);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_dashboard_metrics_cache_expires_at ON dashboard_metrics_cache(expires_at);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_dashboard_metrics_cache_key ON dashboard_metrics_cache(cache_key);

-- Update Triggers
CREATE OR REPLACE FUNCTION update_user_dashboard_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_dashboard_preferences_updated_at
    BEFORE UPDATE ON user_dashboard_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_dashboard_preferences_updated_at();

CREATE OR REPLACE FUNCTION update_data_isolation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_data_isolation_rules_updated_at
    BEFORE UPDATE ON data_isolation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_data_isolation_rules_updated_at();

-- Insert default data isolation rules
INSERT INTO data_isolation_rules (role, entity_type, filter_rules, permissions) VALUES
('admin', 'patients', '{}', '{"canViewAll": true, "canEditAll": true, "canDeleteAll": true}'),
('admin', 'consultations', '{}', '{"canViewAll": true, "canEditAll": true, "canDeleteAll": true}'),
('admin', 'prescriptions', '{}', '{"canViewAll": true, "canEditAll": true, "canDeleteAll": true}'),
('admin', 'invoices', '{}', '{"canViewAll": true, "canEditAll": true, "canDeleteAll": true}'),

('clinician', 'patients', '{}', '{"canViewAll": false, "canEditOwn": true, "canViewDepartment": true}'),
('clinician', 'consultations', '{"doctor_id": "user_id"}', '{"canViewOwn": true, "canEditOwn": true, "canViewDepartment": true}'),
('clinician', 'prescriptions', '{"prescribed_by": "user_id"}', '{"canViewOwn": true, "canEditOwn": true, "canViewDepartment": true}'),
('clinician', 'invoices', '{}', '{"canViewOwn": true, "canEditOwn": false, "canViewDepartment": true}'),

('nurse', 'patients', '{}', '{"canViewAll": false, "canEditOwn": true, "canViewDepartment": true}'),
('nurse', 'consultations', '{"nurse_id": "user_id"}', '{"canViewOwn": true, "canEditOwn": true, "canViewDepartment": true}'),
('nurse', 'prescriptions', '{}', '{"canViewOwn": true, "canEditOwn": false, "canViewDepartment": true}'),
('nurse', 'invoices', '{}', '{"canViewOwn": true, "canEditOwn": false, "canViewDepartment": true}'),

('pharmacist', 'patients', '{}', '{"canViewAll": false, "canEditOwn": false, "canViewDepartment": true}'),
('pharmacist', 'consultations', '{}', '{"canViewOwn": true, "canEditOwn": false, "canViewDepartment": true}'),
('pharmacist', 'prescriptions', '{"assigned_to": "user_id"}', '{"canViewOwn": true, "canEditOwn": true, "canViewDepartment": true}'),
('pharmacist', 'invoices', '{}', '{"canViewOwn": true, "canEditOwn": false, "canViewDepartment": true}'),

('receptionist', 'patients', '{"created_by": "user_id"}', '{"canViewOwn": true, "canEditOwn": true, "canViewDepartment": true}'),
('receptionist', 'consultations', '{}', '{"canViewOwn": true, "canEditOwn": false, "canViewDepartment": true}'),
('receptionist', 'prescriptions', '{}', '{"canViewOwn": true, "canEditOwn": false, "canViewDepartment": true}'),
('receptionist', 'invoices', '{"created_by": "user_id"}', '{"canViewOwn": true, "canEditOwn": true, "canViewDepartment": true}');

-- Insert default dashboard preferences for existing users
INSERT INTO user_dashboard_preferences (user_id, layout_config, custom_metrics, favorite_modules)
SELECT 
    id,
    '{"layout": "detailed", "defaultView": "overview"}',
    ARRAY['total_patients', 'today_consultations', 'pending_prescriptions'],
    ARRAY['patients', 'consultations', 'billing']
FROM users
WHERE id NOT IN (SELECT user_id FROM user_dashboard_preferences);

-- Clean up expired cache entries function
CREATE OR REPLACE FUNCTION cleanup_expired_dashboard_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM dashboard_metrics_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired cache (if pg_cron is available)
-- SELECT cron.schedule('cleanup-dashboard-cache', '0 */6 * * *', 'SELECT cleanup_expired_dashboard_cache();');

COMMENT ON TABLE user_dashboard_preferences IS 'Stores user-specific dashboard preferences and customization settings';
COMMENT ON TABLE user_activity_logs IS 'Logs all user activities for audit and analytics purposes';
COMMENT ON TABLE data_isolation_rules IS 'Defines data access rules and permissions for different user roles';
COMMENT ON TABLE dashboard_metrics_cache IS 'Caches dashboard metrics for improved performance';
-- Migration: Add M-Pesa transaction tracking
-- Created: 2025-01-03
-- Description: Add tables for M-Pesa STK Push transactions and callbacks

-- Create enum for M-Pesa transaction status
CREATE TYPE mpesa_transaction_status AS ENUM ('Pending', 'Completed', 'Failed', 'Cancelled');

-- Create M-Pesa transactions table
CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    merchant_request_id VARCHAR(255) NOT NULL,
    checkout_request_id VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL, -- Amount in cents
    account_reference VARCHAR(255) NOT NULL,
    transaction_desc TEXT NOT NULL,
    status mpesa_transaction_status NOT NULL DEFAULT 'Pending',
    result_code INTEGER,
    result_desc TEXT,
    mpesa_receipt_number VARCHAR(255),
    transaction_date VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_invoice_id ON mpesa_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout_request_id ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_merchant_request_id ON mpesa_transactions(merchant_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_status ON mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_created_at ON mpesa_transactions(created_at);

-- Create M-Pesa callback logs table for debugging
CREATE TABLE IF NOT EXISTS mpesa_callback_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkout_request_id VARCHAR(255) NOT NULL,
    callback_data JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_status VARCHAR(50) DEFAULT 'Received',
    error_message TEXT
);

-- Create index for callback logs
CREATE INDEX IF NOT EXISTS idx_mpesa_callback_logs_checkout_request_id ON mpesa_callback_logs(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_callback_logs_processed_at ON mpesa_callback_logs(processed_at);

-- Add M-Pesa configuration table
CREATE TABLE IF NOT EXISTS mpesa_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment VARCHAR(20) NOT NULL DEFAULT 'sandbox',
    consumer_key VARCHAR(255) NOT NULL,
    business_short_code VARCHAR(20) NOT NULL,
    callback_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default M-Pesa configuration (sandbox)
INSERT INTO mpesa_config (environment, consumer_key, business_short_code, callback_url) 
VALUES ('sandbox', 'your_sandbox_consumer_key', '174379', 'https://your-domain.com/api/v1/mpesa/callback');

-- Add M-Pesa transaction reference to payments table
ALTER TABLE payments ADD COLUMN mpesa_transaction_id UUID REFERENCES mpesa_transactions(id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mpesa_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for mpesa_transactions
CREATE TRIGGER trigger_update_mpesa_transactions_updated_at
    BEFORE UPDATE ON mpesa_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_transactions_updated_at();

-- Create trigger for mpesa_config
CREATE TRIGGER trigger_update_mpesa_config_updated_at
    BEFORE UPDATE ON mpesa_config
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_transactions_updated_at();

-- Add comments for documentation
COMMENT ON TABLE mpesa_transactions IS 'Stores M-Pesa STK Push transaction details and status';
COMMENT ON TABLE mpesa_callback_logs IS 'Logs all M-Pesa callback requests for debugging and audit';
COMMENT ON TABLE mpesa_config IS 'M-Pesa API configuration settings';

COMMENT ON COLUMN mpesa_transactions.amount IS 'Amount in cents (e.g., 1000 = KES 10.00)';
COMMENT ON COLUMN mpesa_transactions.merchant_request_id IS 'Unique identifier from Safaricom for the transaction request';
COMMENT ON COLUMN mpesa_transactions.checkout_request_id IS 'Unique identifier for the checkout process';
COMMENT ON COLUMN mpesa_transactions.mpesa_receipt_number IS 'M-Pesa receipt number if transaction is successful';
COMMENT ON COLUMN mpesa_transactions.transaction_date IS 'Transaction date from M-Pesa (timestamp format)';
-- Create user_settings table for user-specific settings
CREATE TABLE IF NOT EXISTS IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100),
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure unique key per user
    UNIQUE(user_id, key)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_settings_category ON user_settings(category);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_settings_key ON user_settings(key);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at();
-- M-Pesa (Daraja) settings storage
-- A single-row table to hold current Daraja configuration

CREATE TABLE IF NOT EXISTS IF NOT EXISTS mpesa_settings (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    short_code      TEXT NOT NULL DEFAULT '',
    passkey         TEXT NOT NULL DEFAULT '',
    consumer_key    TEXT NOT NULL DEFAULT '',
    consumer_secret TEXT NOT NULL DEFAULT '',
    environment     TEXT NOT NULL DEFAULT 'sandbox', -- 'sandbox' | 'production'
    stk_callback_url        TEXT NOT NULL DEFAULT '',
    c2b_validation_url      TEXT NOT NULL DEFAULT '',
    c2b_confirmation_url    TEXT NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure the singleton row exists
INSERT INTO mpesa_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'mpesa_settings_set_updated_at'
  ) THEN
    CREATE TRIGGER mpesa_settings_set_updated_at
    BEFORE UPDATE ON mpesa_settings
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
  END IF;
END $$;


-- Safe migration to ensure mpesa_settings exists with required columns

CREATE TABLE IF NOT EXISTS IF NOT EXISTS mpesa_settings (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    short_code      TEXT NOT NULL DEFAULT '',
    passkey         TEXT NOT NULL DEFAULT '',
    consumer_key    TEXT NOT NULL DEFAULT '',
    consumer_secret TEXT NOT NULL DEFAULT '',
    environment     TEXT NOT NULL DEFAULT 'sandbox',
    stk_callback_url        TEXT NOT NULL DEFAULT '',
    c2b_validation_url      TEXT NOT NULL DEFAULT '',
    c2b_confirmation_url    TEXT NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS short_code TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS passkey TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS consumer_key TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS consumer_secret TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS stk_callback_url TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS c2b_validation_url TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS c2b_confirmation_url TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO mpesa_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'mpesa_settings_set_updated_at'
  ) THEN
    CREATE TRIGGER mpesa_settings_set_updated_at
    BEFORE UPDATE ON mpesa_settings
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
  END IF;
END $$;


