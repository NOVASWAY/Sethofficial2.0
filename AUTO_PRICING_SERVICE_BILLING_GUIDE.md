# Auto-Pricing Service Billing Guide

## Overview

This guide explains how the system automatically sets prices when services are selected for billing, ensuring accurate and consistent pricing without manual entry.

---

## 🎯 How Auto-Pricing Works

### **When a Patient Comes for a Service (e.g., HIV Test)**

1. **User Records the Service**:
   - User selects service from catalog (e.g., "HIV Test")
   - System automatically retrieves the pre-set price

2. **Price is Auto-Set**:
   - Price is automatically populated from service catalog
   - No manual price entry required
   - Price shown before adding to invoice

3. **Amount Auto-Updates**:
   - Total amount automatically calculates
   - Tax (16% VAT) automatically added
   - Final total updates in real-time

---

## 📋 Service Catalog Structure

### **Services with Pre-Set Prices**

All services in the catalog have:
- **Service Code** (e.g., LAB-006 for HIV Test)
- **Service Name** (e.g., "HIV Test")
- **Category** (e.g., laboratory, consultation, procedure)
- **Cash Price** (e.g., KSh 500)
- **SHA Price** (if applicable, e.g., KSh 0 for HIV Test)

### **Example: HIV Test**

```typescript
{
  id: '9',
  code: 'LAB-006',
  name: 'HIV Test',
  category: 'laboratory',
  description: 'HIV rapid test (Rapid diagnostic test)',
  price: 500,        // Cash price: KSh 500
  shaPrice: 0,       // SHA price: KSh 0 (often free)
  isActive: true,
  requiresDoctor: false
}
```

---

## 🔄 Billing Workflow

### **Step 1: Select Service**

**User Action**:
1. Open Billing Module
2. Click "Select a service..." dropdown
3. Services are grouped by category:
   - **Lab Tests** (HIV Test, CBC, Urinalysis, etc.)
   - **Consultations** (General, Specialist, Follow-up)
   - **Procedures** (Wound Dressing, Injection, etc.)
   - **Imaging** (X-Ray, Ultrasound)
   - **Other**

**System Action**:
- Shows service name with price next to it
- Example: "HIV Test" → "KSh 500"
- Price is visible before selection

---

### **Step 2: Preview Price**

**When Service is Selected**:

**Visual Preview Shows**:
```
┌─────────────────────────────────────┐
│ 🧮 HIV Test × 1                     │
│ Unit Price: KSh 500 (Cash Rate)    │
│ Total: KSh 500                      │
│ ✓ Price automatically set from     │
│   service catalog                   │
└─────────────────────────────────────┘
```

**Information Displayed**:
- ✅ Service name
- ✅ Quantity
- ✅ Unit price (auto-set)
- ✅ Total amount (auto-calculated)
- ✅ Payment type indicator (Cash/SHA)
- ✅ Confirmation that price is auto-set

---

### **Step 3: Add to Invoice**

**User Action**:
- Click "Add" button
- Service is added to invoice items

**System Action**:
- Service added with pre-set price
- Total automatically recalculated
- Tax (16% VAT) automatically added
- Final total updated immediately

---

### **Step 4: Auto-Calculated Totals**

**Display Shows**:
```
┌─────────────────────────────────────┐
│ ✨ Auto-Calculated Totals           │
│                                     │
│ Subtotal:        KSh 500.00        │
│ Tax (16% VAT):   KSh 80.00         │
│ ─────────────────────────────────  │
│ Total Amount:    KSh 580.00        │
│                                     │
│ ✓ Totals automatically update when │
│   services are added or removed    │
└─────────────────────────────────────┘
```

---

## 💰 Price Calculation Logic

### **Cash Payment**

```typescript
// When payment type is "cash"
unitPrice = service.price  // e.g., 500
totalPrice = unitPrice × quantity  // e.g., 500 × 1 = 500
subtotal = sum of all items
tax = subtotal × 0.16  // 16% VAT
total = subtotal + tax
```

### **SHA Payment**

```typescript
// When payment type is "sha" or "mixed"
unitPrice = service.shaPrice || service.price  // e.g., 0 or 500
totalPrice = unitPrice × quantity
// SHA covers the amount, patient pays difference (if any)
```

### **Mixed Payment**

```typescript
// When payment type is "mixed"
// SHA covers SHA price portion
// Patient pays cash for difference
shaAmount = service.shaPrice × quantity
patientAmount = (service.price - service.shaPrice) × quantity
```

---

## 📊 Service Categories & Examples

### **Laboratory Tests**

| Service | Code | Cash Price | SHA Price |
|---------|------|------------|-----------|
| HIV Test | LAB-006 | KSh 500 | KSh 0 |
| Full Blood Count (FBC) | LAB-001 | KSh 800 | KSh 600 |
| Malaria Test | LAB-002 | KSh 300 | KSh 250 |
| Blood Sugar Test | LAB-003 | KSh 200 | KSh 150 |
| Urinalysis | LAB-004 | KSh 400 | KSh 300 |
| Pregnancy Test | LAB-007 | KSh 300 | KSh 200 |

### **Consultations**

| Service | Code | Cash Price | SHA Price |
|---------|------|------------|-----------|
| General Consultation | CONS-001 | KSh 1,000 | KSh 800 |
| Specialist Consultation | CONS-002 | KSh 2,000 | KSh 1,500 |
| Follow-up Visit | CONS-003 | KSh 500 | KSh 400 |

### **Procedures**

| Service | Code | Cash Price | SHA Price |
|---------|------|------------|-----------|
| Wound Dressing | PROC-001 | KSh 500 | KSh 400 |
| Injection/IM | PROC-002 | KSh 200 | KSh 150 |
| IV Drip | PROC-003 | KSh 1,500 | KSh 1,200 |

---

## 🎨 User Interface Features

### **1. Service Selection Dropdown**

**Features**:
- ✅ Services grouped by category
- ✅ Price shown next to each service
- ✅ Easy to find specific services (e.g., HIV Test)
- ✅ Search-friendly organization

**Visual**:
```
Select a service...
├─ Lab Tests
│  ├─ HIV Test                    KSh 500
│  ├─ Full Blood Count (FBC)      KSh 800
│  └─ Malaria Test                KSh 300
├─ Consultations
│  ├─ General Consultation        KSh 1,000
│  └─ Specialist Consultation     KSh 2,000
└─ ...
```

---

### **2. Price Preview Alert**

**When Service Selected**:
- Blue alert box appears
- Shows service name, quantity, unit price
- Shows total amount
- Confirms price is auto-set

**Color Coding**:
- Blue background = Information/Preview
- Green background = Success/Confirmation
- Yellow background = Warning

---

### **3. Auto-Calculated Totals Box**

**Features**:
- ✅ Green highlight box
- ✅ Shows subtotal, tax, total
- ✅ Updates automatically
- ✅ Confirms auto-calculation

---

### **4. Invoice Items Display**

**Each Item Shows**:
- Service name
- Quantity × Unit price
- Total price
- SHA coverage badge (if applicable)
- Remove button

---

## 🔧 Technical Implementation

### **Service Selection Handler**

```typescript
const handleAddService = () => {
  const service = defaultServices.find(s => s.id === selectedServiceId)
  if (!service) return

  const quantity = parseInt(serviceQuantity) || 1
  const isSHA = paymentType === 'sha' || paymentType === 'mixed'
  
  // Auto-set price based on payment type
  const unitPrice = isSHA && service.shaPrice 
    ? service.shaPrice 
    : service.price
  
  const totalPrice = unitPrice * quantity

  // Create invoice item with auto-set price
  const newItem: InvoiceItem = {
    id: crypto.randomUUID(),
    type: 'service',
    description: service.name,
    quantity,
    unit_price: unitPrice,  // Auto-set from catalog
    total_price: totalPrice,  // Auto-calculated
    sha_covered: isSHA,
    sha_amount: isSHA && service.shaPrice ? service.shaPrice * quantity : 0,
    patient_amount: isSHA && service.shaPrice 
      ? (service.price - service.shaPrice) * quantity 
      : totalPrice,
  }

  setItems([...items, newItem])
}
```

### **Auto-Calculate Totals**

```typescript
const calculateTotals = () => {
  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
  const tax = subtotal * 0.16  // 16% VAT
  const total = subtotal + tax
  const shaTotal = items.reduce((sum, item) => 
    sum + (item.sha_covered ? item.sha_amount : 0), 0
  )
  const patientTotal = items.reduce((sum, item) => 
    sum + item.patient_amount, 0
  )

  return { subtotal, tax, total, shaTotal, patientTotal }
}
```

---

## ✅ Benefits

### **For Users**

1. ✅ **No Manual Price Entry**: Prices are automatically set
2. ✅ **Consistent Pricing**: All users see same prices
3. ✅ **Error Prevention**: No typos or incorrect prices
4. ✅ **Time Saving**: Faster billing process
5. ✅ **Transparency**: Price visible before adding

### **For Management**

1. ✅ **Price Control**: Prices managed in one place (service catalog)
2. ✅ **Easy Updates**: Change price once, applies everywhere
3. ✅ **Audit Trail**: All prices come from catalog
4. ✅ **Reporting**: Accurate financial data

---

## 📝 Example: HIV Test Billing

### **Scenario**: Patient comes for HIV test

**Step 1**: User opens Billing Module

**Step 2**: User selects "HIV Test" from dropdown
- System shows: "HIV Test - KSh 500"
- User sees price before selecting

**Step 3**: User sees preview:
```
🧮 HIV Test × 1
Unit Price: KSh 500 (Cash Rate)
Total: KSh 500
✓ Price automatically set from service catalog
```

**Step 4**: User clicks "Add"
- Service added to invoice
- Price: KSh 500 (auto-set)
- Quantity: 1

**Step 5**: System auto-calculates:
- Subtotal: KSh 500.00
- Tax (16%): KSh 80.00
- **Total: KSh 580.00**

**Step 6**: User processes payment
- Amount to pay: KSh 580.00
- System generates invoice
- Receipt printed

---

## 🎯 Key Features

### **1. Automatic Price Setting**
- ✅ Prices come from service catalog
- ✅ No manual entry required
- ✅ Consistent across all users

### **2. Real-Time Calculation**
- ✅ Totals update immediately
- ✅ Tax calculated automatically
- ✅ No manual math needed

### **3. Visual Confirmation**
- ✅ Price preview before adding
- ✅ Auto-calculation indicators
- ✅ Clear pricing display

### **4. Payment Type Awareness**
- ✅ Cash prices for cash payments
- ✅ SHA prices for SHA payments
- ✅ Mixed payment support

---

## 🔍 Finding Services

### **By Category**

Services are organized in dropdown:
- **Lab Tests**: HIV Test, CBC, Malaria, etc.
- **Consultations**: General, Specialist, Follow-up
- **Procedures**: Wound Dressing, Injections, etc.
- **Imaging**: X-Ray, Ultrasound
- **Other**: Medical Certificates, etc.

### **By Search**

Users can:
- Type service name in dropdown
- Filter by category
- See prices while searching

---

## 📊 Service Catalog Management

### **Adding New Services**

**Admin can add services with prices**:
1. Go to Service Catalog
2. Click "Add Service"
3. Enter:
   - Service code (e.g., LAB-007)
   - Service name (e.g., "Hepatitis B Test")
   - Category (e.g., laboratory)
   - Cash price (e.g., 600)
   - SHA price (optional, e.g., 500)
4. Save

**Result**: Service available in billing with auto-set price

### **Updating Prices**

**Admin can update prices**:
1. Go to Service Catalog
2. Find service
3. Click "Edit"
4. Update price
5. Save

**Result**: New price applies to all future invoices

---

## 🎓 Best Practices

### **For Receptionists/Billing Staff**

1. ✅ Always select services from catalog (don't type manually)
2. ✅ Verify price in preview before adding
3. ✅ Check quantity is correct
4. ✅ Review totals before generating invoice

### **For Administrators**

1. ✅ Keep service catalog updated
2. ✅ Set accurate prices
3. ✅ Review prices regularly
4. ✅ Add new services as needed

---

## 🚀 Summary

**The system automatically**:
- ✅ Sets prices when services are selected
- ✅ Calculates totals in real-time
- ✅ Applies tax automatically
- ✅ Updates amounts when items are added/removed

**Users only need to**:
- ✅ Select service from catalog
- ✅ Verify quantity
- ✅ Click "Add"
- ✅ Process payment

**No manual price entry required!**

---

*Last Updated: 2025-01-XX*
*Status: Implemented and Active*

