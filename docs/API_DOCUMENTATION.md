# Enhanced Dashboard API Documentation

## Overview

The Enhanced Dashboard API provides comprehensive endpoints for managing dashboard data, user preferences, activity logging, data isolation, and validation. This API is designed to support multi-user clinic management with role-based access control and real-time updates.

## Base URL

```
http://localhost:8080/api/v1
```

## Authentication

All API endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Dashboard APIs

### Get User Dashboard Metrics

Get dashboard metrics specific to a user.

**Endpoint:** `GET /dashboard/user/{user_id}/metrics`

**Parameters:**
- `user_id` (path): UUID of the user

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPatients": 150,
    "totalConsultations": 75,
    "totalPrescriptions": 60,
    "totalRevenue": 250000,
    "todaysConsultations": 8,
    "todaysRevenue": 15000,
    "pendingPrescriptions": 12,
    "lowStockItems": 5,
    "outOfStockItems": 2,
    "criticalExpiries": 1,
    "monthlyRevenue": 250000,
    "revenueChange": 12.5,
    "patientGrowth": 8.3,
    "consultationGrowth": 15.2,
    "prescriptionGrowth": 6.7
  },
  "message": "Dashboard metrics retrieved successfully"
}
```

### Get Role Dashboard Metrics

Get dashboard metrics filtered by user role.

**Endpoint:** `GET /dashboard/role/{role}/metrics`

**Parameters:**
- `role` (path): User role (admin, clinician, nurse, pharmacist, receptionist)

**Response:**
```json
{
  "success": true,
  "data": {
    "role": "clinician",
    "metrics": {
      "assignedPatients": 25,
      "todaysConsultations": 5,
      "pendingPrescriptions": 8,
      "monthlyRevenue": 45000
    }
  },
  "message": "Role-based metrics retrieved successfully"
}
```

### Get Department Dashboard Metrics

Get dashboard metrics filtered by department.

**Endpoint:** `GET /dashboard/department/{department}/metrics`

**Parameters:**
- `department` (path): Department name (clinical, pharmacy, reception, admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "department": "clinical",
    "metrics": {
      "totalStaff": 12,
      "activePatients": 45,
      "todaysAppointments": 15,
      "departmentRevenue": 75000
    }
  },
  "message": "Department metrics retrieved successfully"
}
```

### Get System Health Metrics

Get system health and performance metrics.

**Endpoint:** `GET /dashboard/system/health`

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": {
      "connected": true,
      "responseTime": 45,
      "activeConnections": 8
    },
    "cache": {
      "status": "operational",
      "hitRate": 0.85,
      "memoryUsage": "256MB"
    },
    "storage": {
      "available": "85%",
      "used": "15%"
    },
    "uptime": "99.9%",
    "responseTime": 45,
    "lastUpdated": "2024-01-15T10:30:00Z"
  },
  "message": "System health metrics retrieved successfully"
}
```

## User Preferences APIs

### Get User Preferences

Get dashboard preferences for a specific user.

**Endpoint:** `GET /user/{user_id}/preferences`

**Parameters:**
- `user_id` (path): UUID of the user

**Response:**
```json
{
  "success": true,
  "data": {
    "layout_config": {
      "grid": [
        {
          "i": "a",
          "x": 0,
          "y": 0,
          "w": 6,
          "h": 2
        }
      ],
      "layout": "default"
    },
    "custom_metrics": [
      {
        "id": "total_patients",
        "name": "Total Patients",
        "type": "count"
      }
    ],
    "favorite_modules": ["patient_management", "appointments", "pharmacy"],
    "refresh_interval": 300,
    "auto_refresh": true,
    "theme": "dark",
    "language": "en",
    "timezone": "UTC"
  },
  "message": "User preferences retrieved successfully"
}
```

### Update User Preferences

Update dashboard preferences for a specific user.

**Endpoint:** `PUT /user/{user_id}/preferences`

**Parameters:**
- `user_id` (path): UUID of the user

**Request Body:**
```json
{
  "layout_config": {
    "grid": [
      {
        "i": "a",
        "x": 0,
        "y": 0,
        "w": 6,
        "h": 2
      }
    ],
    "layout": "default"
  },
  "custom_metrics": [
    {
      "id": "total_patients",
      "name": "Total Patients",
      "type": "count"
    }
  ],
  "favorite_modules": ["patient_management", "appointments", "pharmacy"],
  "refresh_interval": 300,
  "auto_refresh": true,
  "theme": "dark",
  "language": "en",
  "timezone": "UTC"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "layout_config": { /* updated config */ },
    "custom_metrics": [ /* updated metrics */ ],
    "favorite_modules": [ /* updated modules */ ],
    "refresh_interval": 300,
    "auto_refresh": true,
    "theme": "dark",
    "language": "en",
    "timezone": "UTC",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:35:00Z"
  },
  "message": "User preferences updated successfully"
}
```

### Reset User Preferences

Reset user preferences to default values.

**Endpoint:** `POST /user/{user_id}/preferences/reset`

**Parameters:**
- `user_id` (path): UUID of the user

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "layout_config": { /* default config */ },
    "custom_metrics": [ /* default metrics */ ],
    "favorite_modules": [ /* default modules */ ],
    "refresh_interval": 300,
    "auto_refresh": true,
    "theme": "system",
    "language": "en",
    "timezone": "UTC",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:40:00Z"
  },
  "message": "User preferences reset to default successfully"
}
```

### Get Role Preference Template

Get default preference template for a specific role.

**Endpoint:** `GET /user/{role}/preferences/template`

**Parameters:**
- `role` (path): User role (admin, clinician, nurse, pharmacist, receptionist)

**Response:**
```json
{
  "success": true,
  "data": {
    "role": "clinician",
    "template": {
      "layout_config": {
        "grid": [
          {
            "i": "patients",
            "x": 0,
            "y": 0,
            "w": 6,
            "h": 2
          },
          {
            "i": "consultations",
            "x": 6,
            "y": 0,
            "w": 6,
            "h": 2
          }
        ],
        "layout": "clinical"
      },
      "custom_metrics": [
        {
          "id": "assigned_patients",
          "name": "Assigned Patients",
          "type": "count"
        },
        {
          "id": "todays_consultations",
          "name": "Today's Consultations",
          "type": "count"
        }
      ],
      "favorite_modules": ["patients", "consultations", "prescriptions"],
      "refresh_interval": 300,
      "auto_refresh": true,
      "theme": "light",
      "language": "en",
      "timezone": "UTC"
    }
  },
  "message": "Role preference template retrieved successfully"
}
```

## Activity Log APIs

### Log User Activity

Log a user activity for audit and tracking purposes.

**Endpoint:** `POST /activity/log`

**Request Body:**
```json
{
  "action": "view_dashboard",
  "module": "dashboard",
  "entity_type": "dashboard",
  "entity_id": "123e4567-e89b-12d3-a456-426614174000",
  "details": {
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "role": "clinician",
    "department": "clinical",
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "action": "view_dashboard",
    "module": "dashboard",
    "entity_type": "dashboard",
    "entity_id": "123e4567-e89b-12d3-a456-426614174000",
    "details": { /* activity details */ },
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "session_id": "session_123",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "message": "Activity logged successfully"
}
```

### Get User Activity

Get activity history for a specific user.

**Endpoint:** `GET /activity/user/{user_id}`

**Parameters:**
- `user_id` (path): UUID of the user
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 20)
- `action` (query, optional): Filter by action type
- `module` (query, optional): Filter by module
- `entity_type` (query, optional): Filter by entity type

**Response:**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "user_id": "123e4567-e89b-12d3-a456-426614174000",
        "action": "view_dashboard",
        "module": "dashboard",
        "entity_type": "dashboard",
        "entity_id": "123e4567-e89b-12d3-a456-426614174000",
        "details": { /* activity details */ },
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "session_id": "session_123",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "per_page": 20,
      "total_pages": 8
    }
  },
  "message": "User activity retrieved successfully"
}
```

### Get Recent Activities

Get recent activities across all users.

**Endpoint:** `GET /activity/recent`

**Parameters:**
- `limit` (query, optional): Number of activities to retrieve (default: 50)
- `days` (query, optional): Number of days to look back (default: 7)

**Response:**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "user_id": "123e4567-e89b-12d3-a456-426614174000",
        "username": "john_doe",
        "action": "create_patient",
        "module": "patients",
        "entity_type": "patient",
        "entity_id": "123e4567-e89b-12d3-a456-426614174000",
        "details": { /* activity details */ },
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 50
  },
  "message": "Recent activities retrieved successfully"
}
```

### Get Activity Statistics

Get activity statistics and analytics.

**Endpoint:** `GET /activity/stats`

**Parameters:**
- `days` (query, optional): Number of days for statistics (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "total_activities": 1250,
    "unique_users": 15,
    "most_active_users": [
      {
        "user_id": "123e4567-e89b-12d3-a456-426614174000",
        "username": "john_doe",
        "activity_count": 85
      }
    ],
    "activity_by_module": {
      "dashboard": 450,
      "patients": 300,
      "consultations": 250,
      "prescriptions": 150,
      "invoices": 100
    },
    "activity_by_action": {
      "view": 600,
      "create": 200,
      "update": 300,
      "delete": 50,
      "search": 100
    },
    "daily_activity": [
      {
        "date": "2024-01-15",
        "count": 45
      }
    ]
  },
  "message": "Activity statistics retrieved successfully"
}
```

## Data Isolation APIs

### Get Filtered Patients

Get patients filtered based on user permissions and role.

**Endpoint:** `GET /patients/filtered`

**Parameters:**
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 20)
- `search` (query, optional): Search term

**Response:**
```json
{
  "success": true,
  "data": {
    "patients": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+254712345678",
        "date_of_birth": "1990-01-01",
        "location": "Nairobi, Kenya",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "per_page": 20,
      "total_pages": 2
    },
    "filters_applied": {
      "role": "clinician",
      "department": "clinical",
      "assigned_clinician_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  },
  "message": "Filtered patients retrieved successfully"
}
```

### Get Filtered Consultations

Get consultations filtered based on user permissions and role.

**Endpoint:** `GET /consultations/filtered`

**Parameters:**
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 20)
- `patient_id` (query, optional): Filter by patient ID

**Response:**
```json
{
  "success": true,
  "data": {
    "consultations": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "patient_id": "123e4567-e89b-12d3-a456-426614174000",
        "doctor_id": "123e4567-e89b-12d3-a456-426614174000",
        "consultation_date": "2024-01-15T10:30:00Z",
        "diagnosis": "Common cold",
        "treatment": "Rest and fluids",
        "notes": "Patient responding well to treatment",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "per_page": 20,
      "total_pages": 1
    },
    "filters_applied": {
      "role": "clinician",
      "department": "clinical",
      "doctor_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  },
  "message": "Filtered consultations retrieved successfully"
}
```

### Get Filtered Prescriptions

Get prescriptions filtered based on user permissions and role.

**Endpoint:** `GET /prescriptions/filtered`

**Parameters:**
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 20)
- `patient_id` (query, optional): Filter by patient ID

**Response:**
```json
{
  "success": true,
  "data": {
    "prescriptions": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "patient_id": "123e4567-e89b-12d3-a456-426614174000",
        "prescribing_doctor_id": "123e4567-e89b-12d3-a456-426614174000",
        "medication": "Paracetamol",
        "dosage": "500mg",
        "frequency": "3 times daily",
        "duration": "5 days",
        "status": "active",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 12,
      "page": 1,
      "per_page": 20,
      "total_pages": 1
    },
    "filters_applied": {
      "role": "clinician",
      "department": "clinical",
      "prescribing_doctor_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  },
  "message": "Filtered prescriptions retrieved successfully"
}
```

### Get Filtered Invoices

Get invoices filtered based on user permissions and role.

**Endpoint:** `GET /invoices/filtered`

**Parameters:**
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 20)
- `patient_id` (query, optional): Filter by patient ID
- `payment_status` (query, optional): Filter by payment status

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "patient_id": "123e4567-e89b-12d3-a456-426614174000",
        "consultation_id": "123e4567-e89b-12d3-a456-426614174000",
        "amount": 2500.00,
        "payment_status": "paid",
        "payment_method": "mpesa",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 8,
      "page": 1,
      "per_page": 20,
      "total_pages": 1
    },
    "filters_applied": {
      "role": "clinician",
      "department": "clinical",
      "consultation_doctor_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  },
  "message": "Filtered invoices retrieved successfully"
}
```

### Validate Data Access

Validate if a user has access to specific data.

**Endpoint:** `POST /permissions/validate`

**Request Body:**
```json
{
  "entity_type": "patient",
  "entity_id": "123e4567-e89b-12d3-a456-426614174000",
  "action": "read"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "reason": null,
    "conditions": {
      "assigned_clinician_id": "123e4567-e89b-12d3-a456-426614174000"
    },
    "audit_log": {
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "role": "clinician",
      "department": "clinical",
      "resource": "patient",
      "action": "read",
      "entity_id": "123e4567-e89b-12d3-a456-426614174000",
      "allowed": true,
      "reason": "Access granted",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  },
  "message": "Data access validation completed"
}
```

## Validation APIs

### Validate Patient Data

Validate patient data before creation or update.

**Endpoint:** `POST /validation/patient`

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+254712345678",
  "date_of_birth": "1990-01-01",
  "location": "Nairobi, Kenya"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "errors": [],
    "warnings": [],
    "validated_data": {
      "first_name": "John",
      "last_name": "Doe",
      "phone": "+254712345678",
      "date_of_birth": "1990-01-01",
      "location": "Nairobi, Kenya"
    }
  },
  "message": "Patient data validation completed"
}
```

### Validate User Data

Validate user data before creation or update.

**Endpoint:** `POST /validation/user`

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "secure_password123",
  "role": "clinician",
  "department": "clinical"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "errors": [],
    "warnings": [],
    "validated_data": {
      "username": "john_doe",
      "password": "secure_password123",
      "role": "clinician",
      "department": "clinical"
    }
  },
  "message": "User data validation completed"
}
```

### Check Duplicate Patient

Check for duplicate patient records.

**Endpoint:** `POST /validation/duplicate/patient`

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+254712345678",
  "date_of_birth": "1990-01-01"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "is_duplicate": false,
    "similar_patients": [],
    "confidence_score": 0.0
  },
  "message": "Duplicate check completed"
}
```

### Check Duplicate User

Check for duplicate user records.

**Endpoint:** `POST /validation/duplicate/user`

**Request Body:**
```json
{
  "username": "john_doe",
  "role": "clinician"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "is_duplicate": false,
    "similar_users": [],
    "confidence_score": 0.0
  },
  "message": "Duplicate check completed"
}
```

### Validate Business Rules

Validate business rules for specific operations.

**Endpoint:** `POST /validation/business-rules`

**Request Body:**
```json
{
  "rule_type": "consultation_limit",
  "data": {
    "patient_id": "123e4567-e89b-12d3-a456-426614174000",
    "consultation_count": 5,
    "max_consultations": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "rule_type": "consultation_limit",
    "message": "Consultation limit not exceeded",
    "details": {
      "current_count": 5,
      "max_allowed": 10,
      "remaining": 5
    }
  },
  "message": "Business rule validation completed"
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": "Specific error details",
    "field": "field_name"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `AUTHENTICATION_ERROR`: Authentication failed
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `DUPLICATE_ERROR`: Duplicate resource exists
- `BUSINESS_RULE_ERROR`: Business rule violation
- `SYSTEM_ERROR`: Internal system error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Dashboard APIs**: 100 requests per minute per user
- **Activity Log APIs**: 200 requests per minute per user
- **Validation APIs**: 50 requests per minute per user
- **Data Isolation APIs**: 150 requests per minute per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

## WebSocket Support

Real-time updates are available via WebSocket connection:

**WebSocket URL:** `ws://localhost:8080/ws?token=<jwt-token>`

### WebSocket Events

#### Dashboard Updates
```json
{
  "type": "dashboard_update",
  "data": {
    "metrics": { /* updated metrics */ },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### System Alerts
```json
{
  "type": "system_alert",
  "data": {
    "title": "System Alert",
    "message": "Database connection restored",
    "severity": "info",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Activity Logs
```json
{
  "type": "activity_log",
  "data": {
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "action": "create_patient",
    "module": "patients",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Caching

API responses are cached for performance:

- **Dashboard Metrics**: 5 minutes
- **User Preferences**: 10 minutes
- **Activity Logs**: 2 minutes
- **Validation Results**: 1 minute

Cache headers are included in responses:

```
Cache-Control: public, max-age=300
ETag: "abc123"
Last-Modified: Wed, 15 Jan 2024 10:30:00 GMT
```

## Security

### Authentication
- JWT tokens with 24-hour expiration
- Refresh tokens with 7-day expiration
- Token rotation on refresh

### Authorization
- Role-based access control (RBAC)
- Department-based data isolation
- Permission validation for all operations

### Data Protection
- Input sanitization and validation
- SQL injection prevention
- XSS protection
- CSRF protection

### Audit Logging
- All API calls are logged
- User activities are tracked
- Security events are monitored

## Examples

### Complete Dashboard Workflow

1. **Get User Dashboard Metrics**
```bash
curl -X GET "http://localhost:8080/api/v1/dashboard/user/123e4567-e89b-12d3-a456-426614174000/metrics" \
  -H "Authorization: Bearer <jwt-token>"
```

2. **Get User Preferences**
```bash
curl -X GET "http://localhost:8080/api/v1/user/123e4567-e89b-12d3-a456-426614174000/preferences" \
  -H "Authorization: Bearer <jwt-token>"
```

3. **Log Activity**
```bash
curl -X POST "http://localhost:8080/api/v1/activity/log" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "view_dashboard",
    "module": "dashboard",
    "entity_type": "dashboard"
  }'
```

4. **Get Filtered Data**
```bash
curl -X GET "http://localhost:8080/api/v1/patients/filtered?page=1&limit=20" \
  -H "Authorization: Bearer <jwt-token>"
```

5. **Validate Data Access**
```bash
curl -X POST "http://localhost:8080/api/v1/permissions/validate" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "patient",
    "entity_id": "123e4567-e89b-12d3-a456-426614174000",
    "action": "read"
  }'
```

This comprehensive API documentation covers all the enhanced dashboard features and provides detailed examples for integration.
