# Lab System Testing Guide

**Date**: January 2025  
**Purpose**: Comprehensive testing guide for the Lab Technician system

---

## 📋 Table of Contents

1. [Backend Testing](#backend-testing)
2. [Frontend Testing](#frontend-testing)
3. [Integration Testing](#integration-testing)
4. [User Acceptance Testing](#user-acceptance-testing)
5. [Test Scenarios](#test-scenarios)

---

## 🧪 Backend Testing

### Running Backend Tests

```bash
cd backend
cargo test lab_api_tests
```

### Test Coverage

#### Lab Order Tests
- ✅ `test_create_lab_order` - Create lab test order
- ✅ `test_get_lab_orders` - Get all orders
- ✅ `test_get_pending_lab_orders` - Get pending orders
- ✅ `test_update_lab_order` - Update order status
- ✅ `test_cancel_lab_order` - Cancel order

#### Lab Result Tests
- ✅ `test_create_lab_result` - Create test result
- ✅ `test_get_lab_results` - Get all results
- ✅ `test_verify_lab_result` - Verify result
- ✅ `test_review_lab_result` - Review result
- ✅ `test_get_patient_lab_results` - Get patient results

### Manual API Testing

Use tools like Postman or curl to test endpoints:

```bash
# Create lab order
curl -X POST http://localhost:8080/api/lab/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "PATIENT_UUID",
    "ordering_clinician_id": "CLINICIAN_UUID",
    "test_type": "CBC",
    "test_name": "Complete Blood Count",
    "priority": "routine"
  }'

# Get pending orders
curl -X GET http://localhost:8080/api/lab/orders/pending \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create lab result
curl -X POST http://localhost:8080/api/lab/results \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORDER_UUID",
    "test_type": "CBC",
    "test_name": "Complete Blood Count",
    "test_values": {
      "hemoglobin": 14.5,
      "hematocrit": 42.0
    }
  }'
```

---

## 🎨 Frontend Testing

### Component Testing Checklist

#### Lab Technician Dashboard
- [ ] Dashboard loads and displays statistics
- [ ] Statistics update correctly
- [ ] Recent orders display
- [ ] Recent results display
- [ ] Refresh button works
- [ ] Navigation to queue works
- [ ] Auto-refresh every 30 seconds

#### Lab Test Queue
- [ ] Queue displays pending orders
- [ ] Priority sorting works (STAT → Urgent → Routine)
- [ ] Date sorting works
- [ ] Search functionality works
- [ ] Filters work (priority, status, test type)
- [ ] "Collect Sample" button works
- [ ] "Start Test" button works
- [ ] "Enter Result" button navigates correctly
- [ ] Order status updates correctly

#### Lab Result Entry
- [ ] Form loads for CBC test type
- [ ] Form loads for Urinalysis test type
- [ ] Form loads for Blood Glucose test type
- [ ] Reference ranges display correctly
- [ ] Abnormal values are flagged (orange highlight)
- [ ] Values can be entered
- [ ] Notes field works
- [ ] Save button creates result
- [ ] Order status updates to "Completed" after save
- [ ] Error handling works

#### Lab Result Viewer
- [ ] Result displays correctly
- [ ] All test values show
- [ ] Reference ranges display
- [ ] Abnormal values highlighted
- [ ] Verification status shows
- [ ] Verify button works (for pending results)
- [ ] Review button works (for verified results)
- [ ] Print functionality works
- [ ] Back button works

### User Flow Testing

#### Complete Lab Workflow

1. **Clinician Orders Test**
   - [ ] Login as clinician
   - [ ] Open consultation module
   - [ ] Go to "Lab Tests" tab
   - [ ] Add lab test order (CBC, routine)
   - [ ] Save consultation
   - [ ] Verify order created

2. **Lab Technician Processes Order**
   - [ ] Login as lab technician
   - [ ] View lab dashboard
   - [ ] Check pending orders count
   - [ ] Open lab queue
   - [ ] Find the new order
   - [ ] Click "Collect Sample"
   - [ ] Verify status changes to "Collected"
   - [ ] Click "Start Test"
   - [ ] Verify status changes to "In Progress"
   - [ ] Click "Enter Result"
   - [ ] Fill in CBC results
   - [ ] Verify abnormal value detection
   - [ ] Add notes
   - [ ] Save result
   - [ ] Verify order status changes to "Completed"

3. **Lab Technician Verifies Result**
   - [ ] Go to Lab Results
   - [ ] Find the result (status: Pending)
   - [ ] Click "Verify Result"
   - [ ] Verify status changes to "Verified"

4. **Clinician Reviews Result**
   - [ ] Login as clinician
   - [ ] Open patient dashboard
   - [ ] Go to "Lab Results" tab
   - [ ] View the result
   - [ ] Click "Review Result"
   - [ ] Verify status changes to "Reviewed"

### Browser Testing

Test in multiple browsers:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if on Mac)
- [ ] Edge

### Responsive Testing

Test on different screen sizes:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

---

## 🔗 Integration Testing

### End-to-End Scenarios

#### Scenario 1: Complete Lab Workflow
```
1. Receptionist registers patient
2. Clinician creates consultation
3. Clinician orders CBC test (STAT priority)
4. Lab technician sees order in queue (at top due to STAT)
5. Lab technician collects sample
6. Lab technician enters results
7. System flags abnormal hemoglobin value
8. Lab technician verifies result
9. Clinician reviews result in patient dashboard
10. Result appears in patient's medical history
```

#### Scenario 2: Multiple Test Types
```
1. Clinician orders CBC, Urinalysis, and Blood Glucose
2. Lab technician processes each test
3. Each test has appropriate form
4. Results are saved separately
5. All results appear in patient dashboard
```

#### Scenario 3: Priority Handling
```
1. Create orders with different priorities:
   - STAT order
   - Urgent order
   - Routine order
2. Verify queue sorting (STAT first, then Urgent, then Routine)
3. Process STAT order first
4. Verify queue updates correctly
```

---

## ✅ User Acceptance Testing (UAT)

### Test Scenarios for Lab Technicians

#### Scenario 1: Daily Workflow
1. Login as lab technician
2. View dashboard - check pending orders
3. Open lab queue
4. Process first order (collect sample → start test → enter result)
5. Verify result
6. Repeat for 3-5 orders
7. Check statistics update

#### Scenario 2: Urgent Order Handling
1. Clinician creates STAT order
2. Lab technician sees urgent alert
3. Process STAT order immediately
4. Verify priority sorting

#### Scenario 3: Abnormal Value Detection
1. Enter CBC result with low hemoglobin (10.0)
2. Verify system flags as abnormal
3. Add note about abnormal value
4. Save and verify result
5. Check that abnormal flag is visible to clinician

### Test Scenarios for Clinicians

#### Scenario 1: Ordering Lab Tests
1. During consultation, go to "Lab Tests" tab
2. Add CBC test with clinical indication
3. Set priority to "urgent"
4. Save consultation
5. Verify order appears in lab queue

#### Scenario 2: Reviewing Results
1. Open patient dashboard
2. Go to "Lab Results" tab
3. View verified results
4. Review result details
5. Click "Review Result"
6. Verify status updates

---

## 🐛 Common Issues to Test

### Error Handling

1. **Network Errors**
   - [ ] Test with network disconnected
   - [ ] Verify error messages display
   - [ ] Test retry functionality

2. **Invalid Data**
   - [ ] Try to create order without patient_id
   - [ ] Try to enter invalid test values
   - [ ] Try to verify already verified result
   - [ ] Verify error messages are clear

3. **Permission Errors**
   - [ ] Try to access lab features as non-lab user
   - [ ] Try to verify result as non-lab technician
   - [ ] Verify proper error messages

### Edge Cases

1. **Empty Queue**
   - [ ] Test dashboard with no pending orders
   - [ ] Test queue with no orders
   - [ ] Verify empty state messages

2. **Large Datasets**
   - [ ] Test with 100+ pending orders
   - [ ] Test pagination
   - [ ] Test performance

3. **Concurrent Updates**
   - [ ] Two technicians process same order
   - [ ] Verify conflict handling
   - [ ] Test status updates

---

## 📊 Performance Testing

### Load Testing

1. **API Endpoints**
   - [ ] Test with 100 concurrent requests
   - [ ] Test response times
   - [ ] Test database query performance

2. **Frontend**
   - [ ] Test dashboard load time
   - [ ] Test queue rendering with 50+ orders
   - [ ] Test result entry form performance

### Stress Testing

1. **Database**
   - [ ] Test with 10,000 lab orders
   - [ ] Test query performance
   - [ ] Test index effectiveness

---

## ✅ Test Checklist Summary

### Backend
- [x] Unit tests created
- [ ] Integration tests pass
- [ ] API endpoints tested manually
- [ ] Error handling tested
- [ ] Performance tested

### Frontend
- [ ] All components render correctly
- [ ] User flows tested
- [ ] Error handling tested
- [ ] Responsive design tested
- [ ] Browser compatibility tested

### Integration
- [ ] End-to-end workflows tested
- [ ] Role-based access tested
- [ ] Data flow verified
- [ ] Activity logging verified

### UAT
- [ ] Lab technician workflow tested
- [ ] Clinician workflow tested
- [ ] Patient view tested
- [ ] Edge cases tested

---

## 🚀 Quick Test Commands

### Backend
```bash
# Run all lab tests
cargo test lab_api_tests

# Run specific test
cargo test test_create_lab_order

# Run with output
cargo test lab_api_tests -- --nocapture
```

### Frontend
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint
```

---

## 📝 Test Results Template

### Test Execution Log

**Date**: _____________  
**Tester**: _____________  
**Environment**: Development / Staging / Production

#### Backend Tests
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] API endpoints functional
- [ ] Error handling works

#### Frontend Tests
- [ ] Dashboard functional
- [ ] Queue functional
- [ ] Result entry functional
- [ ] Result viewer functional

#### Integration Tests
- [ ] Complete workflow works
- [ ] Role permissions work
- [ ] Data flow correct

#### Issues Found
1. _______________________
2. _______________________
3. _______________________

---

**Last Updated**: January 2025  
**Maintained By**: Development Team

