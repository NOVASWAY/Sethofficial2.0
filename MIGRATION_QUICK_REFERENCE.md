# 📋 Migration Quick Reference Card

**One-Page Guide for Clinic Staff**

---

## 🚀 Quick Start (5 Steps)

### 1️⃣ Prepare CSV File
- Download template from Migration Wizard
- Enter patient data: Name, Age, Location, OP Number, Phone
- Save as CSV format

### 2️⃣ Start Migration
- Go to **Patient Registration**
- Click **"Migration Wizard"**
- Follow the 6 steps

### 3️⃣ Upload File
- Step 2: Upload your CSV file
- System auto-detects columns

### 4️⃣ Review & Import
- Step 4: Review validation results
- Step 5: Click "Start Import"
- Watch progress bar

### 5️⃣ Verify
- Step 6: Check import results
- Search for imported patients
- Verify data accuracy

---

## 📝 CSV Format

**Required:**
- Name (minimum 2 characters)

**Optional:**
- Age (number only)
- Location
- OP Number (e.g., `123/06`)
- Phone Number (e.g., `0712345678`)

**Example:**
```csv
Name,Age,Location,OP Number,Phone Number
John Doe,45,Nairobi,123/06,0712345678
```

---

## ⚠️ Common Issues

| Problem | Solution |
|---------|----------|
| File won't upload | Save as `.csv` (not `.xlsx`) |
| All records show errors | Check Name column has data |
| Import is slow | Normal for large files - wait |
| Some records failed | Review errors, fix CSV, re-import |

---

## 🎯 Key Features

✅ **Auto-Detection** - System finds columns automatically  
✅ **Duplicate Detection** - Warns about duplicates  
✅ **Batch Processing** - Handles large files  
✅ **Resume** - Continue if interrupted  
✅ **Cleanup Tools** - Fix issues after import  

---

## 📞 Need Help?

1. Check **MIGRATION_USER_GUIDE.md**
2. Review **CARD_DATA_EXTRACTION_GUIDE.md**
3. Contact system administrator

---

**Remember**: Only Name is required - missing data is OK!

