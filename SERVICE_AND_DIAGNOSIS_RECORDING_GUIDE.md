# Service and Diagnosis Recording Guide

## Overview

This guide explains how to add services while recording the diagnosis, ensuring proper documentation and compliance with insurance requirements (especially SHA claims).

---

## 🔄 Current Workflow

### **Option 1: Consultation First, Then Billing**

**Step 1: Record Consultation**
1. Clinician opens Consultation Module
2. Records:
   - Chief complaint
   - **Diagnosis** (with ICD-11 code)
   - Physical examination
   - Treatment plan
3. Adds services (e.g., HIV Test, CBC)
4. Saves consultation

**Step 2: Generate Invoice**
1. Consultation data flows to billing
2. Services from consultation are auto-loaded
3. Diagnosis is already recorded
4. Invoice is generated with linked diagnosis

**Result**: Diagnosis and services are linked through the consultation.

---

### **Option 2: Direct Billing (Standalone Service)**

**Current Limitation**: When adding services directly in billing module, diagnosis is not captured at the service level.

**For SHA Claims**: Diagnosis is required and must be linked to services.

---

## 📋 Why Diagnosis is Required

### **For SHA Insurance Claims**

SHA (Social Health Authority) requires:
- ✅ **ICD-11 Diagnosis Code** - Standardized diagnosis code
- ✅ **Diagnosis Description** - Full diagnosis name
- ✅ **Service Code** - SHA-approved service code
- ✅ **Service Description** - What service was provided
- ✅ **Linkage** - Service must be justified by diagnosis

**Example**:
- **Diagnosis**: "Suspected HIV infection" (ICD-11: Z20.6)
- **Service**: "HIV Test" (LAB-006)
- **Justification**: HIV test is medically indicated for suspected HIV infection

---

## 🎯 How to Add Service with Diagnosis

### **Method 1: Through Consultation (Recommended)**

**Workflow**:
```
1. Patient Visit
   ↓
2. Clinician Records Consultation
   - Chief Complaint: "Patient requests HIV test"
   - Diagnosis: "Suspected HIV infection" (Z20.6)
   - Services: HIV Test
   ↓
3. Consultation Saved
   ↓
4. Billing Module Opens
   - Services auto-loaded from consultation
   - Diagnosis already linked
   ↓
5. Invoice Generated
   - Services with diagnosis
   - Ready for SHA claim (if applicable)
```

**Benefits**:
- ✅ Diagnosis and services are properly linked
- ✅ Medical justification is documented
- ✅ Compliant with SHA requirements
- ✅ Complete medical record

---

### **Method 2: Direct Billing with Diagnosis Capture**

**When to Use**:
- Standalone services (e.g., walk-in lab test)
- No consultation needed
- Direct billing required

**Enhanced Workflow** (to be implemented):
```
1. Open Billing Module
   ↓
2. Select Service (e.g., HIV Test)
   ↓
3. System Prompts for Diagnosis
   - Required for SHA claims
   - Optional for cash payments
   ↓
4. Enter Diagnosis
   - Search ICD-11 codes
   - Select appropriate diagnosis
   ↓
5. Service Added with Diagnosis
   ↓
6. Invoice Generated
   - Service linked to diagnosis
   - SHA claim ready (if applicable)
```

---

## 📊 Service-Diagnosis Relationship

### **Examples**

| Service | Typical Diagnosis | ICD-11 Code | Justification |
|---------|------------------|-------------|---------------|
| **HIV Test** | Suspected HIV infection | Z20.6 | Testing for HIV exposure |
| **HIV Test** | Routine screening | Z11.4 | Preventive screening |
| **CBC** | Anemia | D64.9 | Diagnose blood disorder |
| **Blood Sugar** | Diabetes mellitus | E11.9 | Monitor diabetes |
| **Urinalysis** | Urinary tract infection | N39.0 | Diagnose UTI |
| **X-Ray** | Fracture | S72.9 | Diagnose bone injury |

---

## 🔧 Implementation Details

### **Current System**

**Consultation Module**:
- ✅ Records diagnosis with ICD-11 code
- ✅ Records services
- ✅ Links services to consultation
- ✅ Diagnosis flows to billing

**Billing Module**:
- ✅ Can add services directly
- ⚠️ Diagnosis not captured at service level (for standalone billing)
- ✅ SHA details form includes diagnosis (for SHA invoices)

---

### **Enhanced Billing Module** (Recommended Enhancement)

**When Adding Service**:
1. Select service from catalog
2. **If SHA payment type**:
   - System prompts for diagnosis
   - Search ICD-11 codes
   - Link diagnosis to service
3. **If Cash payment**:
   - Diagnosis optional
   - Can be added for documentation
4. Service added with diagnosis link

**Service Item Structure**:
```typescript
{
  id: string
  type: 'service'
  description: string
  quantity: number
  unit_price: number
  total_price: number
  diagnosis?: {
    code: string      // ICD-11 code
    description: string  // Diagnosis name
  }
  sha_covered: boolean
}
```

---

## 📝 SHA Claim Requirements

### **Required Information**

For each service in SHA claim:

1. **Diagnosis**:
   - ICD-11 code (e.g., Z20.6)
   - Diagnosis description (e.g., "Suspected HIV infection")

2. **Service**:
   - SHA service code (e.g., SHA-08-004)
   - Service description (e.g., "HIV rapid test")

3. **Linkage**:
   - Service must be medically justified by diagnosis
   - Must be SHA-approved service

4. **Authorization**:
   - Authorization code (if required)
   - Pre-authorization code (if applicable)

---

## 🎓 Best Practices

### **For Clinicians**

1. ✅ **Always record diagnosis before services**
   - Ensures medical justification
   - Required for insurance claims
   - Better patient care documentation

2. ✅ **Use appropriate ICD-11 codes**
   - Standardized coding
   - Required for SHA claims
   - Better data analysis

3. ✅ **Link services to diagnosis**
   - Each service should have a medical reason
   - Document why service is needed

### **For Receptionists/Billing Staff**

1. ✅ **Use consultation workflow when possible**
   - Diagnosis already recorded
   - Services already linked
   - Less data entry

2. ✅ **For standalone services**:
   - Ask clinician for diagnosis
   - Record diagnosis when adding service
   - Ensure SHA compliance

3. ✅ **Verify diagnosis for SHA claims**
   - Diagnosis must match service
   - ICD-11 code must be valid
   - Service must be SHA-approved

---

## 🔍 Example Scenarios

### **Scenario 1: HIV Test with Consultation**

**Step 1: Consultation**
- Patient: "I want to test for HIV"
- Chief Complaint: "Request for HIV testing"
- Diagnosis: "Suspected HIV infection" (Z20.6)
- Service: HIV Test (LAB-006)

**Step 2: Billing**
- Service auto-loaded: HIV Test
- Diagnosis already linked: Z20.6
- Payment: Cash or SHA
- Invoice generated

**Result**: Complete record with diagnosis-service linkage.

---

### **Scenario 2: Standalone HIV Test (Walk-in)**

**Step 1: Direct Billing**
- Patient requests HIV test
- No consultation
- Service: HIV Test (LAB-006)

**Step 2: Diagnosis Capture** (Enhanced)
- System prompts: "Diagnosis required for this service"
- User selects: "Routine screening" (Z11.4) or "Suspected HIV infection" (Z20.6)
- Service added with diagnosis

**Step 3: Invoice**
- Service: HIV Test
- Diagnosis: Z11.4 (Routine screening)
- Payment: Cash
- Invoice generated

**Result**: Service documented with diagnosis.

---

### **Scenario 3: SHA Claim for HIV Test**

**Step 1: Consultation**
- Diagnosis: "Suspected HIV infection" (Z20.6)
- Service: HIV Test (LAB-006)

**Step 2: Billing - SHA Payment**
- Service: HIV Test
- Diagnosis: Z20.6
- SHA Details:
  - Member Number: SHA-123456
  - Authorization Code: AUTH-001
  - ICD-11 Code: Z20.6
  - Diagnosis: "Suspected HIV infection"
  - Service Code: SHA-08-004
  - Service Description: "HIV rapid test"

**Step 3: SHA Claim Generated**
- All required information linked
- Ready for submission

**Result**: Compliant SHA claim with diagnosis-service linkage.

---

## 🚀 Recommended Enhancements

### **1. Diagnosis Prompt in Billing Module**

**When adding service**:
- If SHA payment type → Require diagnosis
- If Cash payment → Optional diagnosis (for documentation)
- Show ICD-11 code search
- Link diagnosis to service item

### **2. Service-Diagnosis Validation**

**System checks**:
- Service is appropriate for diagnosis
- ICD-11 code is valid
- SHA service code matches diagnosis
- Medical justification exists

### **3. Auto-Suggest Services Based on Diagnosis**

**When diagnosis is entered**:
- System suggests appropriate services
- Example: "Suspected HIV infection" → Suggests "HIV Test"
- User can select from suggestions

---

## 📋 Summary

### **Current State**

✅ **Consultation Module**:
- Records diagnosis and services
- Links them together
- Flows to billing

⚠️ **Billing Module**:
- Can add services directly
- Diagnosis not captured at service level (for standalone)
- SHA form has diagnosis (but not per-service)

### **Recommended Workflow**

1. **Use Consultation First** (when possible)
   - Diagnosis recorded
   - Services added
   - Properly linked

2. **For Standalone Services**
   - Capture diagnosis when adding service
   - Link diagnosis to service
   - Ensure SHA compliance

3. **For SHA Claims**
   - Diagnosis is mandatory
   - Must link to each service
   - Use proper ICD-11 codes

---

## 🎯 Key Points

1. ✅ **Diagnosis is required** for proper medical documentation
2. ✅ **Services should be linked** to diagnosis for justification
3. ✅ **SHA claims require** diagnosis-service linkage
4. ✅ **Consultation workflow** automatically links diagnosis and services
5. ✅ **Standalone billing** should capture diagnosis when adding services

---

*Last Updated: 2025-01-XX*
*Status: Current Implementation + Recommendations*

