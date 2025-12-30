# ✅ Supabase Setup - Complete Guide

## 🎉 Project Created Successfully!

- **Project Name:** seth-clinic-db
- **Project Reference:** aiisqfannytexwpvgpjx
- **Project URL:** https://aiisqfannytexwpvgpjx.supabase.co

---

## 📋 Step-by-Step Setup Instructions

### Step 1: Get Database Connection String

1. Go to: https://supabase.com/dashboard/project/aiisqfannytexwpvgpjx/settings/database
2. Scroll down to find the **"Connection string"** section
3. You'll see connection strings in different formats:
   - **URI format** (recommended for Railway):
     ```
     postgresql://postgres:[YOUR_PASSWORD]@db.aiisqfannytexwpvgpjx.supabase.co:5432/postgres
     ```
   - Replace `[YOUR_PASSWORD]` with the database password you set when creating the project
   - If you forgot the password, click **"Reset database password"** button

**Alternative:** You can also find it in:
- Settings → API → Connection pooling section

---

### Step 2: Run SQL Migrations

1. **Open SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/aiisqfannytexwpvgpjx/sql/new
   - Or click "SQL Editor" in the left sidebar

2. **Copy the SQL file:**
   - Open: `scripts/create_all_tables.sql` in your project
   - Select ALL content (Ctrl+A / Cmd+A)
   - Copy (Ctrl+C / Cmd+C)

3. **Paste and Run:**
   - Paste into the SQL Editor text area
   - Click the **"Run"** button (or press Ctrl+Enter / Cmd+Enter)
   - Wait for execution to complete (may take 10-30 seconds)

4. **Verify Tables Created:**
   - Go to: https://supabase.com/dashboard/project/aiisqfannytexwpvgpjx/editor
   - You should see all tables listed (users, patients, consultations, etc.)

---

### Step 3: Set DATABASE_URL in Railway

1. **Go to Railway Dashboard:**
   - Navigate to your backend service
   - Click on "Variables" tab

2. **Add/Update DATABASE_URL:**
   - Variable name: `DATABASE_URL`
   - Variable value: The connection string from Step 1
   - Format: `postgresql://postgres:[PASSWORD]@db.aiisqfannytexwpvgpjx.supabase.co:5432/postgres`
   - Click "Save"

3. **Redeploy (if needed):**
   - Railway will automatically redeploy when you change environment variables
   - Or manually trigger a redeploy from the "Deployments" tab

---

### Step 4: Verify Connection

1. **Check Railway Logs:**
   - Go to your Railway service → "Deployments" → Latest deployment → "View Logs"
   - Look for:
     - ✅ "Database connection established successfully"
     - ✅ "Migrations completed successfully" (if migrations are enabled)
     - ✅ "Server started on port XXXX"

2. **Test Health Endpoint:**
   - Your backend should be accessible at: `https://your-railway-app.railway.app/health`
   - Should return: `{"status":"ok"}`

---

## 🔧 Troubleshooting

### Connection String Issues:
- **Password contains special characters:** URL-encode them (e.g., `@` becomes `%40`)
- **Connection refused:** Check if your Railway service IP is allowed (Supabase may require IP allowlisting for some plans)
- **SSL required:** Supabase requires SSL, ensure your connection string includes `?sslmode=require`

### Migration Issues:
- **Tables already exist:** The SQL script uses `CREATE TABLE` (not `IF NOT EXISTS`). If tables exist, you may need to drop them first or modify the script.
- **Permission errors:** Ensure you're using the `postgres` user (default admin user)

### Railway Deployment Issues:
- **Service unavailable:** Check Railway logs for database connection errors
- **Healthcheck failing:** Verify DATABASE_URL is set correctly and database is accessible

---

## 📝 Quick Reference

**Connection String Template:**
```
postgresql://postgres:[PASSWORD]@db.aiisqfannytexwpvgpjx.supabase.co:5432/postgres?sslmode=require
```

**SQL File Location:**
```
scripts/create_all_tables.sql
```

**Supabase Dashboard:**
```
https://supabase.com/dashboard/project/aiisqfannytexwpvgpjx
```

---

## ✅ Checklist

- [ ] Got connection string from Supabase dashboard
- [ ] Ran `create_all_tables.sql` in SQL Editor
- [ ] Verified tables exist in Table Editor
- [ ] Set DATABASE_URL in Railway
- [ ] Verified Railway deployment is healthy
- [ ] Tested backend API endpoints

---

**Need Help?** Check the logs in both Supabase and Railway dashboards for detailed error messages.

