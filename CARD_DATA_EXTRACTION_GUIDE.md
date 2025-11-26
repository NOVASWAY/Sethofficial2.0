# 📋 Card Data Extraction Guide

**For Clinic Staff**  
**How to Extract Data from Physical Cards to CSV Format**

**Version**: 1.0  
**Date**: January 2025

---

## 🎯 Overview

This guide helps you extract patient information from physical cards and prepare it for digital migration. You'll learn how to organize card data and create a CSV file that the system can import.

**Goal**: Convert physical card data into a digital CSV file ready for import.

---

## 📝 Step 1: Understand Your Cards

### Common Card Formats

Most patient cards contain some or all of this information:

1. **Patient Name** - Full name (required)
2. **Age or Date of Birth** - Patient's age or birth date
3. **Location/Address** - Where patient lives
4. **OP Number** - Outpatient number (may have year suffix like `123/06`)
5. **Phone Number** - Contact number
6. **Gender** - Male/Female (may not be on card)
7. **Registration Date** - When patient first registered

### Card Layout Examples

**Format 1: Simple Card**
```
Name: John Doe
Age: 45
Location: Nairobi
OP: 123/06
Phone: 0712345678
```

**Format 2: Detailed Card**
```
PATIENT INFORMATION
───────────────────
Full Name: Mary Smith
Date of Birth: 15/03/1990
Age: 32
Gender: Female
Address: Kiambu, Main Street
OP Number: 456/10
Contact: 0723456789
```

**Format 3: Minimal Card**
```
John Doe
123/06
Nairobi
```

---

## 📊 Step 2: Prepare Your Workspace

### What You Need:
- ✅ Physical patient cards
- ✅ Computer with Excel or Google Sheets
- ✅ CSV template (download from system)
- ✅ Pen and paper (for notes)
- ✅ Good lighting (to read cards clearly)

### Organize Cards:
1. **Sort Cards** - Organize in a logical order:
   - Alphabetically by name
   - By registration date
   - By OP number
   - Or any order that makes sense

2. **Set Aside Problem Cards**:
   - Damaged or illegible cards
   - Cards with unclear information
   - Cards missing critical data (name)

3. **Work in Batches**:
   - Process 50-100 cards at a time
   - Take breaks to avoid errors
   - Verify accuracy periodically

---

## 💻 Step 3: Create CSV File

### Option A: Using Excel (Recommended)

1. **Open Excel**
   - Create a new spreadsheet
   - Or download the template from the system

2. **Set Up Columns**
   - Row 1: Column headers
   - Use these exact headers:
     ```
     Name,Age,Location,OP Number,Phone Number
     ```

3. **Enter Data**
   - Row 2: First patient
   - Row 3: Second patient
   - Continue for all patients

4. **Save as CSV**
   - File → Save As
   - Choose "CSV (Comma delimited) (*.csv)"
   - Click Save

### Option B: Using Google Sheets

1. **Open Google Sheets**
   - Create a new spreadsheet
   - Or use the template

2. **Set Up Columns**
   - Same headers as Excel

3. **Enter Data**
   - Same process as Excel

4. **Download as CSV**
   - File → Download → Comma-separated values (.csv)

---

## ✍️ Step 4: Enter Data from Cards

### Data Entry Guidelines

#### Name (Required)
- **Enter**: Full name as written on card
- **Format**: "First Last" or "First Middle Last"
- **Example**: `John Doe`, `Mary Jane Smith`
- **Minimum**: 2 characters
- **Note**: System will split into first/last name automatically

#### Age (Optional)
- **Enter**: Number only (no "years" or "yrs")
- **Format**: Just the number
- **Example**: `45`, `32`, `67`
- **Range**: 0-150
- **Note**: If missing, system will use default (1990-01-01)

#### Location (Optional)
- **Enter**: Address, city, or area name
- **Format**: Any text
- **Example**: `Nairobi`, `Kiambu, Main Street`, `Nakuru`
- **Note**: Can be updated later if missing

#### OP Number (Optional)
- **Enter**: As written on card
- **Format**: Supports various formats
- **Examples**: 
  - `123/06` (with year)
  - `456` (without year)
  - `789/15` (year 2015)
- **Note**: System handles year conversion automatically

#### Phone Number (Optional)
- **Enter**: As written on card
- **Format**: 
  - `0712345678` (10 digits)
  - `+254712345678` (with country code)
- **Note**: System validates format but still imports if invalid

### Data Entry Example

**Card Information:**
```
Name: John Doe
Age: 45
Location: Nairobi
OP: 123/06
Phone: 0712345678
```

**CSV Entry:**
```csv
Name,Age,Location,OP Number,Phone Number
John Doe,45,Nairobi,123/06,0712345678
```

---

## 🔍 Step 5: Handle Special Cases

### Missing Information

**If a field is missing on the card:**
- Leave the cell empty
- Don't write "N/A" or "Unknown"
- System will use defaults

**Example:**
```csv
Name,Age,Location,OP Number,Phone Number
Mary Smith,,Kiambu,456/10,
```
- Age missing → System will use default
- Phone missing → System will mark as "Not provided"

### Unclear Information

**If you can't read something:**
- Leave it blank
- Make a note on paper
- Come back to it later
- Or enter your best guess with a note

### Multiple Formats

**If cards have different formats:**
- Use the same CSV format for all
- Map information to the correct columns
- Ignore extra information not in CSV format

### Family Members (Shared OP Numbers)

**If multiple people share an OP number:**
- Enter each person as a separate row
- Use the same OP number for all
- System will automatically add suffixes (-A, -B, etc.)

**Example:**
```csv
Name,Age,Location,OP Number,Phone Number
John Doe,45,Nairobi,123/06,0712345678
Sarah Doe,,Nairobi,123/06,
```
- Both will get OP number `123/06`
- System will differentiate them automatically

---

## ✅ Step 6: Quality Check

### Before Saving CSV, Check:

1. **Required Fields**
   - ✅ Every row has a Name
   - ✅ Names are at least 2 characters

2. **Data Format**
   - ✅ Ages are numbers only (no text)
   - ✅ Phone numbers look reasonable
   - ✅ No special characters that might break CSV

3. **Completeness**
   - ✅ All cards processed (or note which ones weren't)
   - ✅ No skipped rows
   - ✅ Data matches cards

4. **File Format**
   - ✅ Saved as `.csv` (not `.xlsx`)
   - ✅ UTF-8 encoding
   - ✅ File size under 10MB

### Quick Verification Checklist:

- [ ] All rows have names
- [ ] Ages are numbers (if provided)
- [ ] File saved as CSV format
- [ ] File size reasonable (< 10MB)
- [ ] Spot-checked a few entries against cards
- [ ] No obvious errors or typos

---

## 📋 CSV Templates

### Basic Template

Download from the system or create manually:

```csv
Name,Age,Location,OP Number,Phone Number
```

### Template with Examples

```csv
Name,Age,Location,OP Number,Phone Number
John Doe,45,Nairobi,123/06,0712345678
Mary Smith,32,Kiambu,456/10,0723456789
David Kamau,28,Nakuru,789/15,+254734567890
```

### Template for Cards with Extra Fields

If your cards have extra information (like gender, registration date), you can:
- Add it to Location field: `Nairobi, Registered: 2020`
- Or ignore it (system doesn't need it)
- Or add custom columns (system will map them)

---

## 💡 Best Practices

### Data Entry Tips:

1. **Work Systematically**
   - Process cards in order
   - Don't skip around randomly
   - Mark processed cards

2. **Double-Check Important Data**
   - Verify names are spelled correctly
   - Check OP numbers match cards
   - Confirm phone numbers

3. **Handle Missing Data Gracefully**
   - Don't make up information
   - Leave blank if unsure
   - Can be updated later in system

4. **Take Breaks**
   - Data entry is tiring
   - Take breaks every 50-100 cards
   - Review work periodically

5. **Save Frequently**
   - Save your CSV file often
   - Keep backup copies
   - Don't lose your work

### Common Mistakes to Avoid:

❌ **Don't:**
- Enter "N/A" or "Unknown" for missing fields (leave blank)
- Include units with numbers (e.g., "45 years" → use "45")
- Use quotes unless necessary
- Mix different date formats
- Enter invalid phone numbers with letters

✅ **Do:**
- Leave cells empty for missing data
- Use consistent formats
- Save as CSV (not Excel)
- Verify data matches cards
- Keep backups

---

## 🔧 Troubleshooting

### Problem: Excel Won't Save as CSV

**Solution:**
- File → Save As
- Change file type to "CSV UTF-8 (Comma delimited) (*.csv)"
- Or use Google Sheets and download as CSV

### Problem: Special Characters Break CSV

**Solution:**
- Remove or replace special characters
- Use simple text only
- Avoid quotes, commas in data (unless necessary)

### Problem: Too Many Cards to Process

**Solution:**
- Work in batches (50-100 at a time)
- Import each batch separately
- System tracks all imports
- Can resume if interrupted

### Problem: Can't Read Card Information

**Solution:**
- Leave field blank
- Make a note on paper
- Come back to it later
- Or enter best guess with note

### Problem: Different Card Formats

**Solution:**
- Use same CSV format for all
- Map information to correct columns
- Ignore extra information
- Or create separate CSV files for different formats

---

## 📊 Example: Complete Workflow

### Scenario: Migrating 100 Patient Cards

1. **Preparation** (15 minutes)
   - Organize 100 cards alphabetically
   - Open Excel, create CSV template
   - Set up workspace

2. **Data Entry** (2-3 hours)
   - Enter 100 patients into CSV
   - Work in batches of 25
   - Take breaks every 25 cards
   - Verify accuracy periodically

3. **Quality Check** (15 minutes)
   - Review CSV for errors
   - Spot-check 10 entries against cards
   - Verify file format

4. **Save and Backup** (5 minutes)
   - Save as CSV
   - Create backup copy
   - Note any cards not processed

5. **Import** (5 minutes)
   - Upload CSV to system
   - Follow migration wizard
   - Verify import success

**Total Time**: ~3-4 hours for 100 cards

---

## ✅ Pre-Import Checklist

Before importing your CSV file:

- [ ] All required fields (Name) are filled
- [ ] File saved as `.csv` format
- [ ] File size under 10MB
- [ ] Data matches physical cards
- [ ] Backup copy created
- [ ] Quality check completed
- [ ] Ready to import

---

## 🎯 Next Steps

After creating your CSV file:

1. **Review MIGRATION_USER_GUIDE.md**
   - Learn how to use the migration wizard
   - Understand the import process

2. **Test with Small Batch**
   - Import 10-20 records first
   - Verify everything works
   - Then proceed with full import

3. **Start Migration**
   - Use the Migration Wizard
   - Follow step-by-step instructions
   - Monitor progress

---

## 📞 Need Help?

If you encounter issues:

1. **Review this guide** - Check troubleshooting section
2. **Check MIGRATION_USER_GUIDE.md** - For import process
3. **Contact administrator** - For technical assistance
4. **Use system templates** - Download from migration wizard

---

**Last Updated**: January 2025  
**Version**: 1.0

