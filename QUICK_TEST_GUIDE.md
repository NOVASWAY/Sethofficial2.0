# ⚡ QUICK TEST GUIDE

**Fast reference for frontend validation**

---

## 🔐 **LOGIN CREDENTIALS**

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Receptionist | `receptionist` | `recep123` |
| Nurse | `nurse` | `nurse123` |
| Clinician | `clinician` | `doc123` |

**URL:** http://localhost:3000

---

## ✅ **QUICK MODULE CHECKLIST**

### **✓ Authentication**
- [ ] Login works for all 4 roles
- [ ] Logout works
- [ ] Session persists on refresh

### **✓ Patient Registration**
- [ ] Can register new patient
- [ ] Form validation works
- [ ] Patient ID auto-generates

### **✓ Consultation**
- [ ] Can record vitals
- [ ] Can add diagnosis
- [ ] Can write prescription
- [ ] Can select services

### **✓ Billing**
- [ ] Cash payment works
- [ ] M-Pesa payment works
- [ ] SHA payment works
- [ ] Mixed payment works
- [ ] Invoice exports work

### **✓ Pharmacy**
- [ ] Can view pending prescriptions
- [ ] Can dispense medications
- [ ] Stock auto-deducts

### **✓ Stock Management**
- [ ] Can add stock
- [ ] Can view inventory
- [ ] Low stock alerts show
- [ ] Expiry warnings show

### **✓ Financial Overview**
- [ ] Dashboard loads
- [ ] Charts display
- [ ] All tabs work
- [ ] Export works

### **✓ Reports**
- [ ] SHA claims show
- [ ] Audit trail shows
- [ ] Patient stats show
- [ ] Export works

---

## 🎯 **PRIORITY TESTS**

### **Must Work:**
1. ✅ Login (all roles)
2. ✅ Patient registration
3. ✅ Consultation workflow
4. ✅ Invoice generation (all payment types)
5. ✅ Pharmacy dispensing
6. ✅ Stock management
7. ✅ Navigation between modules

### **Should Work:**
1. ✅ Theme toggle
2. ✅ Search functionality
3. ✅ Data export
4. ✅ Form validation
5. ✅ Responsive design

### **Nice to Have:**
1. ✅ Smooth animations
2. ✅ Toast notifications
3. ✅ Loading states
4. ✅ Error messages

---

## 🚀 **QUICK TEST SCENARIOS**

### **Scenario 1: New Patient (5 min)**
```
1. Login as receptionist
2. Go to Patient Registration
3. Fill form with test data
4. Submit
5. Verify patient appears in list
```

### **Scenario 2: Consultation (5 min)**
```
1. Login as clinician
2. Go to Consultation
3. Select a patient
4. Record vitals
5. Add diagnosis
6. Write prescription
7. Save consultation
```

### **Scenario 3: Billing (5 min)**
```
1. Login as receptionist
2. Go to Billing
3. Create new invoice
4. Add items
5. Select payment type (Cash)
6. Process payment
7. Verify invoice created
```

### **Scenario 4: Pharmacy (5 min)**
```
1. Login as pharmacist
2. Go to Pharmacy Dispensing
3. View pending prescriptions
4. Select one
5. Dispense medication
6. Verify stock deducted
```

### **Scenario 5: Complete Journey (15 min)**
```
1. Receptionist: Register patient
2. Clinician: Consult patient
3. Receptionist: Bill patient
4. Pharmacist: Dispense medication
5. Admin: View reports
```

---

## 🐛 **COMMON ISSUES TO CHECK**

### **Login Issues:**
- [ ] Check role is selected
- [ ] Check credentials are correct
- [ ] Check server is running

### **Navigation Issues:**
- [ ] Check sidebar items are clickable
- [ ] Check URLs are correct
- [ ] Check browser back button works

### **Form Issues:**
- [ ] Check required fields have values
- [ ] Check validation messages clear
- [ ] Check submit button enabled

### **Display Issues:**
- [ ] Check in both light and dark mode
- [ ] Check on different screen sizes
- [ ] Check in different browsers

---

## 📝 **BUG REPORT TEMPLATE**

```
Bug #: 
Module: 
Severity: Critical/High/Medium/Low
Description: 
Steps to Reproduce:
1.
2.
3.
Expected Result: 
Actual Result: 
Browser: 
Screenshot: Yes/No
```

---

## ✅ **FINAL CHECKLIST**

**Before reporting complete:**
- [ ] Tested all 7 modules
- [ ] Tested all 5 user roles
- [ ] Tested at least 1 complete workflow
- [ ] Tested in 2+ browsers
- [ ] Tested responsive design
- [ ] Documented all issues found
- [ ] Verified critical features work
- [ ] Ready to provide feedback

---

## 📞 **QUICK LINKS**

- **Full Checklist:** `FRONTEND_VALIDATION_CHECKLIST.md`
- **Login Guide:** `START_HERE.md`
- **System Status:** `FINAL_STATUS.md`
- **All Docs:** Root directory `.md` files

---

**Happy Testing!** 🧪

**Report back with:** ✅ Pass / 🟡 Pass with issues / 🔴 Fail

---

**Estimated Testing Time:** 30-60 minutes for thorough test  
**Minimum Testing Time:** 15 minutes for quick test  
**Recommended:** Test systematically using full checklist

