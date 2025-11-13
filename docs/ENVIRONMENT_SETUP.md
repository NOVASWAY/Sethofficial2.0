# Environment Setup Guide

**Date**: January 2025  
**Status**: Complete

---

## Overview

This guide provides comprehensive instructions for setting up environment variables for the Clinic Management System across different environments (development, staging, production).

---

## Quick Start

### 1. Copy Environment Files

```bash
# Root directory
cp env.example .env

# Backend directory
cp backend/env.example backend/.env
```

### 2. Generate Required Secrets

```bash
# Generate JWT secret (32+ characters)
openssl rand -base64 32

# Generate database password
openssl rand -base64 24

# Generate Redis password
openssl rand -base64 24
```

### 3. Update Environment Variables

Edit `.env` and `backend/.env` files with your actual values.

### 4. Validate Configuration

```bash
# Run validation script
./scripts/validate-env.sh
```

---

## Required Variables

### Core Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` | ✅ Yes |
| `JWT_SECRET` | Secret key for JWT tokens | `openssl rand -base64 32` | ✅ Yes |
| `HOST` | Server bind address | `0.0.0.0` | ✅ Yes |
| `PORT` | Server port | `8080` | ✅ Yes |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:3000` | ✅ Yes |

### Security Variables

| Variable | Description | Minimum Length | Required |
|----------|-------------|----------------|----------|
| `JWT_SECRET` | JWT signing secret | 32 characters | ✅ Yes |
| `POSTGRES_PASSWORD` | Database password | 16 characters | ✅ Yes |
| `REDIS_PASSWORD` | Redis password | 16 characters | ⚠️ Recommended |

---

## Optional Variables

### Email Configuration

Required for password reset and email verification:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=noreply@sethmedicalclinic.com
FROM_NAME=Seth Medical Clinic
```

**Note**: For Gmail, use an App Password, not your regular password.

### SMS Configuration

Required for SMS notifications and MFA:

```bash
# Twilio
SMS_PROVIDER=twilio
SMS_ACCOUNT_SID=your_twilio_account_sid
SMS_AUTH_TOKEN=your_twilio_auth_token
SMS_FROM_NUMBER=+1234567890

# Or Africa's Talking
AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_USERNAME=your_username
AFRICASTALKING_SENDER_ID=SETHMED
```

### M-Pesa Configuration

Required for payment processing:

```bash
MPESA_ENVIRONMENT=sandbox  # or production
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_BUSINESS_SHORT_CODE=your_short_code
MPESA_PASSKEY=your_passkey
```

### Redis Configuration

Optional but recommended for caching:

```bash
REDIS_URL=redis://:password@localhost:6379
REDIS_ENABLED=true
```

---

## Environment-Specific Configurations

### Development

```bash
ENVIRONMENT=development
DEBUG=true
RUST_LOG=debug
RUST_BACKTRACE=1
HOT_RELOAD=true
MOCK_EXTERNAL_SERVICES=false
```

### Staging

```bash
ENVIRONMENT=staging
DEBUG=false
RUST_LOG=info
SSL_ENABLED=true
CORS_ENABLED=true
```

### Production

```bash
ENVIRONMENT=production
DEBUG=false
RUST_LOG=info
SSL_ENABLED=true
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/key.pem
DOMAIN=yourclinic.com
FRONTEND_URL=https://yourclinic.com
```

**Critical Production Requirements:**

1. ✅ Strong JWT_SECRET (32+ characters, generated securely)
2. ✅ Strong database passwords
3. ✅ SSL/TLS enabled
4. ✅ DEBUG=false
5. ✅ Proper CORS configuration
6. ✅ Email service configured
7. ✅ Monitoring enabled

---

## Validation

### Automatic Validation

Run the validation script:

```bash
./scripts/validate-env.sh
```

This script checks:
- ✅ Required variables are set
- ✅ Security variables meet minimum requirements
- ✅ Database URL format is valid
- ✅ Production-specific requirements
- ⚠️ Optional but recommended configurations

### Manual Validation Checklist

- [ ] All required variables are set
- [ ] JWT_SECRET is at least 32 characters
- [ ] Database password is strong (16+ characters)
- [ ] Email service is configured (for password reset)
- [ ] SSL is configured (for production)
- [ ] CORS is properly configured
- [ ] No default/example values in production

---

## Security Best Practices

### 1. Secret Generation

**Never use default or example values!**

Generate secrets using:

```bash
# JWT Secret
openssl rand -base64 32

# Database Password
openssl rand -base64 24

# General Secret
openssl rand -hex 32
```

### 2. Secret Storage

- ✅ Use `.env` files for development
- ✅ Use environment variables in production
- ✅ Consider secrets management services (AWS Secrets Manager, HashiCorp Vault)
- ❌ Never commit `.env` files to version control
- ❌ Never hardcode secrets in code

### 3. Secret Rotation

- Rotate JWT_SECRET periodically (every 90 days recommended)
- Rotate database passwords regularly
- Rotate API keys when compromised or periodically

### 4. File Permissions

```bash
# Set proper permissions on .env files
chmod 600 .env
chmod 600 backend/.env
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

**Error**: `Failed to connect to database`

**Solution**:
- Check `DATABASE_URL` format
- Verify database is running
- Check database credentials
- Verify network connectivity

#### 2. JWT Secret Too Short

**Error**: `JWT_SECRET must be at least 32 characters`

**Solution**:
```bash
# Generate new secret
openssl rand -base64 32
```

#### 3. Email Not Sending

**Error**: `Failed to send email`

**Solution**:
- Verify SMTP credentials
- Check SMTP server is accessible
- For Gmail, use App Password
- Check firewall/network restrictions

#### 4. CORS Errors

**Error**: `CORS policy blocked`

**Solution**:
- Add frontend URL to `ALLOWED_ORIGINS`
- Verify `FRONTEND_URL` is correct
- Check `CORS_ENABLED=true`

---

## Environment Variable Reference

### Complete List

See `env.example` for the complete list of all available environment variables with descriptions.

### Categories

1. **Database**: `DATABASE_URL`, `DB_POOL_SIZE`, etc.
2. **Security**: `JWT_SECRET`, `RATE_LIMIT_REQUESTS`, etc.
3. **Email**: `SMTP_HOST`, `SMTP_PORT`, `FROM_EMAIL`, etc.
4. **SMS**: `SMS_PROVIDER`, `SMS_ACCOUNT_SID`, etc.
5. **M-Pesa**: `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, etc.
6. **Monitoring**: `ENABLE_METRICS`, `METRICS_PORT`, etc.
7. **SSL/TLS**: `SSL_CERT_PATH`, `SSL_KEY_PATH`, etc.
8. **Feature Flags**: `FEATURE_MFA_ENABLED`, `FEATURE_EMAIL_VERIFICATION`, etc.

---

## Next Steps

After setting up environment variables:

1. ✅ Validate configuration: `./scripts/validate-env.sh`
2. ✅ Start database: `docker-compose up -d postgres`
3. ✅ Run migrations: `cd backend && sqlx migrate run`
4. ✅ Start backend: `cd backend && cargo run`
5. ✅ Start frontend: `npm run dev`

---

## Additional Resources

- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Secret Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

**Last Updated**: January 2025

