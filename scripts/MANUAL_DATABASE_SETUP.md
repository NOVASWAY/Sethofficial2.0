# Manual Database Setup Guide

Since automated migrations have been problematic, you can create all tables manually via Railway's database console.

## Steps to Create Tables Manually

### 1. Access Railway Database Console

1. Go to Railway Dashboard: https://railway.app
2. Navigate to your project
3. Click on your **PostgreSQL** service
4. Click on the **"Data"** or **"Query"** tab
5. Click **"New Query"** or **"SQL Editor"**

### 2. Run the Combined SQL Script

1. Open the file: `scripts/create_all_tables.sql`
2. Copy **ALL** the SQL content
3. Paste it into Railway's SQL console
4. Click **"Run"** or **"Execute"**

This will create all tables in the correct order.

### 3. Verify Tables Were Created

Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see tables like:
- `users`
- `patients`
- `appointments`
- `invoices`
- `backup_schedules`
- etc.

### 4. Deploy Backend

After tables are created, deploy the backend. The service will:
- ✅ Connect to the database
- ⚠️ Skip migrations (they'll fail gracefully since tables exist)
- ✅ Start normally

## Alternative: Use Environment Variable

You can also set `SKIP_MIGRATIONS=true` in Railway environment variables to skip migration attempts entirely.

## What Changed

- Migrations are now **optional** - service continues even if they fail
- Service will start successfully if tables already exist
- You can create tables manually using `scripts/create_all_tables.sql`

