-- Audit Events Table for HIPAA/GDPR Compliance
CREATE TABLE IF NOT EXISTS audit_events (
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
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_severity ON audit_events (severity);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_success ON audit_events (success);
CREATE INDEX IF NOT EXISTS idx_audit_events_session_id ON audit_events (session_id);

-- Compliance Configuration Table
CREATE TABLE IF NOT EXISTS compliance_config (
    id SERIAL PRIMARY KEY,
    config_type VARCHAR(50) NOT NULL, -- 'hipaa' or 'gdpr'
    config_data JSONB NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    version INTEGER DEFAULT 1
);

-- Data Retention Policies Table
CREATE TABLE IF NOT EXISTS data_retention_policies (
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
CREATE TABLE IF NOT EXISTS consent_records (
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
CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON consent_records (user_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_type ON consent_records (consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_records_timestamp ON consent_records (consent_timestamp);

-- Data Breach Incidents Table
CREATE TABLE IF NOT EXISTS data_breach_incidents (
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
CREATE INDEX IF NOT EXISTS idx_breach_incidents_discovered_at ON data_breach_incidents (discovered_at);
CREATE INDEX IF NOT EXISTS idx_breach_incidents_status ON data_breach_incidents (status);
CREATE INDEX IF NOT EXISTS idx_breach_incidents_severity ON data_breach_incidents (severity);

-- Privacy Impact Assessment Table
CREATE TABLE IF NOT EXISTS privacy_impact_assessments (
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
CREATE INDEX IF NOT EXISTS idx_pia_assessment_date ON privacy_impact_assessments (assessment_date);
CREATE INDEX IF NOT EXISTS idx_pia_risk_level ON privacy_impact_assessments (risk_level);
CREATE INDEX IF NOT EXISTS idx_pia_approval_status ON privacy_impact_assessments (approval_status);

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
