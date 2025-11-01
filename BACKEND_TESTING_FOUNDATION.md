# 🧪 Backend Testing Foundation

**Date**: January 2025  
**Status**: ✅ Test Infrastructure Created

---

## Overview

Comprehensive testing infrastructure has been set up for the backend with:
- ✅ Test configuration and helpers
- ✅ Security middleware tests
- ✅ API integration test structure
- ✅ Test utilities for database and authentication

---

## Test Structure

### Existing Test Files

1. **`tests/auth_tests.rs`** - Authentication endpoint tests
2. **`tests/integration_tests.rs`** - Integration test utilities
3. **`tests/unit_tests.rs`** - Unit test examples
4. **`tests/e2e_tests.rs`** - End-to-end workflow tests
5. **`tests/test_config.rs`** - Test configuration
6. **`tests/test_helpers.rs`** - Test utility functions

### New Test Files

7. **`tests/security_middleware_tests.rs`** - Security middleware tests
8. **`tests/api_integration_tests.rs`** - API endpoint integration tests

---

## Test Utilities

### Test Helpers (`tests/test_helpers.rs`)

Available helper functions:
- `setup_test_database()` - Creates test database pool
- `cleanup_test_database()` - Cleans up test data
- `create_test_patient()` - Creates test patient data
- `create_test_user()` - Creates test user data
- `create_test_appointment()` - Creates test appointment data

### Test Configuration (`tests/test_config.rs`)

Configuration options:
- `TEST_DATABASE_URL` - Test database connection
- `JWT_SECRET` - JWT secret for testing
- `TEST_LOG_LEVEL` - Logging level for tests
- `ENABLE_INTEGRATION_TESTS` - Enable/disable integration tests
- `ENABLE_E2E_TESTS` - Enable/disable E2E tests

---

## Running Tests

### Run All Tests
```bash
cd backend
cargo test
```

### Run Specific Test Suite
```bash
# Security middleware tests
cargo test security_middleware

# Authentication tests
cargo test auth

# Integration tests
cargo test integration

# End-to-end tests
cargo test e2e
```

### Run Tests with Database (Integration Tests)
```bash
# Set test database URL
export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/clinic_management_test"

# Run ignored tests (require database)
cargo test -- --ignored --test-threads=1
```

### Run Tests with Verbose Output
```bash
cargo test -- --nocapture --test-threads=1
```

---

## Test Coverage

### Current Test Coverage

**Security Middleware:**
- ✅ Token validation
- ✅ Missing token handling
- ✅ Invalid token handling
- ✅ Malformed header handling
- ⏳ Rate limiting (marked as ignored)

**Authentication:**
- ✅ Login with valid credentials
- ✅ Login with invalid credentials
- ✅ Login with missing fields
- ✅ Get current user with valid token
- ✅ Get current user without token

**API Endpoints:**
- ✅ Health check endpoint
- ✅ Protected route access control
- ⏳ Patient CRUD operations (requires database)

---

## Test Categories

### 1. Unit Tests
**Location**: `tests/unit_tests.rs`, module-level `#[cfg(test)]` blocks

**Purpose**: Test individual functions and modules in isolation

**Example**:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_hash_password() {
        let auth_service = AuthService::new("secret", 24, 7);
        let hash = auth_service.hash_password("password").unwrap();
        assert!(!hash.is_empty());
    }
}
```

### 2. Integration Tests
**Location**: `tests/integration_tests.rs`, `tests/api_integration_tests.rs`

**Purpose**: Test API endpoints with full request/response cycle

**Example**:
```rust
#[actix_web::test]
async fn test_get_patients() {
    let app = create_test_app().await;
    let req = TestRequest::get()
        .uri("/api/patients")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
}
```

### 3. End-to-End Tests
**Location**: `tests/e2e_tests.rs`

**Purpose**: Test complete workflows across multiple endpoints

**Example**:
```rust
#[actix_web::test]
async fn test_patient_registration_workflow() {
    // 1. Register patient
    // 2. Create consultation
    // 3. Create invoice
    // 4. Verify all data
}
```

---

## Test Database Setup

### Option 1: Separate Test Database (Recommended)

```bash
# Create test database
createdb clinic_management_test

# Set environment variable
export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/clinic_management_test"

# Run migrations
cd backend
sqlx migrate run --database-url $TEST_DATABASE_URL
```

### Option 2: Use Main Database (Development Only)

```bash
export TEST_DATABASE_URL=$DATABASE_URL
```

⚠️ **Warning**: Don't use production database for tests!

---

## Test Data Management

### Creating Test Data

```rust
use test_helpers::test_utils::*;

#[actix_web::test]
async fn test_with_data() {
    let app_state = create_test_app_state().await;
    
    // Create test user
    let user_id = create_test_user(
        &app_state.db_pool,
        &app_state.auth_service,
        "testuser",
        "password",
        "clinician"
    ).await;
    
    // Use test data...
    
    // Cleanup
    cleanup_test_data(&app_state.db_pool).await;
}
```

### Test Data Cleanup

Tests should clean up after themselves:
```rust
#[actix_web::test]
async fn test_example() {
    let app_state = create_test_app_state().await;
    
    // Test logic...
    
    // Always cleanup
    cleanup_test_data(&app_state.db_pool).await;
}
```

---

## Writing New Tests

### Test Template

```rust
use actix_web::{test, web, App};
use serde_json::json;
use clinic_management_backend::{AppState, simple_handlers, middleware};

#[actix_web::test]
async fn test_feature_name() {
    // 1. Setup
    let app_state = create_test_app_state().await;
    let app = create_test_app_with_middleware(&app_state).await;
    
    // 2. Prepare request
    let req = TestRequest::post()
        .uri("/api/endpoint")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(&request_data)
        .to_request();
    
    // 3. Execute
    let resp = test::call_service(&app, req).await;
    
    // 4. Assert
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], true);
    
    // 5. Cleanup
    cleanup_test_data(&app_state.db_pool).await;
}
```

---

## Test Coverage Goals

### Current Status
- **Unit Tests**: ~30% coverage
- **Integration Tests**: ~20% coverage
- **E2E Tests**: ~10% coverage

### Target Coverage (Production Ready)
- **Unit Tests**: 70%+ coverage
- **Integration Tests**: All major endpoints
- **E2E Tests**: Critical workflows

---

## Next Steps

1. **Expand Unit Tests**:
   - [ ] Test all handler functions
   - [ ] Test auth service methods
   - [ ] Test validation functions
   - [ ] Test utility functions

2. **Complete Integration Tests**:
   - [ ] Patient CRUD endpoints
   - [ ] Consultation endpoints
   - [ ] Appointment endpoints
   - [ ] Invoice endpoints
   - [ ] Pharmacy endpoints

3. **Add E2E Tests**:
   - [ ] Patient registration → Consultation → Billing workflow
   - [ ] Prescription → Dispensing workflow
   - [ ] Appointment booking workflow

4. **Performance Tests**:
   - [ ] Load testing
   - [ ] Stress testing
   - [ ] Database query performance

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions-rs/toolchain@v1
      - name: Run tests
        run: |
          cd backend
          export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/test"
          cargo test
```

---

## Notes

- Tests that require database are marked with `#[ignore]`
- Run ignored tests with: `cargo test -- --ignored`
- Test database should be isolated from development/production
- Always clean up test data after tests
- Use unique test data (UUIDs, timestamps) to avoid conflicts

---

**Status**: ✅ **Test infrastructure is ready!** Tests can now be expanded to cover all endpoints and workflows.
