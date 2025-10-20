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
CREATE TABLE notifications (
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
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_recipient_email ON notifications(recipient_email);
CREATE INDEX idx_notifications_recipient_phone ON notifications(recipient_phone);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_template ON notifications(template);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_scheduled_at ON notifications(scheduled_at);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);

-- Create notification settings table for user preferences
CREATE TABLE notification_settings (
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
CREATE INDEX idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX idx_notification_settings_type ON notification_settings(notification_type);

-- Create notification templates table for customizable templates
CREATE TABLE notification_templates (
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
CREATE INDEX idx_notification_templates_type ON notification_templates(template_type);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active);

-- Create notification logs table for audit trail
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'created', 'sent', 'delivered', 'failed', 'retried'
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for notification logs
CREATE INDEX idx_notification_logs_notification_id ON notification_logs(notification_id);
CREATE INDEX idx_notification_logs_action ON notification_logs(action);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);

-- Create notification queue table for scheduled notifications
CREATE TABLE notification_queue (
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
CREATE INDEX idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_retry_count ON notification_queue(retry_count);

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
