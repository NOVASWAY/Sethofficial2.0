# Configuration Guide

**Date**: Generated automatically  
**Status**: Complete configuration instructions

---

## 🚀 Quick Setup

### Automated Setup
```bash
# Run the complete setup script
./scripts/setup-all.sh
```

This will guide you through:
- Environment file creation
- Secret generation
- Email configuration
- SMS configuration
- M-Pesa configuration
- Test database setup
- SSL certificate generation
- Production configuration

---

## 📧 Email Service Configuration

### Option 1: Interactive Script
```bash
./scripts/configure-email.sh
```

### Option 2: Manual Configuration

Edit `backend/.env`:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=noreply@sethmedicalclinic.com
FROM_NAME=Seth Medical Clinic
```

**Gmail Setup:**
1. Enable 2-Step Verification: https://myaccount.google.com/security
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the App Password (not your regular password)

**Other Providers:**
- **SendGrid**: Use `SENDGRID_API_KEY` instead of SMTP
- **Custom SMTP**: Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`

---

## 📱 SMS Service Configuration

### Option 1: Interactive Script
```bash
./scripts/configure-sms.sh
```

### Option 2: Manual Configuration

**Twilio:**
```bash
SMS_PROVIDER=twilio
SMS_ACCOUNT_SID=your_account_sid
SMS_AUTH_TOKEN=your_auth_token
SMS_FROM_NUMBER=+1234567890
```

**Africa's Talking:**
```bash
SMS_PROVIDER=africastalking
AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_USERNAME=your_username
AFRICASTALKING_SENDER_ID=SETHMED
```

---

## 💰 M-Pesa Configuration

### Option 1: Interactive Script
```bash
./scripts/configure-mpesa.sh
```

### Option 2: Manual Configuration

**Sandbox (Testing):**
```bash
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY=your_passkey
```

**Production:**
```bash
MPESA_ENVIRONMENT=production
MPESA_CONSUMER_KEY=your_production_consumer_key
MPESA_CONSUMER_SECRET=your_production_consumer_secret
MPESA_BUSINESS_SHORT_CODE=your_short_code
MPESA_PASSKEY=your_production_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
MPESA_TIMEOUT_URL=https://yourdomain.com/api/mpesa/timeout
```

---

## 🧪 Test Database Setup

### Option 1: Interactive Script
```bash
./scripts/setup-test-db.sh
```

### Option 2: Manual Setup

1. Create test database:
```bash
createdb clinic_management_test
```

2. Run migrations:
```bash
cd backend
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/clinic_management_test"
sqlx migrate run
```

3. Add to `backend/.env`:
```bash
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/clinic_management_test
```

---

## 🔐 SSL Certificate Generation

### Development/Testing
```bash
./scripts/generate-ssl-certs.sh
```

This generates self-signed certificates for local development.

### Production
For production, use Let's Encrypt:
```bash
certbot certonly --standalone -d yourdomain.com
```

Then configure in `backend/.env`:
```bash
SSL_ENABLED=true
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

---

## 🏭 Production Configuration

### Option 1: Interactive Script
```bash
./scripts/configure-production.sh
```

### Option 2: Manual Configuration

Edit `backend/.env`:
```bash
ENVIRONMENT=production
DOMAIN=yourclinic.com
FRONTEND_URL=https://yourclinic.com
CORS_ORIGINS=https://yourclinic.com,https://www.yourclinic.com
RUST_LOG=info
RUST_BACKTRACE=0
SSL_ENABLED=true
ENABLE_CSRF_PROTECTION=true
ENABLE_SECURITY_HEADERS=true
```

---

## 🔄 Backup Configuration

### Option 1: Interactive Script
```bash
./scripts/configure-backup.sh
```

### Option 2: Manual Configuration

Edit `backend/.env`:
```bash
BACKUP_ENABLED=true
BACKUP_CRON_EXPRESSION=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=./backups
BACKUP_COMPRESSION=true
BACKUP_INCLUDE_FILES=true
BACKUP_MAX_SIZE_MB=1024
```

**Cron Expression Examples:**
- `0 2 * * *` - Daily at 2:00 AM
- `0 0 * * 0` - Weekly on Sunday
- `0 2 1 * *` - Monthly on 1st at 2:00 AM

---

## ☁️ Cloud Storage Configuration

### Option 1: Interactive Script
```bash
./scripts/configure-cloud-storage.sh
```

### Option 2: Manual Configuration

**AWS S3:**
```bash
STORAGE_PROVIDER=aws
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
```

**Google Cloud Storage:**
```bash
STORAGE_PROVIDER=gcp
GCP_PROJECT_ID=your-project
GCS_BUCKET=your-bucket
GCP_SERVICE_ACCOUNT_KEY=/path/to/key.json
```

**Azure Blob Storage:**
```bash
STORAGE_PROVIDER=azure
AZURE_STORAGE_ACCOUNT=your_account
AZURE_STORAGE_KEY=your_key
AZURE_CONTAINER=your-container
```

---

## 📊 Monitoring Setup

### Setup Prometheus & Grafana
```bash
./scripts/setup-monitoring.sh
```

This will:
1. Create monitoring Docker Compose file
2. Set up Prometheus configuration
3. Configure Grafana datasources
4. Start monitoring services

**Access:**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

---

## 🧪 Running Tests

### Full Test Suite
```bash
./scripts/run-tests.sh
```

### Individual Test Suites
```bash
# Backend unit tests
cd backend && cargo test --lib

# Integration tests
cd backend && cargo test --test '*'

# With test database
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/clinic_management_test"
cd backend && cargo test
```

---

## ✅ Configuration Verification

### Check Environment Variables
```bash
# Validate .env files
./scripts/validate-env.sh  # If available
```

### Test Services
```bash
# Test email
curl -X POST http://localhost:8080/api/email/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","body":"Test email"}'

# Test SMS (if configured)
curl -X POST http://localhost:8080/api/sms/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"+1234567890","message":"Test SMS"}'

# Health check
curl http://localhost:8080/health
```

---

## 📝 Configuration Checklist

- [ ] Environment files created (`.env` and `backend/.env`)
- [ ] Secure secrets generated (JWT, database, Redis)
- [ ] Email service configured
- [ ] SMS service configured (if using MFA)
- [ ] M-Pesa configured (if using payments)
- [ ] Test database set up
- [ ] SSL certificates generated (for HTTPS)
- [ ] Production configuration (if deploying)
- [ ] Backup system configured
- [ ] Cloud storage configured (optional)
- [ ] Monitoring services set up (optional)

---

## 🔗 Related Documentation

- [Environment Variables Reference](ENVIRONMENT_VARIABLES.md)
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md)
- [Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)

---

**Last Updated**: Generated automatically

