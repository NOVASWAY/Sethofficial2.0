# Service Catalog Persistence Issue

## 🔴 Critical Issue Identified

### **Problem**: Services Are NOT Saved to Database

**Status**: ❌ **NOT PERSISTENT**

---

## 📋 Current State

### **What Exists** ✅

1. **Frontend UI** (`components/service-catalog.tsx`):
   - ✅ Admin can add services
   - ✅ Admin can edit services
   - ✅ Services displayed with prices
   - ❌ **BUT: Only saved to local state!**

2. **Frontend API Client** (`lib/api-client.ts`):
   - ✅ `serviceCatalogAPI.create()` method exists
   - ✅ `serviceCatalogAPI.updatePrices()` method exists
   - ❌ **BUT: Backend endpoints don't exist!**

3. **Backend Service Catalog** (`backend/src/service_catalog.rs`):
   - ✅ In-memory service catalog
   - ✅ Default services initialized
   - ❌ **BUT: Not database-backed!**
   - ❌ **BUT: Lost on server restart!**

4. **Admin Service Management** (`components/admin-service-management.tsx`):
   - ✅ Tries to call `serviceCatalogAPI.create()`
   - ✅ Tries to call `serviceCatalogAPI.updatePrices()`
   - ❌ **BUT: Backend routes don't exist!**

---

## ❌ What's Missing

### **1. Database Table** ❌

**No `services` table exists in database!**

Services need to be stored in a table like:
```sql
CREATE TABLE services (
    id UUID PRIMARY KEY,
    service_code VARCHAR(50) UNIQUE,
    name VARCHAR(255),
    category VARCHAR(50),
    description TEXT,
    cash_price DECIMAL(10,2),
    sha_price DECIMAL(10,2),
    nhif_price DECIMAL(10,2),
    is_active BOOLEAN,
    requires_prescription BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

---

### **2. Backend API Routes** ❌

**No routes in `backend/src/main.rs` for:**
- `POST /api/admin/services` - Create service
- `PUT /api/admin/services/:id` - Update service prices
- `GET /api/admin/services` - Get all services for admin
- `DELETE /api/admin/services/:id` - Delete service

---

### **3. Backend Handlers** ❌

**No handlers for:**
- Creating services
- Updating service prices
- Managing services (CRUD)

---

### **4. Frontend Not Calling API** ❌

**`components/service-catalog.tsx`:**
- Only updates local state: `setServices([...services, newService])`
- Does NOT call `serviceCatalogAPI.create()`
- Changes lost on page refresh!

---

## 🎯 What Needs to Be Done

### **Fix 1: Create Database Migration**

Create `backend/migrations/023_create_services_table.sql`:
- Services table with all fields
- Indexes for performance
- Foreign keys if needed

---

### **Fix 2: Create Backend Models**

Update `backend/src/models.rs`:
- `Service` struct (database model)
- `CreateService` struct (for creation)
- `UpdateService` struct (for updates)

---

### **Fix 3: Create Backend Handlers**

Create `backend/src/handlers/service_handlers.rs`:
- `create_service()` - Create new service
- `update_service()` - Update service (prices, etc.)
- `get_services()` - Get all services
- `get_service_by_id()` - Get single service
- `delete_service()` - Delete service

---

### **Fix 4: Register Routes**

Update `backend/src/main.rs`:
- Add routes for service management
- Protect with admin authentication

---

### **Fix 5: Update Frontend**

Update `components/service-catalog.tsx`:
- Call `serviceCatalogAPI.create()` when adding service
- Call `serviceCatalogAPI.update()` when editing service
- Load services from API on mount
- Remove local-only state management

---

### **Fix 6: Update Admin Service Management**

Ensure `components/admin-service-management.tsx`:
- Properly calls API
- Handles errors
- Refreshes after changes

---

## 📊 Impact

### **Current Behavior**:

1. Admin adds service → ✅ Appears in UI
2. Admin refreshes page → ❌ Service is GONE!
3. Admin edits price → ✅ Shows in UI
4. Server restarts → ❌ All changes LOST!

### **After Fix**:

1. Admin adds service → ✅ Saved to database
2. Admin refreshes page → ✅ Service still there!
3. Admin edits price → ✅ Saved to database
4. Server restarts → ✅ All services persist!

---

## 🔧 Priority

**CRITICAL** - This is a core feature that admins need!

Without persistence:
- Admins can't manage service catalog
- Prices can't be updated permanently
- New services can't be added permanently
- System relies on hardcoded defaults

---

*Status: Critical Issue - Needs Immediate Fix*

