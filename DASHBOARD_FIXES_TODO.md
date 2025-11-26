# 📋 Dashboard & Patient Data Input - TODO List

**Priority-Based Action Items**  
**Date**: January 2025  
**Total Items**: 25

---

## 🔴 Priority 1: Critical Fixes (Must Fix Immediately)

### 1. ✅ Add Duplicate Detection Before Registration
**Status**: Pending  
**File**: `components/registration-module.tsx`  
**Description**: Check for existing patients by phone, name, or patient number before creating new record. Show warning dialog if duplicates found.  
**Impact**: Prevents duplicate patient records  
**Estimated Time**: 4 hours

### 2. ✅ Add Automatic Returning Patient Detection
**Status**: Pending  
**File**: `components/registration-module.tsx`  
**Description**: Auto-search when phone number is entered (10+ digits). Pre-fill form with existing patient data. Show "Returning Patient" banner.  
**Impact**: Improves efficiency, prevents duplicates  
**Estimated Time**: 6 hours

### 3. ✅ Add Visit History Display in Patient View
**Status**: Pending  
**File**: `components/registration-module.tsx` (View Dialog)  
**Description**: Show all consultations, previous diagnoses, medication history, and link to previous invoices in patient details dialog.  
**Impact**: Better patient care, informed decisions  
**Estimated Time**: 8 hours

### 4. ✅ Replace Mock Data in User-Specific Dashboard
**Status**: Pending  
**File**: `components/dashboard/user-specific-dashboard.tsx`  
**Description**: Replace mock user activity data (lines 96-124) with real API calls to backend activity logging endpoint.  
**Impact**: Accurate data, better user experience  
**Estimated Time**: 4 hours

### 5. ✅ Implement Actual Quick Actions in Role Dashboards
**Status**: Pending  
**File**: `components/dashboard/role-specific-dashboard.tsx`  
**Description**: Replace console.log placeholders with real navigation/functionality for all role dashboards (admin, receptionist, nurse, clinician, pharmacist).  
**Impact**: Functional dashboards, better UX  
**Estimated Time**: 8 hours

---

## 🟠 Priority 2: High Priority (Fix Soon)

### 6. ✅ Add Visit Reason Field to Registration
**Status**: Pending  
**File**: `components/registration-module.tsx`  
**Description**: Capture why patient is visiting (chief complaint) during registration. Link to consultation and track visit patterns.  
**Impact**: Better visit tracking, analytics  
**Estimated Time**: 3 hours

### 7. ✅ Add Kenyan Phone Number Validation
**Status**: Pending  
**File**: `components/registration-module.tsx`  
**Description**: Validate phone format (254XXXXXXXXX or 0XXXXXXXXX). Auto-format on input. Show validation errors.  
**Impact**: Data quality, user experience  
**Estimated Time**: 3 hours

### 8. ✅ Add Quick Registration Mode for Returning Patients
**Status**: Pending  
**File**: `components/registration-module.tsx`  
**Description**: Allow minimal data entry (phone + visit reason) for returning patients. Auto-fill from previous registration.  
**Impact**: Faster registration, better efficiency  
**Estimated Time**: 6 hours

### 9. ✅ Link Visits to Billing Records
**Status**: Pending  
**File**: `components/billing-module.tsx`, `components/consultation-module.tsx`  
**Description**: Create clear relationship between consultations and invoices. Show invoice history per patient. Track what was billed for each visit.  
**Impact**: Better financial tracking, audit trail  
**Estimated Time**: 6 hours

### 10. ✅ Add Visit History Tracking Per Patient
**Status**: Pending  
**File**: Backend models, `components/registration-module.tsx`  
**Description**: Maintain visit history table. Track all visits with dates, reasons, diagnoses. Link visits to consultations and billing.  
**Impact**: Complete patient history  
**Estimated Time**: 8 hours

---

## 🟡 Priority 3: Medium Priority (Improve Efficiency)

### 11. ✅ Make Emergency Contact Fields Optional
**Status**: Pending  
**File**: `components/registration-module.tsx`  
**Description**: Allow registration to proceed without emergency contact to speed up process. Add "Skip for now" option.  
**Impact**: Faster registration  
**Estimated Time**: 1 hour

### 12. ✅ Add Location Autocomplete
**Status**: Pending  
**File**: `components/registration-module.tsx`  
**Description**: Provide suggestions for common Kenyan locations (Nairobi, Kiambu, Mombasa, etc.) to speed up data entry.  
**Impact**: Faster data entry, consistency  
**Estimated Time**: 3 hours

### 13. ✅ Implement Actual Settings Modals
**Status**: Pending  
**File**: `components/enhanced-dashboard-overview.tsx`, `components/realtime-dashboard-overview.tsx`  
**Description**: Replace toast notifications with real settings modals/pages for dashboard customization, preferences, and configuration.  
**Impact**: Better user experience  
**Estimated Time**: 6 hours

### 14. ✅ Add Invoice History Display Per Patient
**Status**: Pending  
**File**: `components/registration-module.tsx` (View Dialog)  
**Description**: Show all invoices for a patient with payment status, amounts, dates. Link to visit/consultation records.  
**Impact**: Better financial tracking  
**Estimated Time**: 4 hours

### 15. ✅ Create Patient Dashboard View
**Status**: Pending  
**File**: New component `components/patient-dashboard.tsx`  
**Description**: Show visit history, billing history, upcoming appointments, medication history, and key patient metrics in one place.  
**Impact**: Comprehensive patient view  
**Estimated Time**: 10 hours

---

## 🟢 Priority 4: Nice to Have (Enhancements)

### 16. ✅ Remove Console.log Statements
**Status**: Pending  
**File**: All dashboard components  
**Description**: Clean up all console.log statements in dashboard components and replace with proper logging or remove.  
**Impact**: Cleaner code, better performance  
**Estimated Time**: 2 hours

### 17. ✅ Add Prescription Queue View for Pharmacist
**Status**: Pending  
**File**: `components/dashboard/pharmacist/page.tsx`  
**Description**: Show pending prescriptions, allow filtering, and provide quick actions for dispensing.  
**Impact**: Better workflow for pharmacists  
**Estimated Time**: 6 hours

### 18. ✅ Add Vital Signs Quick Entry for Nurse
**Status**: Pending  
**File**: `components/dashboard/nurse/page.tsx`  
**Description**: Create form for rapid vital signs entry with validation and auto-save to patient record.  
**Impact**: Faster data entry for nurses  
**Estimated Time**: 4 hours

### 19. ✅ Add ICD-11 Code Lookup for Clinician
**Status**: Pending  
**File**: `components/dashboard/clinician/page.tsx`  
**Description**: Integrate ICD-11 code search functionality for diagnosis entry during consultations.  
**Impact**: Accurate diagnosis coding  
**Estimated Time**: 6 hours

### 20. ✅ Integrate Stock Alerts in Pharmacist Dashboard
**Status**: Pending  
**File**: `components/dashboard/pharmacist/page.tsx`  
**Description**: Show low stock and expiry alerts prominently. Link to inventory management.  
**Impact**: Better inventory awareness  
**Estimated Time**: 3 hours

### 21. ✅ Add Connection Retry UI for Real-time Dashboard
**Status**: Pending  
**File**: `components/realtime-dashboard-overview.tsx`  
**Description**: Show connection status, retry button, and connection quality metrics for WebSocket connections.  
**Impact**: Better real-time experience  
**Estimated Time**: 4 hours

### 22. ✅ Save User Preferences to Backend
**Status**: Pending  
**File**: `components/dashboard/user-specific-dashboard.tsx`  
**Description**: Replace localStorage-only storage with backend API calls. Sync preferences across devices.  
**Impact**: Better user experience  
**Estimated Time**: 4 hours

### 23. ✅ Implement Real Activity Logging
**Status**: Pending  
**File**: Backend + `components/dashboard/user-specific-dashboard.tsx`  
**Description**: Replace mock activity data with backend API calls. Log all user actions (registration, consultation, billing, etc.).  
**Impact**: Accurate activity tracking  
**Estimated Time**: 8 hours

### 24. ✅ Add Visit Reason Categorization
**Status**: Pending  
**File**: `components/registration-module.tsx`  
**Description**: Categorize visit reasons (follow-up, new complaint, routine check, emergency, etc.) for better analytics.  
**Impact**: Better analytics  
**Estimated Time**: 3 hours

### 25. ✅ Add Payment Method Tracking
**Status**: Pending  
**File**: `components/billing-module.tsx`  
**Description**: Track payment methods (cash, M-Pesa, SHA) per invoice. Show payment history and outstanding balances.  
**Impact**: Better financial tracking  
**Estimated Time**: 4 hours

### 26. ✅ Add "Last Visit" Indicator
**Status**: Pending  
**File**: `components/registration-module.tsx`  
**Description**: Show when patient last visited clinic in patient list and registration form. Highlight returning vs new patients.  
**Impact**: Better patient identification  
**Estimated Time**: 2 hours

---

## 📊 Summary

### By Priority:
- **Priority 1 (Critical)**: 5 items - ~30 hours
- **Priority 2 (High)**: 5 items - ~26 hours
- **Priority 3 (Medium)**: 5 items - ~24 hours
- **Priority 4 (Nice to Have)**: 11 items - ~46 hours

### Total Estimated Time:
- **Critical + High**: ~56 hours (1.5 weeks)
- **All Items**: ~126 hours (3+ weeks)

### By Category:
- **Dashboard Fixes**: 8 items
- **Patient Registration**: 7 items
- **Visit/Billing Integration**: 5 items
- **User Experience**: 5 items

---

## 🎯 Quick Wins (Can Do First)

These items can be completed quickly and provide immediate value:

1. **Make Emergency Contact Optional** (1 hour)
2. **Remove Console.log Statements** (2 hours)
3. **Add "Last Visit" Indicator** (2 hours)
4. **Add Phone Validation** (3 hours)
5. **Add Location Autocomplete** (3 hours)

**Total Quick Wins**: ~11 hours

---

## 📝 Notes

- All items should be tested after implementation
- Backend API endpoints may need to be created for some items
- Database migrations may be required for visit history tracking
- Consider user training for new features

---

**Last Updated**: January 2025  
**Version**: 1.0

