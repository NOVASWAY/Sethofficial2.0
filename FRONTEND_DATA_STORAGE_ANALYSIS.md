# Frontend Data Storage Analysis - Current State

## Overview

This document explains how customer diagnosis, treatment, prescriptions, and receipts are currently stored in the frontend of the clinic management system.

---

## 📊 Data Storage Architecture

### Current Storage Model: **API-First with React Context**

The system uses a **hybrid approach**:
1. **Primary Storage**: PostgreSQL Database (via Backend API)
2. **Frontend State**: React Context + useState hooks
3. **Caching**: In-memory cache with TTL (5 minutes)
4. **No localStorage**: Data is NOT stored in browser localStorage (except for settings)

---

## 🔍 Detailed Breakdown by Entity

### 1. **CONSULTATIONS (Diagnosis & Treatment)**

#### Storage Flow:
```
User Input (Consultation Form)
    ↓
React Component State (useState)
    ↓
consultationAPI.create() → Backend API
    ↓
PostgreSQL Database (consultations table)
    ↓
React Context (WorkflowContext/PatientContext) - for UI state
```

#### Where It's Stored:

**Component State** (`components/consultation-module.tsx`):
```typescript
const [consultationData, setConsultationData] = useState({
  patient_id: '',
  clinician_id: '',
  chief_complaint: '',
  diagnosis: '',
  icd_11_codes: [],
  notes: '',
  treatment_plan: '',
})
```

**API Call**:
```typescript
const apiResponse = await consultationAPI.create(consultationPayload)
```

**Context Storage** (`contexts/workflow-context-enhanced.tsx`):
```typescript
const [pendingConsultation, setPendingConsultation] = useState<ConsultationData | null>(null)
```

**Backend Storage**:
- Table: `consultations`
- Fields: `diagnosis`, `treatment_plan`, `chief_complaint`, `notes`, `vital_signs` (JSONB)

#### What Gets Saved:
- ✅ Chief complaint
- ✅ Diagnosis
- ✅ ICD-11 codes
- ✅ Treatment plan
- ✅ Clinical notes
- ✅ Vital signs (temperature, BP, pulse, etc.)
- ✅ Consultation date/time
- ✅ Linked to patient and clinician

#### Retrieval:
- Loaded from API: `consultationAPI.getByPatientId(patientId)`
- Cached in memory for 5 minutes
- Displayed in Patient Dashboard

---

### 2. **PRESCRIPTIONS**

#### Storage Flow:
```
User Input (Prescription Form)
    ↓
React Component State (useState)
    ↓
prescriptionAPI.create() → Backend API
    ↓
PostgreSQL Database (prescriptions table)
    ↓
React Component State (for display)
```

#### Where It's Stored:

**Component State** (`components/consultation-module.tsx`):
```typescript
const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
```

**API Call**:
```typescript
const prescriptionResult = await prescriptionAPI.create(prescriptionData)
```

**Backend Storage**:
- Table: `prescriptions`
- Fields: `medicines` (JSONB array), `instructions`, `status`, `patient_id`, `consultation_id`

#### What Gets Saved:
- ✅ Medication name
- ✅ Dosage
- ✅ Frequency
- ✅ Duration (days)
- ✅ Quantity
- ✅ Instructions
- ✅ Status (active, dispensed, cancelled)
- ✅ Linked to patient, doctor, and consultation

#### Retrieval:
- Loaded from API: `prescriptionAPI.getAll({ patient_id, status })`
- Cached in memory for 5 minutes
- Displayed in Prescription Queue and Patient Dashboard

---

### 3. **INVOICES/RECEIPTS**

#### Storage Flow:
```
User Input (Billing/Invoice Form)
    ↓
InvoiceContext.addInvoice()
    ↓
invoiceAPI.create() → Backend API
    ↓
PostgreSQL Database (invoices table)
    ↓
InvoiceContext State (for UI)
```

#### Where It's Stored:

**Context Storage** (`contexts/invoice-context.tsx`):
```typescript
const [invoices, setInvoices] = useState<Invoice[]>([])

// Load from API on mount
useEffect(() => {
  const invoicesData = await invoiceAPI.getAll()
  setInvoices(invoicesData.data || [])
}, [])
```

**API Call**:
```typescript
const newInvoice = await invoiceAPI.create(invoiceData)
setInvoices(prev => [newInvoice, ...prev])
```

**Backend Storage**:
- Table: `invoices`
- Fields: `items` (JSONB), `subtotal`, `tax_amount`, `total_amount`, `payment_status`, `payment_method`

#### What Gets Saved:
- ✅ Invoice number (auto-generated)
- ✅ Patient information
- ✅ Invoice items (services, medications, procedures)
- ✅ Subtotal, tax (16% VAT), total amount
- ✅ Payment method (cash, M-Pesa, SHA)
- ✅ Payment status (pending, partial, paid)
- ✅ M-Pesa transaction codes
- ✅ SHA claim numbers
- ✅ Linked to patient and consultation

#### Retrieval:
- Loaded from API: `invoiceAPI.getAll()`
- Stored in InvoiceContext state
- Displayed in Invoice Management and Patient Dashboard

---

## 🔄 Data Flow Patterns

### Pattern 1: Create Operation
```
1. User fills form → Component state (useState)
2. User clicks Save → API call (consultationAPI.create)
3. Backend saves to database
4. API returns saved record
5. Component updates local state (optimistic update)
6. Context updates (if applicable)
```

### Pattern 2: Read Operation
```
1. Component mounts → useEffect hook
2. API call (consultationAPI.getAll)
3. Check cache (5-minute TTL)
4. If cached → use cache
5. If not cached → fetch from API
6. Update component state
7. Display data
```

### Pattern 3: Update Operation
```
1. User edits data → Component state
2. User clicks Update → API call (consultationAPI.update)
3. Backend updates database
4. API returns updated record
5. Component updates local state
6. Context updates (if applicable)
```

---

## 📦 Storage Locations Summary

### **In-Memory (React State)**
- ✅ Component state (`useState`)
- ✅ Context state (`useContext`)
- ✅ Temporary form data
- ❌ **NOT persisted** - Lost on page refresh

### **Backend Database (PostgreSQL)**
- ✅ All consultations
- ✅ All prescriptions
- ✅ All invoices/receipts
- ✅ All patient data
- ✅ **Permanently stored** - Survives page refresh

### **Browser Storage (localStorage)**
- ❌ **NOT used** for consultations, prescriptions, or invoices
- ✅ Only used for:
  - User authentication tokens
  - User preferences/settings
  - Auto-print receipt settings

### **Caching**
- ✅ In-memory cache (5-minute TTL)
- ✅ Reduces API calls
- ✅ Improves performance
- ❌ **NOT persisted** - Cleared on page refresh

---

## 🔍 Code Examples

### Consultation Storage Example

**File**: `components/consultation-module.tsx`

```typescript
// 1. Component State
const [consultationData, setConsultationData] = useState({
  patient_id: '',
  diagnosis: '',
  treatment_plan: '',
  // ... other fields
})

// 2. Save to Backend
const apiResponse = await consultationAPI.create(consultationPayload)

// 3. Update Local State (optimistic update)
patientConsultation.id = apiResponse.id
```

### Prescription Storage Example

**File**: `components/consultation-module.tsx`

```typescript
// 1. Component State
const [prescriptions, setPrescriptions] = useState<Prescription[]>([])

// 2. Save to Backend
const prescriptionResult = await prescriptionAPI.create(prescriptionData)

// 3. Update Local State
// Prescription is now in database and can be retrieved
```

### Invoice Storage Example

**File**: `contexts/invoice-context.tsx`

```typescript
// 1. Context State
const [invoices, setInvoices] = useState<Invoice[]>([])

// 2. Load from API on mount
useEffect(() => {
  const invoicesData = await invoiceAPI.getAll()
  setInvoices(invoicesData.data || [])
}, [])

// 3. Save to Backend
const addInvoice = async (invoiceData) => {
  const newInvoice = await invoiceAPI.create(invoiceData)
  setInvoices(prev => [newInvoice, ...prev])
}
```

---

## ✅ Data Persistence Guarantees

### What IS Persisted:
- ✅ **All consultations** → Saved to database immediately
- ✅ **All prescriptions** → Saved to database immediately
- ✅ **All invoices/receipts** → Saved to database immediately
- ✅ **All patient data** → Saved to database immediately

### What is NOT Persisted (Frontend Only):
- ❌ Form draft data (lost if page refreshes before saving)
- ❌ Unsaved changes in forms
- ❌ Cache data (cleared on refresh, but re-fetched from API)

---

## 🔄 Data Retrieval

### Consultations
```typescript
// From Patient Dashboard
const consultations = await consultationAPI.getByPatientId(patientId)

// From Consultation Module
const consultation = await consultationAPI.getById(consultationId)
```

### Prescriptions
```typescript
// From Prescription Queue
const prescriptions = await prescriptionAPI.getAll({ status: 'active' })

// From Patient Dashboard
const prescriptions = await prescriptionAPI.getAll({ patient_id: patientId })
```

### Invoices/Receipts
```typescript
// From Invoice Context
const invoices = await invoiceAPI.getAll()

// From Patient Dashboard
const invoices = await invoiceAPI.getAll({ patient_id: patientId })
```

---

## 📊 Current State Summary

### ✅ **What Works Well:**
1. **All data is saved to database** - No data loss
2. **API-first architecture** - Centralized data management
3. **Context-based state** - Shared state across components
4. **Caching** - Reduces API calls and improves performance
5. **Optimistic updates** - Better user experience

### ⚠️ **Current Limitations:**
1. **No offline support** - Requires internet connection
2. **No draft saving** - Unsaved form data is lost on refresh
3. **Cache cleared on refresh** - Must re-fetch from API
4. **No localStorage backup** - All data depends on backend

### 🎯 **Data Safety:**
- ✅ **All critical data is in database** - Safe from browser clearing
- ✅ **Data survives page refresh** - Loaded from API
- ✅ **Data survives browser restart** - Stored in PostgreSQL
- ✅ **Data survives system restart** - Database persists

---

## 🔍 Verification

To verify data is stored:

1. **Check Browser Network Tab**:
   - Look for API calls: `/api/consultations`, `/api/prescriptions`, `/api/invoices`
   - Verify POST requests return 201 Created
   - Verify GET requests return data

2. **Check Database**:
   ```sql
   SELECT * FROM consultations ORDER BY created_at DESC LIMIT 10;
   SELECT * FROM prescriptions ORDER BY created_at DESC LIMIT 10;
   SELECT * FROM invoices ORDER BY created_at DESC LIMIT 10;
   ```

3. **Check Frontend State**:
   - Open React DevTools
   - Check Context providers
   - Verify state updates after API calls

---

## 📝 Conclusion

**Current State**: All customer diagnosis, treatment, prescriptions, and receipts are:
- ✅ **Stored in PostgreSQL database** via Backend API
- ✅ **Managed in React Context/State** for UI
- ✅ **Cached in memory** for performance
- ❌ **NOT stored in localStorage** (except settings)

**Data Safety**: ✅ **All data is permanently stored** in the database and can be retrieved anytime.

---

*Last Updated: 2025-01-XX*
*Status: Current Implementation Analysis*

