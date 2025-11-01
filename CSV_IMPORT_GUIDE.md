# 📥 CSV Patient Import Guide

**Date**: January 2025  
**Status**: ✅ Fully Implemented

---

## Overview

The Clinic Management System includes a comprehensive CSV import feature that allows you to bulk import patient data from CSV files. This is perfect for migrating existing patient records into the system.

---

## How to Access CSV Import

1. Navigate to **Patient Registration** page
2. Click the **"Import Patient Data"** button (with upload icon)
3. A dialog will open with import options

---

## CSV File Format

### Required Columns

| Column Name | Required | Description | Example |
|------------|----------|-------------|---------|
| **Name** | ✅ Yes | Patient's full name (min 2 characters) | `John Doe` |
| **Age** | ❌ Optional | Patient's age | `45` |
| **Location** | ❌ Optional | Patient's address/location | `Nairobi` |
| **OP Number** | ❌ Optional | Outpatient number (supports year suffix) | `123/06` or `789` |
| **Phone Number** | ❌ Optional | Contact phone number | `0712345678` |

### Sample CSV Template

```csv
Name,Age,Location,OP Number,Phone Number
John Doe,45,Nairobi,123/06,0712345678
Mary Smith,32,Kiambu,456/10,0723456789
David Kamau,28,Nakuru,789/15,+254734567890
Sarah Doe,,Nairobi,123/06,
Peter Kamau,35,,,0745678901
Grace Njeri,67,Nyeri,,
```

**Note:** You can download a template CSV file directly from the import dialog.

---

## Smart Features

### 1. **OP Number Parsing**
- Supports OP numbers with year suffix: `789/06` (year 2006)
- Automatic year conversion:
  - `00-30` = `2000-2030`
  - `31-99` = `1931-1999`
- Example: `123/06` → Parsed as year `2006`

### 2. **Shared OP Numbers (Family Members)**
- Multiple patients can share the same OP number
- System automatically adds suffixes: `-A`, `-B`, `-C`, etc.
- Example:
  - First person: `123/06`
  - Second person: `123/06-A`
  - Third person: `123/06-B`

### 3. **Automatic Date of Birth Calculation**
- If age is provided, system calculates approximate date of birth
- Uses January 1st of calculated birth year
- Missing ages default to `1990-01-01`

### 4. **Patient Number Generation**
- If OP number is missing, system generates: `PAT-YYYY-XXXX`
- Format: `PAT-2025-1234` (year + random 4-digit number)

### 5. **Flexible Validation**
- **Only name is required** - all other fields are optional
- Missing data is allowed (marked with default values)
- Data can be updated later after import

---

## Import Process

### Step 1: Prepare Your CSV File
1. Use the template provided (download from import dialog)
2. Fill in patient data following the format
3. Ensure CSV encoding is UTF-8
4. File size limit: 10MB

### Step 2: Upload File
1. Click "Import Patient Data" button
2. Click to upload or drag and drop CSV file
3. System automatically parses the file

### Step 3: Review Preview
The system shows:
- **Valid Records** (green) - Ready to import
- **Records with Errors** (red) - Need fixing (name required)
- **Records with Warnings** (yellow) - Can import but missing data

**Preview shows:**
- Patient name
- Age
- Location
- Original OP Number
- Generated Patient Number
- Phone number
- Any errors or warnings

### Step 4: Import
1. Review all records
2. Fix any errors if needed (or skip invalid records)
3. Click "Import X Valid Records" button
4. System imports all valid records
5. Success notification shows count of imported patients

---

## Validation Rules

### Errors (Prevent Import)
- **Name missing or too short** (< 2 characters)
  - Fix: Add valid patient name

### Warnings (Allow Import)
- **Age missing** - Will use default date of birth
- **Location missing** - Will be marked "Not specified"
- **Phone number missing** - Will be marked "Not provided"
- **Invalid phone format** - Can still import (update later)
- **Shared OP number** - System handles with suffixes
- **OP number missing** - System generates new patient number
- **Age out of range** (> 150 years) - Still imports with warning

---

## What Happens After Import?

1. **Data Storage**
   - ✅ **Patients saved directly to backend database** (PostgreSQL)
   - ✅ **Data persisted in database** - not lost on logout
   - ✅ **Immediately searchable** from any device/session
   - ✅ **Data syncs automatically** - frontend reloads after import

2. **Backend API** ✅ **FULLY CONNECTED**
   - ✅ Endpoint: `POST /api/patients/import`
   - ✅ Validates and saves each patient to database
   - ✅ Returns import results (success/failure counts)
   - ✅ Handles errors gracefully (continues importing even if some fail)

3. **Patient Numbers**
   - Unique patient numbers assigned (or preserved from OP numbers)
   - OP numbers preserved when provided in CSV
   - Shared OP numbers get suffixes (-A, -B, etc.)

---

## Backend API Endpoint

**Endpoint:** `POST /api/patients/import`

**Request Body:**
```json
{
  "patients": [
    {
      "patient_number": "OP-123-06",
      "first_name": "John",
      "last_name": "Doe",
      "date_of_birth": "1980-01-01",
      "gender": "Unknown",
      "phone": "0712345678",
      "location": "Nairobi",
      "emergency_contact": "",
      "emergency_phone": "",
      "status": "active"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "imported": 10,
  "failed": 2,
  "errors": ["Failed to import patient at index 5", "..."],
  "message": "Imported 10 patients"
}
```

---

## Column Name Detection

The system automatically detects columns by searching for keywords:

- **Name**: `name`, `patient name`, `full name`
- **Age**: `age`
- **Location**: `location`, `address`
- **OP Number**: `op`, `op number`, `client`, `client number`
- **Phone**: `phone`, `phone number`, `number`, `mobile`

**Note:** Column names are case-insensitive.

---

## Limitations & Notes

1. **File Format**: Currently supports CSV files only
   - Excel files need to be saved as CSV first
   - Maximum file size: 10MB

2. **Data Mapping**:
   - Names are split into first_name and last_name
   - Gender defaults to "Unknown" (not in CSV)
   - Emergency contact fields are empty (not in CSV)

3. **Backend Sync**:
   - Currently saves to frontend context/localStorage
   - Backend API endpoint exists but not connected yet
   - TODO in code: Connect to backend bulk import API

4. **No Duplicate Prevention**:
   - System doesn't check for existing patients
   - You may import duplicates if same patient exists
   - Use patient numbers to identify duplicates

---

## Tips for Successful Import

1. **Download Template First**
   - Use the provided template as starting point
   - Ensures correct column names and format

2. **Clean Your Data**
   - Remove special characters that might break CSV parsing
   - Ensure proper encoding (UTF-8)
   - Remove empty rows at the end

3. **Handle Missing Data**
   - Don't worry about missing optional fields
   - System handles defaults gracefully
   - You can update records after import

4. **Test with Small File First**
   - Import a few records first to verify format
   - Then proceed with full dataset

5. **Review Preview Carefully**
   - Check generated patient numbers
   - Verify date of birth calculations
   - Ensure family members with shared OP numbers are handled correctly

---

## Troubleshooting

### Problem: File not parsing
**Solution:**
- Ensure file is saved as CSV (not Excel .xlsx)
- Check encoding is UTF-8
- Verify column headers match template

### Problem: All records show errors
**Solution:**
- Check that "Name" column exists and has data
- Ensure names are at least 2 characters
- Verify CSV format (comma-separated)

### Problem: Dates/ages incorrect
**Solution:**
- Ages should be numbers only (not "45 years")
- System calculates DOB from age
- Missing ages default to 1990

### Problem: Phone numbers not importing
**Solution:**
- Phone numbers are optional
- Invalid formats show warnings but still import
- Can be updated after import

---

## Example Import Scenarios

### Scenario 1: Basic Import (All Fields)
```csv
Name,Age,Location,OP Number,Phone Number
John Doe,45,Nairobi,123/06,0712345678
```
**Result:** ✅ Perfect import, all data preserved

### Scenario 2: Missing Optional Fields
```csv
Name,Age,Location,OP Number,Phone Number
Mary Smith,32,,,
```
**Result:** ✅ Imports successfully with defaults:
- Location: "Not specified"
- Phone: "Not provided"
- Patient Number: Auto-generated

### Scenario 3: Family Members (Shared OP)
```csv
Name,Age,Location,OP Number,Phone Number
John Doe,45,Nairobi,123/06,0712345678
Sarah Doe,,Nairobi,123/06,
```
**Result:** ✅ Both import:
- John: `123/06`
- Sarah: `123/06-A`

### Scenario 4: Invalid Data
```csv
Name,Age,Location,OP Number,Phone Number
J,45,Nairobi,123/06,0712345678
```
**Result:** ❌ Error - Name too short (< 2 characters)

---

## Future Enhancements

- [ ] Direct Excel (.xlsx) file support
- [ ] Duplicate detection before import
- [ ] Advanced data mapping options
- [ ] Import history/audit log
- [ ] Batch import validation
- [ ] Automatic backend sync
- [ ] Import templates for different formats

---

## Files Involved

- **Frontend Component**: `components/patient-import.tsx`
- **Context**: `contexts/patient-context-enhanced.tsx` (importPatients function)
- **API Client**: `lib/api-client.ts` (bulkImport method)
- **Backend Handler**: `backend/src/simple_handlers.rs` (import_patients)
- **Backend Route**: `POST /api/patients/import` in `backend/src/main.rs`

---

**Status**: ✅ **CSV Import fully functional!** Ready to use for patient data migration.
