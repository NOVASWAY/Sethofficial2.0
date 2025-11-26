-- Migration: Add diagnosis fields to invoice_items table
-- Created: 2025-01-XX
-- Description: Add diagnosis_code and diagnosis_description to invoice_items for proper service-diagnosis linkage

-- Add diagnosis fields to invoice_items table
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS diagnosis_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS diagnosis_description VARCHAR(255);

-- Add index for diagnosis queries
CREATE INDEX IF NOT EXISTS idx_invoice_items_diagnosis_code ON invoice_items(diagnosis_code);

-- Add comment
COMMENT ON COLUMN invoice_items.diagnosis_code IS 'ICD-11 diagnosis code linked to this service';
COMMENT ON COLUMN invoice_items.diagnosis_description IS 'Full diagnosis description linked to this service';

