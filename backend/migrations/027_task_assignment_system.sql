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
CREATE TABLE IF NOT EXISTS tasks (
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
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_tasks_patient_id ON tasks(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(assigned_to, status, priority, due_date) 
    WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');

-- Create task comments/updates table for collaboration
CREATE TABLE IF NOT EXISTS task_updates (
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
CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON task_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_user_id ON task_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_created_at ON task_updates(created_at DESC);

-- Create task assignments history table (for audit trail)
CREATE TABLE IF NOT EXISTS task_assignments_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    previous_assignee UUID REFERENCES users(id) ON DELETE SET NULL,
    new_assignee UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for task assignments history
CREATE INDEX IF NOT EXISTS idx_task_assignments_history_task_id ON task_assignments_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_history_new_assignee ON task_assignments_history(new_assignee);

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

