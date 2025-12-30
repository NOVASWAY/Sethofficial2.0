# Quick Supabase Setup - 5 Minutes

## Fastest Way to Get Started

### 1. Create Supabase Project (2 min)

1. Go to https://supabase.com → **Sign Up** (free)
2. Click **"New Project"**
3. Name: `seth-clinic-db`
4. Set a strong password (save it!)
5. Choose region
6. Click **"Create new project"**
7. Wait 2 minutes

### 2. Get Connection String (30 sec)

1. Supabase Dashboard → **Settings** → **Database**
2. Scroll to **"Connection string"**
3. Click **"URI"** tab
4. Copy the connection string
5. Add `?sslmode=require` at the end if missing

Example:
```
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### 3. Create Tables (1 min)

1. Supabase Dashboard → **SQL Editor**
2. Click **"New query"**
3. Open `scripts/create_all_tables.sql` from this repo
4. Copy ALL content (Ctrl+A, Ctrl+C)
5. Paste into Supabase SQL Editor
6. Click **"Run"** (or Ctrl+Enter)
7. Wait ~30 seconds
8. Done! ✅

### 4. Connect Railway Backend (1 min)

1. Railway Dashboard → Your Backend Service → **Variables**
2. Add/Update `DATABASE_URL`:
   - **Name**: `DATABASE_URL`
   - **Value**: Your Supabase connection string from step 2
3. Save
4. Railway auto-redeploys
5. Check logs - should see ✅ connection successful

### 5. Verify (30 sec)

Run in Supabase SQL Editor:
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should return ~30+ tables.

## That's It! 🎉

Your backend is now connected to Supabase database.

## Need Help?

See detailed guide: `docs/SUPABASE_SETUP_GUIDE.md`

