# Demo Credentials and Mock Data

## System Access

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API Health**: http://localhost:8080/health

## Demo User Credentials

All demo users use the password: **`demo123`**

### Admin User
- **Username**: `admin`
- **Password**: `demo123`
- **Role**: Administrator
- **Access**: Full system access

### Receptionist
- **Username**: `receptionist`
- **Password**: `demo123`
- **Role**: Receptionist
- **Access**: Patient management, appointments

### Clinician/Doctor
- **Username**: `clinician`
- **Password**: `demo123`
- **Role**: Clinician
- **Access**: Patient consultations, prescriptions

### Nurse
- **Username**: `nurse`
- **Password**: `demo123`
- **Role**: Nurse
- **Access**: Patient care, consultations

## Sample Data

The system includes:
- 4 demo users (admin, receptionist, clinician, nurse)
- Sample patient records
- Mock medical data for demonstration

## Quick Start

1. Open http://localhost:3000 in your browser
2. Login with any demo credentials above
3. Explore the system features

## API Testing

Test the login endpoint:
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"demo123"}'
```

