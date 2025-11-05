# Dashboard Dysfunctional Features Report

**Date**: January 2025  
**Scan Scope**: All user dashboards across roles

---

## 🔴 Critical Issues

### 1. **Prescription Creation Not Implemented**
**Location**: `app/dashboard/[role]/prescriptions/page.tsx` (Line 612-619)

**Issue**: 
- Prescription creation button shows "Coming Soon" toast
- TODO comment indicates implementation missing
- User cannot create prescriptions from the dashboard

**Code**:
```typescript
// TODO: Implement prescription creation with selected patient and medications
// const selectedPatientId = ...
// const prescriptionData = { ... }
// await prescriptionAPI.create(prescriptionData)
toast({
  title: "Coming Soon",
  description: "Prescription creation will be implemented soon.",
})
```

**Impact**: HIGH - Core functionality missing for clinicians

---

### 2. **Hardcoded User ID in Inventory**
**Location**: `app/dashboard/[role]/inventory/page.tsx` (Line 357)

**Issue**: 
- `createdBy: 'U001'` is hardcoded instead of using actual authenticated user
- TODO comment indicates should get from auth context

**Code**:
```typescript
createdBy: 'U001', // TODO: Get from auth context
```

**Impact**: MEDIUM - Audit trail incorrect, data isolation broken

---

### 3. **Revenue Change Calculation Not Implemented**
**Location**: `components/dashboard-overview.tsx` (Line 216)

**Issue**: 
- Revenue change percentage is hardcoded to `12.5`
- TODO comment indicates should calculate from historical data

**Code**:
```typescript
const revenueChange = 12.5 // TODO: Calculate from historical data
```

**Impact**: MEDIUM - Misleading metrics on dashboard

---

## 🟡 Moderate Issues

### 4. **Financial Growth Rate Not Calculated**
**Location**: `components/financial-overview.tsx` (Line 108)

**Issue**: 
- Growth rate hardcoded to `0`
- TODO indicates should calculate from previous period

**Code**:
```typescript
growthRate: 0, // TODO: Calculate from previous period
```

**Impact**: MEDIUM - Missing financial trend analysis

---

### 5. **Patient Tracking Not Implemented**
**Location**: `components/financial-overview.tsx` (Line 135)

**Issue**: 
- New vs returning patients not tracked
- Hardcoded to `0` for both metrics

**Code**:
```typescript
newThisMonth: 0, // TODO: Track new vs returning patients
returning: 0,
```

**Impact**: LOW - Missing patient analytics

---

### 6. **Mock Data Fallbacks in Visits Page**
**Location**: `app/dashboard/[role]/visits/page.tsx` (Lines 57-68, 111-259)

**Issue**: 
- Falls back to mock data on API errors
- Large mock data structure still in code
- May mask API connection issues

**Code**:
```typescript
// Fallback to mock data
setVisits(mockVisits)

const mockVisits = [ ... large array of mock data ... ]
```

**Impact**: MEDIUM - May hide API connection issues, provides false data

---

### 7. **SHA Claims Stats Using Mock Data**
**Location**: `components/reports-module.tsx` (Lines 344-355)

**Issue**: 
- SHA stats hardcoded to zeros
- Comment indicates "we don't have SHA claims context yet"
- But SHA claims API was just implemented!

**Code**:
```typescript
// Mock SHA stats for now (since we don't have SHA claims context yet)
const shaStats = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  totalAmount: 0,
  approvedAmount: 0,
}
```

**Impact**: MEDIUM - Reports showing incorrect SHA claims data despite API being available

---

## 🟢 Minor Issues

### 8. **Console Logs in Production Code**
**Location**: Multiple files

**Issues Found**:
- `app/dashboard/[role]/visits/page.tsx` (Lines 97, 102, 107, 458)
- `app/dashboard/[role]/prescriptions/page.tsx` (Lines 102, 132)
- `app/dashboard/[role]/inventory/page.tsx` (Line 83)

**Impact**: LOW - Debug code should be removed or use proper logging

---

### 9. **Unused Mock Data Declarations**
**Location**: `app/dashboard/[role]/prescriptions/page.tsx` (Line 138)

**Issue**: 
- Large `mockPrescriptions` array declared but marked as "Legacy mock data (kept for reference, not used)"

**Impact**: LOW - Code cleanup needed

---

### 10. **Type Safety Issues**
**Location**: Multiple dashboard files

**Issues Found**:
- Extensive use of `any` type in:
  - `app/dashboard/[role]/visits/page.tsx` (Lines 25, 26, 38, 203)
  - `app/dashboard/[role]/inventory/page.tsx` (Lines 30, 51, 63, 155, 170, 208, 272)

**Impact**: MEDIUM - Reduced type safety, potential runtime errors

---

## 📊 Summary by Priority

### High Priority (Fix Immediately)
1. ✅ Prescription creation functionality
2. ✅ Replace hardcoded user ID with auth context
3. ✅ Calculate revenue change from historical data

### Medium Priority (Fix Soon)
4. Calculate financial growth rate from previous periods
5. Replace SHA claims mock data with API calls
6. Remove or handle mock data fallbacks properly
7. Add proper TypeScript types

### Low Priority (Code Quality)
8. Remove console.log statements
9. Clean up unused mock data
10. Track new vs returning patients

---

## 🔧 Recommended Fixes

### Priority 1: Prescription Creation
1. Implement `prescriptionAPI.create()` call
2. Extract form data (patient, medications, notes)
3. Add proper error handling
4. Refresh prescriptions list after creation

### Priority 2: User Context Integration
1. Use `useAuth()` hook to get current user
2. Replace all hardcoded `'U001'` with `user?.id`
3. Ensure proper authentication checks

### Priority 3: Revenue Calculations
1. Implement historical revenue comparison
2. Calculate percentage change between periods
3. Add proper date range handling

### Priority 4: SHA Claims Integration
1. Create SHA claims context/hook
2. Replace mock stats with real API data
3. Connect to `/api/reports/sha-claims` endpoint

---

## ✅ Features Working Correctly

- ✅ Patient management dashboards
- ✅ Appointment booking
- ✅ Invoice management  
- ✅ Inventory display and search
- ✅ Queue management
- ✅ Billing module
- ✅ Financial dashboard (most features)
- ✅ Dashboard overview metrics (with API fallback)
- ✅ Real-time dashboard (WebSocket integration)
- ✅ User-specific dashboards
- ✅ Role-based dashboards

---

## 📝 Notes

- Most dashboards are functional and connected to backend APIs
- Main issues are incomplete implementations (prescriptions) and mock data usage
- Type safety can be improved across dashboard components
- Revenue calculations need historical data comparison logic

