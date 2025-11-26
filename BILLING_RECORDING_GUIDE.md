# Billing Recording Guide

## Overview

This document explains how billing is recorded in the clinic management system, including invoice creation, payment processing, and data storage.

---

## 📋 Billing Data Structure

### 1. **Invoice Table** (`invoices`)

**Primary Storage Location**: Database table `invoices`

**Fields Recorded**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique invoice identifier |
| `patient_id` | UUID | Reference to patient |
| `invoice_number` | VARCHAR(50) | Unique invoice number (e.g., INV-20250115-0012) |
| `date` | DATE | Invoice date |
| `items` | JSONB | Array of invoice items (services, medications, procedures) |
| `subtotal` | DECIMAL(10,2) | Subtotal before tax |
| `tax_amount` | DECIMAL(10,2) | Tax amount (16% VAT in Kenya) |
| `total_amount` | DECIMAL(10,2) | Total amount including tax |
| `payment_status` | VARCHAR(20) | Status: pending, partial, paid, cancelled |
| `payment_method` | VARCHAR(50) | Method: cash, mpesa, sha, mixed |
| `consultation_id` | UUID | Reference to consultation (optional) |
| `created_by` | UUID | User who created the invoice |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

**Invoice Number Format**:
```
INV-YYYYMMDD-XXXX
Example: INV-20250115-0012
```

---

### 2. **Invoice Items** (`invoice_items`)

**Purpose**: Detailed breakdown of each item on the invoice

**Fields Recorded**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique item identifier |
| `invoice_id` | UUID | Reference to parent invoice |
| `item_type` | VARCHAR(20) | Type: service, medication, procedure |
| `item_id` | UUID | Reference to service/medication ID (optional) |
| `description` | VARCHAR(200) | Item description |
| `quantity` | INTEGER | Quantity |
| `unit_price` | DECIMAL(10,2) | Price per unit |
| `total_price` | DECIMAL(10,2) | Total price (quantity × unit_price) |
| `sha_covered` | BOOLEAN | Whether SHA covers this item |
| `sha_amount` | DECIMAL(10,2) | Amount covered by SHA |
| `patient_amount` | DECIMAL(10,2) | Amount paid by patient |

---

### 3. **Payment Allocations** (`payment_allocations`)

**Purpose**: Records individual payments for invoices (supports mixed payments)

**Fields Recorded**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique payment identifier |
| `invoice_id` | UUID | Reference to invoice |
| `payment_type` | VARCHAR(20) | Type: sha, cash, mpesa |
| `amount` | DECIMAL(10,2) | Payment amount |
| `payment_reference` | VARCHAR(100) | Reference number (e.g., M-Pesa code) |
| `payment_date` | DATE | Date of payment |
| `notes` | TEXT | Payment notes |
| `created_at` | TIMESTAMP | Creation timestamp |

---

### 4. **Financial Transactions** (`financial_transactions`)

**Purpose**: Tracks all financial transactions for cash flow analysis

**Fields Recorded**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique transaction identifier |
| `transaction_number` | VARCHAR(20) | Transaction number |
| `transaction_date` | DATE | Transaction date |
| `transaction_type` | VARCHAR(20) | Type: revenue, expense, refund, adjustment |
| `category` | VARCHAR(50) | Category (e.g., patient_payment, salary) |
| `amount` | DECIMAL(10,2) | Transaction amount |
| `payment_method` | VARCHAR(20) | Method: cash, mpesa, bank_transfer, sha |
| `reference_id` | UUID | Reference to invoice_id or other entity |
| `reference_type` | VARCHAR(50) | Type of reference (e.g., invoice, expense) |
| `description` | TEXT | Transaction description |
| `notes` | TEXT | Additional notes |
| `created_by` | UUID | User who created the transaction |
| `created_at` | TIMESTAMP | Creation timestamp |

---

## 🔄 Billing Recording Process

### Step 1: **Invoice Creation**

**Trigger**: After consultation or when billing is needed

**Process**:

1. **User Action**: Receptionist/Clinician creates invoice
2. **Data Collection**:
   - Patient information
   - Services/medications from consultation
   - Payment type (cash, SHA, M-Pesa, mixed)
   - Notes (optional)

3. **Backend Processing**:
   ```rust
   // Generate invoice number
   invoice_number = format!("INV-{}-{}", date, random_number)
   
   // Calculate totals
   subtotal = sum(item.quantity × item.unit_price)
   tax_amount = subtotal × 0.16  // 16% VAT
   total_amount = subtotal + tax_amount
   ```

4. **Database Insert**:
   ```sql
   INSERT INTO invoices (
       id, patient_id, invoice_number, date, items, 
       subtotal, tax_amount, total_amount, 
       payment_status, consultation_id, created_by
   ) VALUES (...)
   ```

5. **Result**: Invoice created with status "pending"

---

### Step 2: **Payment Processing**

**Trigger**: When payment is received

**Process**:

#### **A. Cash Payment**

1. **User Action**: Receptionist records cash payment
2. **Data Recorded**:
   - Payment amount
   - Payment method: "cash"
   - Date received
   - Received by (user)

3. **Database Updates**:
   ```sql
   -- Update invoice status
   UPDATE invoices 
   SET payment_status = 'paid',
       payment_method = 'cash',
       updated_at = NOW()
   WHERE id = invoice_id
   
   -- Create payment allocation
   INSERT INTO payment_allocations (
       invoice_id, payment_type, amount, 
       payment_date, notes
   ) VALUES (...)
   
   -- Create financial transaction
   INSERT INTO financial_transactions (
       transaction_type, category, amount,
       payment_method, reference_id, reference_type
   ) VALUES ('revenue', 'patient_payment', amount, 'cash', invoice_id, 'invoice')
   ```

---

#### **B. M-Pesa Payment**

1. **User Action**: Receptionist initiates M-Pesa payment
2. **Process**:
   - STK Push sent to patient's phone
   - Patient enters PIN
   - Payment confirmation received
   - Transaction code captured

3. **Data Recorded**:
   - Payment amount
   - Payment method: "mpesa"
   - M-Pesa transaction code (receipt number)
   - Phone number
   - Date received

4. **Database Updates**:
   ```sql
   -- Update invoice
   UPDATE invoices 
   SET payment_status = 'paid',
       payment_method = 'mpesa',
       updated_at = NOW()
   WHERE id = invoice_id
   
   -- Create payment allocation with M-Pesa code
   INSERT INTO payment_allocations (
       invoice_id, payment_type, amount,
       payment_reference, payment_date
   ) VALUES (invoice_id, 'mpesa', amount, mpesa_code, date)
   
   -- Create financial transaction
   INSERT INTO financial_transactions (...)
   ```

---

#### **C. SHA (Insurance) Payment**

1. **User Action**: Receptionist records SHA claim
2. **Data Recorded**:
   - Payment amount
   - Payment method: "sha"
   - SHA claim number
   - Member number
   - Authorization code
   - Diagnosis (ICD-11 code)
   - Service codes

3. **Database Updates**:
   ```sql
   -- Update invoice
   UPDATE invoices 
   SET payment_status = 'paid',
       payment_method = 'sha',
       updated_at = NOW()
   WHERE id = invoice_id
   
   -- Create payment allocation
   INSERT INTO payment_allocations (
       invoice_id, payment_type, amount,
       payment_reference, payment_date
   ) VALUES (invoice_id, 'sha', amount, claim_number, date)
   
   -- Create SHA claim record (if separate table exists)
   -- Create financial transaction
   ```

---

#### **D. Mixed Payment**

1. **User Action**: Receptionist records multiple payment methods
2. **Example**: 
   - SHA covers 80% (KSh 8,000)
   - Patient pays 20% cash (KSh 2,000)

3. **Data Recorded**:
   - Multiple payment allocations
   - Each with different payment type
   - Total equals invoice amount

4. **Database Updates**:
   ```sql
   -- Update invoice
   UPDATE invoices 
   SET payment_status = 'paid',
       payment_method = 'mixed',
       updated_at = NOW()
   WHERE id = invoice_id
   
   -- Create multiple payment allocations
   INSERT INTO payment_allocations (...) VALUES (invoice_id, 'sha', 8000, ...)
   INSERT INTO payment_allocations (...) VALUES (invoice_id, 'cash', 2000, ...)
   
   -- Create financial transactions for each
   ```

---

### Step 3: **Invoice Items Storage**

**Format**: JSONB array in `invoices.items` field

**Example**:
```json
[
  {
    "description": "General Consultation",
    "quantity": 1,
    "unit_price": 5000.00,
    "total": 5000.00
  },
  {
    "description": "Blood Pressure Check",
    "quantity": 1,
    "unit_price": 2000.00,
    "total": 2000.00
  }
]
```

**Also Stored Separately**: In `invoice_items` table for detailed tracking

---

## 📊 What Gets Recorded

### **Invoice Level**

✅ **Patient Information**:
- Patient ID
- Patient name (for display)

✅ **Financial Information**:
- Subtotal
- Tax amount (16% VAT)
- Total amount
- Discount (if applicable)

✅ **Payment Information**:
- Payment status (pending, partial, paid, cancelled)
- Payment method (cash, mpesa, sha, mixed)
- M-Pesa transaction code (if applicable)
- SHA claim number (if applicable)

✅ **Metadata**:
- Invoice number (auto-generated)
- Invoice date
- Consultation ID (if linked)
- Created by (user ID)
- Created at timestamp
- Updated at timestamp

✅ **Additional**:
- Notes (optional)
- Due date (optional)

---

### **Item Level**

✅ **For Each Item**:
- Description
- Item type (service, medication, procedure)
- Quantity
- Unit price
- Total price
- SHA coverage (yes/no)
- SHA amount (if covered)
- Patient amount (if partial coverage)

---

### **Payment Level**

✅ **For Each Payment**:
- Payment type (cash, mpesa, sha)
- Amount
- Payment reference (M-Pesa code, claim number, etc.)
- Payment date
- Notes
- Created timestamp

---

## 🔍 Data Flow

### **Invoice Creation Flow**

```
User Creates Invoice
    ↓
Frontend: BillingModule/InvoiceManagement
    ↓
API Call: POST /api/invoices
    ↓
Backend: invoice_handlers::create_invoice()
    ↓
Validation & Calculation
    ↓
Database: INSERT INTO invoices
    ↓
Response: Invoice ID & Number
    ↓
Frontend: Display Invoice & Enable Payment
```

---

### **Payment Processing Flow**

```
User Records Payment
    ↓
Frontend: Payment Form
    ↓
API Call: POST /api/invoices/{id}/pay
    ↓
Backend: invoice_handlers::process_payment()
    ↓
Update Invoice Status
    ↓
Create Payment Allocation
    ↓
Create Financial Transaction
    ↓
Response: Payment Confirmation
    ↓
Frontend: Update UI & Print Receipt
```

---

## 💾 Database Schema

### **Invoices Table**

```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    date DATE NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    consultation_id UUID REFERENCES consultations(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### **Payment Allocations Table**

```sql
CREATE TABLE payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('sha', 'cash', 'mpesa')),
    amount DECIMAL(10,2) NOT NULL,
    payment_reference VARCHAR(100),
    payment_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **Financial Transactions Table**

```sql
CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(20) UNIQUE NOT NULL,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('revenue', 'expense', 'refund', 'adjustment')),
    category VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20),
    reference_id UUID,
    reference_type VARCHAR(50),
    description TEXT NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 📝 Code Examples

### **Creating an Invoice (Backend)**

```rust
pub async fn create_invoice(
    req: web::Json<CreateInvoice>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)?;
    let invoice_data = req.into_inner();
    
    // Generate invoice number
    let invoice_number = format!("INV-{}-{}", 
        now.format("%Y%m%d"),
        format!("{:04}", rand::random::<u16>())
    );

    // Calculate totals
    let mut subtotal = 0.0;
    let mut items_json = Vec::new();

    for item in &invoice_data.items {
        let total = item.quantity as f64 * item.unit_price;
        subtotal += total;
        items_json.push(json!({
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total": total
        }));
    }

    // Calculate tax (16% VAT)
    let tax_amount = subtotal * 0.16;
    let total_amount = subtotal + tax_amount;

    // Insert invoice
    sqlx::query(
        "INSERT INTO invoices (
            id, patient_id, invoice_number, date, items, 
            subtotal, tax_amount, total_amount, 
            payment_status, consultation_id, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)"
    )
    .bind(invoice_id)
    .bind(invoice_data.patient_id)
    .bind(&invoice_number)
    .bind(invoice_data.date)
    .bind(serde_json::to_value(items_json).unwrap())
    .bind(subtotal)
    .bind(tax_amount)
    .bind(total_amount)
    .bind("pending")
    .bind(invoice_data.consultation_id)
    .bind(claims.user_id)
    .bind(now)
    .bind(now)
    .execute(&data.db_pool)
    .await?;

    Ok(HttpResponse::Created().json(ApiResponse {
        success: true,
        data: Some(json!({
            "id": invoice_id,
            "invoice_number": invoice_number,
            "total_amount": total_amount
        })),
        message: Some("Invoice created successfully".to_string()),
        error: None,
    }))
}
```

### **Processing Payment (Backend)**

```rust
pub async fn process_payment(
    path: web::Path<Uuid>,
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();
    let payment_data = req.into_inner();
    
    let payment_method = payment_data.get("payment_method")
        .and_then(|v| v.as_str())
        .unwrap_or("cash");
    
    let amount = payment_data.get("amount")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    // Update invoice status
    sqlx::query(
        "UPDATE invoices 
         SET payment_status = 'paid',
             payment_method = $1,
             updated_at = NOW()
         WHERE id = $2"
    )
    .bind(payment_method)
    .bind(invoice_id)
    .execute(&data.db_pool)
    .await?;

    // Create payment allocation
    let payment_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO payment_allocations (
            id, invoice_id, payment_type, amount, 
            payment_reference, payment_date, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)"
    )
    .bind(payment_id)
    .bind(invoice_id)
    .bind(payment_method)
    .bind(amount)
    .bind(payment_data.get("reference").and_then(|v| v.as_str()))
    .bind(Utc::now().date_naive())
    .bind(Utc::now())
    .execute(&data.db_pool)
    .await?;

    // Create financial transaction
    // ... (similar pattern)

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
            "payment_id": payment_id,
            "invoice_id": invoice_id,
            "amount": amount,
            "payment_method": payment_method,
            "status": "paid"
        })),
        message: Some("Payment processed successfully".to_string()),
        error: None,
    }))
}
```

---

## 🔐 Data Integrity

### **Constraints**

1. **Foreign Keys**:
   - `patient_id` → `patients(id)`
   - `consultation_id` → `consultations(id)`
   - `created_by` → `users(id)`

2. **Unique Constraints**:
   - `invoice_number` must be unique
   - `transaction_number` must be unique

3. **Check Constraints**:
   - `payment_status` IN ('pending', 'partial', 'paid', 'cancelled')
   - `payment_type` IN ('sha', 'cash', 'mpesa')
   - `transaction_type` IN ('revenue', 'expense', 'refund', 'adjustment')

---

## 📈 Reporting & Analytics

### **Data Available for Reports**

✅ **Revenue Reports**:
- Total revenue by date range
- Revenue by payment method
- Revenue by service category
- Daily/weekly/monthly summaries

✅ **Outstanding Balances**:
- Pending invoices
- Partial payments
- Overdue invoices

✅ **Payment Analysis**:
- Cash vs M-Pesa vs SHA breakdown
- Payment trends over time
- Average transaction value

✅ **Patient Billing History**:
- All invoices for a patient
- Payment history
- Outstanding balances

---

## 🎯 Key Points

### **What is Recorded**:

1. ✅ **Invoice Details**: Number, date, amounts, status
2. ✅ **Items**: Services, medications, procedures with prices
3. ✅ **Payments**: Method, amount, reference, date
4. ✅ **Financial Transactions**: For cash flow tracking
5. ✅ **Metadata**: Who created, when, linked consultations

### **What is NOT Recorded** (by default):

1. ❌ Patient payment card details (if card payment added)
2. ❌ Bank account numbers
3. ❌ Detailed M-Pesa PIN/authentication data
4. ❌ Physical receipt images (unless file upload added)

---

## 🔄 Workflow Summary

```
1. Consultation Completed
    ↓
2. Invoice Created
    - Items from consultation
    - Prices calculated
    - Tax added (16%)
    - Status: "pending"
    ↓
3. Payment Received
    - Method recorded (cash/mpesa/sha)
    - Amount recorded
    - Reference captured (if applicable)
    ↓
4. Invoice Updated
    - Status: "paid"
    - Payment method set
    ↓
5. Payment Allocation Created
    - Payment details stored
    ↓
6. Financial Transaction Created
    - For cash flow tracking
    ↓
7. Receipt Generated
    - Printable invoice/receipt
```

---

## 📋 Summary

**Billing is recorded in multiple tables**:

1. **`invoices`** - Main invoice record
2. **`invoice_items`** - Detailed item breakdown
3. **`payment_allocations`** - Individual payments
4. **`financial_transactions`** - Cash flow tracking

**All billing data is**:
- ✅ Stored in PostgreSQL database
- ✅ Linked to patients and consultations
- ✅ Tracked with timestamps
- ✅ Auditable (created_by field)
- ✅ Queryable for reports
- ✅ Printable as receipts

---

*Last Updated: 2025-01-XX*
*Status: Current Implementation*

