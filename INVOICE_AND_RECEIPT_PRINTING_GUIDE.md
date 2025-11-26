# 📄 Invoice Auto-Saving & Receipt Printing Guide

**Date**: January 2025  
**Status**: ✅ **Fully Implemented**

---

## ✅ Invoice Auto-Saving

### How It Works

**Invoices are automatically saved to the database** when generated:

1. **Billing Module** → User generates invoice
2. **Invoice Context** → Calls `addInvoice()` function
3. **API Client** → Calls `invoiceAPI.create()` 
4. **Backend API** → Saves to PostgreSQL database via `/api/v1/invoices` endpoint
5. **Database** → Invoice stored in `invoices` table with all details

### What Gets Saved

- ✅ Invoice number (auto-generated)
- ✅ Patient information
- ✅ Invoice items (services, medications, procedures)
- ✅ Payment details (method, amount, transaction codes)
- ✅ Tax calculations (16% VAT)
- ✅ Payment status
- ✅ Timestamps (created_at, updated_at)
- ✅ M-Pesa transaction codes (if applicable)
- ✅ SHA claim numbers (if applicable)

### Database Storage

**Table**: `invoices`
- All invoices are permanently stored
- Can be retrieved anytime
- Linked to patients, consultations, and payments
- Full audit trail maintained

---

## 🖨️ Receipt Printing

### Individual Receipt Printing

#### **Standard Receipt (Full Page)**
- Professional layout
- Clinic branding
- Complete invoice details
- Suitable for A4 printing

#### **Thermal Receipt (80mm)**
- Optimized for thermal printers
- Compact format
- All essential information
- Perfect for receipt printers

### How to Print Individual Receipt

1. **After Invoice Generation**:
   - Invoice is automatically saved
   - Print dialog appears (if auto-print is disabled)
   - Click "Print Receipt" button

2. **From Invoice Management**:
   - Navigate to Invoice Management
   - Find the invoice
   - Click "Print" button
   - Choose Standard or Thermal format

3. **Print Options**:
   - **Standard**: Full-page receipt (A4)
   - **Thermal**: Compact receipt (80mm width)

---

## 📦 Batch/Collective Receipt Printing

### What Is Batch Printing?

Print multiple receipts at once for different patients. Useful for:
- End-of-day receipts
- Bulk printing for multiple patients
- Printing receipts for a date range
- Printing all unpaid invoices

### How to Use Batch Printing

1. **Navigate to Invoice Management**
2. **Select Multiple Invoices**:
   - Use checkboxes to select invoices
   - Or use "Select All" button
   - Selected invoices are highlighted

3. **Click "Print Batch"**:
   - Choose "Print Standard" or "Print Thermal"
   - All selected receipts will print
   - Each receipt on separate page

4. **Print Options**:
   - **Standard Batch**: Full-page receipts, one per page
   - **Thermal Batch**: Compact receipts, optimized for thermal printers

### Batch Printing Features

- ✅ Select multiple invoices
- ✅ Select all / Deselect all
- ✅ See total amount of selected invoices
- ✅ Print all at once
- ✅ Each receipt on separate page
- ✅ Page breaks between receipts

---

## ⚙️ Auto-Print Feature

### Enable Auto-Print

**Location**: Bottom-right corner of Billing Module

1. **Toggle Checkbox**: "Auto-print receipts"
2. **Setting Saved**: Stored in browser localStorage
3. **Behavior**: 
   - When enabled: Receipts automatically print after invoice generation
   - When disabled: Print dialog appears for manual printing

### Auto-Print Behavior

**When Enabled**:
- Invoice is generated
- Receipt automatically opens in print dialog
- User can print or cancel
- No manual action needed

**When Disabled**:
- Invoice is generated
- Print dialog appears
- User clicks "Print" to print receipt
- More control over printing

---

## 🖨️ Printer Setup

### Standard Printers (A4)

**No special setup required**:
- Works with any standard printer
- Uses browser print dialog
- Supports all printer types

### Thermal Printers (80mm)

**Recommended Setup**:
1. **Printer Type**: 80mm thermal receipt printer
2. **Paper Size**: 80mm x continuous
3. **Browser Settings**:
   - Set paper size to 80mm
   - Enable "Print background graphics"
   - Set margins to minimum

**Common Thermal Printers**:
- Epson TM-T20
- Star TSP100
- Bixolon SRP-350
- Any 80mm thermal printer

**Print Settings**:
- Paper Size: 80mm (3.15 inches)
- Orientation: Portrait
- Margins: Minimum (0.1 inch)
- Scale: 100%

---

## 📋 Receipt Content

### What's Included on Receipt

1. **Clinic Information**:
   - Clinic name and logo
   - Address and contact details

2. **Patient Information**:
   - Patient name
   - Patient ID
   - Patient number (if available)

3. **Invoice Details**:
   - Invoice/Receipt number
   - Date
   - Payment status

4. **Services & Items**:
   - Description
   - Quantity
   - Unit price
   - Total price

5. **Financial Summary**:
   - Subtotal
   - Tax (16% VAT)
   - Discount (if any)
   - **Total Amount**

6. **Payment Information**:
   - Payment method
   - M-Pesa transaction code (if applicable)
   - SHA claim number (if applicable)
   - Amount paid
   - Balance (if any)

7. **Footer**:
   - Thank you message
   - Contact information
   - Generation timestamp

---

## 🔧 Technical Details

### Invoice Storage

**Backend API**: `POST /api/v1/invoices`
- Saves invoice to PostgreSQL
- Returns saved invoice with ID
- Includes all payment details

**Database Table**: `invoices`
```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL,
    invoice_number VARCHAR(50) UNIQUE,
    date DATE NOT NULL,
    items JSONB NOT NULL,
    subtotal DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    payment_status VARCHAR(20),
    payment_method VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Print Components

**Files**:
- `components/printable-invoice.tsx` - Individual receipt printing
- `components/batch-receipt-printer.tsx` - Batch receipt printing

**Features**:
- HTML-based printing (works with any printer)
- CSS optimized for print
- Thermal printer support (80mm width)
- Standard printer support (A4)
- Auto-print functionality
- Print preview

---

## 🎯 Usage Examples

### Example 1: Generate and Print Single Receipt

1. Go to Billing Module
2. Add patient and services
3. Select payment method
4. Click "Generate Invoice"
5. Invoice is saved automatically
6. Print dialog appears
7. Click "Print Receipt"
8. Receipt prints

### Example 2: Batch Print End-of-Day Receipts

1. Go to Invoice Management
2. Filter invoices by date (today)
3. Click "Batch Print" button
4. Select all invoices
5. Click "Print Batch (Standard)" or "Print Batch (Thermal)"
6. All receipts print

### Example 3: Enable Auto-Print

1. Go to Billing Module
2. Check "Auto-print receipts" in bottom-right
3. Generate invoice
4. Receipt automatically opens for printing
5. Click "Print" in browser dialog

---

## ✅ Summary

### Invoice Saving
- ✅ **Automatic**: Invoices saved when generated
- ✅ **Persistent**: Stored in PostgreSQL database
- ✅ **Complete**: All details saved
- ✅ **Retrievable**: Can access anytime

### Receipt Printing
- ✅ **Individual**: Print single receipts
- ✅ **Batch**: Print multiple receipts at once
- ✅ **Standard**: Full-page format
- ✅ **Thermal**: 80mm compact format
- ✅ **Auto-Print**: Optional automatic printing

### Features
- ✅ Auto-save to database
- ✅ Print individual receipts
- ✅ Print batch receipts
- ✅ Thermal printer support
- ✅ Standard printer support
- ✅ Auto-print option
- ✅ Print preview

---

**All invoice saving and receipt printing features are fully implemented and ready to use!** 🎉

---

**Last Updated**: January 2025  
**Version**: 1.0

