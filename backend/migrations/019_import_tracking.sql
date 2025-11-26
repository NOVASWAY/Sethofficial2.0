-- Migration: Import Tracking and Audit Trail
-- Created: 2025-01-XX
-- Description: Add tables for tracking patient import operations, progress, and audit trail

-- Create enum for import status
CREATE TYPE import_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'partial');

-- Import sessions table for tracking import operations
CREATE TABLE IF NOT EXISTS import_sessions (
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
CREATE TABLE IF NOT EXISTS import_audit_logs (
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
CREATE TABLE IF NOT EXISTS import_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_session_id UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    metric_unit VARCHAR(50),
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_sessions_user_id ON import_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON import_sessions(status);
CREATE INDEX IF NOT EXISTS idx_import_sessions_created_at ON import_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_import_sessions_file_name ON import_sessions(file_name);

CREATE INDEX IF NOT EXISTS idx_import_audit_logs_session_id ON import_audit_logs(import_session_id);
CREATE INDEX IF NOT EXISTS idx_import_audit_logs_user_id ON import_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_audit_logs_action ON import_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_import_audit_logs_timestamp ON import_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_import_audit_logs_result ON import_audit_logs(result);

CREATE INDEX IF NOT EXISTS idx_import_statistics_session_id ON import_statistics(import_session_id);
CREATE INDEX IF NOT EXISTS idx_import_statistics_metric_name ON import_statistics(metric_name);
CREATE INDEX IF NOT EXISTS idx_import_statistics_recorded_at ON import_statistics(recorded_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_import_sessions_user_created ON import_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_audit_logs_session_timestamp ON import_audit_logs(import_session_id, timestamp DESC);

