# Testing Guide

**Date**: Generated automatically  
**Status**: Complete testing procedures

---

## 🧪 Overview

This guide provides comprehensive testing procedures for the Clinic Management System, including service testing, integration testing, and performance testing.

---

## 📧 Email Service Testing

### Using Test Script
```bash
./scripts/test-email.sh
```

### Manual Testing
```bash
# Get auth token first
TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your_password"}' \
  | jq -r '.data.token')

# Get CSRF token
CSRF_TOKEN=$(curl -s -X GET http://localhost:8080/api/csrf/token \
  -H "Authorization: Bearer $TOKEN" | jq -r '.token')

# Send test email
curl -X POST http://localhost:8080/api/email/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "body": "This is a test email"
  }'
```

### Verification
- Check recipient inbox for email
- Verify email content and formatting
- Check backend logs for any errors

---

## 📱 SMS Service Testing

### Using Test Script
```bash
./scripts/test-sms.sh
```

### Manual Testing
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your_password"}' \
  | jq -r '.data.token')

# Get CSRF token
CSRF_TOKEN=$(curl -s -X GET http://localhost:8080/api/csrf/token \
  -H "Authorization: Bearer $TOKEN" | jq -r '.token')

# Send test SMS
curl -X POST http://localhost:8080/api/sms/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "message": "Test SMS from Clinic Management System"
  }'
```

### Verification
- Check recipient phone for SMS
- Verify message content
- Check backend logs for any errors

---

## 💰 M-Pesa Service Testing

### Using Test Script
```bash
./scripts/test-mpesa.sh
```

### Manual Testing (Sandbox)
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your_password"}' \
  | jq -r '.data.token')

# Get CSRF token
CSRF_TOKEN=$(curl -s -X GET http://localhost:8080/api/csrf/token \
  -H "Authorization: Bearer $TOKEN" | jq -r '.token')

# Initiate STK Push
curl -X POST http://localhost:8080/api/mpesa/stk-push \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "254712345678",
    "amount": 100,
    "account_reference": "TEST",
    "transaction_desc": "Test payment"
  }'
```

### Verification
- Check phone for M-Pesa prompt
- Complete payment on phone
- Verify callback received
- Check backend logs for transaction status

---

## 🧪 Backend Unit Tests

### Run All Tests
```bash
./scripts/run-tests.sh
```

### Run Specific Test Suites
```bash
cd backend

# Unit tests only
cargo test --lib

# Integration tests
cargo test --test '*'

# Specific test
cargo test test_name

# With output
cargo test -- --nocapture
```

### Test Database Setup
```bash
# Set up test database
./scripts/setup-test-db.sh

# Run tests with test database
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/clinic_management_test"
cd backend && cargo test
```

---

## 🔄 Integration Testing

### API Integration Tests
```bash
cd backend
cargo test --test api_integration_tests
```

### End-to-End Tests
```bash
cd backend
cargo test --test e2e_tests
```

### Test Coverage
```bash
# Install cargo-tarpaulin
cargo install cargo-tarpaulin

# Generate coverage report
cd backend
cargo tarpaulin --out Html
```

---

## ⚡ Performance Testing

### Using Test Script
```bash
./scripts/run-performance-tests.sh
```

### Load Testing with wrk
```bash
# Basic load test
wrk -t4 -c100 -d30s http://localhost:8080/health

# Authenticated endpoint
wrk -t4 -c100 -d30s \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/patients
```

### Stress Testing
```bash
# Gradually increase load
for i in 10 50 100 200 500; do
  echo "Testing with $i concurrent connections..."
  wrk -t4 -c$i -d30s http://localhost:8080/api/patients
done
```

See [PERFORMANCE_TESTING_GUIDE.md](PERFORMANCE_TESTING_GUIDE.md) for detailed performance testing strategies.

---

## 🔐 Security Testing

### CSRF Protection Test
```bash
# Should fail without CSRF token
curl -X POST http://localhost:8080/api/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'

# Should succeed with CSRF token
CSRF_TOKEN=$(curl -s -X GET http://localhost:8080/api/csrf/token \
  -H "Authorization: Bearer $TOKEN" | jq -r '.token')

curl -X POST http://localhost:8080/api/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'
```

### Authentication Test
```bash
# Should fail without token
curl http://localhost:8080/api/patients

# Should succeed with valid token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/patients
```

### Rate Limiting Test
```bash
# Send multiple rapid requests
for i in {1..150}; do
  curl http://localhost:8080/health
done
# Should see rate limit errors after threshold
```

---

## 📊 Database Testing

### Query Performance
```sql
-- Enable slow query logging
SET log_min_duration_statement = 100;

-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

### Connection Pool Testing
```bash
# Monitor connection pool usage
# Check backend logs for pool statistics
```

---

## ✅ Testing Checklist

### Pre-Deployment Testing
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Email service tested
- [ ] SMS service tested (if configured)
- [ ] M-Pesa tested in sandbox (if configured)
- [ ] CSRF protection verified
- [ ] Authentication/Authorization verified
- [ ] Rate limiting verified
- [ ] Performance benchmarks met
- [ ] Security tests passed

### Post-Deployment Testing
- [ ] Health check endpoint responds
- [ ] All services running
- [ ] Database connectivity verified
- [ ] Redis connectivity verified (if enabled)
- [ ] External services (email, SMS, M-Pesa) working
- [ ] Monitoring metrics available
- [ ] Backup system functional

---

## 🐛 Debugging Failed Tests

### Check Logs
```bash
# Backend logs
docker-compose logs backend

# Database logs
docker-compose logs postgres

# Redis logs (if enabled)
docker-compose logs redis
```

### Common Issues

1. **Test Database Not Available**
   - Run `./scripts/setup-test-db.sh`
   - Set `TEST_DATABASE_URL` environment variable

2. **Authentication Failures**
   - Verify JWT_SECRET is set
   - Check token expiration
   - Verify user exists in database

3. **CSRF Token Issues**
   - Ensure Redis is running (for CSRF tokens)
   - Check CSRF token expiration
   - Verify token is included in requests

4. **External Service Failures**
   - Check service credentials in `.env`
   - Verify network connectivity
   - Check service provider status

---

## 🔗 Related Documentation

- [Performance Testing Guide](PERFORMANCE_TESTING_GUIDE.md)
- [Configuration Guide](CONFIGURATION_GUIDE.md)
- [Environment Variables](ENVIRONMENT_VARIABLES.md)

---

**Last Updated**: Generated automatically
