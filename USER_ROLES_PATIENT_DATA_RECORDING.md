# 👥 User Roles & Patient Data Recording Guide

**Date**: January 2025  
**Purpose**: Comprehensive guide showing what patient data each user role records in the system

---

## 📊 Overview

The system has **6 main user roles**, each with specific responsibilities for recording patient data:

1. **Receptionist** - Patient registration and basic information
2. **Clinician/Doctor** - Medical consultations and clinical data
3. **Nurse** - Vital signs and patient monitoring
4. **Pharmacist** - Medication dispensing and pharmacy records
5. **Lab Technician** - Laboratory test orders and results
6. **Administrator** - Full access (can record all data types)

---

## 1. 👤 RECEPTIONIST - Patient Registration Data

### Primary Responsibility
**First point of contact** - Registers new patients and updates existing patient information

### Patient Data Recorded:

#### ✅ **Required Fields** (Must Fill):
1. **First Name** - Patient's first name
2. **Last Name** - Patient's last name
3. **Date of Birth** - Patient's birth date (or Age)
4. **Gender** - Male, Female, Other
5. **Phone Number** - Contact phone (validated for Kenyan format)
6. **Visit Reason** - Why patient is visiting today

#### ✅ **Optional Fields** (Can Fill):
7. **Location/Address** - Patient's address (with Kenyan location autocomplete)
8. **Emergency Contact Name** - Name of emergency contact person
9. **Emergency Contact Phone** - Phone number of emergency contact
10. **Patient Number (OP Number)** - Legacy OP number if available
11. **Visit Reason Category** - Categorized visit reason:
    - Follow-up
    - New Complaint
    - Routine Check
    - Emergency
    - Medication Refill
    - Lab Results
    - Other

### Additional Functions:
- ✅ **Duplicate Detection** - Checks for existing patients before registration
- ✅ **Returning Patient Detection** - Auto-detects returning patients by phone
- ✅ **Form Auto-fill** - Pre-fills form for returning patients
- ✅ **Phone Validation** - Real-time Kenyan phone number validation
- ✅ **Location Autocomplete** - 47 Kenyan locations with suggestions
- ✅ **Quick Registration Mode** - Minimal data for returning patients

### Data Entry Location:
- **Module**: Patient Registration (`components/registration-module.tsx`)
- **Access**: Receptionist dashboard → Patient Registration

### What Gets Saved:
- Patient demographics
- Contact information
- Emergency contact (optional)
- Visit reason and category
- Registration timestamp
- Registration user (receptionist ID)

---

## 2. 🩺 CLINICIAN/DOCTOR - Clinical Consultation Data

### Primary Responsibility
**Medical care** - Records clinical data during patient consultations

### Patient Data Recorded:

#### ✅ **Required Fields**:
1. **Chief Complaint** - Main reason for visit (patient's description)
2. **Patient ID** - Links to registered patient

#### ✅ **Clinical Data** (Can Record):
3. **Vital Signs**:
   - Temperature (°C)
   - Blood Pressure (systolic/diastolic)
   - Pulse (beats per minute)
   - Weight (kg)
   - Height (cm)
   - Respiratory Rate (breaths per minute)
   - Oxygen Saturation (%)

4. **Physical Examination** - Detailed examination findings

5. **Diagnosis** - Medical diagnosis (free text or ICD-11 code)

6. **ICD-11 Codes** - International diagnostic codes (optional lookup)

7. **Treatment Plan** - Planned treatment approach

8. **Follow-up Date** - When patient should return

9. **Clinical Notes** - Additional clinical observations

#### ✅ **Prescriptions** (Can Create):
10. **Medication Name** - Prescribed medication
11. **Dosage** - How much to take
12. **Frequency** - How often to take
13. **Duration** - How long to take (days)
14. **Quantity** - Number of units
15. **Instructions** - Special instructions for patient

#### ✅ **Services** (Can Add):
16. **Service Items** - Services provided during consultation:
    - Consultation fees
    - Procedures
    - Lab tests
    - Other services

### Additional Functions:
- ✅ **Allergy Checking** - Checks patient allergies before prescribing
- ✅ **Medication Stock Check** - Shows available medication stock
- ✅ **ICD-11 Code Lookup** - Search for diagnostic codes
- ✅ **Service Catalog** - Browse available services
- ✅ **Prescription Creation** - Create prescriptions during consultation

### Data Entry Location:
- **Module**: Consultation Module (`components/consultation-module.tsx`)
- **Access**: Clinician dashboard → Consultations

### What Gets Saved:
- Consultation record with all clinical data
- Vital signs (if recorded)
- Diagnosis and ICD-11 codes
- Treatment plan
- Prescriptions (linked to consultation)
- Services provided
- Consultation timestamp
- Clinician ID (who created consultation)

---

## 3. 👩‍⚕️ NURSE - Vital Signs & Monitoring Data

### Primary Responsibility
**Patient monitoring** - Records vital signs and monitors patient status

### Patient Data Recorded:

#### ✅ **Vital Signs** (Primary Focus):
1. **Temperature** - Body temperature (°C)
2. **Blood Pressure** - Systolic/Diastolic (mmHg)
3. **Pulse** - Heart rate (bpm)
4. **Weight** - Patient weight (kg)
5. **Height** - Patient height (cm)
6. **Respiratory Rate** - Breathing rate (per minute)
7. **Oxygen Saturation** - SpO2 (%)

#### ✅ **Patient Monitoring**:
8. **Patient Status** - Current condition
9. **Care Notes** - Nursing care observations
10. **Medication Administration** - Records when medications given

### Additional Functions:
- ✅ **Quick Vital Signs Entry** - Fast entry form for vital signs
- ✅ **Patient Monitoring** - Track patient progress
- ✅ **Care Plan Updates** - Update nursing care plans

### Data Entry Location:
- **Module**: Vital Signs Quick Entry (`components/vital-signs-quick-entry.tsx`)
- **Access**: Nurse dashboard → Vital Signs

### What Gets Saved:
- Vital signs records
- Monitoring notes
- Medication administration records
- Timestamp
- Nurse ID (who recorded)

---

## 4. 💊 PHARMACIST - Medication & Dispensing Data

### Primary Responsibility
**Pharmacy operations** - Dispenses medications and manages inventory

### Patient Data Recorded:

#### ✅ **Prescription Processing**:
1. **Prescription ID** - Which prescription being dispensed
2. **Patient ID** - Patient receiving medication
3. **Medication Name** - Medication being dispensed
4. **Quantity Dispensed** - How many units given
5. **Dosage Instructions** - How to take medication
6. **Dispensing Date** - When medication was dispensed
7. **Dispensing Notes** - Any special instructions

#### ✅ **Inventory Management**:
8. **Stock Levels** - Current medication stock
9. **Expiry Dates** - Medication expiration tracking
10. **Stock Alerts** - Low stock notifications

### Additional Functions:
- ✅ **Prescription Queue** - View pending prescriptions
- ✅ **Stock Checking** - Check medication availability
- ✅ **Expiry Monitoring** - Track expiring medications
- ✅ **Inventory Updates** - Update stock levels

### Data Entry Location:
- **Module**: Pharmacy Dispensing (`components/pharmacy-dispensing-module.tsx`)
- **Access**: Pharmacist dashboard → Pharmacy

### What Gets Saved:
- Dispensing records
- Prescription fulfillment status
- Inventory updates
- Timestamp
- Pharmacist ID (who dispensed)

---

## 5. 💰 RECEPTIONIST - Billing & Payment Data

### Primary Responsibility
**Financial transactions** - Records billing and payment information

### Patient Data Recorded:

#### ✅ **Invoice Creation**:
1. **Patient ID** - Patient being billed
2. **Invoice Items** - Services, medications, procedures
3. **Service Descriptions** - What was provided
4. **Quantities** - How many units
5. **Unit Prices** - Price per unit
6. **Subtotal** - Total before tax
7. **Tax Amount** - VAT (16%)
8. **Total Amount** - Final amount due

#### ✅ **Payment Recording**:
9. **Payment Method** - Cash, M-Pesa, SHA, Mixed
10. **Amount Paid** - How much patient paid
11. **Payment Reference** - Transaction reference number
12. **M-Pesa Code** - M-Pesa transaction code (if applicable)
13. **SHA Claim Number** - SHA insurance claim (if applicable)
14. **Payment Date** - When payment was received

### Additional Functions:
- ✅ **M-Pesa Integration** - Process M-Pesa payments
- ✅ **SHA Claims** - Generate SHA insurance claims
- ✅ **Receipt Printing** - Print payment receipts
- ✅ **Invoice Management** - View and manage invoices

### Data Entry Location:
- **Module**: Billing Module (`components/billing-module.tsx`)
- **Access**: Receptionist dashboard → Billing

### What Gets Saved:
- Invoice records
- Payment records
- Payment method details
- Transaction codes
- Timestamp
- Receptionist ID (who processed payment)

---

## 5. 🧪 LAB TECHNICIAN - Laboratory Test Data

### Primary Responsibility
**Laboratory operations** - Processes lab test orders and records test results

### Patient Data Recorded:

#### ✅ **Lab Test Order Management**:
1. **Order Status Updates**
   - Pending → Collected (when sample is collected)
   - Collected → In Progress (when testing begins)
   - In Progress → Completed (when results are entered)

2. **Sample Collection Information**
   - Sample collection date and time
   - Sample type (blood, urine, stool, etc.)

#### ✅ **Lab Test Results**:
1. **Test Values** (varies by test type):
   - **CBC**: Hemoglobin, Hematocrit, WBC, RBC, Platelets, MCV, MCH, MCHC
   - **Urinalysis**: Color, Appearance, pH, Specific Gravity, Protein, Glucose, Ketones, Blood, Leukocytes, Nitrites, Cell counts
   - **Blood Glucose**: Glucose level, Test type
   - **Other Tests**: Custom test values (JSON format)

2. **Reference Ranges**
   - Normal ranges for each test value
   - Automatically compared with entered values

3. **Abnormal Value Flags**
   - Automatic detection of values outside normal range
   - Highlighted for clinician review

4. **Result Notes**
   - Additional observations or comments
   - Quality control notes

5. **Result Verification**
   - Verification status
   - Verification date and time
   - Verified by (lab technician ID)

6. **Attachments**
   - Lab report PDFs or images
   - Supporting documentation

### Additional Functions:
- ✅ **Priority Management** - Handles STAT, urgent, and routine orders
- ✅ **Queue Management** - Views and manages pending test orders
- ✅ **Abnormal Detection** - Automatic flagging of abnormal values
- ✅ **Result History** - Tracks all lab results for patients
- ✅ **Test Type Support** - Structured forms for common tests

### Data Access:
- ✅ **Can View**: Lab orders, lab results, patient information (for lab purposes), consultations (linked to orders)
- ✅ **Can Edit**: Lab orders (status), lab results (before verification)
- ✅ **Can Create**: Lab test results
- ❌ **Cannot**: Delete orders/results, modify verified results, access billing information

### Data Entry Location:
- **Module**: Lab Technician Dashboard (`components/lab-technician-dashboard.tsx`)
- **Queue**: Lab Test Queue (`components/lab-test-queue.tsx`)
- **Result Entry**: Lab Result Entry (`components/lab-result-entry.tsx`)
- **Access**: Lab Technician dashboard → Lab Queue / Enter Results

### What Gets Saved:
- Lab test order status updates
- Lab test result values
- Reference ranges
- Abnormal value flags
- Result notes
- Verification status
- Timestamps
- Lab technician ID (who entered/verified)

---

## 6. 👑 ADMINISTRATOR - Full Access

### Primary Responsibility
**System management** - Full access to all data and functions

### Patient Data Recorded:
**Can record ALL data types** that other roles can record:
- ✅ Patient registration data
- ✅ Clinical consultation data
- ✅ Vital signs
- ✅ Prescriptions
- ✅ Dispensing records
- ✅ Billing and payments
- ✅ System configuration
- ✅ User management

### Additional Functions:
- ✅ **User Management** - Create/edit user accounts
- ✅ **System Settings** - Configure system preferences
- ✅ **Reports** - Generate all types of reports
- ✅ **Audit Logs** - View all system activities
- ✅ **Data Management** - Import/export data

---

## 📋 Complete Data Flow by Role

### Patient Registration Flow:
```
Receptionist → Registers Patient
├── Personal Information (name, DOB, gender)
├── Contact Information (phone, address)
├── Emergency Contact (optional)
└── Visit Reason
```

### Consultation Flow:
```
Clinician → Creates Consultation
├── Chief Complaint
├── Vital Signs (or Nurse records separately)
├── Physical Examination
├── Diagnosis (with ICD-11 codes)
├── Treatment Plan
├── Prescriptions
└── Services Provided
```

### Pharmacy Flow:
```
Pharmacist → Dispenses Medication
├── Prescription Details
├── Quantity Dispensed
├── Dispensing Instructions
└── Inventory Update
```

### Billing Flow:
```
Receptionist → Creates Invoice
├── Invoice Items (from consultation)
├── Payment Method
├── Payment Amount
└── Transaction Details
```

---

## 🔐 Data Access by Role

### Who Can View What:

| Data Type | Receptionist | Clinician | Nurse | Pharmacist | Admin |
|-----------|-------------|-----------|-------|------------|-------|
| **Patient Demographics** | ✅ View/Edit | ✅ View | ✅ View | ✅ View (limited) | ✅ All |
| **Contact Information** | ✅ View/Edit | ✅ View | ✅ View | ❌ | ✅ All |
| **Vital Signs** | ❌ | ✅ View/Edit | ✅ View/Edit | ❌ | ✅ All |
| **Consultations** | ✅ View | ✅ View/Edit | ✅ View | ❌ | ✅ All |
| **Diagnosis** | ❌ | ✅ View/Edit | ✅ View | ❌ | ✅ All |
| **Prescriptions** | ✅ View | ✅ View/Edit | ✅ View | ✅ View/Edit | ✅ All |
| **Dispensing Records** | ✅ View | ✅ View | ✅ View | ✅ View/Edit | ✅ All |
| **Lab Test Orders** | ✅ View | ✅ View/Edit | ✅ View | ❌ | ✅ All |
| **Lab Test Results** | ✅ View | ✅ View | ✅ View | ✅ View/Edit | ✅ All |
| **Invoices** | ✅ View/Edit | ✅ View (own) | ❌ | ✅ View | ✅ All |
| **Payments** | ✅ View/Edit | ❌ | ❌ | ❌ | ✅ All |

---

## 📝 Data Recording Summary

### Receptionist Records:
1. ✅ Patient registration (demographics, contact)
2. ✅ Visit reason and category
3. ✅ Emergency contact information
4. ✅ Invoice creation
5. ✅ Payment processing
6. ✅ Receipt generation

### Clinician Records:
1. ✅ Chief complaint
2. ✅ Physical examination
3. ✅ Diagnosis (with ICD-11 codes)
4. ✅ Treatment plan
5. ✅ Prescriptions
6. ✅ Clinical notes
7. ✅ Follow-up dates
8. ✅ Services provided

### Nurse Records:
1. ✅ Vital signs
2. ✅ Patient monitoring notes
3. ✅ Medication administration
4. ✅ Care plan updates

### Pharmacist Records:
1. ✅ Prescription dispensing
2. ✅ Medication quantities dispensed
3. ✅ Dispensing instructions
4. ✅ Inventory updates
5. ✅ Expiry tracking

### Lab Technician Records:
1. ✅ Lab test order status updates
2. ✅ Sample collection dates
3. ✅ Lab test results (test values)
4. ✅ Reference ranges
5. ✅ Abnormal value flags
6. ✅ Lab result notes
7. ✅ Result verification
8. ✅ Lab report attachments

### Administrator Records:
1. ✅ **All of the above** (full access)
2. ✅ User accounts
3. ✅ System settings
4. ✅ Audit logs

---

## 🎯 Key Points

### Data Ownership:
- Each record is **linked to the user who created it**
- **Activity logging** tracks who recorded what
- **Audit trail** maintained for all data changes

### Data Relationships:
- **Patient** → Has many **Consultations**
- **Consultation** → Has many **Prescriptions**
- **Consultation** → Has many **Lab Test Orders**
- **Lab Test Order** → Has **Lab Test Results**
- **Prescription** → Has **Dispensing Records**
- **Consultation** → Generates **Invoice**
- **Invoice** → Has **Payment Records**

### Data Validation:
- ✅ **Phone numbers** validated (Kenyan format)
- ✅ **Duplicate detection** prevents duplicate patients
- ✅ **Required fields** enforced
- ✅ **Data type validation** (dates, numbers, etc.)

---

## 📊 Complete Patient Data Structure

### Patient Record Contains:
```json
{
  "id": "patient-uuid",
  "patient_number": "OP-12345",
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "1990-01-15",
  "gender": "Male",
  "phone": "+254712345678",
  "location": "Nairobi",
  "emergency_contact": "Jane Doe",
  "emergency_phone": "+254712345679",
  "blood_type": "O+",
  "allergies": ["Penicillin"],
  "medical_history": "Hypertension",
  "insurance_type": "SHA",
  "insurance_number": "SHA-12345",
  "created_at": "2025-01-15T10:00:00Z",
  "created_by": "receptionist-uuid"
}
```

### Consultation Record Contains:
```json
{
  "id": "consultation-uuid",
  "patient_id": "patient-uuid",
  "clinician_id": "doctor-uuid",
  "chief_complaint": "Headache and fever",
  "vital_signs": {
    "temperature": 38.5,
    "blood_pressure": "120/80",
    "pulse": 72
  },
  "diagnosis": "Viral infection",
  "icd_11_codes": ["1A00"],
  "treatment_plan": "Rest and medication",
  "prescriptions": [...],
  "services": [...],
  "created_at": "2025-01-15T10:30:00Z",
  "created_by": "doctor-uuid"
}
```

---

## ✅ Summary

### Receptionist:
- Records: **Patient registration, billing, payments**
- Focus: **Administrative data**

### Clinician:
- Records: **Clinical consultations, diagnoses, prescriptions**
- Focus: **Medical care data**

### Nurse:
- Records: **Vital signs, monitoring**
- Focus: **Patient monitoring data**

### Pharmacist:
- Records: **Medication dispensing, inventory**
- Focus: **Pharmacy operations data**

### Administrator:
- Records: **Everything** (full access)
- Focus: **System management**

---

**All patient data is automatically saved to the database and linked to the user who recorded it!** 🎉

---

**Last Updated**: January 2025  
**Version**: 1.0

