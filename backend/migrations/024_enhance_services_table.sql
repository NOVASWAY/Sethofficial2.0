-- Migration: Enhance services table for complete pricing
-- Created: 2025-01-XX
-- Description: Add cash_price and nhif_price columns, rename unit_price for clarity

-- Add missing price columns
ALTER TABLE services
ADD COLUMN IF NOT EXISTS cash_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS nhif_price DECIMAL(10,2);

-- If unit_price exists but cash_price doesn't, migrate data
UPDATE services
SET cash_price = unit_price
WHERE cash_price IS NULL AND unit_price IS NOT NULL;

-- Make cash_price NOT NULL (set default if needed)
ALTER TABLE services
ALTER COLUMN cash_price SET DEFAULT 0.00;

-- Update existing records to have cash_price = unit_price if still null
UPDATE services
SET cash_price = COALESCE(unit_price, 0.00)
WHERE cash_price IS NULL;

-- Make cash_price NOT NULL
ALTER TABLE services
ALTER COLUMN cash_price SET NOT NULL;

-- Add requires_prescription field
ALTER TABLE services
ADD COLUMN IF NOT EXISTS requires_prescription BOOLEAN DEFAULT false;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_services_code ON services(service_code);

-- Add comments
COMMENT ON COLUMN services.cash_price IS 'Price for cash-paying patients';
COMMENT ON COLUMN services.nhif_price IS 'Price for NHIF-insured patients';
COMMENT ON COLUMN services.sha_price IS 'Price for SHA-insured patients';
COMMENT ON COLUMN services.unit_price IS 'Legacy field - use cash_price instead';
COMMENT ON COLUMN services.requires_prescription IS 'Whether this service requires a prescription';

