# ⚡ Performance Optimization Guide

**Date**: January 2025  
**Status**: ✅ Recommendations Complete | ⏳ Implementation In Progress

---

## Overview

This document outlines performance optimization strategies for the Clinic Management System, including database query optimization, caching strategies, and frontend optimization recommendations.

---

## 1. Database Query Optimization

### Current Issues Identified

1. **N+1 Query Problems**
   - Patient queries fetch appointments/consultations separately
   - Invoice queries fetch patient data separately
   - Consider using JOINs or eager loading

2. **Missing Indexes**
   - Search queries on `first_name`, `last_name`, `patient_number` could benefit from indexes
   - Date-based queries on `appointments.date` should be indexed
   - Foreign key columns should be indexed

3. **Inefficient Pagination**
   - Some queries fetch all data then filter in memory
   - Should use database-level filtering and LIMIT/OFFSET

### Recommended Optimizations

#### A. Add Database Indexes

Create migration for indexes:

```sql
-- Patient search indexes
CREATE INDEX IF NOT EXISTS idx_patients_first_name ON patients(first_name);
CREATE INDEX IF NOT EXISTS idx_patients_last_name ON patients(last_name);
CREATE INDEX IF NOT EXISTS idx_patients_patient_number ON patients(patient_number);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

-- Appointment indexes
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);

-- Consultation indexes
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_date ON consultations(consultation_date);

-- Medicine indexes
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_current_stock ON medicines(current_stock);

-- Prescription indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation_id ON prescriptions(consultation_id);
```

#### B. Optimize Patient Queries

**Current:**
```rust
// Multiple queries
let patient = get_patient(id);
let appointments = get_appointments_by_patient(id);
let consultations = get_consultations_by_patient(id);
```

**Optimized:**
```rust
// Single query with JOINs
let patient_with_related = sqlx::query_as!(
    PatientWithRelated,
    r#"
    SELECT 
        p.*,
        json_agg(DISTINCT a.*) as appointments,
        json_agg(DISTINCT c.*) as consultations
    FROM patients p
    LEFT JOIN appointments a ON a.patient_id = p.id
    LEFT JOIN consultations c ON c.patient_id = p.id
    WHERE p.id = $1
    GROUP BY p.id
    "#
)
.bind(patient_id)
.fetch_one(&pool)
.await?;
```

#### C. Optimize Invoice Listing

**Current:**
```rust
// Fetches all then filters in memory
let invoices = sqlx::query("SELECT * FROM invoices LIMIT $1")
    .bind(per_page * 10)
    .fetch_all(&pool)
    .await?;
// Then filter in Rust
```

**Optimized:**
```rust
// Filter at database level
let invoices = sqlx::query_as!(
    InvoiceRow,
    r#"
    SELECT i.*, p.first_name, p.last_name, p.phone
    FROM invoices i
    LEFT JOIN patients p ON i.patient_id = p.id
    WHERE 
        ($1::uuid IS NULL OR i.patient_id = $1)
        AND ($2::text IS NULL OR i.payment_status = $2)
        AND ($3::date IS NULL OR i.date >= $3)
        AND ($4::date IS NULL OR i.date <= $4)
    ORDER BY i.created_at DESC
    LIMIT $5 OFFSET $6
    "#
)
.bind(patient_id)
.bind(payment_status)
.bind(date_from)
.bind(date_to)
.bind(per_page)
.bind(offset)
.fetch_all(&pool)
.await?;
```

---

## 2. Caching Strategy

### Cache Infrastructure

Multiple cache implementations exist:
- `src/cache.rs` - Basic memory cache
- `src/caching.rs` - Multi-layer cache (Redis + Memory)
- `src/cache/cache_service.rs` - Typed cache service

### Recommended Approach

Use **multi-layer caching** with Redis for distributed cache and in-memory for fast access.

#### A. Initialize Cache Service

```rust
// In main.rs
use cache::CacheService;
use std::time::Duration;

let cache_config = cache::CacheConfig {
    default_ttl: Duration::from_secs(300), // 5 minutes
    max_entries: 10000,
    cleanup_interval: Duration::from_secs(60),
    enable_metrics: true,
};

let cache_service = Arc::new(CacheService::new(cache_config));

let app_state = AppState {
    db_pool,
    auth_service,
    cache_service: Some(cache_service.clone()),
};
```

#### B. Cache Key Strategy

```rust
// Cache key patterns
const CACHE_PATTERN_PATIENT: &str = "patient:{}";
const CACHE_PATTERN_PATIENTS_LIST: &str = "patients:page:{}:per_page:{}:search:{}";
const CACHE_PATTERN_APPOINTMENTS: &str = "appointments:date:{}";
const CACHE_PATTERN_INVOICES: &str = "invoices:page:{}:status:{}";
const CACHE_PATTERN_DASHBOARD: &str = "dashboard:user:{}";
```

#### C. Example Cached Handler

```rust
pub async fn get_patient(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();
    let cache_key = format!("patient:{}", patient_id);

    // Try cache first
    if let Some(ref cache) = state.cache_service {
        if let Some(patient) = cache.get::<Patient>(&cache_key).await {
            return Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": patient,
                "cached": true
            })));
        }
    }

    // Cache miss - fetch from database
    let patient = sqlx::query_as::<_, Patient>(
        "SELECT * FROM patients WHERE id = $1"
    )
    .bind(patient_id)
    .fetch_optional(&state.db_pool)
    .await?;

    match patient {
        Some(p) => {
            // Store in cache
            if let Some(ref cache) = state.cache_service {
                let _ = cache.set(&cache_key, &p, None).await;
            }

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": p,
                "cached": false
            })))
        }
        None => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Patient not found"
        })))
    }
}
```

#### D. Cache Invalidation

```rust
// Invalidate cache on updates
pub async fn update_patient(
    path: web::Path<Uuid>,
    req: web::Json<UpdatePatientRequest>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();

    // Update database
    let updated = sqlx::query_as::<_, Patient>(
        "UPDATE patients SET ... WHERE id = $1 RETURNING *"
    )
    .bind(patient_id)
    .fetch_one(&state.db_pool)
    .await?;

    // Invalidate cache
    if let Some(ref cache) = state.cache_service {
        let cache_key = format!("patient:{}", patient_id);
        let _ = cache.delete(&cache_key).await;
        
        // Also invalidate list caches
        cache.invalidate_pattern("patients:*").await;
    }

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": updated
    })))
}
```

### Caching Recommendations by Endpoint

| Endpoint | Cache TTL | Strategy |
|----------|-----------|----------|
| `GET /api/patients` | 60s | Cache paginated results |
| `GET /api/patients/{id}` | 300s | Cache individual patient |
| `GET /api/appointments` | 30s | Cache date-filtered results |
| `GET /api/invoices` | 60s | Cache filtered results |
| `GET /api/dashboard` | 30s | Cache dashboard summaries |
| `GET /api/reports/dashboard` | 60s | Cache report data |
| `GET /api/medicines` | 300s | Cache medicine list (rarely changes) |
| `GET /api/inventory/low-stock` | 60s | Cache alert data |

---

## 3. Database Connection Pooling

### Current Configuration

Ensure connection pool is optimized:

```rust
// In main.rs
let db_pool = sqlx::PgPool::connect(&database_url).await?;

// Optimized:
let db_pool = sqlx::PgPool::connect_with(
    sqlx::postgres::PgConnectOptions::from_str(&database_url)?
        .max_connections(20) // Adjust based on load
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(600))
        .max_lifetime(Duration::from_secs(1800))
).await?;
```

### Pool Size Recommendations

- **Development**: 5-10 connections
- **Production**: 20-50 connections (based on server capacity)

---

## 4. API Response Optimization

### A. Response Compression

Add compression middleware:

```rust
// In Cargo.toml
actix-web-httpauth = "0.8"
actix-web-compression = "0.3"

// In main.rs
use actix_web::middleware::Compress;

App::new()
    .wrap(Compress::default())
    // ... other middleware
```

### B. Pagination Optimization

```rust
// Return pagination metadata
{
    "success": true,
    "data": [...],
    "pagination": {
        "page": 1,
        "per_page": 20,
        "total": 150,
        "total_pages": 8,
        "has_next": true,
        "has_prev": false
    }
}
```

### C. Field Selection

Allow clients to request specific fields:

```rust
// GET /api/patients?fields=id,first_name,last_name,phone
let fields = query.get("fields").and_then(|v| v.as_str());

if let Some(fields_str) = fields {
    // Only select requested fields
    let selected_fields = fields_str.split(',').collect::<Vec<_>>();
    // Build dynamic query
}
```

---

## 5. Frontend Optimization

### A. API Request Batching

```typescript
// Batch multiple requests
const [patients, appointments, invoices] = await Promise.all([
  patientAPI.getPatients({ page: 1 }),
  appointmentAPI.getAppointments({ date: today }),
  invoiceAPI.getInvoices({ status: 'pending' })
]);
```

### B. React Query / SWR

Use data fetching library with built-in caching:

```typescript
import { useQuery } from '@tanstack/react-query';

function usePatients(page: number) {
  return useQuery({
    queryKey: ['patients', page],
    queryFn: () => patientAPI.getPatients({ page }),
    staleTime: 60000, // 1 minute
    cacheTime: 300000, // 5 minutes
  });
}
```

### C. Code Splitting

```typescript
// Lazy load components
const PatientManagement = lazy(() => import('./PatientManagement'));
const Dashboard = lazy(() => import('./Dashboard'));

// Use Suspense
<Suspense fallback={<Loading />}>
  <PatientManagement />
</Suspense>
```

### D. Image Optimization

- Use Next.js Image component
- Implement lazy loading
- Serve images in WebP format
- Use CDN for static assets

### E. Bundle Optimization

```javascript
// next.config.js
module.exports = {
  // Enable bundle analyzer
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      };
    }
    return config;
  },
};
```

---

## 6. Redis Integration

### A. Setup Redis

```bash
# Docker Compose
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
```

### B. Environment Variables

```bash
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
CACHE_TTL_SECONDS=300
```

### C. Use Redis for Session Storage

```rust
// Store sessions in Redis instead of memory
let session_key = format!("session:{}", session_id);
redis_client.set(&session_key, &session_data, Some(Duration::from_secs(3600))).await?;
```

---

## 7. Monitoring & Profiling

### A. Add Query Logging

```rust
// Enable SQLx query logging
env::set_var("SQLX_LOG", "sqlx=debug");

// Or in code
sqlx::query("...")
    .fetch_all(&pool)
    .await?;
```

### B. Add Response Time Tracking

```rust
// Middleware to track response times
use actix_web::middleware::Logger;
use std::time::Instant;

// Custom middleware
pub struct TimingMiddleware;

impl<S, B> Transform<S, ServiceRequest> for TimingMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
{
    fn call(&self, req: ServiceRequest, s: &mut S) -> Self::Future {
        let start = Instant::now();
        let fut = s.call(req);
        
        Box::pin(async move {
            let res = fut.await?;
            let elapsed = start.elapsed();
            info!("Request took {:?}", elapsed);
            Ok(res)
        })
    }
}
```

### C. Database Query Performance

Use PostgreSQL's `EXPLAIN ANALYZE`:

```sql
EXPLAIN ANALYZE
SELECT * FROM patients 
WHERE first_name ILIKE '%john%'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 8. Implementation Priority

### Phase 1: Quick Wins (High Impact, Low Effort)
1. ✅ Add database indexes
2. ✅ Enable response compression
3. ✅ Add pagination metadata
4. ✅ Implement basic caching for dashboard/reports

### Phase 2: Medium Effort (High Impact)
1. ✅ Optimize N+1 queries with JOINs
2. ✅ Implement Redis caching
3. ✅ Add request/response time logging
4. ✅ Optimize database connection pooling

### Phase 3: Long-term (Continuous)
1. ✅ Frontend code splitting
2. ✅ API request batching
3. ✅ Database query optimization (ongoing)
4. ✅ Performance monitoring dashboard

---

## 9. Performance Targets

| Metric | Current | Target | Optimization |
|--------|---------|--------|--------------|
| API Response Time | 200-500ms | <100ms | Caching + Query Optimization |
| Database Query Time | 50-200ms | <50ms | Indexes + Query Optimization |
| Page Load Time | 2-5s | <2s | Code Splitting + Lazy Loading |
| Cache Hit Rate | 0% | >70% | Redis + Memory Cache |
| Concurrent Users | 10-50 | 100+ | Connection Pooling |

---

## 10. Next Steps

1. **Create Index Migration**
   - Add all recommended indexes
   - Test query performance improvements

2. **Integrate Caching**
   - Add cache service to AppState
   - Implement caching in high-traffic endpoints
   - Add cache invalidation on updates

3. **Monitor Performance**
   - Add performance metrics
   - Set up query logging
   - Create performance dashboard

4. **Frontend Optimization**
   - Implement React Query
   - Add code splitting
   - Optimize bundle size

---

**Status**: ✅ **Optimization guide complete!** Ready for implementation based on priorities.