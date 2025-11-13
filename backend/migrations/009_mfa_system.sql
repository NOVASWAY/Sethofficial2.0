-- Multi-Factor Authentication (MFA/2FA) System
-- Migration: 009_mfa_system.sql

-- Add MFA columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_method VARCHAR(20), -- 'totp', 'sms', 'email'
ADD COLUMN IF NOT EXISTS mfa_secret TEXT, -- Encrypted TOTP secret
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20), -- For SMS-based MFA
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- MFA recovery codes table
CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL, -- Hashed recovery code
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '1 year')
);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_user_id ON mfa_recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_code_hash ON mfa_recovery_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_unused ON mfa_recovery_codes(user_id, used) WHERE used = false;

-- MFA verification sessions (for temporary sessions after password verification, before MFA)
CREATE TABLE IF NOT EXISTS mfa_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL, -- Temporary token for MFA verification
    mfa_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    ip_address INET,
    user_agent TEXT,
    verified_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_mfa_sessions_token ON mfa_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_user_id ON mfa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_expires_at ON mfa_sessions(expires_at);

-- MFA verification attempts (for rate limiting and security)
CREATE TABLE IF NOT EXISTS mfa_verification_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255), -- Associated MFA session
    attempt_type VARCHAR(20) NOT NULL, -- 'totp', 'sms', 'recovery_code'
    success BOOLEAN NOT NULL DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_verification_attempts_user_id ON mfa_verification_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_verification_attempts_session ON mfa_verification_attempts(session_token);
CREATE INDEX IF NOT EXISTS idx_mfa_verification_attempts_created_at ON mfa_verification_attempts(created_at);

-- Cleanup function for expired MFA sessions (can be called by a scheduled job)
CREATE OR REPLACE FUNCTION cleanup_expired_mfa_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM mfa_sessions WHERE expires_at < NOW();
    DELETE FROM mfa_verification_attempts WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

