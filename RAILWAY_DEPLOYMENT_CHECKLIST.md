# Railway Deployment Checklist

## Healthcheck Failing - Troubleshooting Steps

### 1. Database Connection Issues

**Check DATABASE_URL:**
- Go to Railway Dashboard → Your Backend Service → Variables
- Verify `DATABASE_URL` is set
- It should be auto-provided if PostgreSQL service is linked

**Link PostgreSQL Service:**
1. Railway Dashboard → Your Project
2. Click "+ New" → "Database" → "Add PostgreSQL"
3. After PostgreSQL is created, go to Backend Service → Settings → Variables
4. Click "Add Reference" → Select your PostgreSQL service
5. This will auto-add `DATABASE_URL`

### 2. Database Tables Missing

**This is EXPECTED!** The database starts empty. Migrations will create tables.

**Migrations run automatically on startup:**
- Check Railway logs for: "✅ Database migrations completed successfully"
- If migrations fail, check logs for error messages
- Migrations are in `/app/migrations` in the Docker container

### 3. Service Not Starting

**Check Railway Logs:**
- Railway Dashboard → Your Service → Deployments → Latest → Logs
- Look for:
  - "✅ Database connection established"
  - "✅ Database migrations completed successfully"
  - "📡 Server will listen on: 0.0.0.0:XXXX"

**Common Issues:**
- `DATABASE_URL` not set → Service exits immediately
- Database not ready → Connection retries (5 attempts, 5 sec each)
- Migration failures → Check migration logs

### 4. Healthcheck Configuration

**Current Setup:**
- Health endpoint: `/health`
- Healthcheck timeout: 60s start period
- Healthcheck interval: 30s

**If healthcheck fails:**
- Service may be crashing before it starts
- Check logs for startup errors
- Verify PORT environment variable is set (Railway auto-sets this)

## Required Environment Variables

1. **DATABASE_URL** - Auto-provided when PostgreSQL is linked
2. **JWT_SECRET** - Set manually (use a strong random string)
3. **CORS_ORIGINS** - Set manually (e.g., "https://your-frontend.netlify.app")
4. **PORT** - Auto-set by Railway (don't override)
5. **HOST** - Defaults to 0.0.0.0 (don't override)

## Database Setup

1. **Create PostgreSQL Service:**
   - Railway Dashboard → "+ New" → "Database" → "Add PostgreSQL"

2. **Link to Backend:**
   - Backend Service → Variables → "Add Reference" → Select PostgreSQL
   - This auto-adds `DATABASE_URL`

3. **Migrations Run Automatically:**
   - On first startup, migrations create all tables
   - Check logs for migration success/failure
   - Tables will be created in the linked PostgreSQL database

## Next Steps

1. Verify PostgreSQL service exists and is linked
2. Check Railway logs for startup errors
3. Verify DATABASE_URL is set in backend service variables
4. Redeploy if needed
