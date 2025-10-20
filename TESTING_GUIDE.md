# Testing Guide

## Clinic Management System - Comprehensive Testing Documentation

### Table of Contents
1. [Testing Overview](#testing-overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Backend Testing](#backend-testing)
4. [Frontend Testing](#frontend-testing)
5. [Integration Testing](#integration-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [Performance Testing](#performance-testing)
8. [Security Testing](#security-testing)
9. [Test Automation](#test-automation)
10. [Test Data Management](#test-data-management)
11. [Continuous Integration](#continuous-integration)
12. [Troubleshooting](#troubleshooting)

## Testing Overview

### Testing Philosophy
The Clinic Management System follows a comprehensive testing strategy that ensures reliability, security, and performance across all components.

### Testing Pyramid
```
        /\
       /  \
      / E2E \     <- End-to-End Tests (Few)
     /______\
    /        \
   /Integration\ <- Integration Tests (Some)
  /____________\
 /              \
/   Unit Tests   \ <- Unit Tests (Many)
/________________\
```

### Test Categories
- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **End-to-End Tests**: Complete user workflow testing
- **Performance Tests**: Load and stress testing
- **Security Tests**: Vulnerability and penetration testing

## Test Environment Setup

### Prerequisites
- Rust 1.70+ with Cargo
- Node.js 18+ with npm/yarn
- PostgreSQL 13+
- Docker and Docker Compose (optional)

### Environment Variables
```bash
# Test Database
TEST_DATABASE_URL="postgresql://test_user:test_password@localhost:5432/clinic_management_test"

# JWT Secret for Testing
JWT_SECRET="test_jwt_secret_key_for_testing_only"

# Test Configuration
TEST_TIMEOUT=30
TEST_LOG_LEVEL=debug
ENABLE_PERFORMANCE_TESTS=false
```

### Test Database Setup
```bash
# Create test database
createdb clinic_management_test

# Run migrations
cd backend
DATABASE_URL=$TEST_DATABASE_URL sqlx migrate run
```

## Backend Testing

### Unit Tests

#### Running Unit Tests
```bash
cd backend
cargo test --lib
```

#### Test Structure
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_function_name() {
        // Arrange
        let input = create_test_data();
        
        // Act
        let result = function_under_test(input);
        
        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), expected_output);
    }
}
```

#### Key Test Areas
- **Authentication**: Password hashing, JWT generation/validation
- **Data Validation**: Input validation, sanitization
- **Business Logic**: Patient management, appointment scheduling
- **Cache Operations**: Cache set/get, expiration, statistics
- **Security Functions**: Rate limiting, input sanitization

#### Example Unit Test
```rust
#[test]
fn test_password_hashing() {
    let password = "test_password_123";
    let hashed = PasswordSecurity::hash_password(password).unwrap();
    
    assert!(hashed.len() > 50);
    assert!(PasswordSecurity::verify_password(password, &hashed).unwrap());
    assert!(!PasswordSecurity::verify_password("wrong_password", &hashed).unwrap());
}
```

### Integration Tests

#### Running Integration Tests
```bash
cd backend
cargo test --test integration_tests
```

#### Test Database Management
```rust
async fn setup_test_db() -> PgPool {
    let database_url = std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must be set");
    
    let pool = PgPool::connect(&database_url).await.unwrap();
    
    // Clean up before each test
    sqlx::query("TRUNCATE TABLE patients, users, appointments CASCADE")
        .execute(&pool)
        .await
        .unwrap();
    
    pool
}
```

#### Key Integration Test Areas
- **Database Operations**: CRUD operations, transactions
- **API Endpoints**: HTTP request/response testing
- **Authentication Flow**: Login, logout, token validation
- **Cache Integration**: Database-cache synchronization
- **File Operations**: Upload, download, storage

#### Example Integration Test
```rust
#[tokio::test]
async fn test_patient_crud_operations() {
    let pool = setup_test_db().await;
    
    // Create patient
    let patient_data = CreatePatient {
        first_name: "John".to_string(),
        last_name: "Doe".to_string(),
        date_of_birth: "1990-01-01".parse().unwrap(),
        gender: Some("male".to_string()),
        phone: Some("1234567890".to_string()),
        location: Some("Test Location".to_string()),
        emergency_contact: Some("Jane Doe".to_string()),
        emergency_phone: Some("0987654321".to_string()),
        medical_history: None,
        allergies: None,
    };
    
    let patient = create_patient(&pool, &patient_data).await.unwrap();
    assert_eq!(patient.first_name, "John");
    
    // Read patient
    let retrieved = get_patient(&pool, patient.id).await.unwrap();
    assert_eq!(retrieved.first_name, "John");
    
    // Update patient
    let update_data = UpdatePatient {
        first_name: Some("Jane".to_string()),
        ..Default::default()
    };
    
    let updated = update_patient(&pool, patient.id, &update_data).await.unwrap();
    assert_eq!(updated.first_name, "Jane");
    
    // Delete patient
    delete_patient(&pool, patient.id).await.unwrap();
    let result = get_patient(&pool, patient.id).await;
    assert!(result.is_err());
}
```

### End-to-End Tests

#### Running E2E Tests
```bash
cd backend
cargo test --test e2e_tests
```

#### Test Application Setup
```rust
async fn create_test_app() -> TestApp {
    let pool = setup_test_db().await;
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .configure(configure_routes)
    ).await;
    
    TestApp { app, pool }
}
```

#### Key E2E Test Scenarios
- **Complete User Workflows**: Registration to consultation
- **Patient Journey**: Registration to treatment
- **Appointment Management**: Scheduling to completion
- **Medicine Management**: Inventory to dispensing
- **Multi-User Scenarios**: Concurrent operations

#### Example E2E Test
```rust
#[tokio::test]
async fn test_complete_patient_journey() {
    let app = create_test_app().await;
    
    // 1. Register patient
    let patient_data = json!({
        "first_name": "John",
        "last_name": "Doe",
        "date_of_birth": "1990-01-01",
        "gender": "male",
        "phone": "1234567890",
        "location": "Test Location"
    });
    
    let response = app
        .post("/api/patients")
        .json(&patient_data)
        .send()
        .await
        .unwrap();
    
    assert_eq!(response.status(), 201);
    let patient: Patient = response.json().await.unwrap();
    
    // 2. Schedule appointment
    let appointment_data = json!({
        "patient_id": patient.id,
        "appointment_date": "2024-12-01",
        "appointment_time": "10:00:00",
        "notes": "Regular checkup"
    });
    
    let response = app
        .post("/api/appointments")
        .json(&appointment_data)
        .send()
        .await
        .unwrap();
    
    assert_eq!(response.status(), 201);
    let appointment: Appointment = response.json().await.unwrap();
    
    // 3. Complete appointment
    let update_data = json!({
        "status": "completed",
        "notes": "Patient is healthy"
    });
    
    let response = app
        .put(&format!("/api/appointments/{}", appointment.id))
        .json(&update_data)
        .send()
        .await
        .unwrap();
    
    assert_eq!(response.status(), 200);
}
```

## Frontend Testing

### Component Testing

#### Setup
```bash
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom jest
```

#### Test Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

#### Example Component Test
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { PatientForm } from '@/components/patient-form';

describe('PatientForm', () => {
  it('should render form fields correctly', () => {
    render(<PatientForm />);
    
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
  });
  
  it('should validate required fields', async () => {
    render(<PatientForm />);
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);
    
    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
  });
});
```

### Hook Testing

#### Example Hook Test
```typescript
import { renderHook, act } from '@testing-library/react';
import { usePatientData } from '@/hooks/use-patient-data';

describe('usePatientData', () => {
  it('should fetch patient data successfully', async () => {
    const { result } = renderHook(() => usePatientData('patient-id'));
    
    expect(result.current.loading).toBe(true);
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeDefined();
  });
});
```

## Performance Testing

### Load Testing

#### Setup
```bash
# Install artillery for load testing
npm install -g artillery
```

#### Load Test Configuration
```yaml
# load-test.yml
config:
  target: 'http://localhost:8080'
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      Authorization: 'Bearer test-token'

scenarios:
  - name: "Patient API Load Test"
    flow:
      - get:
          url: "/api/patients"
      - post:
          url: "/api/patients"
          json:
            first_name: "Test"
            last_name: "User"
            date_of_birth: "1990-01-01"
```

#### Running Load Tests
```bash
artillery run load-test.yml
```

### Stress Testing

#### Example Stress Test
```rust
#[tokio::test]
async fn test_concurrent_requests() {
    let app = create_test_app().await;
    let mut handles = vec![];
    
    // Spawn 100 concurrent requests
    for i in 0..100 {
        let app = app.clone();
        let handle = tokio::spawn(async move {
            let response = app
                .get("/api/patients")
                .send()
                .await
                .unwrap();
            assert_eq!(response.status(), 200);
        });
        handles.push(handle);
    }
    
    // Wait for all requests to complete
    for handle in handles {
        handle.await.unwrap();
    }
}
```

## Security Testing

### Authentication Testing

#### Example Security Test
```rust
#[tokio::test]
async fn test_brute_force_protection() {
    let app = create_test_app().await;
    
    // Attempt multiple failed logins
    for _ in 0..5 {
        let response = app
            .post("/api/auth/login")
            .json(&json!({
                "username": "test_user",
                "password": "wrong_password"
            }))
            .send()
            .await
            .unwrap();
        
        assert_eq!(response.status(), 401);
    }
    
    // Next login should be rate limited
    let response = app
        .post("/api/auth/login")
        .json(&json!({
            "username": "test_user",
            "password": "wrong_password"
        }))
        .send()
        .await
        .unwrap();
    
    assert_eq!(response.status(), 429);
}
```

### Input Validation Testing

#### Example Validation Test
```rust
#[tokio::test]
async fn test_sql_injection_protection() {
    let app = create_test_app().await;
    
    let malicious_input = "'; DROP TABLE patients; --";
    
    let response = app
        .post("/api/patients")
        .json(&json!({
            "first_name": malicious_input,
            "last_name": "Doe",
            "date_of_birth": "1990-01-01"
        }))
        .send()
        .await
        .unwrap();
    
    // Should sanitize input, not execute SQL
    assert_eq!(response.status(), 400);
}
```

## Test Automation

### Automated Test Runner

#### Test Script (`run_tests.sh`)
```bash
#!/bin/bash

# Test configuration
TEST_DATABASE_URL="postgresql://test_user:test_password@localhost:5432/clinic_management_test"
JWT_SECRET="test_jwt_secret_key_for_testing_only"
TEST_TIMEOUT=30
TEST_LOG_LEVEL=debug

# Function to run unit tests
run_unit_tests() {
    echo "Running unit tests..."
    cd backend
    cargo test --lib -- --nocapture
}

# Function to run integration tests
run_integration_tests() {
    echo "Running integration tests..."
    cd backend
    cargo test --test integration_tests -- --nocapture
}

# Function to run E2E tests
run_e2e_tests() {
    echo "Running end-to-end tests..."
    cd backend
    cargo test --test e2e_tests -- --nocapture
}

# Main test execution
main() {
    echo "Starting comprehensive test suite..."
    
    run_unit_tests
    run_integration_tests
    run_e2e_tests
    
    echo "All tests completed!"
}

main "$@"
```

### CI/CD Integration

#### GitHub Actions Workflow
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_USER: test_user
          POSTGRES_DB: clinic_management_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        cd backend && cargo build
        cd frontend && npm install
    
    - name: Run database migrations
      run: |
        cd backend
        DATABASE_URL="postgresql://test_user:test_password@localhost:5432/clinic_management_test" sqlx migrate run
    
    - name: Run tests
      run: |
        chmod +x run_tests.sh
        ./run_tests.sh
      env:
        TEST_DATABASE_URL: "postgresql://test_user:test_password@localhost:5432/clinic_management_test"
        JWT_SECRET: "test_jwt_secret_key_for_testing_only"
```

## Test Data Management

### Test Data Generation

#### Factory Functions
```rust
pub fn create_test_patient() -> CreatePatient {
    CreatePatient {
        first_name: "John".to_string(),
        last_name: "Doe".to_string(),
        date_of_birth: "1990-01-01".parse().unwrap(),
        gender: Some("male".to_string()),
        phone: Some("1234567890".to_string()),
        location: Some("Test Location".to_string()),
        emergency_contact: Some("Jane Doe".to_string()),
        emergency_phone: Some("0987654321".to_string()),
        medical_history: None,
        allergies: None,
    }
}

pub fn create_test_user() -> CreateUser {
    CreateUser {
        username: "test_user".to_string(),
        password: "test_password_123".to_string(),
        role: "doctor".to_string(),
        name: "Test Doctor".to_string(),
        department: Some("General Medicine".to_string()),
    }
}
```

### Test Database Cleanup

#### Cleanup Strategy
```rust
async fn cleanup_test_data(pool: &PgPool) {
    // Clean up in reverse dependency order
    sqlx::query("DELETE FROM appointments").execute(pool).await.unwrap();
    sqlx::query("DELETE FROM patients").execute(pool).await.unwrap();
    sqlx::query("DELETE FROM users WHERE username LIKE 'test_%'").execute(pool).await.unwrap();
    sqlx::query("DELETE FROM medicines WHERE name LIKE 'Test%'").execute(pool).await.unwrap();
}
```

## Continuous Integration

### Test Pipeline

#### Pre-commit Hooks
```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running pre-commit tests..."

# Run linting
cd backend && cargo clippy -- -D warnings
cd frontend && npm run lint

# Run unit tests
cd backend && cargo test --lib

echo "Pre-commit tests passed!"
```

#### Pull Request Checks
- Unit test execution
- Integration test execution
- Code coverage analysis
- Security vulnerability scanning
- Performance regression testing

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check database connectivity
psql -h localhost -U test_user -d clinic_management_test
```

#### Test Timeout Issues
```rust
// Increase test timeout
#[tokio::test]
#[timeout(Duration::from_secs(60))]
async fn test_long_running_operation() {
    // Test implementation
}
```

#### Memory Issues
```bash
# Monitor memory usage during tests
cargo test -- --nocapture 2>&1 | tee test_output.log
```

### Debug Mode

#### Enable Debug Logging
```rust
// In test setup
env_logger::Builder::from_env(Env::default().default_filter_or("debug")).init();
```

#### Test Debugging
```rust
#[tokio::test]
async fn test_with_debug_output() {
    let result = function_under_test().await;
    println!("Debug: {:?}", result);
    assert!(result.is_ok());
}
```

---

This testing guide provides comprehensive coverage of all testing aspects for the Clinic Management System. It ensures that developers can effectively test, debug, and maintain the system with confidence.