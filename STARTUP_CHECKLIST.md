# System Startup Checklist

## ✅ Pre-Startup Requirements

### 1. Database Setup
- [ ] **PostgreSQL is running** and accessible
- [ ] **Database exists**: `clinic_management`
- [ ] **User has permissions**: `clinic_user` with proper access
- [ ] **Run migrations**: Execute `npm run db:migrate` or `cd backend && sqlx migrate run`
  - This will create/update tables for:
    - Notes system (025_user_notes_system.sql)
    - Internal notifications (026_internal_notifications.sql)
    - Task assignment (027_task_assignment_system.sql)
    - Announcements (028_announcements_system.sql)

### 2. Environment Variables
Ensure these are set in `backend/.env`:
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `JWT_SECRET` - Secret key for JWT tokens
- [ ] `JWT_EXPIRATION_HOURS` - Token expiration (default: 24)
- [ ] `REFRESH_TOKEN_EXPIRATION_DAYS` - Refresh token expiration (default: 7)
- [ ] `HOST` - Backend host (default: 0.0.0.0)
- [ ] `PORT` - Backend port (default: 8080)
- [ ] `CORS_ORIGINS` - Allowed CORS origins (default: http://localhost:3000,http://localhost:3001)
- [ ] `NEXT_PUBLIC_API_URL` - Frontend API URL (default: http://localhost:8080/api)

### 3. Backend Dependencies
- [ ] **Rust toolchain** installed (rustc, cargo)
- [ ] **Backend dependencies** installed: `cd backend && cargo build`
- [ ] **No compilation errors**: `cd backend && cargo check`

### 4. Frontend Dependencies
- [ ] **Node.js** installed (v18+ recommended)
- [ ] **Frontend dependencies** installed: `npm install`
- [ ] **No TypeScript errors**: `npm run type-check`

### 5. Optional Services
- [ ] **Redis** (optional) - For caching and session management
- [ ] **M-Pesa API credentials** (if using M-Pesa payments)

## 🚀 Startup Steps

### Step 1: Start Database
```bash
# If using Docker:
docker-compose up -d postgres

# Or start PostgreSQL service:
sudo systemctl start postgresql
```

### Step 2: Run Migrations
```bash
# Option 1: Using npm script
npm run db:migrate

# Option 2: Using sqlx directly
cd backend
export DATABASE_URL="postgresql://clinic_user:clinic_password@localhost:5432/clinic_management"
sqlx migrate run
```

### Step 3: Start Backend
```bash
# Option 1: Using npm script
npm run backend:dev

# Option 2: Direct cargo run
cd backend
cargo run
```

The backend should start on `http://localhost:8080` (or your configured port).

### Step 4: Start Frontend
```bash
# In a separate terminal
npm run dev
```

The frontend should start on `http://localhost:3000`.

## ✅ Verification Steps

### 1. Backend Health Check
```bash
curl http://localhost:8080/health
# Should return: {"status":"ok","message":"Backend is running",...}
```

### 2. Database Connection
```bash
curl http://localhost:8080/api/database-test
# Should return: {"status":"ok","message":"Database connection successful"}
```

### 3. Frontend Loads
- Open `http://localhost:3000` in browser
- Should see login page or dashboard (if already logged in)

### 4. Test New Features
- [ ] **Notes System**: Navigate to a patient → Notes tab → Add a note
- [ ] **Notifications**: Check notification bell icon in header
- [ ] **Tasks**: Create a task (if task management UI is accessible)
- [ ] **Activity Feed**: Check dashboard overview for activity feed
- [ ] **Announcements**: Check announcements panel (if accessible)

## ⚠️ Common Issues

### Issue: Migration fails with "relation already exists"
**Solution**: This is normal if tables already exist. Migrations use `CREATE TABLE IF NOT EXISTS`.

### Issue: Backend won't compile
**Solution**: 
1. Check Rust version: `rustc --version` (should be 1.70+)
2. Clean and rebuild: `cd backend && cargo clean && cargo build`
3. Check for missing dependencies in `Cargo.toml`

### Issue: Frontend can't connect to backend
**Solution**:
1. Verify `NEXT_PUBLIC_API_URL` in `.env.local` or `.env`
2. Check CORS settings in backend
3. Verify backend is running on correct port

### Issue: Database connection fails
**Solution**:
1. Verify PostgreSQL is running: `sudo systemctl status postgresql`
2. Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`
3. Verify database exists: `psql -U clinic_user -d clinic_management -c "SELECT 1;"`

## 📋 Migration Status

After running migrations, verify tables exist:
```sql
-- Check notes table
SELECT COUNT(*) FROM notes;

-- Check notifications table has new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'notifications' AND column_name IN ('is_read', 'read_at', 'action_url');

-- Check tasks table
SELECT COUNT(*) FROM tasks;

-- Check announcements table
SELECT COUNT(*) FROM announcements;
```

## 🎯 Expected Behavior

Once everything is running:
1. ✅ Backend API responds on port 8080
2. ✅ Frontend loads on port 3000
3. ✅ Database migrations are applied
4. ✅ All API endpoints are accessible
5. ✅ New collaboration features are functional:
   - Notes can be added to patients/consultations
   - Notifications appear in notification center
   - Tasks can be created and assigned
   - Activity feed shows system events
   - Announcements can be created and viewed

## 📝 Notes

- Migrations are **idempotent** (safe to run multiple times)
- The system uses **soft deletes** for notes (deleted_at column)
- All new features require **authentication** (JWT token)
- **Role-based access control** is enforced for sensitive operations

