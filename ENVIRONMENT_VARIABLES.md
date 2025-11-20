# Environment Variables Reference

**Date**: Generated automatically  
**Status**: Complete reference for all environment variables

---

## 📋 Quick Reference

### Required Variables (Production)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (32+ characters)
- `POSTGRES_PASSWORD` - Database password
- `HOST` - Server bind address
- `PORT` - Server port

### Recommended Variables
- `REDIS_URL` - Redis connection string
- `REDIS_PASSWORD` - Redis password
- `FRONTEND_URL` - Frontend application URL
- `ENVIRONMENT` - Environment name (development/staging/production)

---

## 🔐 Security Variables

| Variable | Description | Default | Required | Min Length |
|----------|-------------|---------|----------|------------|
| `JWT_SECRET` | Secret key for JWT token signing | - | ✅ Yes | 32 chars |
| `POSTGRES_PASSWORD` | PostgreSQL database password | - | ✅ Yes | 16 chars |
| `REDIS_PASSWORD` | Redis password | - | ⚠️ Recommended | 16 chars |
| `ENABLE_CSRF_PROTECTION` | Enable CSRF protection | `true` | ❌ No | - |
| `CSRF_TOKEN_LENGTH` | Length of CSRF tokens | `32` | ❌ No | - |
| `CSRF_TOKEN_EXPIRATION_MINUTES` | CSRF token expiration time | `60` | ❌ No | - |
| `ENABLE_SECURITY_HEADERS` | Enable security headers | `true` | ❌ No | - |
| `ENABLE_HSTS` | Enable HSTS header | `true` | ❌ No | - |
| `HSTS_MAX_AGE` | HSTS max-age in seconds | `31536000` | ❌ No | - |
| `ENABLE_CSP` | Enable Content Security Policy | `true` | ❌ No | - |
| `CSP_POLICY` | CSP policy string | See default | ❌ No | - |

**Generate secure secrets:**
```bash
# JWT Secret
openssl rand -base64 32

# Database Password
openssl rand -base64 24

# Redis Password
openssl rand -base64 24
```

---

## 🗄️ Database Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ Yes |
| `POSTGRES_USER` | PostgreSQL username | `clinic_user` | ❌ No |
| `POSTGRES_PASSWORD` | PostgreSQL password | - | ✅ Yes |
| `POSTGRES_DB` | Database name | `clinic_management` | ❌ No |
| `DB_POOL_SIZE` | Connection pool size | `20` | ❌ No |
| `DB_POOL_MAX_CONNECTIONS` | Max connections | `50` | ❌ No |
| `DB_POOL_TIMEOUT_SECONDS` | Connection timeout | `30` | ❌ No |

**Example:**
```bash
DATABASE_URL=postgresql://clinic_user:password@localhost:5432/clinic_management
```

---

## 🔴 Redis Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | ❌ No |
| `REDIS_PASSWORD` | Redis password | - | ⚠️ Recommended |
| `REDIS_ENABLED` | Enable Redis caching | `true` | ❌ No |
| `CACHE_TTL` | Cache TTL in seconds | `600` | ❌ No |
| `CACHE_PREFIX` | Cache key prefix | `clinic_management` | ❌ No |

**Example:**
```bash
REDIS_URL=redis://:password@localhost:6379
REDIS_PASSWORD=your_secure_redis_password
```

---

## 🚀 Server Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `HOST` | Server bind address | `0.0.0.0` | ✅ Yes |
| `PORT` | Server port | `8080` | ✅ Yes |
| `ENVIRONMENT` | Environment name | `development` | ❌ No |
| `RUST_LOG` | Logging level | `info` | ❌ No |
| `RUST_BACKTRACE` | Enable backtrace | `1` | ❌ No |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` | ❌ No |
| `DOMAIN` | Production domain | - | ⚠️ Production |

**Logging Levels:**
- `trace` - Most verbose
- `debug` - Debug information
- `info` - General information (recommended for production)
- `warn` - Warnings only
- `error` - Errors only

---

## 🔒 Authentication & Authorization

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | JWT signing secret | - | ✅ Yes |
| `JWT_EXPIRATION_HOURS` | Access token expiration | `24` | ❌ No |
| `REFRESH_TOKEN_EXPIRATION_DAYS` | Refresh token expiration | `7` | ❌ No |
| `MAX_LOGIN_ATTEMPTS` | Max failed login attempts | `5` | ❌ No |
| `LOCKOUT_DURATION_MINUTES` | Account lockout duration | `15` | ❌ No |
| `SESSION_TIMEOUT` | Session timeout in seconds | `1800` | ❌ No |
| `MAX_CONCURRENT_SESSIONS` | Max sessions per user | `3` | ❌ No |

---

## 🛡️ Rate Limiting

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RATE_LIMIT_REQUESTS` | Requests per window | `100` | ❌ No |
| `RATE_LIMIT_WINDOW` | Time window in seconds | `60` | ❌ No |
| `ENABLE_RATE_LIMITING` | Enable rate limiting | `true` | ❌ No |

---

## 🔑 Password Policy

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PASSWORD_MIN_LENGTH` | Minimum password length | `8` | ❌ No |
| `PASSWORD_REQUIRE_UPPERCASE` | Require uppercase | `true` | ❌ No |
| `PASSWORD_REQUIRE_LOWERCASE` | Require lowercase | `true` | ❌ No |
| `PASSWORD_REQUIRE_NUMBERS` | Require numbers | `true` | ❌ No |
| `PASSWORD_REQUIRE_SPECIAL_CHARS` | Require special chars | `true` | ❌ No |
| `PASSWORD_HISTORY_COUNT` | Prevent reuse of last N | `5` | ❌ No |
| `PASSWORD_MAX_AGE_DAYS` | Password expiration | `90` | ❌ No |

---

## 📧 Email Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SMTP_HOST` | SMTP server host | - | ⚠️ For email features |
| `SMTP_PORT` | SMTP server port | `587` | ⚠️ For email features |
| `SMTP_USERNAME` | SMTP username | - | ⚠️ For email features |
| `SMTP_PASSWORD` | SMTP password | - | ⚠️ For email features |
| `FROM_EMAIL` | Sender email address | - | ⚠️ For email features |
| `FROM_NAME` | Sender name | - | ⚠️ For email features |
| `SENDGRID_API_KEY` | SendGrid API key (alternative) | - | ❌ No |

**Gmail Setup:**
1. Enable 2-Step Verification
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use App Password as `SMTP_PASSWORD`

**Example:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=noreply@sethmedicalclinic.com
FROM_NAME=Seth Medical Clinic
```

---

## 📱 SMS Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SMS_PROVIDER` | Provider: `twilio` or `africastalking` | `twilio` | ❌ No |
| `SMS_ACCOUNT_SID` | Twilio Account SID | - | ⚠️ For SMS features |
| `SMS_AUTH_TOKEN` | Twilio Auth Token | - | ⚠️ For SMS features |
| `SMS_FROM_NUMBER` | Twilio phone number | - | ⚠️ For SMS features |
| `AFRICASTALKING_API_KEY` | Africa's Talking API key | - | ❌ No |
| `AFRICASTALKING_USERNAME` | Africa's Talking username | - | ❌ No |
| `AFRICASTALKING_SHORT_CODE` | Africa's Talking short code | - | ❌ No |

**Twilio Setup:**
1. Sign up at https://www.twilio.com
2. Get Account SID and Auth Token from dashboard
3. Purchase a phone number

**Example:**
```bash
SMS_PROVIDER=twilio
SMS_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SMS_AUTH_TOKEN=your_auth_token
SMS_FROM_NUMBER=+1234567890
```

---

## 💰 M-Pesa Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MPESA_ENVIRONMENT` | `sandbox` or `production` | `sandbox` | ❌ No |
| `MPESA_CONSUMER_KEY` | M-Pesa Consumer Key | - | ⚠️ For payments |
| `MPESA_CONSUMER_SECRET` | M-Pesa Consumer Secret | - | ⚠️ For payments |
| `MPESA_BUSINESS_SHORT_CODE` | Business short code | - | ⚠️ For payments |
| `MPESA_PASSKEY` | M-Pesa Passkey | - | ⚠️ For payments |
| `MPESA_CALLBACK_URL` | Payment callback URL | - | ⚠️ Production |

**M-Pesa Setup:**
1. Register at https://developer.safaricom.co.ke
2. Create app and get credentials
3. For production, configure callback URLs

**Example:**
```bash
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY=your_passkey
```

---

## 🌐 CORS Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `http://localhost:3000` | ❌ No |
| `ALLOWED_ORIGINS` | Alternative name for CORS_ORIGINS | - | ❌ No |
| `CORS_MAX_AGE` | Preflight cache time | `3600` | ❌ No |
| `ALLOWED_METHODS` | Allowed HTTP methods | `GET,POST,PUT,DELETE` | ❌ No |
| `ALLOWED_HEADERS` | Allowed headers | See default | ❌ No |

**Example:**
```bash
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

## 📁 File Upload Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MAX_FILE_SIZE` | Max file size in bytes | `10485760` (10MB) | ❌ No |
| `UPLOAD_PATH` | Upload directory path | `/app/uploads` | ❌ No |
| `UPLOAD_DIR` | Local upload directory | `./uploads` | ❌ No |
| `ALLOWED_FILE_TYPES` | Allowed MIME types | See default | ❌ No |

**Example:**
```bash
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/app/uploads
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf
```

---

## 🔐 SSL/TLS Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SSL_ENABLED` | Enable SSL/TLS | `false` | ❌ No |
| `SSL_CERT_PATH` | SSL certificate path | - | ⚠️ If SSL enabled |
| `SSL_KEY_PATH` | SSL private key path | - | ⚠️ If SSL enabled |

---

## 📊 Monitoring & Metrics

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ENABLE_METRICS` | Enable Prometheus metrics | `true` | ❌ No |
| `METRICS_PORT` | Metrics endpoint port | `9090` | ❌ No |
| `ENABLE_AUDIT_LOGGING` | Enable audit logs | `true` | ❌ No |
| `ENABLE_SECURITY_MONITORING` | Enable security monitoring | `true` | ❌ No |

---

## 🔄 Backup Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `BACKUP_ENABLED` | Enable automatic backups | `true` | ❌ No |
| `BACKUP_CRON_EXPRESSION` | Backup schedule (cron) | `0 2 * * *` | ❌ No |
| `BACKUP_RETENTION_DAYS` | Days to keep backups | `30` | ❌ No |
| `BACKUP_PATH` | Backup storage path | `/backups` | ❌ No |

---

## 🔐 MFA/2FA Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MFA_ENABLED` | Enable MFA | `true` | ❌ No |
| `MFA_ISSUER_NAME` | TOTP issuer name | `Seth Medical Clinic` | ❌ No |

---

## 📝 Environment-Specific Examples

### Development
```bash
ENVIRONMENT=development
RUST_LOG=debug
RUST_BACKTRACE=1
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Production
```bash
ENVIRONMENT=production
RUST_LOG=info
RUST_BACKTRACE=0
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
SSL_ENABLED=true
```

---

## ✅ Validation Checklist

Before deploying to production, ensure:

- [ ] `JWT_SECRET` is 32+ characters and randomly generated
- [ ] `POSTGRES_PASSWORD` is 16+ characters and secure
- [ ] `REDIS_PASSWORD` is set (if using Redis)
- [ ] `ENVIRONMENT=production` is set
- [ ] `RUST_LOG=info` (not debug)
- [ ] `CORS_ORIGINS` includes only production domains
- [ ] `FRONTEND_URL` points to production frontend
- [ ] SSL certificates are configured (if using HTTPS)
- [ ] Email service credentials are configured
- [ ] SMS service credentials are configured (if using SMS)
- [ ] M-Pesa credentials are configured (if using payments)

---

## 🔒 Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use different secrets** for dev/staging/production
3. **Rotate secrets periodically** (every 90 days recommended)
4. **Use secrets management** in production (AWS Secrets Manager, HashiCorp Vault, etc.)
5. **Restrict file permissions** on `.env` files (`chmod 600 .env`)
6. **Use environment-specific files** (`.env.development`, `.env.production`)
7. **Validate environment variables** on startup
8. **Log warnings** for missing required variables

---

## 📚 Related Documentation

- [Environment Setup Guide](docs/ENVIRONMENT_SETUP.md)
- [Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Security Review](SECURITY_REVIEW.md)

---

**Last Updated**: Generated automatically

