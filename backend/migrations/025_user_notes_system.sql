-- User Notes System for Collaborative Communication
-- This migration creates a flexible notes system where users can add notes to any record
-- Migration: 025_user_notes_system.sql

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
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
CREATE INDEX idx_notes_resource ON notes(resource_type, resource_id);
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_notes_important ON notes(is_important) WHERE is_important = true;
CREATE INDEX idx_notes_urgent ON notes(is_urgent) WHERE is_urgent = true;
CREATE INDEX idx_notes_not_deleted ON notes(resource_type, resource_id) WHERE deleted_at IS NULL;

-- Create composite index for common queries
CREATE INDEX idx_notes_resource_created ON notes(resource_type, resource_id, created_at DESC) WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON TABLE notes IS 'User notes system for collaborative communication. Notes can be attached to any resource (patient, consultation, prescription, etc.)';
COMMENT ON COLUMN notes.resource_type IS 'Type of resource this note is attached to (patient, consultation, prescription, etc.)';
COMMENT ON COLUMN notes.resource_id IS 'UUID of the resource this note is attached to';
COMMENT ON COLUMN notes.is_important IS 'Mark note as important for easy filtering';
COMMENT ON COLUMN notes.is_urgent IS 'Mark note as urgent for priority display';
COMMENT ON COLUMN notes.is_private IS 'Private notes are only visible to creator and admins';
COMMENT ON COLUMN notes.tags IS 'Array of tags for categorizing notes';

