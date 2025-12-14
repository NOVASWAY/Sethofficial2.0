-- Migration: Add card, bank_transfer, and cheque payment types
-- This allows integration with payment gateways like Stripe, PayPal, etc.

-- Update payment_allocations table to support new payment types
ALTER TABLE payment_allocations 
DROP CONSTRAINT IF EXISTS payment_allocations_payment_type_check;

ALTER TABLE payment_allocations
ADD CONSTRAINT payment_allocations_payment_type_check 
CHECK (payment_type IN ('sha', 'cash', 'mpesa', 'card', 'bank_transfer', 'cheque'));

-- Add payment gateway fields to payment_allocations for card payments
ALTER TABLE payment_allocations
ADD COLUMN IF NOT EXISTS gateway_name VARCHAR(50), -- e.g., 'stripe', 'paypal', 'pesapal'
ADD COLUMN IF NOT EXISTS gateway_transaction_id VARCHAR(255), -- Transaction ID from gateway
ADD COLUMN IF NOT EXISTS gateway_response JSONB, -- Full response from payment gateway
ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4), -- Last 4 digits of card (for display)
ADD COLUMN IF NOT EXISTS card_brand VARCHAR(20), -- e.g., 'visa', 'mastercard'
ADD COLUMN IF NOT EXISTS card_expiry_month INTEGER,
ADD COLUMN IF NOT EXISTS card_expiry_year INTEGER,
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100), -- For bank transfers
ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50), -- For bank transfers
ADD COLUMN IF NOT EXISTS cheque_number VARCHAR(50); -- For cheque payments

-- Create index for gateway transaction lookups
CREATE INDEX IF NOT EXISTS idx_payment_allocations_gateway_txn 
ON payment_allocations(gateway_name, gateway_transaction_id);

-- Update financial_transactions to support new payment methods
ALTER TABLE financial_transactions
DROP CONSTRAINT IF EXISTS financial_transactions_payment_method_check;

-- Note: financial_transactions.payment_method is VARCHAR(20) without explicit constraint
-- But we should document the supported values
COMMENT ON COLUMN financial_transactions.payment_method IS 
'Payment method: cash, mpesa, sha, card, bank_transfer, cheque';

-- Create payment gateway settings table (for storing API keys, etc.)
CREATE TABLE IF NOT EXISTS payment_gateway_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway_name VARCHAR(50) UNIQUE NOT NULL, -- 'stripe', 'paypal', 'pesapal', etc.
    is_enabled BOOLEAN DEFAULT false,
    is_test_mode BOOLEAN DEFAULT true, -- Use test/sandbox mode
    public_key TEXT, -- Public key for frontend
    secret_key_encrypted TEXT, -- Encrypted secret key (never expose to frontend)
    webhook_secret TEXT, -- For verifying webhook calls
    currency VARCHAR(3) DEFAULT 'KES', -- Default currency
    settings JSONB, -- Additional gateway-specific settings
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payment gateway transactions table (for tracking all gateway interactions)
CREATE TABLE IF NOT EXISTS payment_gateway_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    payment_allocation_id UUID REFERENCES payment_allocations(id) ON DELETE SET NULL,
    gateway_name VARCHAR(50) NOT NULL,
    gateway_transaction_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'pending', 'processing', 'succeeded', 'failed', 'refunded'
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    gateway_response JSONB, -- Full response from gateway
    error_message TEXT, -- Error message if failed
    metadata JSONB, -- Additional metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(gateway_name, gateway_transaction_id)
);

-- Create indexes for payment gateway transactions
CREATE INDEX IF NOT EXISTS idx_payment_gateway_txn_invoice 
ON payment_gateway_transactions(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payment_gateway_txn_status 
ON payment_gateway_transactions(status);

CREATE INDEX IF NOT EXISTS idx_payment_gateway_txn_created 
ON payment_gateway_transactions(created_at DESC);

COMMENT ON TABLE payment_gateway_settings IS 
'Stores configuration for payment gateways (Stripe, PayPal, Pesapal, etc.)';

COMMENT ON TABLE payment_gateway_transactions IS 
'Tracks all interactions with payment gateways for auditing and reconciliation';

