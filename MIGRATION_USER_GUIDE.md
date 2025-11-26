# 📖 Card-to-Digital Migration User Guide

**For Clinic Staff**  
**Version**: 1.0  
**Date**: January 2025

---

## 🎯 Overview

This guide will help you migrate patient data from physical cards to the digital clinic management system. The process is straightforward and guided by a step-by-step wizard.

**What You'll Learn:**
- How to prepare data from physical cards
- How to create a CSV file from card data
- How to use the Migration Wizard
- How to verify your migration was successful
- How to handle common issues

**Time Required:** 
- Small clinic (100-500 patients): 2-4 hours
- Medium clinic (500-1000 patients): 4-8 hours
- Large clinic (1000+ patients): 1-2 days (can be done in batches)

---

## 📋 Before You Begin

### What You Need:
- ✅ Access to the clinic management system
- ✅ Physical patient cards
- ✅ Computer with internet connection
- ✅ Excel or Google Sheets (for creating CSV files)
- ✅ 30 minutes to 2 hours (depending on data size)

### What the System Does:
- ✅ Imports patient data from CSV files
- ✅ Detects and warns about duplicate patients
- ✅ Validates data quality
- ✅ Tracks import progress
- ✅ Allows you to resume if interrupted
- ✅ Provides cleanup tools after import

---

## 📝 Step 1: Prepare Your Data

### 1.1 Gather Physical Cards

1. **Organize Cards**
   - Collect all patient cards
   - Sort them in a logical order (alphabetical, by date, etc.)
   - Set aside any damaged or illegible cards for manual entry later

2. **Review Card Information**
   - Check what information is on each card
   - Common fields: Name, Age, Location, OP Number, Phone Number
   - Note any missing or unclear information

### 1.2 Create CSV File

**Option A: Using Excel (Recommended)**

1. Open Microsoft Excel or Google Sheets
2. Create a new spreadsheet
3. Add these column headers in the first row:
   ```
   Name,Age,Location,OP Number,Phone Number
   ```
4. Enter patient data row by row:
   ```
   John Doe,45,Nairobi,123/06,0712345678
   Mary Smith,32,Kiambu,456/10,0723456789
   ```
5. Save as CSV:
   - **Excel**: File → Save As → Choose "CSV (Comma delimited) (*.csv)"
   - **Google Sheets**: File → Download → Comma-separated values (.csv)

**Option B: Download Template**

1. Log into the clinic management system
2. Go to **Patient Registration** page
3. Click **"Migration Wizard"** button
4. In Step 2, download the CSV template
5. Fill in the template with your patient data

### 1.3 CSV Format Requirements

**Required Column:**
- **Name** - Patient's full name (minimum 2 characters)

**Optional Columns:**
- **Age** - Patient's age (number only, e.g., 45)
- **Location** - Patient's address or location
- **OP Number** - Outpatient number (supports formats like `123/06`, `789`)
- **Phone Number** - Contact phone number (e.g., `0712345678` or `+254712345678`)

**Example CSV:**
```csv
Name,Age,Location,OP Number,Phone Number
John Doe,45,Nairobi,123/06,0712345678
Mary Smith,32,Kiambu,456/10,0723456789
David Kamau,28,Nakuru,789/15,+254734567890
Sarah Doe,,Nairobi,123/06,
Peter Kamau,35,,,0745678901
```

**Important Notes:**
- ✅ Use commas to separate columns
- ✅ Don't use quotes unless necessary
- ✅ Save file as UTF-8 encoding
- ✅ Maximum file size: 10MB
- ✅ Missing data is OK (system will use defaults)

---

## 🚀 Step 2: Start Migration Wizard

### 2.1 Access the Wizard

1. **Log into the system**
   - Go to the clinic management system
   - Log in with your credentials

2. **Navigate to Patient Registration**
   - Click on **"Patient Registration"** in the main menu
   - Or go to the **Registration** module

3. **Open Migration Wizard**
   - Click the **"Migration Wizard"** button
   - A dialog will open with 6 steps

### 2.2 Step 1: Data Preparation Checklist

The wizard will show you a checklist:
- ✅ Export to CSV: Ensure your data is in CSV format
- ✅ Review Data Quality: Check for missing values and errors
- ✅ Standardize Formats: Ensure dates, phone numbers are consistent
- ✅ Backup Original Data: Keep a backup of your original card data
- ✅ Download Template: Use the provided CSV template

**Action:** Review the checklist and click **"Next"** when ready.

---

## 📤 Step 3: Upload Your CSV File

### 3.1 Upload File

1. **Click "Upload File"**
   - You can click to browse or drag and drop your CSV file
   - Supported format: `.csv` files only

2. **Wait for Processing**
   - The system will automatically parse your file
   - This usually takes a few seconds

3. **Review File Info**
   - File name and size will be displayed
   - Number of records detected will be shown

**If Upload Fails:**
- Check file is saved as `.csv` (not `.xlsx`)
- Ensure file size is under 10MB
- Check file encoding is UTF-8
- Try downloading the template and using that format

---

## 🗺️ Step 4: Map Your Data (If Needed)

### 4.1 Automatic Mapping

The system automatically detects common column names:
- **Name** → First Name & Last Name
- **Age** → Date of Birth (calculated)
- **OP Number** → Patient Number
- **Phone Number** → Phone
- **Location** → Location/Address

### 4.2 Custom Mapping (If Your Columns Are Different)

If your CSV has different column names:

1. **Review Detected Mappings**
   - The system shows what it detected
   - Check if mappings are correct

2. **Adjust Mappings**
   - Click on each CSV column
   - Select the correct database field from dropdown
   - Required fields must be mapped:
     - First Name
     - Last Name
     - Date of Birth (or Age)
     - Gender
     - Phone Number

3. **Save Template (Optional)**
   - If you'll use this format again, click "Save Template"
   - Give it a name (e.g., "Standard Card Format")
   - You can load it next time

4. **Confirm Mapping**
   - Review all mappings
   - Click **"Confirm Mapping"** when done

**Tip:** If you're unsure about a mapping, hover over the field name for help.

---

## ✅ Step 5: Review Validation & Duplicates

### 5.1 Review Preview

The system shows you a preview of all records with:

**✅ Valid Records (Green)**
- Ready to import
- All required fields present
- No errors

**⚠️ Records with Warnings (Yellow)**
- Can be imported
- Missing some optional data
- May have format issues
- Example: Missing phone number, invalid date format

**❌ Records with Errors (Red)**
- Cannot be imported
- Missing required fields
- Need to be fixed
- Example: Name too short, invalid data

### 5.2 Check for Duplicates

The system automatically detects:
- **Duplicates in your file** - Same patient appears multiple times
- **Duplicates with existing patients** - Matches patients already in the system

**What to Do:**
- Review duplicate warnings
- Decide if they're actually duplicates or different people
- You can merge duplicates later using the merge tool

### 5.3 Data Quality Dashboard

Click **"Show Quality Dashboard"** to see:
- **Quality Score** - Overall data quality (0-100%)
- **Completeness** - Percentage of fields filled
- **Issue Breakdown** - Types of issues found
- **Recommendations** - Suggestions to improve data

**Action:** Review the preview carefully, then click **"Next"** to proceed.

---

## 🚀 Step 6: Execute Import

### 6.1 Start Import

1. **Review Import Settings**
   - Check batch size (for large files)
   - Review number of records to import

2. **Click "Start Import"**
   - The system will begin importing records
   - Progress bar shows real-time progress

3. **Monitor Progress**
   - Watch the progress bar
   - See current batch being processed
   - View statistics (imported, failed, remaining)

### 6.2 During Import

**For Small Files (< 50 records):**
- Import completes in seconds
- All records processed at once

**For Large Files (50+ records):**
- Import happens in batches (100-500 records per batch)
- Progress updates after each batch
- You can see:
  - Current batch number
  - Total batches
  - Records imported so far
  - Records failed so far

**If Import is Interrupted:**
- Don't worry! The system saves progress
- You can resume from where it stopped
- Go to "Import History" and click "Resume"

### 6.3 Import Complete

When import finishes, you'll see:
- ✅ Total records imported
- ⚠️ Number of failed records (if any)
- 📊 Import summary

**Action:** Click **"Next"** to review results.

---

## 📊 Step 7: Post-Import Review

### 7.1 Review Import Results

The system shows you:
- **Total Records** - How many were in the file
- **Successfully Imported** - How many were saved
- **Failed Records** - How many couldn't be imported
- **Import Time** - How long it took

### 7.2 Verify Imported Patients

1. **Search for Imported Patients**
   - Go to Patient Management
   - Search for a patient you just imported
   - Verify their information is correct

2. **Check Patient List**
   - View the patient list
   - Count should match imported count
   - Verify data looks correct

### 7.3 Use Post-Import Cleanup Tools

Click **"Post-Import Cleanup"** to:
- **Find Missing Data** - Identify patients with missing information
- **Detect Duplicates** - Find duplicate patients
- **Fix Data Issues** - Bulk fix common problems
- **Improve Data Quality** - Standardize phone numbers, addresses

**Action:** Review results, verify data, then click **"Finish Migration"**.

---

## 🔄 Resuming a Failed Import

### If Import Was Interrupted

1. **Go to Import History**
   - Click **"Import History"** button
   - Find your interrupted import session

2. **Review Status**
   - Check how many records were imported
   - See how many failed
   - Review error messages

3. **Resume Import**
   - Click **"Resume"** button on the session
   - System will continue from last successful batch
   - You'll need to provide the original CSV file again

**Note:** The system remembers which records were already imported, so it won't create duplicates.

---

## 🛠️ Troubleshooting

### Problem: File Won't Upload

**Solutions:**
- ✅ Check file is saved as `.csv` (not `.xlsx`)
- ✅ Ensure file size is under 10MB
- ✅ Check file encoding is UTF-8
- ✅ Try downloading the template and using that format
- ✅ Remove special characters from file name

### Problem: All Records Show Errors

**Solutions:**
- ✅ Check that "Name" column exists and has data
- ✅ Ensure names are at least 2 characters long
- ✅ Verify CSV format (comma-separated, not semicolon)
- ✅ Check for empty rows at the end of file

### Problem: Import is Very Slow

**Solutions:**
- ✅ This is normal for large files (1000+ records)
- ✅ System processes in batches automatically
- ✅ Progress bar shows it's working
- ✅ Don't close the browser - let it complete

### Problem: Some Records Failed

**Solutions:**
- ✅ Review error messages in import results
- ✅ Fix the CSV file with correct data
- ✅ Re-import only the failed records
- ✅ Or manually add failed records one by one

### Problem: Duplicates Detected

**Solutions:**
- ✅ Review if they're actually duplicates
- ✅ Use the duplicate merge tool to combine them
- ✅ Or keep them separate if they're different people
- ✅ Check similarity scores to decide

### Problem: Data Looks Wrong After Import

**Solutions:**
- ✅ Check your CSV file format
- ✅ Verify column mappings were correct
- ✅ Use post-import cleanup tools to fix issues
- ✅ Manually edit individual patient records

---

## 💡 Best Practices

### Before Import:
1. **Backup Your Data**
   - Keep original CSV files
   - Keep physical cards until migration is verified

2. **Test with Small Batch First**
   - Import 10-20 records first
   - Verify everything works correctly
   - Then proceed with full import

3. **Clean Your Data**
   - Remove empty rows
   - Fix obvious errors
   - Standardize formats (phone numbers, dates)

### During Import:
1. **Don't Close Browser**
   - Let import complete
   - Progress is saved automatically

2. **Monitor Progress**
   - Watch for errors
   - Note any issues

3. **Take Breaks for Large Imports**
   - System saves progress
   - You can resume later

### After Import:
1. **Verify Data**
   - Search for imported patients
   - Spot-check a few records
   - Compare with original cards

2. **Use Cleanup Tools**
   - Run post-import cleanup
   - Fix missing data
   - Merge duplicates

3. **Update Missing Information**
   - Add missing phone numbers
   - Complete addresses
   - Add any other missing data

---

## 📞 Getting Help

### If You Need Assistance:

1. **Check This Guide**
   - Review the troubleshooting section
   - Look for your specific issue

2. **Contact System Administrator**
   - They can help with technical issues
   - They have access to import history and logs

3. **Review Import History**
   - Check previous imports for reference
   - See what worked before

---

## ✅ Migration Checklist

Use this checklist to ensure successful migration:

### Preparation:
- [ ] Physical cards organized
- [ ] CSV file created and saved
- [ ] Data reviewed for quality
- [ ] Backup of original data created

### Import:
- [ ] Migration wizard started
- [ ] CSV file uploaded successfully
- [ ] Data mapping confirmed
- [ ] Validation reviewed
- [ ] Import executed
- [ ] Import completed successfully

### Verification:
- [ ] Imported patients verified in system
- [ ] Data accuracy checked
- [ ] Duplicates reviewed and merged
- [ ] Missing data updated
- [ ] Post-import cleanup completed

### Completion:
- [ ] All patients migrated
- [ ] Data quality acceptable
- [ ] System ready for use
- [ ] Staff trained on new system

---

## 🎉 Success!

Once you've completed the migration:
- ✅ All patient data is now digital
- ✅ Data is searchable and accessible
- ✅ No more physical cards needed (after verification)
- ✅ System ready for daily operations

**Congratulations! Your clinic is now fully digital!** 🚀

---

## 📚 Additional Resources

- **CSV Import Guide**: See `CSV_IMPORT_GUIDE.md` for detailed CSV format information
- **Data Migration Guide**: See `docs/DATA_MIGRATION_GUIDE.md` for technical details
- **System User Guide**: See `docs/USER_GUIDE.md` for general system usage

---

**Last Updated**: January 2025  
**Version**: 1.0

