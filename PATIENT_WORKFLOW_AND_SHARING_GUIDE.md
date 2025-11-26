# Patient Workflow and Cross-User Sharing Guide

## Overview

This document explains how different users receive and access patients registered by other users, and how they determine which procedures to take with each patient.

---

## 🔄 How Patients Are Shared Across Users

### 1. **Patient Registration (Receptionist)**

**Who Registers**: Receptionist

**What Happens**:
1. Receptionist registers patient → Saved to database
2. Patient record is **immediately available** to all authorized users
3. Patient appears in system-wide patient list

**Data Visibility**:
- ✅ **All users** can search and find the patient
- ✅ **All users** can view patient basic information
- ✅ Patient is linked to the receptionist who registered them (`created_by` field)

---

### 2. **Patient Access by Role**

#### **Admin**
- ✅ **Can see ALL patients** (no restrictions)
- ✅ Can view/edit all patient data
- ✅ Can see patients from all departments

#### **Clinician**
- ✅ **Can see patients from their department**
- ✅ Can see patients assigned to them
- ✅ Can see patients they've consulted
- ✅ **Cannot see** patients from other departments (unless assigned)

#### **Nurse**
- ✅ **Can see patients from their department**
- ✅ Can see patients assigned to them
- ✅ Can view patient data (read-only for most fields)
- ✅ Can record vital signs

#### **Pharmacist**
- ✅ **Can see patients with pending prescriptions**
- ✅ Can see patients from their department
- ✅ Can view patient medication history
- ✅ **Cannot see** full patient medical records

#### **Lab Technician**
- ✅ **Can see patients with lab orders**
- ✅ Can see patients from their department
- ✅ Can view patient lab history
- ✅ **Cannot see** full patient medical records

#### **Receptionist**
- ✅ **Can see patients they registered**
- ✅ Can see patients from their department
- ✅ Can view/edit patient basic information
- ✅ **Cannot see** clinical data (diagnosis, prescriptions)

---

## 📋 How Users Determine Next Procedures

### Current System: **Status-Based Workflow**

The system uses **status tracking** to determine what needs to be done:

### 1. **Patient Status Flow**

```
Registration (Receptionist)
    ↓
Status: "registered" or "checked_in"
    ↓
Queue Management
    ↓
Status: "waiting" → "called" → "in_consultation"
    ↓
Consultation (Clinician)
    ↓
Status: "consultation_completed"
    ↓
Prescription Created (if needed)
    ↓
Status: "prescription_pending"
    ↓
Billing (Receptionist)
    ↓
Status: "billing_pending" or "billing_completed"
    ↓
Pharmacy (Pharmacist)
    ↓
Status: "prescription_dispensed"
    ↓
Lab Tests (Lab Technician) - if ordered
    ↓
Status: "lab_completed"
    ↓
Completed
```

---

### 2. **How Users See What Needs to Be Done**

#### **A. Queue Management System**

**Location**: Queue Management Component

**How It Works**:
1. **Receptionist** checks in patient → Patient added to queue
2. **Queue shows**:
   - Waiting patients (sorted by priority)
   - In-consultation patients
   - Completed patients

**Queue Statuses**:
- `waiting` - Patient checked in, waiting to be seen
- `called` - Patient called by clinician
- `in-consultation` - Currently being seen
- `completed` - Consultation finished

**Code Example**:
```typescript
// Queue Management Component
const waitingQueue = queue.filter(q => q.status === 'waiting')
const inConsultationQueue = queue.filter(q => q.status === 'in-consultation')
```

---

#### **B. Role-Specific Dashboards**

Each role sees **different pending tasks**:

**Clinician Dashboard**:
- ✅ Today's consultations
- ✅ Patients in queue
- ✅ Pending lab results to review
- ✅ Follow-up appointments needed

**Pharmacist Dashboard**:
- ✅ Prescription queue (pending prescriptions)
- ✅ Prescriptions by status (active, dispensed, cancelled)
- ✅ Filter by patient or date

**Lab Technician Dashboard**:
- ✅ Lab test orders (pending orders)
- ✅ Orders by status (pending, collected, in_progress, completed)
- ✅ Filter by test type or priority

**Receptionist Dashboard**:
- ✅ Appointment queue
- ✅ Patient check-ins
- ✅ Pending invoices
- ✅ New registrations

---

#### **C. Patient Dashboard**

**Location**: Patient Dashboard Component

**What Users See**:
1. **Patient Information** (all users can view)
2. **Consultations Tab**:
   - All consultations for the patient
   - Status of each consultation
   - Who conducted each consultation
   - Diagnosis and treatment

3. **Prescriptions Tab**:
   - All prescriptions
   - Status (active, dispensed, cancelled)
   - Who prescribed
   - What needs to be done next

4. **Invoices Tab**:
   - All invoices/receipts
   - Payment status
   - What's pending payment

5. **Lab Results Tab**:
   - All lab test results
   - Status (pending, verified, reviewed)
   - What needs review

---

### 3. **Status Indicators**

The system uses **status badges** to show what needs attention:

**Consultation Status**:
- 🟡 `pending` - Needs consultation
- 🔵 `in_progress` - Currently being consulted
- 🟢 `completed` - Consultation done

**Prescription Status**:
- 🟡 `active` - Needs to be dispensed
- 🟢 `dispensed` - Already dispensed
- 🔴 `cancelled` - Cancelled

**Invoice Status**:
- 🟡 `pending` - Needs payment
- 🟢 `paid` - Payment received
- 🟠 `partial` - Partial payment

**Lab Result Status**:
- 🟡 `pending` - Needs verification
- 🔵 `verified` - Verified by lab tech, needs clinician review
- 🟢 `reviewed` - Reviewed by clinician

---

## 🔍 How Users Find Patients

### 1. **Search Functionality**

**All users can search**:
- By patient name
- By patient number
- By phone number
- By date of visit

**Code Example**:
```typescript
// Patient Search
const searchPatients = async (query: string) => {
  const results = await patientAPI.search(query)
  // Results filtered by user permissions
  return results
}
```

### 2. **Filtered Views**

**Each role sees filtered data**:

**Clinician**:
```typescript
// Can see patients from their department
const patients = await dataIsolationAPI.getFilteredPatients({
  role: 'clinician',
  department: user.department
})
```

**Pharmacist**:
```typescript
// Can see patients with prescriptions
const prescriptions = await prescriptionAPI.getAll({
  status: 'active' // Pending prescriptions
})
```

**Lab Technician**:
```typescript
// Can see patients with lab orders
const labOrders = await labAPI.getAll({
  status: 'pending' // Pending lab orders
})
```

---

## 📊 Workflow Decision Points

### How Users Know What to Do Next:

### 1. **For Clinicians**

**When patient is in queue**:
- See patient in "Waiting" queue
- Click "Call Next" or select patient
- Patient status changes to "in-consultation"
- Open consultation module
- Record diagnosis and treatment
- Create prescriptions (if needed)
- Order lab tests (if needed)
- Save consultation → Status becomes "completed"

**Next Steps After Consultation**:
- If prescriptions created → Pharmacist sees in prescription queue
- If lab tests ordered → Lab technician sees in lab queue
- If billing needed → Receptionist sees in billing queue

---

### 2. **For Pharmacists**

**How they receive patients**:
1. Clinician creates prescription → Saved to database
2. Prescription appears in **Prescription Queue**
3. Pharmacist sees:
   - Patient name
   - Medications prescribed
   - Prescription status (active/pending)
   - Date prescribed

**What to do**:
- Open prescription from queue
- Check medication availability
- Dispense medications
- Update prescription status to "dispensed"
- Update inventory

---

### 3. **For Lab Technicians**

**How they receive patients**:
1. Clinician orders lab test → Saved to database
2. Lab order appears in **Lab Test Queue**
3. Lab technician sees:
   - Patient name
   - Test type and name
   - Priority (routine, urgent, stat)
   - Order status (pending, collected, in_progress)

**What to do**:
- Open order from queue
- Update status: pending → collected → in_progress
- Enter test results
- Verify results
- Results become available to clinician

---

### 4. **For Receptionists**

**How they receive patients**:
1. Patient registers → Appears in patient list
2. Patient checks in → Added to queue
3. After consultation → Invoice needs to be created
4. Receptionist sees:
   - Pending invoices
   - Payment status
   - Unpaid invoices

**What to do**:
- Create invoice from consultation
- Process payment
- Print receipt
- Update invoice status

---

## 🔄 Data Flow Example

### Complete Patient Journey:

**Step 1: Registration (Receptionist)**
```
Receptionist → Registers Patient "John Doe"
    ↓
Patient saved to database
    ↓
Patient visible to all authorized users
```

**Step 2: Queue (Receptionist)**
```
Receptionist → Checks in Patient
    ↓
Patient added to queue (status: "waiting")
    ↓
Queue visible to all clinicians
```

**Step 3: Consultation (Clinician)**
```
Clinician → Opens queue → Sees "John Doe" waiting
    ↓
Calls patient → Status: "called"
    ↓
Starts consultation → Status: "in-consultation"
    ↓
Records diagnosis: "Hypertension"
    ↓
Creates prescription: "Amlodipine 5mg"
    ↓
Orders lab test: "Blood Pressure Check"
    ↓
Saves consultation → Status: "completed"
```

**Step 4: Prescription (Pharmacist)**
```
Pharmacist → Opens Prescription Queue
    ↓
Sees prescription for "John Doe"
    ↓
Status: "active" (needs dispensing)
    ↓
Dispenses medication
    ↓
Updates status: "dispensed"
```

**Step 5: Lab Test (Lab Technician)**
```
Lab Technician → Opens Lab Test Queue
    ↓
Sees lab order for "John Doe"
    ↓
Status: "pending" (needs processing)
    ↓
Collects sample → Status: "collected"
    ↓
Enters results → Status: "completed"
    ↓
Verifies results → Status: "verified"
```

**Step 6: Review (Clinician)**
```
Clinician → Opens Patient Dashboard
    ↓
Sees lab results for "John Doe"
    ↓
Status: "verified" (needs review)
    ↓
Reviews results → Status: "reviewed"
```

**Step 7: Billing (Receptionist)**
```
Receptionist → Opens Billing Module
    ↓
Sees consultation for "John Doe"
    ↓
Creates invoice
    ↓
Processes payment
    ↓
Prints receipt
```

---

## 🎯 Key Mechanisms

### 1. **Status-Based Routing**

The system uses **status fields** to route patients:

- `consultation.status` → Determines if consultation is done
- `prescription.status` → Determines if prescription needs dispensing
- `lab_order.status` → Determines if lab test needs processing
- `invoice.payment_status` → Determines if payment is needed

### 2. **Queue System**

**Queue Management** tracks patient flow:
- Waiting queue → Shows who needs to be seen
- In-consultation queue → Shows who's currently being seen
- Completed queue → Shows who's finished

### 3. **Role-Based Filtering**

**Data Isolation** ensures users see relevant patients:
- Clinicians see patients from their department
- Pharmacists see patients with prescriptions
- Lab technicians see patients with lab orders
- Receptionists see all patients (for registration/billing)

### 4. **Linked Records**

**All records are linked**:
- Consultation → Linked to patient and clinician
- Prescription → Linked to consultation and patient
- Lab order → Linked to consultation and patient
- Invoice → Linked to consultation and patient

This allows users to:
- See full patient history
- Understand context
- Know what's been done
- Know what needs to be done next

---

## 📱 User Interface Indicators

### Visual Cues for Next Steps:

1. **Badge Colors**:
   - 🟡 Yellow/Orange = Needs attention
   - 🔵 Blue = In progress
   - 🟢 Green = Completed
   - 🔴 Red = Urgent/Critical

2. **Queue Numbers**:
   - Shows patient position in queue
   - Helps prioritize

3. **Status Labels**:
   - Clear text status (e.g., "Pending", "In Progress", "Completed")
   - Easy to understand

4. **Count Badges**:
   - "5 pending prescriptions"
   - "3 lab orders waiting"
   - "12 patients in queue"

---

## 🔐 Data Access Rules

### Who Can See What:

| Data Type | Receptionist | Clinician | Nurse | Pharmacist | Lab Tech | Admin |
|-----------|--------------|-----------|-------|------------|----------|-------|
| **Patient Basic Info** | ✅ View/Edit | ✅ View | ✅ View | ✅ View | ✅ View | ✅ All |
| **Consultations** | ✅ View | ✅ View/Edit | ✅ View | ❌ | ❌ | ✅ All |
| **Diagnosis** | ❌ | ✅ View/Edit | ✅ View | ❌ | ❌ | ✅ All |
| **Prescriptions** | ✅ View | ✅ View/Edit | ✅ View | ✅ View/Edit | ❌ | ✅ All |
| **Lab Orders** | ✅ View | ✅ View/Edit | ✅ View | ❌ | ✅ View/Edit | ✅ All |
| **Invoices** | ✅ View/Edit | ✅ View | ✅ View | ❌ | ❌ | ✅ All |

---

## 🎯 Decision Making Process

### How Users Determine Next Procedure:

### 1. **Check Status**
- Look at patient status badges
- Check queue position
- Review pending items

### 2. **Review History**
- Open patient dashboard
- See previous consultations
- Check what's been done
- Identify what's missing

### 3. **Follow Workflow**
- Registration → Consultation → Billing → Pharmacy
- Or: Registration → Consultation → Lab → Review → Billing

### 4. **Use Queue System**
- Check waiting queue
- See who's next
- Prioritize by urgency

---

## 💡 Best Practices

### For Clinicians:
1. ✅ Check queue regularly for waiting patients
2. ✅ Review patient history before consultation
3. ✅ Update status after each step
4. ✅ Create prescriptions/lab orders as needed

### For Pharmacists:
1. ✅ Check prescription queue daily
2. ✅ Prioritize urgent prescriptions
3. ✅ Verify medication availability
4. ✅ Update status after dispensing

### For Lab Technicians:
1. ✅ Check lab queue regularly
2. ✅ Process urgent/STAT orders first
3. ✅ Verify results before marking verified
4. ✅ Update order status as you progress

### For Receptionists:
1. ✅ Register patients promptly
2. ✅ Check in patients to queue
3. ✅ Create invoices after consultation
4. ✅ Process payments and print receipts

---

## 🔍 Current Limitations

### What's Missing:
1. ❌ **No automated workflow engine** (backend exists but not fully integrated)
2. ❌ **No task assignment system** (users must check queues manually)
3. ❌ **No notification system** (users must check dashboards)
4. ❌ **No workflow visualization** (can't see patient journey visually)

### What Works:
1. ✅ **Status-based routing** (status fields determine next steps)
2. ✅ **Queue system** (shows who needs attention)
3. ✅ **Role-based dashboards** (each role sees relevant data)
4. ✅ **Patient dashboard** (shows complete history)

---

## 🚀 Recommendations for Improvement

### 1. **Implement Workflow Engine**
- Automatically route patients to next stage
- Assign tasks to appropriate users
- Send notifications when tasks are ready

### 2. **Add Task Assignment**
- Allow clinicians to assign patients to specific users
- Show assigned patients in user's dashboard
- Track assignment history

### 3. **Add Notifications**
- Notify users when new patients need attention
- Alert when prescriptions are ready
- Notify when lab results are available

### 4. **Add Workflow Visualization**
- Show patient journey visually
- Display current stage
- Show what's been done and what's next

---

## 📝 Summary

### How Patients Are Shared:
1. ✅ **All patients are in central database**
2. ✅ **Users access patients based on their role**
3. ✅ **Data isolation ensures users see relevant patients**
4. ✅ **Search allows finding any patient (with permissions)**

### How Procedures Are Determined:
1. ✅ **Status fields indicate what needs to be done**
2. ✅ **Queue system shows pending work**
3. ✅ **Role-specific dashboards highlight relevant tasks**
4. ✅ **Patient dashboard shows complete history and next steps**

### Current Flow:
```
Registration → Queue → Consultation → Prescription/Lab → Billing → Completed
```

Each step updates status, making it visible to the next user in the workflow.

---

*Last Updated: 2025-01-XX*
*Status: Current Implementation Analysis*

