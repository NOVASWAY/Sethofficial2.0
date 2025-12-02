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
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, is_read, created_at DESC) 
WHERE is_read = false AND recipient_id IS NOT NULL;

-- Add index for internal notifications (in_app type)
CREATE INDEX IF NOT EXISTS idx_notifications_internal ON notifications(recipient_id, notification_type, is_read, created_at DESC)
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

