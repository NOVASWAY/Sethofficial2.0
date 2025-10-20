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
CREATE TABLE application_logs (
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
CREATE TABLE health_checks (
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
CREATE TABLE alert_configs (
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
CREATE TABLE alerts (
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
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_labels JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance monitoring table
CREATE TABLE performance_metrics (
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
CREATE TABLE log_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_type VARCHAR(255) NOT NULL,
    retention_days INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_cleanup TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_application_logs_timestamp ON application_logs(timestamp DESC);
CREATE INDEX idx_application_logs_level ON application_logs(level);
CREATE INDEX idx_application_logs_user_id ON application_logs(user_id);
CREATE INDEX idx_application_logs_session_id ON application_logs(session_id);
CREATE INDEX idx_application_logs_request_id ON application_logs(request_id);
CREATE INDEX idx_application_logs_trace_id ON application_logs(trace_id);
CREATE INDEX idx_application_logs_module ON application_logs(module);

CREATE INDEX idx_health_checks_name ON health_checks(name);
CREATE INDEX idx_health_checks_status ON health_checks(status);
CREATE INDEX idx_health_checks_last_checked ON health_checks(last_checked DESC);

CREATE INDEX idx_alerts_config_id ON alerts(config_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_alert_type ON alerts(alert_type);
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_resolved_at ON alerts(resolved_at);
CREATE INDEX idx_alerts_acknowledged_by ON alerts(acknowledged_by);

CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp DESC);

CREATE INDEX idx_performance_metrics_operation ON performance_metrics(operation_name);
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX idx_performance_metrics_user_id ON performance_metrics(user_id);

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
