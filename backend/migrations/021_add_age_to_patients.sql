-- Migration: Add age column to patients table
-- Created: 2025-01-XX
-- Description: Add age field to patients table and make date_of_birth nullable
-- This allows the system to store only age instead of requiring date_of_birth

-- Add age column to patients table
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS age INTEGER;

-- Make date_of_birth nullable (for backward compatibility with existing data)
ALTER TABLE patients 
ALTER COLUMN date_of_birth DROP NOT NULL;

-- Add index on age for faster queries
CREATE INDEX IF NOT EXISTS idx_patients_age ON patients(age);

-- Add comment for documentation
COMMENT ON COLUMN patients.age IS 'Patient age in years. Primary field for age information.';
COMMENT ON COLUMN patients.date_of_birth IS 'Date of birth (optional, deprecated - use age instead)';

-- For existing records, calculate age from date_of_birth if age is NULL
UPDATE patients 
SET age = EXTRACT(YEAR FROM AGE(date_of_birth))
WHERE age IS NULL AND date_of_birth IS NOT NULL;

