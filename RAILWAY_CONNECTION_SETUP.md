# 🚂 Railway + Supabase Connection Setup

## ✅ Completed Steps
1. ✅ Supabase project created: `seth-clinic-db`
2. ✅ Database tables created via SQL migration
3. ✅ Project reference: `aiisqfannytexwpvgpjx`

## 📋 Connection String Format

Your Supabase connection string format is:
```
postgresql://postgres:[YOUR_PASSWORD]@db.aiisqfannytexwpvgpjx.supabase.co:5432/postgres
```

**Important:** Replace `[YOUR_PASSWORD]` with the database password you set when creating the Supabase project.

### URL Encoding Special Characters
If your password contains special characters, encode them:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`
- `?` → `%3F`

## 🔧 Setting DATABASE_URL in Railway

### Option 1: Via Railway Web Dashboard (Recommended)

1. **Go to Railway Dashboard:**
   - Navigate to: https://railway.app/dashboard
   - Select your project
   - Click on your backend service

2. **Add Environment Variable:**
   - Click on the **"Variables"** tab
   - Click **"New Variable"** or find existing `DATABASE_URL`
   - **Variable Name:** `DATABASE_URL`
   - **Variable Value:** Paste your complete Supabase connection string
   - Click **"Add"** or **"Update"**

3. **Redeploy:**
   - Railway will automatically redeploy when you change environment variables
   - Or manually trigger a redeploy from the **"Deployments"** tab

### Option 2: Via Railway CLI

If you have Railway CLI installed:

```bash
# Login to Railway (if not already logged in)
railway login

# Link to your project (if not already linked)
railway link

# Set the DATABASE_URL variable
railway variables set DATABASE_URL="postgresql://postgres:[YOUR_PASSWORD]@db.aiisqfannytexwpvgpjx.supabase.co:5432/postgres"
```

## ✅ Verification Steps

After setting the connection string:

1. **Check Railway Logs:**
   - Go to Railway → Your Service → Deployments → Latest → View Logs
   - Look for:
     - ✅ "Database connection established successfully"
     - ✅ "Server started on port XXXX"
     - ❌ If you see connection errors, check the connection string

2. **Test Health Endpoint:**
   - Your backend should be at: `https://your-app.railway.app/health`
   - Should return: `{"status":"ok"}`

3. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Logs
   - You should see connection attempts from Railway

## 🔍 Troubleshooting

### Connection Refused
- **Check password:** Ensure the password in the connection string is correct
- **Check URL encoding:** Special characters must be URL-encoded
- **Check network:** Railway should be able to reach Supabase (no IP restrictions)

### SSL Required
Supabase requires SSL. Your connection string should include SSL mode:
```
postgresql://postgres:[PASSWORD]@db.aiisqfannytexwpvgpjx.supabase.co:5432/postgres?sslmode=require
```

### Authentication Failed
- Verify the password is correct
- Check if you need to reset the database password in Supabase
- Go to: Settings → Database → Reset database password

### Service Unavailable
- Check Railway deployment status
- Verify the backend service is running
- Check Railway logs for startup errors

## 📝 Quick Reference

**Supabase Project:**
- Name: `seth-clinic-db`
- Reference: `aiisqfannytexwpvgpjx`
- Database Host: `db.aiisqfannytexwpvgpjx.supabase.co`
- Port: `5432`
- Database: `postgres`
- User: `postgres`

**Connection String Template:**
```
postgresql://postgres:[PASSWORD]@db.aiisqfannytexwpvgpjx.supabase.co:5432/postgres?sslmode=require
```

---

**Need Help?** Check both Railway and Supabase logs for detailed error messages.

