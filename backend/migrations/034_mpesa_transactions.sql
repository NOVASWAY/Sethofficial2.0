-- Migration: Add M-Pesa transaction tracking
-- Created: 2025-01-03
-- Description: Add tables for M-Pesa STK Push transactions and callbacks

-- Create enum for M-Pesa transaction status
CREATE TYPE mpesa_transaction_status AS ENUM ('Pending', 'Completed', 'Failed', 'Cancelled');

-- Create M-Pesa transactions table
CREATE TABLE mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    merchant_request_id VARCHAR(255) NOT NULL,
    checkout_request_id VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL, -- Amount in cents
    account_reference VARCHAR(255) NOT NULL,
    transaction_desc TEXT NOT NULL,
    status mpesa_transaction_status NOT NULL DEFAULT 'Pending',
    result_code INTEGER,
    result_desc TEXT,
    mpesa_receipt_number VARCHAR(255),
    transaction_date VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_mpesa_transactions_invoice_id ON mpesa_transactions(invoice_id);
CREATE INDEX idx_mpesa_transactions_checkout_request_id ON mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_transactions_merchant_request_id ON mpesa_transactions(merchant_request_id);
CREATE INDEX idx_mpesa_transactions_status ON mpesa_transactions(status);
CREATE INDEX idx_mpesa_transactions_created_at ON mpesa_transactions(created_at);

-- Create M-Pesa callback logs table for debugging
CREATE TABLE mpesa_callback_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkout_request_id VARCHAR(255) NOT NULL,
    callback_data JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_status VARCHAR(50) DEFAULT 'Received',
    error_message TEXT
);

-- Create index for callback logs
CREATE INDEX idx_mpesa_callback_logs_checkout_request_id ON mpesa_callback_logs(checkout_request_id);
CREATE INDEX idx_mpesa_callback_logs_processed_at ON mpesa_callback_logs(processed_at);

-- Add M-Pesa configuration table
CREATE TABLE mpesa_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment VARCHAR(20) NOT NULL DEFAULT 'sandbox',
    consumer_key VARCHAR(255) NOT NULL,
    business_short_code VARCHAR(20) NOT NULL,
    callback_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default M-Pesa configuration (sandbox)
INSERT INTO mpesa_config (environment, consumer_key, business_short_code, callback_url) 
VALUES ('sandbox', 'your_sandbox_consumer_key', '174379', 'https://your-domain.com/api/v1/mpesa/callback');

-- Add M-Pesa transaction reference to payments table
ALTER TABLE payments ADD COLUMN mpesa_transaction_id UUID REFERENCES mpesa_transactions(id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mpesa_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for mpesa_transactions
CREATE TRIGGER trigger_update_mpesa_transactions_updated_at
    BEFORE UPDATE ON mpesa_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_transactions_updated_at();

-- Create trigger for mpesa_config
CREATE TRIGGER trigger_update_mpesa_config_updated_at
    BEFORE UPDATE ON mpesa_config
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_transactions_updated_at();

-- Add comments for documentation
COMMENT ON TABLE mpesa_transactions IS 'Stores M-Pesa STK Push transaction details and status';
COMMENT ON TABLE mpesa_callback_logs IS 'Logs all M-Pesa callback requests for debugging and audit';
COMMENT ON TABLE mpesa_config IS 'M-Pesa API configuration settings';

COMMENT ON COLUMN mpesa_transactions.amount IS 'Amount in cents (e.g., 1000 = KES 10.00)';
COMMENT ON COLUMN mpesa_transactions.merchant_request_id IS 'Unique identifier from Safaricom for the transaction request';
COMMENT ON COLUMN mpesa_transactions.checkout_request_id IS 'Unique identifier for the checkout process';
COMMENT ON COLUMN mpesa_transactions.mpesa_receipt_number IS 'M-Pesa receipt number if transaction is successful';
COMMENT ON COLUMN mpesa_transactions.transaction_date IS 'Transaction date from M-Pesa (timestamp format)';
