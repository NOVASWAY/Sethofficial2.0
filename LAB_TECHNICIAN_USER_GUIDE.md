# Lab Technician User Guide

**Version**: 1.0  
**Last Updated**: January 2025  
**System**: Seth Medical Clinic Management System

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Lab Technician Dashboard](#lab-technician-dashboard)
4. [Managing Lab Test Queue](#managing-lab-test-queue)
5. [Entering Lab Test Results](#entering-lab-test-results)
6. [Verifying Results](#verifying-results)
7. [Viewing Lab Results](#viewing-lab-results)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The Lab Technician role in the clinic management system allows you to:
- View and manage pending lab test orders
- Enter lab test results for various test types
- Verify lab test results
- Track lab test history and statistics
- Access patient information relevant to lab tests

### Key Features

- **Lab Test Queue**: View all pending lab test orders organized by priority
- **Result Entry**: Enter results with automatic abnormal value detection
- **Result Verification**: Verify results before they're reviewed by clinicians
- **Test Type Support**: CBC, Urinalysis, Blood Glucose, and more
- **Reference Ranges**: Automatic comparison with normal ranges
- **Priority Management**: Handle STAT, urgent, and routine orders

---

## 🚀 Getting Started

### Accessing the Lab Dashboard

1. Log in to the system with your lab technician credentials
2. You will be automatically directed to the Lab Technician Dashboard
3. If you need to navigate manually, go to: **Dashboard → Lab Dashboard**

### Navigation Menu

As a lab technician, you have access to:
- **Lab Dashboard**: Overview of pending orders and statistics
- **Lab Queue**: View and manage pending lab test orders
- **Lab Results**: View all lab test results
- **Patient Records**: View patient information (read-only for lab purposes)

---

## 📊 Lab Technician Dashboard

The dashboard provides an overview of your lab operations:

### Statistics Cards

- **Pending Orders**: Number of tests awaiting processing
- **Completed Today**: Tests completed today
- **Verified Today**: Results verified today
- **Urgent Orders**: Orders requiring immediate attention (STAT/Urgent)

### Dashboard Tabs

1. **Test Queue**: Shows recent pending orders
2. **Recent Results**: Displays recently completed results
3. **Statistics**: Overview of lab operations metrics

### Quick Actions

- **View Queue**: Navigate to the full lab test queue
- **Refresh**: Update dashboard data
- **Enter Result**: Quick access to result entry

---

## 📋 Managing Lab Test Queue

### Viewing the Queue

1. Navigate to **Lab Queue** from the dashboard or navigation menu
2. The queue displays all pending orders sorted by priority:
   - **STAT** orders (highest priority - red badge)
   - **Urgent** orders (orange badge)
   - **Routine** orders (gray badge)

### Queue Features

#### Filtering

- **Search**: Search by order number, test name, test type, or patient ID
- **Priority Filter**: Filter by STAT, Urgent, or Routine
- **Status Filter**: Filter by Pending, Collected, or In Progress
- **Test Type Filter**: Filter by specific test type (CBC, Urinalysis, etc.)

#### Sorting

- **By Priority**: Sort by priority level (STAT → Urgent → Routine)
- **By Date**: Sort by order date (newest or oldest first)

### Order Actions

#### Collect Sample

1. Click **"Collect Sample"** on a pending order
2. The order status changes to "Collected"
3. The collection time is automatically recorded

#### Start Test

1. After collecting a sample, click **"Start Test"**
2. The order status changes to "In Progress"
3. You can now proceed to enter results

#### Enter Result

1. Click **"Enter Result"** on any order
2. You'll be taken to the result entry form
3. Fill in the test values and save

---

## 🧪 Entering Lab Test Results

### Accessing Result Entry

1. From the queue, click **"Enter Result"** on an order
2. Or navigate to **Lab Results → Enter Result** and select an order

### Supported Test Types

The system supports structured forms for:

#### Complete Blood Count (CBC)
- Hemoglobin (g/dL)
- Hematocrit (%)
- White Blood Cells (×10³/µL)
- Red Blood Cells (×10⁶/µL)
- Platelets (×10³/µL)
- MCV, MCH, MCHC

#### Urinalysis
- Color, Appearance
- pH, Specific Gravity
- Protein, Glucose, Ketones
- Blood, Leukocytes, Nitrites
- Cell counts (RBC, WBC, Epithelial)
- Bacteria

#### Blood Glucose
- Glucose Level (mg/dL)
- Test Type (Fasting, Random, Postprandial, OGTT)

#### Generic Tests
- For other test types, a JSON editor is available
- Enter test values in JSON format

### Entering Results

1. **Review Order Information**
   - Check order number, test type, and clinical indication
   - Note the priority level

2. **Enter Test Values**
   - Fill in all required fields
   - The system will automatically:
     - Compare values against reference ranges
     - Flag abnormal values (highlighted in orange)
     - Display normal ranges for each value

3. **Review Abnormal Values**
   - Orange-highlighted fields indicate values outside normal range
   - Review these carefully before saving

4. **Add Notes** (Optional)
   - Add any additional observations or notes
   - Notes are visible to clinicians reviewing results

5. **Save Result**
   - Click **"Save Result"**
   - The order status automatically changes to "Completed"
   - The result is now available for verification

### Abnormal Value Detection

- Values outside reference ranges are automatically flagged
- Flagged values are highlighted in orange
- A warning message appears if any abnormal values are detected
- Reference ranges are displayed for each numeric value

---

## ✅ Verifying Results

### Verification Process

1. Navigate to **Lab Results**
2. Find results with status "Pending"
3. Review the test values and notes
4. Click **"Verify Result"**
5. The result status changes to "Verified"
6. Verified results are now available for clinician review

### Verification Requirements

- All test values must be entered
- Review abnormal values carefully
- Ensure notes are accurate if provided
- Verify that the correct test was performed

### After Verification

- Results become visible to clinicians
- Clinicians can review and accept results
- Results are linked to the original consultation
- Results appear in patient's medical history

---

## 👁️ Viewing Lab Results

### Viewing Individual Results

1. Navigate to **Lab Results**
2. Click on any result to view details
3. The result viewer displays:
   - Test information (type, name, date)
   - All test values with reference ranges
   - Abnormal value indicators
   - Verification status
   - Notes and attachments
   - Order information

### Viewing Patient Results

1. Navigate to **Patient Records**
2. Search for a patient
3. Open the patient dashboard
4. Go to the **"Lab Results"** tab
5. View all lab results for that patient

### Result Status Indicators

- **Pending**: Result entered but not yet verified
- **Verified**: Result verified by lab technician (green badge)
- **Reviewed**: Result reviewed by clinician (purple badge)
- **Cancelled**: Result cancelled

---

## 🔧 Common Tasks

### Handling Urgent Orders

1. Urgent and STAT orders appear at the top of the queue
2. They are highlighted with orange/red badges
3. Process these orders first
4. Complete and verify results promptly

### Updating Order Status

- **Pending → Collected**: When sample is collected
- **Collected → In Progress**: When testing begins
- **In Progress → Completed**: When results are entered

### Finding a Specific Order

1. Use the search function in the queue
2. Search by:
   - Order number (e.g., LAB-20250115-001)
   - Patient ID
   - Test name or type
   - Clinician name

### Viewing Order History

1. Navigate to **Lab Results**
2. Use filters to find specific results
3. Results are sorted by date (newest first)

---

## 🐛 Troubleshooting

### Issue: Cannot see pending orders

**Solution**:
- Check that you're logged in as a lab technician
- Refresh the page
- Verify your role permissions with administrator

### Issue: Cannot enter results

**Solution**:
- Ensure the order status is "Collected" or "In Progress"
- Check that all required fields are filled
- Verify you have write permissions

### Issue: Abnormal values not flagged

**Solution**:
- Check that reference ranges are configured for the test type
- Verify numeric values are entered correctly
- Some test types may not have reference ranges configured

### Issue: Cannot verify result

**Solution**:
- Ensure result status is "Pending"
- Check that all test values are entered
- Verify you have verification permissions

### Issue: Results not appearing in patient dashboard

**Solution**:
- Ensure results are verified
- Check that the order is linked to the correct patient
- Verify the patient ID matches

---

## 📝 Best Practices

### Result Entry

1. **Double-check values**: Verify all entered values before saving
2. **Review abnormal values**: Pay special attention to flagged values
3. **Add notes when needed**: Document any unusual findings
4. **Complete promptly**: Process orders in priority order

### Verification

1. **Review thoroughly**: Check all values before verifying
2. **Verify promptly**: Verify results as soon as possible after entry
3. **Document issues**: Add notes if there are any concerns

### Queue Management

1. **Prioritize correctly**: Handle STAT and urgent orders first
2. **Update status**: Keep order status current
3. **Communicate delays**: Add notes if there are processing delays

---

## 🔐 Permissions

As a lab technician, you have access to:

### Read Access
- Lab test orders
- Lab test results
- Patient information (for lab purposes)
- Consultation information (linked to orders)

### Write Access
- Create lab test results
- Update lab test orders (status changes)
- Verify lab test results
- Add notes to results

### Restrictions
- Cannot delete lab orders or results
- Cannot modify verified results (contact administrator)
- Cannot access financial or billing information
- Cannot modify patient records (read-only)

---

## 📞 Support

If you encounter issues or need assistance:

1. **Check this guide** for common solutions
2. **Contact your system administrator** for permission issues
3. **Report bugs** to the development team
4. **Request training** if you need additional help

---

## 📚 Related Documentation

- [User Roles and Patient Data Recording](./USER_ROLES_PATIENT_DATA_RECORDING.md)
- [System User Guide](./docs/USER_GUIDE.md)
- [API Documentation](./docs/API_DOCUMENTATION.md)

---

**Last Updated**: January 2025  
**Maintained By**: Development Team

