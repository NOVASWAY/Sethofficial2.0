# Supabase Setup Guide for Railway Backend

This guide will help you set up Supabase as your external database and connect it to your Railway backend.

## Option 1: Web Dashboard Setup (Recommended - Easiest)

### Step 1: Create Supabase Account & Project

1. Go to https://supabase.com
2. Click **"Start your project"** or **"Sign Up"**
3. Sign up with GitHub, Google, or email
4. Click **"New Project"**
5. Fill in:
   - **Name**: `seth-clinic-db` (or any name you prefer)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free (500MB database)
6. Click **"Create new project"**
7. Wait 2-3 minutes for project to be ready

### Step 2: Get Connection String

1. In Supabase Dashboard, go to **Settings** → **Database**
2. Scroll down to **"Connection string"** section
3. Under **"URI"**, copy the connection string
   - It looks like: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
4. **Important**: Add `?sslmode=require` at the end if not present
5. Save this connection string - you'll need it for Railway

### Step 3: Run Migrations in Supabase

1. In Supabase Dashboard, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Open `scripts/create_all_tables.sql` from this project
4. Copy **ALL** the SQL content (Ctrl+A, Ctrl+C)
5. Paste into Supabase SQL Editor
6. Click **"Run"** or press `Ctrl+Enter`
7. Wait for execution to complete (30-60 seconds)
8. You should see "Success. No rows returned"

### Step 4: Verify Tables Created

Run this query in Supabase SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see tables like: `users`, `patients`, `appointments`, `invoices`, etc.

### Step 5: Set DATABASE_URL in Railway

1. Go to Railway Dashboard: https://railway.app
2. Select your project → **Backend Service** (`seth-clinic-backend`)
3. Go to **Variables** tab
4. Click **"+ New Variable"**
5. Add:
   - **Name**: `DATABASE_URL`
   - **Value**: Your Supabase connection string from Step 2
6. Click **"Add"**
7. **Remove** the Railway PostgreSQL service link if it exists (we're using external DB now)

### Step 6: Redeploy Backend

1. In Railway, the service will auto-redeploy when you change variables
2. Or manually trigger: Railway Dashboard → Deployments → Redeploy
3. Check logs - you should see:
   - ✅ Database connection established
   - ⚠️ Migrations skipped (tables already exist)
   - ✅ Service started successfully

## Option 2: CLI Setup (Advanced)

### Prerequisites

```bash
# Install Supabase CLI
npm install -g supabase

# Or using Homebrew (macOS)
brew install supabase/tap/supabase
```

### Setup Steps

1. **Login to Supabase**:
   ```bash
   supabase login
   ```
   This opens your browser for authentication.

2. **Create Project** (via web dashboard first, then link):
   - Create project at https://supabase.com/dashboard
   - Get project reference ID from URL (e.g., `abcdefghijklmnop`)

3. **Link Project**:
   ```bash
   cd /home/njau/seth/Sethofficial2.0
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. **Run Migrations**:
   ```bash
   # Using the combined SQL file
   supabase db push --file scripts/create_all_tables.sql
   
   # Or run individual migrations
   supabase migration up
   ```

5. **Get Connection String**:
   ```bash
   supabase status
   ```
   Or get it from Supabase Dashboard → Settings → Database

6. **Set in Railway** (same as Option 1, Step 5)

## Connection String Format

Your Supabase connection string should look like:

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
```

**Important Notes**:
- Use port `6543` for connection pooling (recommended)
- Use port `5432` for direct connection
- Always include `?sslmode=require` for security
- Replace `[PASSWORD]` with your actual database password

## Troubleshooting

### Connection Refused
- Verify connection string is correct
- Check if project is paused (free tier pauses after inactivity)
- Ensure `sslmode=require` is in connection string

### Authentication Failed
- Double-check password in connection string
- Verify project is active (not paused)

### Migrations Fail
- Check if tables already exist (may need to drop first)
- Verify SQL syntax is correct
- Check Supabase logs in Dashboard → Logs

### Service Won't Start
- Verify `DATABASE_URL` is set correctly in Railway
- Check Railway logs for connection errors
- Ensure database is not paused

## Benefits of Supabase

✅ **Free Tier**: 500MB database, 2GB bandwidth  
✅ **SQL Editor**: Easy to run migrations manually  
✅ **Automatic Backups**: Daily backups included  
✅ **Real-time**: Built-in real-time subscriptions  
✅ **Dashboard**: Great UI for managing data  
✅ **API**: Auto-generated REST API  

## Next Steps

After setup:
1. ✅ Database is ready
2. ✅ Backend connects successfully
3. ✅ Tables are created
4. 🎉 System is operational!

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Railway Docs: https://docs.railway.app

