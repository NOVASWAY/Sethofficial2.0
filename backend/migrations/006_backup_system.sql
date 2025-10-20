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
CREATE TABLE backup_jobs (
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
CREATE TABLE backup_config (
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
CREATE TABLE restore_jobs (
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
CREATE TABLE backup_schedules (
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
CREATE INDEX idx_backup_jobs_status ON backup_jobs(status);
CREATE INDEX idx_backup_jobs_started_at ON backup_jobs(started_at);
CREATE INDEX idx_backup_jobs_type ON backup_jobs(backup_type);
CREATE INDEX idx_backup_jobs_created_by ON backup_jobs(created_by);

CREATE INDEX idx_restore_jobs_status ON restore_jobs(status);
CREATE INDEX idx_restore_jobs_backup_id ON restore_jobs(backup_id);
CREATE INDEX idx_restore_jobs_created_by ON restore_jobs(created_by);

CREATE INDEX idx_backup_schedules_enabled ON backup_schedules(enabled);
CREATE INDEX idx_backup_schedules_next_run ON backup_schedules(next_run);

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
