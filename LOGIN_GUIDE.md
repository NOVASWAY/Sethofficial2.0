# 🔐 LOGIN GUIDE - Seth Medical Clinic

## 🌐 **OPEN THE APP**
**URL:** http://localhost:3000

---

## 👤 **ALL TEST ACCOUNTS**

### **1. ADMINISTRATOR** 
```
Username: admin
Password: admin123
Role: Administrator
```
✅ **Can access:** Everything!

---

### **2. RECEPTIONIST** 
```
Username: receptionist
Password: recep123
Role: Receptionist
```
✅ **Can access:** Patient Registration, Appointments, Billing

---

### **3. NURSE** 
```
Username: nurse
Password: nurse123
Role: Nurse
```
✅ **Can access:** Consultations, Visits, Patient Records

---

### **4. CLINICIAN (DOCTOR)** 
```
Username: clinician
Password: doc123
Role: Clinician
```
✅ **Can access:** Full Consultations, Prescriptions, Diagnostics

---

---

## 📝 **HOW TO LOGIN**

1. Open browser: http://localhost:3000
2. **Select Role** from dropdown
3. **Type Username** (see above)
4. **Type Password** (see above)  
5. Click **"Sign In"** button

---

## ✅ **QUICK TEST SEQUENCE**

Start with **ADMIN** to see everything:
```
1. Select: Administrator
2. Username: admin  
3. Password: admin123
4. Click Sign In
```

---

## ⚠️ **IMPORTANT NOTES**

- **Minimum password:** 4 characters
- **Session:** 24 hours
- **Data:** Mock data (resets on page refresh)
- **Browser:** Use Chrome or Firefox

---

## 🆘 **TROUBLESHOOTING**

**Can't login?**
- ✓ Role selected in dropdown?
- ✓ Username spelled correctly?
- ✓ Password at least 4 characters?
- ✓ Server running? (check terminal)

**Page not loading?**
1. Check if server is running
2. Go to: http://localhost:3000
3. Clear browser cache (Ctrl+Shift+R)

**Getting 404 error?**
- Wait 30 seconds after login
- Refresh the page (F5)
- Try logging in again

---

## 🎯 **RECOMMENDED TESTING ORDER**

1. **Login as Admin** - Explore all modules and features
2. **Login as Receptionist** - Test patient registration
3. **Login as Clinician** - Test consultations and prescriptions
4. **Login as Receptionist** - Test billing with different payment types
5. **Login as Pharmacist** - Test dispensing and stock management

---

## 📊 **ALL CREDENTIALS AT A GLANCE**

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Receptionist | `receptionist` | `recep123` |
| Nurse | `nurse` | `nurse123` |
| Clinician | `clinician` | `doc123` |

---

**🚀 Ready to Test! Start with Admin for full access!**

**Last Updated:** October 2, 2025, 19:45 EAT

