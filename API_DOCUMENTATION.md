# Clinic Management System API Documentation

## Overview

The Clinic Management System provides a comprehensive REST API for managing all aspects of a medical clinic, including patient management, appointments, consultations, billing, pharmacy, and user administration.

## Base URL

```
http://localhost:8080/api/v1
```

## Authentication

All API endpoints (except authentication endpoints) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error details"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Input validation failed |
| `CONFLICT` | Resource conflict |
| `INTERNAL_ERROR` | Server error |

## Pagination

List endpoints support pagination with the following parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Sort field
- `order`: Sort order (`asc` or `desc`)

### Pagination Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

---

## Authentication Endpoints

### POST /auth/login

Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "uuid",
      "username": "string",
      "role": "string",
      "name": "string",
      "department": "string",
      "permissions": ["string"],
      "status": "string"
    }
  }
}
```

### POST /auth/register

Register a new user (admin only).

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "name": "string",
  "role": "doctor|nurse|receptionist|admin",
  "department": "string",
  "permissions": ["string"],
  "status": "Active|Inactive"
}
```

### POST /auth/logout

Logout the current user (invalidates token).

### POST /auth/refresh

Refresh the JWT token.

---

## Patient Management

### GET /patients

Get a list of patients with optional filtering and pagination.

**Query Parameters:**
- `search`: Search term (name, phone, patient_number)
- `page`: Page number
- `limit`: Items per page
- `sort`: Sort field
- `order`: Sort order

**Response:**
```json
{
  "success": true,
  "data": {
    "patients": [
      {
        "id": "uuid",
        "first_name": "string",
        "last_name": "string",
        "date_of_birth": "YYYY-MM-DD",
        "gender": "Male|Female|Other",
        "phone": "string",
        "location": "string",
        "patient_number": "string",
        "allergies": "string",
        "past_medical_history": "string",
        "family_medical_history": "string",
        "social_history": "string",
        "emergency_contact_name": "string",
        "emergency_contact_phone": "string",
        "blood_group": "string",
        "created_at": "ISO8601",
        "updated_at": "ISO8601"
      }
    ],
    "pagination": { ... }
  }
}
```

### GET /patients/{id}

Get a specific patient by ID.

### POST /patients

Create a new patient.

**Request Body:**
```json
{
  "first_name": "string",
  "last_name": "string",
  "date_of_birth": "YYYY-MM-DD",
  "gender": "Male|Female|Other",
  "phone": "string",
  "location": "string",
  "patient_number": "string",
  "allergies": "string",
  "past_medical_history": "string",
  "family_medical_history": "string",
  "social_history": "string",
  "emergency_contact_name": "string",
  "emergency_contact_phone": "string",
  "blood_group": "string"
}
```

### PUT /patients/{id}

Update an existing patient.

**Request Body:** (All fields optional)
```json
{
  "first_name": "string",
  "last_name": "string",
  "date_of_birth": "YYYY-MM-DD",
  "gender": "Male|Female|Other",
  "phone": "string",
  "location": "string",
  "patient_number": "string",
  "allergies": "string",
  "past_medical_history": "string",
  "family_medical_history": "string",
  "social_history": "string",
  "emergency_contact_name": "string",
  "emergency_contact_phone": "string",
  "blood_group": "string"
}
```

### DELETE /patients/{id}

Delete a patient (soft delete).

---

## Appointment Management

### GET /appointments

Get a list of appointments with optional filtering.

**Query Parameters:**
- `patient_id`: Filter by patient ID
- `doctor_id`: Filter by doctor ID
- `date_from`: Start date (YYYY-MM-DD)
- `date_to`: End date (YYYY-MM-DD)
- `status`: Filter by status
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "patient_id": "uuid",
      "doctor_id": "uuid",
      "appointment_date": "ISO8601",
      "duration_minutes": 30,
      "status": "scheduled|confirmed|cancelled|completed|no_show",
      "notes": "string",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ]
}
```

### GET /appointments/{id}

Get a specific appointment by ID.

### POST /appointments

Create a new appointment.

**Request Body:**
```json
{
  "patient_id": "uuid",
  "doctor_id": "uuid",
  "appointment_date": "ISO8601",
  "duration_minutes": 30,
  "status": "scheduled",
  "notes": "string"
}
```

### PUT /appointments/{id}

Update an existing appointment.

### DELETE /appointments/{id}

Cancel an appointment.

---

## User Management

### GET /users

Get a list of users (admin only).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "string",
      "name": "string",
      "role": "doctor|nurse|receptionist|admin",
      "department": "string",
      "permissions": ["string"],
      "status": "Active|Inactive",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ]
}
```

### GET /users/{id}

Get a specific user by ID.

### POST /users

Create a new user (admin only).

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "name": "string",
  "role": "doctor|nurse|receptionist|admin",
  "department": "string",
  "permissions": ["string"],
  "status": "Active|Inactive"
}
```

### PUT /users/{id}

Update an existing user.

### DELETE /users/{id}

Deactivate a user (admin only).

---

## Medicine Management

### GET /medicines

Get a list of medicines with optional filtering.

**Query Parameters:**
- `search`: Search term (name, category, manufacturer)
- `category`: Filter by category
- `low_stock`: Show only low stock items
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "category": "string",
      "dosage_form": "string",
      "strength": "string",
      "manufacturer": "string",
      "batch_number": "string",
      "expiry_date": "YYYY-MM-DD",
      "stock_quantity": 100,
      "reorder_level": 20,
      "unit_price": 5.50,
      "prescription_required": true,
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ]
}
```

### GET /medicines/{id}

Get a specific medicine by ID.

### POST /medicines

Add a new medicine to inventory.

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "category": "string",
  "dosage_form": "string",
  "strength": "string",
  "manufacturer": "string",
  "batch_number": "string",
  "expiry_date": "YYYY-MM-DD",
  "stock_quantity": 100,
  "reorder_level": 20,
  "unit_price": 5.50,
  "prescription_required": true
}
```

### PUT /medicines/{id}

Update medicine information.

### DELETE /medicines/{id}

Remove medicine from inventory.

---

## Settings Management

### GET /settings

Get system settings (admin only).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "key": "string",
      "value": "string",
      "is_encrypted": false,
      "category": "string",
      "description": "string",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ]
}
```

### GET /settings/{key}

Get a specific system setting.

### PUT /settings/{key}

Update a system setting (admin only).

**Request Body:**
```json
{
  "value": "string",
  "is_encrypted": false,
  "category": "string",
  "description": "string"
}
```

### GET /user-settings

Get user-specific settings.

### PUT /user-settings/{key}

Update a user-specific setting.

---

## Notification Management

### GET /notifications

Get notification history.

**Query Parameters:**
- `user_id`: Filter by user ID
- `type`: Filter by notification type
- `status`: Filter by status
- `date_from`: Start date
- `date_to`: End date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "notification_type": "Email|Sms|Push|InApp",
      "recipient": "string",
      "subject": "string",
      "body": "string",
      "status": "Pending|Sent|Failed|Delivered",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ]
}
```

### POST /notifications/send

Send a notification.

**Request Body:**
```json
{
  "user_id": "uuid",
  "notification_type": "Email|Sms|Push|InApp",
  "recipient": "string",
  "subject": "string",
  "body": "string",
  "template_name": "string",
  "template_data": {}
}
```

### GET /notifications/stats

Get notification statistics.

---

## Reports and Analytics

### GET /reports/patients

Get patient statistics and reports.

**Query Parameters:**
- `date_from`: Start date
- `date_to`: End date
- `group_by`: Group by field (month, week, day)

### GET /reports/appointments

Get appointment statistics and reports.

### GET /reports/revenue

Get revenue reports and analytics.

### GET /reports/medicines

Get medicine usage and inventory reports.

---

## WebSocket Endpoints

### WebSocket Connection

Connect to real-time updates:

```
ws://localhost:8080/ws
```

**Authentication:**
Include JWT token in query parameter:
```
ws://localhost:8080/ws?token=jwt_token_here
```

**Message Types:**
- `patient_update`: Patient data changes
- `appointment_update`: Appointment changes
- `medicine_update`: Medicine inventory changes
- `notification`: New notifications
- `system_alert`: System alerts and warnings

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Authentication endpoints**: 5 requests per minute per IP
- **General endpoints**: 100 requests per minute per user
- **File upload endpoints**: 10 requests per minute per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## File Upload

### POST /upload

Upload files (documents, images, etc.).

**Request:** Multipart form data
- `file`: The file to upload
- `category`: File category (patient_document, prescription, etc.)
- `patient_id`: Associated patient ID (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "file_id": "uuid",
    "filename": "string",
    "size": 1024,
    "mime_type": "string",
    "url": "string"
  }
}
```

---

## Health Check

### GET /health

Check system health and status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "ISO8601",
  "version": "1.0.0",
  "database": "connected",
  "services": {
    "cache": "ok",
    "notifications": "ok",
    "websocket": "ok"
  }
}
```

---

## SDKs and Examples

### JavaScript/TypeScript

```javascript
// Initialize API client
const apiClient = new ClinicManagementAPI({
  baseURL: 'http://localhost:8080/api/v1',
  token: 'your_jwt_token'
});

// Get patients
const patients = await apiClient.patients.list({
  page: 1,
  limit: 20,
  search: 'John'
});

// Create patient
const newPatient = await apiClient.patients.create({
  first_name: 'John',
  last_name: 'Doe',
  date_of_birth: '1990-01-01',
  gender: 'Male',
  phone: '1234567890'
});
```

### Python

```python
import requests

# Initialize API client
class ClinicManagementAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {token}'}
    
    def get_patients(self, **params):
        response = requests.get(
            f'{self.base_url}/patients',
            headers=self.headers,
            params=params
        )
        return response.json()

# Usage
api = ClinicManagementAPI('http://localhost:8080/api/v1', 'your_jwt_token')
patients = api.get_patients(page=1, limit=20)
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# Get patients
curl -X GET http://localhost:8080/api/v1/patients \
  -H "Authorization: Bearer your_jwt_token"

# Create patient
curl -X POST http://localhost:8080/api/v1/patients \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "1990-01-01",
    "gender": "Male",
    "phone": "1234567890"
  }'
```

---

## Changelog

### Version 1.0.0
- Initial API release
- Patient management
- Appointment scheduling
- User management
- Medicine inventory
- Settings management
- Notification system
- WebSocket support
- File upload
- Reports and analytics

---

## Support

For API support and questions:
- Email: support@clinicmanagement.com
- Documentation: https://docs.clinicmanagement.com
- GitHub Issues: https://github.com/clinicmanagement/api/issues

