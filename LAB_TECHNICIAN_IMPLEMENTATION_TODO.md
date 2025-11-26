# 📋 Lab Technician Role & Lab Test Functionality - TODO List

**Date**: January 2025  
**Priority**: HIGH - Critical missing functionality  
**Status**: Not Started

---

## 🎯 Overview

Implement complete lab technician role and lab test management system to enable:
- Lab test ordering by clinicians
- Lab test queue management
- Lab result entry by technicians
- Lab result viewing by clinicians
- Complete lab workflow tracking

---

## 📊 Implementation Tasks

### Phase 1: Database & Backend Foundation (HIGH PRIORITY)

#### 1. ✅ Database Schema
**Status**: Pending  
**Priority**: Critical  
**Estimated Time**: 2-3 hours

**Tasks**:
- [ ] Create database migration file: `020_lab_tests.sql`
- [ ] Create `lab_test_orders` table with all required fields
- [ ] Create `lab_test_results` table with all required fields
- [ ] Add indexes for performance (patient_id, order_number, status, etc.)
- [ ] Add foreign key constraints
- [ ] Add check constraints for status values
- [ ] Test migration on development database

**Files to Create**:
- `backend/migrations/020_lab_tests.sql`

**Acceptance Criteria**:
- Tables created successfully
- All indexes created
- Foreign keys working
- Constraints enforced

---

#### 2. ✅ Backend Models
**Status**: Pending  
**Priority**: Critical  
**Estimated Time**: 1-2 hours

**Tasks**:
- [ ] Add `LabTestOrder` struct to `backend/src/models.rs`
- [ ] Add `LabTestResult` struct to `backend/src/models.rs`
- [ ] Add `CreateLabTestOrder` struct
- [ ] Add `CreateLabTestResult` struct
- [ ] Add `UpdateLabTestOrder` struct
- [ ] Add `UpdateLabTestResult` struct
- [ ] Add validation methods
- [ ] Add helper methods (status transitions, etc.)

**Files to Modify**:
- `backend/src/models.rs`

**Acceptance Criteria**:
- All structs defined
- Validation working
- Serialization/deserialization working

---

#### 3. ✅ Backend API Handlers
**Status**: Pending  
**Priority**: Critical  
**Estimated Time**: 4-5 hours

**Tasks**:
- [ ] Create `backend/src/handlers/lab_order_handlers.rs`
  - [ ] `create_lab_order` - Create new lab test order
  - [ ] `get_lab_orders` - Get all orders (with filters)
  - [ ] `get_lab_order` - Get specific order
  - [ ] `update_lab_order` - Update order status
  - [ ] `get_pending_orders` - Get pending orders for queue
  - [ ] `cancel_lab_order` - Cancel order
- [ ] Create `backend/src/handlers/lab_result_handlers.rs`
  - [ ] `create_lab_result` - Create test result
  - [ ] `get_lab_results` - Get all results
  - [ ] `get_lab_result` - Get specific result
  - [ ] `update_lab_result` - Update result
  - [ ] `get_patient_lab_results` - Get patient's all results
  - [ ] `get_order_results` - Get results for specific order
  - [ ] `verify_lab_result` - Verify result
  - [ ] `review_lab_result` - Review result (clinician)

**Files to Create**:
- `backend/src/handlers/lab_order_handlers.rs`
- `backend/src/handlers/lab_result_handlers.rs`

**Files to Modify**:
- `backend/src/handlers/mod.rs` - Export new handlers

**Acceptance Criteria**:
- All endpoints working
- Proper error handling
- Authentication/authorization
- Validation working

---

#### 4. ✅ Backend Routes
**Status**: Pending  
**Priority**: Critical  
**Estimated Time**: 1 hour

**Tasks**:
- [ ] Add lab order routes to `backend/src/main.rs`:
  - [ ] `POST /api/v1/lab/orders` - Create order
  - [ ] `GET /api/v1/lab/orders` - Get all orders
  - [ ] `GET /api/v1/lab/orders/:id` - Get specific order
  - [ ] `PUT /api/v1/lab/orders/:id` - Update order
  - [ ] `GET /api/v1/lab/orders/pending` - Get pending orders
  - [ ] `DELETE /api/v1/lab/orders/:id` - Cancel order
- [ ] Add lab result routes:
  - [ ] `POST /api/v1/lab/results` - Create result
  - [ ] `GET /api/v1/lab/results` - Get all results
  - [ ] `GET /api/v1/lab/results/:id` - Get specific result
  - [ ] `PUT /api/v1/lab/results/:id` - Update result
  - [ ] `GET /api/v1/lab/results/patient/:patient_id` - Get patient results
  - [ ] `GET /api/v1/lab/results/order/:order_id` - Get order results
  - [ ] `POST /api/v1/lab/results/:id/verify` - Verify result
  - [ ] `POST /api/v1/lab/results/:id/review` - Review result
- [ ] Add authentication middleware
- [ ] Add role-based access control

**Files to Modify**:
- `backend/src/main.rs`

**Acceptance Criteria**:
- All routes registered
- Authentication working
- Role-based access enforced

---

#### 5. ✅ User Role Addition (Backend)
**Status**: Pending  
**Priority**: Critical  
**Estimated Time**: 1-2 hours

**Tasks**:
- [ ] Add `lab_technician` to role enum in database
- [ ] Add lab technician permissions to `backend/src/user_management.rs`
- [ ] Add lab technician to role hierarchy
- [ ] Add lab technician permissions:
  - [ ] `lab_orders:read`
  - [ ] `lab_orders:write`
  - [ ] `lab_results:read`
  - [ ] `lab_results:write`
  - [ ] `lab_results:verify`
- [ ] Update permission validator

**Files to Modify**:
- `backend/src/user_management.rs`
- `backend/src/security/permission_validator.rs`
- Database migration (if needed)

**Acceptance Criteria**:
- Lab technician role exists
- Permissions working
- Role hierarchy updated

---

### Phase 2: Frontend API Client (HIGH PRIORITY)

#### 6. ✅ API Client Methods
**Status**: Pending  
**Priority**: Critical  
**Estimated Time**: 2-3 hours

**Tasks**:
- [ ] Add lab order API methods to `lib/api-client.ts`:
  - [ ] `createLabOrder` - Create lab test order
  - [ ] `getLabOrders` - Get all orders
  - [ ] `getLabOrder` - Get specific order
  - [ ] `updateLabOrder` - Update order
  - [ ] `getPendingLabOrders` - Get pending orders
  - [ ] `cancelLabOrder` - Cancel order
- [ ] Add lab result API methods:
  - [ ] `createLabResult` - Create result
  - [ ] `getLabResults` - Get all results
  - [ ] `getLabResult` - Get specific result
  - [ ] `updateLabResult` - Update result
  - [ ] `getPatientLabResults` - Get patient results
  - [ ] `getOrderLabResults` - Get order results
  - [ ] `verifyLabResult` - Verify result
  - [ ] `reviewLabResult` - Review result
- [ ] Add TypeScript interfaces for lab orders and results
- [ ] Add error handling

**Files to Modify**:
- `lib/api-client.ts`

**Acceptance Criteria**:
- All API methods implemented
- TypeScript types defined
- Error handling working

---

### Phase 3: Frontend Components (HIGH PRIORITY)

#### 7. ✅ Lab Technician Dashboard
**Status**: Pending  
**Priority**: Critical  
**Estimated Time**: 3-4 hours

**Tasks**:
- [ ] Create `components/lab-technician-dashboard.tsx`
- [ ] Display lab test queue
- [ ] Show pending orders count
- [ ] Show completed tests today
- [ ] Show statistics (tests completed, pending, etc.)
- [ ] Add quick actions (view queue, enter results)
- [ ] Add filters (by status, date, test type)
- [ ] Add search functionality

**Files to Create**:
- `components/lab-technician-dashboard.tsx`

**Acceptance Criteria**:
- Dashboard displays correctly
- All statistics working
- Navigation functional

---

#### 8. ✅ Lab Test Queue Component
**Status**: Pending  
**Priority**: Critical  
**Estimated Time**: 4-5 hours

**Tasks**:
- [ ] Create `components/lab-test-queue.tsx`
- [ ] Display pending lab test orders
- [ ] Show order details (patient, test type, priority, date)
- [ ] Add filters (by priority, test type, date)
- [ ] Add search functionality
- [ ] Add "Collect Sample" action
- [ ] Add "Start Test" action
- [ ] Add "Enter Results" action
- [ ] Show order status (pending, collected, in_progress)
- [ ] Add pagination

**Files to Create**:
- `components/lab-test-queue.tsx`

**Acceptance Criteria**:
- Queue displays all pending orders
- Filters working
- Actions functional
- Status updates working

---

#### 9. ✅ Lab Result Entry Component
**Status**: Pending  
**Priority**: Critical  
**Estimated Time**: 5-6 hours

**Tasks**:
- [ ] Create `components/lab-result-entry.tsx`
- [ ] Form for entering test results
- [ ] Dynamic form based on test type (CBC, Urinalysis, etc.)
- [ ] Input validation for each test value
- [ ] Reference range display
- [ ] Abnormal value flagging
- [ ] Notes field
- [ ] File upload for lab report PDFs
- [ ] Save draft functionality
- [ ] Verify result action
- [ ] Preview before saving

**Files to Create**:
- `components/lab-result-entry.tsx`

**Test Type Forms Needed**:
- [ ] CBC result form (hemoglobin, hematocrit, WBC, RBC, platelets)
- [ ] Urinalysis form (color, appearance, pH, protein, glucose, etc.)
- [ ] Blood Glucose form (glucose level)
- [ ] Generic form for other test types

**Acceptance Criteria**:
- All test types supported
- Validation working
- Reference ranges displayed
- Abnormal flags working
- File upload working

---

#### 10. ✅ Lab Result Viewer Component
**Status**: Pending  
**Priority**: High  
**Estimated Time**: 3-4 hours

**Tasks**:
- [ ] Create `components/lab-result-viewer.tsx`
- [ ] Display lab test results
- [ ] Show test values with reference ranges
- [ ] Highlight abnormal values
- [ ] Show test timeline (ordered, collected, completed)
- [ ] Display lab report PDFs
- [ ] Add "Review" action for clinicians
- [ ] Add "Print" functionality
- [ ] Show verification status
- [ ] Show review status

**Files to Create**:
- `components/lab-result-viewer.tsx`

**Acceptance Criteria**:
- Results display correctly
- Abnormal values highlighted
- PDFs viewable
- Print working

---

#### 11. ✅ Lab Test Ordering (Clinician Interface)
**Status**: Pending  
**Priority**: High  
**Estimated Time**: 3-4 hours

**Tasks**:
- [ ] Add lab test ordering to consultation module
- [ ] Lab test selection interface
- [ ] Show available lab tests
- [ ] Add test to consultation
- [ ] Set priority (routine, urgent, stat)
- [ ] Add clinical indication
- [ ] Display ordered tests in consultation
- [ ] Link to lab results when available

**Files to Modify**:
- `components/consultation-module.tsx`

**Acceptance Criteria**:
- Clinicians can order lab tests
- Tests linked to consultation
- Priority and indication saved

---

#### 12. ✅ Lab Results in Patient Dashboard
**Status**: Pending  
**Priority**: High  
**Estimated Time**: 2-3 hours

**Tasks**:
- [ ] Add lab results section to patient dashboard
- [ ] Display all lab results for patient
- [ ] Show test history
- [ ] Link to detailed result view
- [ ] Show latest results
- [ ] Filter by test type
- [ ] Filter by date range

**Files to Modify**:
- `components/patient-dashboard.tsx`

**Acceptance Criteria**:
- Lab results visible in patient view
- History displayed correctly
- Links working

---

### Phase 4: Role Configuration & Navigation (MEDIUM PRIORITY)

#### 13. ✅ Role Configuration Updates
**Status**: Pending  
**Priority**: Medium  
**Estimated Time**: 1-2 hours

**Tasks**:
- [ ] Add `lab_technician` to role types in `lib/auth.ts`
- [ ] Add lab technician to role config in `components/dashboard-layout.tsx`
- [ ] Add lab technician permissions
- [ ] Add lab technician to role hierarchy
- [ ] Update `contexts/user-management-context.tsx` to include lab_technician
- [ ] Update `hooks/use-data-isolation.ts` for lab technician permissions

**Files to Modify**:
- `lib/auth.ts`
- `components/dashboard-layout.tsx`
- `contexts/user-management-context.tsx`
- `hooks/use-data-isolation.ts`

**Acceptance Criteria**:
- Lab technician role recognized
- Permissions working
- Role hierarchy correct

---

#### 14. ✅ Navigation & Dashboard Integration
**Status**: Pending  
**Priority**: Medium  
**Estimated Time**: 2-3 hours

**Tasks**:
- [ ] Add lab technician navigation items
- [ ] Create lab technician dashboard route
- [ ] Add lab technician to role-specific dashboard
- [ ] Add lab menu items:
  - [ ] Lab Queue
  - [ ] Enter Results
  - [ ] Lab History
  - [ ] Lab Reports
- [ ] Update dashboard overview for lab technician

**Files to Modify**:
- `components/dashboard-layout.tsx`
- `components/dashboard/role-specific-dashboard.tsx`
- `app/dashboard/lab-technician/page.tsx` (create if needed)

**Acceptance Criteria**:
- Navigation working
- Dashboard accessible
- Menu items functional

---

### Phase 5: Testing & Documentation (MEDIUM PRIORITY)

#### 15. ✅ Backend Testing
**Status**: Pending  
**Priority**: Medium  
**Estimated Time**: 3-4 hours

**Tasks**:
- [ ] Write unit tests for lab order handlers
- [ ] Write unit tests for lab result handlers
- [ ] Write integration tests for lab API
- [ ] Test error handling
- [ ] Test validation
- [ ] Test permissions
- [ ] Test status transitions

**Files to Create**:
- `backend/tests/lab_order_tests.rs`
- `backend/tests/lab_result_tests.rs`

**Acceptance Criteria**:
- All tests passing
- Good test coverage
- Error cases tested

---

#### 16. ✅ Frontend Testing
**Status**: Pending  
**Priority**: Medium  
**Estimated Time**: 2-3 hours

**Tasks**:
- [ ] Test lab technician dashboard
- [ ] Test lab test queue
- [ ] Test lab result entry
- [ ] Test lab result viewer
- [ ] Test lab test ordering (clinician)
- [ ] Test permissions
- [ ] Test error handling

**Acceptance Criteria**:
- All components working
- No console errors
- User flows functional

---

#### 17. ✅ Documentation
**Status**: Pending  
**Priority**: Low  
**Estimated Time**: 2-3 hours

**Tasks**:
- [ ] Update `USER_ROLES_PATIENT_DATA_RECORDING.md` with lab technician
- [ ] Create `LAB_TECHNICIAN_USER_GUIDE.md`
- [ ] Update API documentation
- [ ] Create lab workflow diagram
- [ ] Document lab test types and reference ranges

**Files to Create/Modify**:
- `LAB_TECHNICIAN_USER_GUIDE.md`
- `USER_ROLES_PATIENT_DATA_RECORDING.md` (update)

**Acceptance Criteria**:
- Documentation complete
- User guide clear
- API docs updated

---

## 📊 Task Summary

### By Phase:
- **Phase 1 (Backend)**: 5 tasks, ~10-13 hours
- **Phase 2 (API Client)**: 1 task, ~2-3 hours
- **Phase 3 (Frontend)**: 6 tasks, ~20-26 hours
- **Phase 4 (Configuration)**: 2 tasks, ~3-5 hours
- **Phase 5 (Testing)**: 3 tasks, ~7-10 hours

### Total Estimated Time: **42-57 hours** (~5-7 days)

### By Priority:
- **Critical (Must Have)**: 11 tasks
- **High Priority**: 2 tasks
- **Medium Priority**: 4 tasks
- **Low Priority**: 1 task

---

## 🎯 Quick Start Checklist

### Minimum Viable Implementation (MVP):
1. ✅ Database tables (lab_test_orders, lab_test_results)
2. ✅ Backend API endpoints (create order, create result, get results)
3. ✅ Lab technician role addition
4. ✅ Lab test queue component
5. ✅ Lab result entry component
6. ✅ Lab test ordering in consultation module

**MVP Time**: ~25-30 hours (~3-4 days)

---

## 🚀 Implementation Order

### Week 1: Backend Foundation
1. Database schema
2. Backend models
3. Backend API handlers
4. Backend routes
5. User role addition

### Week 2: Frontend Implementation
6. API client methods
7. Lab technician dashboard
8. Lab test queue
9. Lab result entry
10. Lab result viewer

### Week 3: Integration & Testing
11. Lab test ordering (clinician)
12. Lab results in patient dashboard
13. Role configuration
14. Navigation integration
15. Testing

### Week 4: Polish & Documentation
16. Frontend testing
17. Backend testing
18. Documentation

---

## ✅ Definition of Done

### Each Task is Complete When:
- [ ] Code written and tested
- [ ] No linter errors
- [ ] No console errors
- [ ] Functionality working as expected
- [ ] Error handling implemented
- [ ] User feedback/validation working
- [ ] Documentation updated (if needed)

### Overall Feature is Complete When:
- [ ] All tasks completed
- [ ] Lab technician can view queue
- [ ] Lab technician can enter results
- [ ] Clinicians can order lab tests
- [ ] Clinicians can view lab results
- [ ] Lab workflow end-to-end working
- [ ] All tests passing
- [ ] Documentation complete

---

## 📝 Notes

### Important Considerations:
- **Test Types**: Start with CBC, Urinalysis, Blood Glucose. Add more as needed.
- **Reference Ranges**: May need to be configurable per clinic
- **File Attachments**: Consider storage solution (local or cloud)
- **Notifications**: Consider adding notifications when results ready
- **Printing**: Lab results should be printable
- **Integration**: Lab results should integrate with consultation workflow

### Future Enhancements (Not in MVP):
- Lab equipment management
- Quality control tracking
- Lab inventory (reagents, supplies)
- Lab technician scheduling
- Lab report templates
- Automated result interpretation
- Lab result alerts for critical values

---

**Last Updated**: January 2025  
**Status**: 📋 Ready to Begin Implementation

