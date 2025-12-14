-- Enhanced Dashboard Features Database Schema
-- Migration: 004_enhanced_dashboard_schema.sql
-- Description: Adds tables for user preferences, activity logging, and data isolation

-- User Dashboard Preferences Table
CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
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
CREATE TABLE IF NOT EXISTS user_activity_logs (
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
CREATE TABLE IF NOT EXISTS data_isolation_rules (
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
CREATE TABLE IF NOT EXISTS dashboard_metrics_cache (
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
CREATE INDEX IF NOT EXISTS idx_user_dashboard_preferences_user_id ON user_dashboard_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_preferences_updated_at ON user_dashboard_preferences(updated_at);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_module ON user_activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_entity_type ON user_activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_entity_id ON user_activity_logs(entity_id);

CREATE INDEX IF NOT EXISTS idx_data_isolation_rules_role ON data_isolation_rules(role);
CREATE INDEX IF NOT EXISTS idx_data_isolation_rules_entity_type ON data_isolation_rules(entity_type);
CREATE INDEX IF NOT EXISTS idx_data_isolation_rules_active ON data_isolation_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_cache_user_id ON dashboard_metrics_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_cache_role ON dashboard_metrics_cache(role);
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_cache_department ON dashboard_metrics_cache(department);
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_cache_expires_at ON dashboard_metrics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_cache_key ON dashboard_metrics_cache(cache_key);

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
