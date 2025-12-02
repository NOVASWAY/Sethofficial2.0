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
CREATE TABLE IF NOT EXISTS announcements (
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
CREATE TABLE IF NOT EXISTS announcement_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(announcement_id, user_id)
);

-- Create announcement comments table
CREATE TABLE IF NOT EXISTS announcement_comments (
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
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_scope ON announcements(scope) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON announcements(published_at DESC) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX IF NOT EXISTS idx_announcements_is_pinned ON announcements(is_pinned) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_target_departments ON announcements USING GIN(target_departments) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_target_roles ON announcements USING GIN(target_roles) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_target_user_ids ON announcements USING GIN(target_user_ids) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_announcement_acknowledgments_announcement_id ON announcement_acknowledgments(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_acknowledgments_user_id ON announcement_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_acknowledgments_acknowledged_at ON announcement_acknowledgments(acknowledged_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_comments_announcement_id ON announcement_comments(announcement_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcement_comments_user_id ON announcement_comments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcement_comments_parent_comment_id ON announcement_comments(parent_comment_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcement_comments_created_at ON announcement_comments(created_at DESC) WHERE deleted_at IS NULL;

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

