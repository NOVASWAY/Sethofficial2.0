# Enhanced Dashboard Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Backend Architecture](#backend-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Database Schema](#database-schema)
5. [API Design](#api-design)
6. [Security Implementation](#security-implementation)
7. [Performance Optimization](#performance-optimization)
8. [Caching Strategy](#caching-strategy)
9. [Real-time Communication](#real-time-communication)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Guide](#deployment-guide)
12. [Monitoring and Logging](#monitoring-and-logging)

## Architecture Overview

The Enhanced Dashboard system follows a modern microservices architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Next.js)     │◄──►│   (Rust/Actix)  │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WebSocket     │    │   Cache Layer   │    │   Redis Cache   │
│   (Real-time)   │    │   (In-memory)   │    │   (Optional)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components

- **Frontend**: Next.js React application with TypeScript
- **Backend**: Rust-based Actix-web server with SQLx
- **Database**: PostgreSQL with comprehensive schema
- **Real-time**: WebSocket connections for live updates
- **Caching**: Multi-layer caching strategy
- **Security**: JWT authentication with RBAC
- **Monitoring**: Comprehensive logging and metrics

## Backend Architecture

### Core Modules

#### 1. Authentication & Authorization
```rust
// JWT-based authentication with role-based access control
pub struct AuthService {
    jwt_secret: String,
    access_token_ttl: u64,
    refresh_token_ttl: u64,
}

pub struct PermissionValidator {
    role_permissions: HashMap<String, RolePermissions>,
}
```

#### 2. Dashboard Handlers
```rust
// Dashboard metrics and data aggregation
pub mod dashboard_handlers {
    pub async fn get_user_dashboard_metrics(
        user_id: web::Path<Uuid>,
        db: web::Data<Database>,
        cache: web::Data<DashboardCache>,
    ) -> Result<HttpResponse, ApiError>
}
```

#### 3. Data Isolation
```rust
// Role-based data filtering and access control
pub struct DataIsolationService {
    validator: PermissionValidator,
    cache: Arc<CacheService>,
}
```

#### 4. Caching System
```rust
// Multi-layer caching for performance optimization
pub struct CacheService<T> {
    cache: Arc<RwLock<HashMap<String, CacheEntry<T>>>>,
    config: CacheConfig,
    metrics: Arc<RwLock<CacheMetrics>>,
}
```

### Request Flow

1. **Authentication**: JWT token validation
2. **Authorization**: Role-based permission checking
3. **Data Isolation**: Apply user-specific filters
4. **Caching**: Check cache for existing data
5. **Database Query**: Execute optimized SQL queries
6. **Response**: Return formatted JSON response
7. **Audit Logging**: Record user activity

### Error Handling

```rust
#[derive(Debug, Serialize, Deserialize)]
pub enum ApiError {
    ValidationError(String),
    AuthenticationError(String),
    AuthorizationError(String),
    NotFoundError(String),
    DatabaseError(String),
    CacheError(String),
    SystemError(String),
}
```

## Frontend Architecture

### Component Structure

```
components/
├── enhanced-dashboard-overview.tsx    # Main dashboard component
├── realtime-dashboard-overview.tsx    # Real-time dashboard
├── enhanced-error-handler.tsx         # Error handling
└── ui/                               # Reusable UI components
    ├── card.tsx
    ├── button.tsx
    └── badge.tsx

hooks/
├── use-dashboard-data.ts             # Dashboard data management
├── use-realtime-dashboard.ts         # Real-time updates
├── use-enhanced-validation.ts        # Form validation
├── use-backend-data-isolation.ts     # Data filtering
└── use-enhanced-error-handling.ts    # Error management

lib/
├── api-client.ts                     # API communication
├── websocket-service.ts              # WebSocket management
└── data-validation-enhanced.ts       # Validation utilities
```

### State Management

The frontend uses React hooks for state management:

```typescript
// Dashboard data hook
export function useDashboardData(options: DashboardOptions = {}) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data fetching and caching logic
  const refresh = useCallback(async () => {
    // Implementation
  }, []);
  
  return { metrics, loading, error, refresh };
}
```

### Real-time Updates

WebSocket integration for live data:

```typescript
export function useRealtimeDashboard(options: RealtimeOptions = {}) {
  const [wsConnected, setWsConnected] = useState(false);
  const [realtimeMetrics, setRealtimeMetrics] = useState<any>(null);
  
  const ws = useWebSocket({
    onConnect: () => setWsConnected(true),
    onDashboardUpdate: (data) => setRealtimeMetrics(data),
    onSystemAlert: (alert) => handleSystemAlert(alert),
  });
  
  return { wsConnected, realtimeMetrics, ws };
}
```

## Database Schema

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    department VARCHAR(100),
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Patients Table
```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE NOT NULL,
    location TEXT,
    assigned_clinician_id UUID REFERENCES users(id),
    assigned_nurse_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Enhanced Dashboard Tables
```sql
-- User dashboard preferences
CREATE TABLE user_dashboard_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    layout_config JSONB DEFAULT '{}',
    custom_metrics JSONB DEFAULT '[]',
    favorite_modules TEXT[] DEFAULT '{}',
    refresh_interval INTEGER DEFAULT 300,
    auto_refresh BOOLEAN DEFAULT TRUE,
    theme VARCHAR(50) DEFAULT 'system',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- User activity logs
CREATE TABLE user_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    module VARCHAR(100),
    entity_type VARCHAR(100),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data isolation rules
CREATE TABLE data_isolation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    filter_rules JSONB NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, entity_type)
);

-- Dashboard metrics cache
CREATE TABLE dashboard_metrics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_key VARCHAR(255) NOT NULL UNIQUE,
    metric_value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Indexes for Performance

```sql
-- Performance indexes
CREATE INDEX idx_user_preferences_user_id ON user_dashboard_preferences(user_id);
CREATE INDEX idx_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON user_activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX idx_data_isolation_rules_role_entity ON data_isolation_rules(role, entity_type);
CREATE INDEX idx_dashboard_metrics_cache_key ON dashboard_metrics_cache(metric_key);
CREATE INDEX idx_dashboard_metrics_cache_expires_at ON dashboard_metrics_cache(expires_at);

-- Composite indexes for common queries
CREATE INDEX idx_patients_clinician_nurse ON patients(assigned_clinician_id, assigned_nurse_id);
CREATE INDEX idx_consultations_doctor_date ON consultations(doctor_id, consultation_date);
CREATE INDEX idx_prescriptions_doctor_status ON prescriptions(prescribing_doctor_id, status);
```

## API Design

### RESTful Endpoints

#### Dashboard APIs
```
GET    /api/v1/dashboard/user/{user_id}/metrics
GET    /api/v1/dashboard/role/{role}/metrics
GET    /api/v1/dashboard/department/{department}/metrics
GET    /api/v1/dashboard/system/health
```

#### User Preferences APIs
```
GET    /api/v1/user/{user_id}/preferences
PUT    /api/v1/user/{user_id}/preferences
POST   /api/v1/user/{user_id}/preferences/reset
GET    /api/v1/user/{role}/preferences/template
```

#### Activity Log APIs
```
POST   /api/v1/activity/log
GET    /api/v1/activity/user/{user_id}
GET    /api/v1/activity/recent
GET    /api/v1/activity/stats
```

#### Data Isolation APIs
```
GET    /api/v1/patients/filtered
GET    /api/v1/consultations/filtered
GET    /api/v1/prescriptions/filtered
GET    /api/v1/invoices/filtered
POST   /api/v1/permissions/validate
```

#### Validation APIs
```
POST   /api/v1/validation/patient
POST   /api/v1/validation/user
POST   /api/v1/validation/duplicate/patient
POST   /api/v1/validation/duplicate/user
POST   /api/v1/validation/business-rules
```

### Response Format

All API responses follow a consistent format:

```json
{
  "success": boolean,
  "data": any,
  "message": string,
  "error": {
    "code": string,
    "details": string,
    "field": string
  }
}
```

### Error Handling

```rust
impl ResponseError for ApiError {
    fn error_response(&self) -> HttpResponse {
        match self {
            ApiError::ValidationError(msg) => {
                HttpResponse::BadRequest().json(ErrorResponse {
                    success: false,
                    message: msg.clone(),
                    error: Some(ErrorDetails {
                        code: "VALIDATION_ERROR".to_string(),
                        details: msg.clone(),
                        field: None,
                    }),
                })
            }
            // Other error types...
        }
    }
}
```

## Security Implementation

### Authentication

JWT-based authentication with secure token management:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,           // User ID
    pub user_id: Uuid,         // User ID as UUID
    pub username: String,      // Username
    pub role: String,          // User role
    pub department: Option<String>, // Department
    pub permissions: serde_json::Value, // Permissions
    pub exp: u64,              // Expiration time
    pub iat: u64,              // Issued at
    pub jti: String,           // JWT ID
    pub session_id: Option<String>, // Session ID
}
```

### Authorization

Role-based access control with permission validation:

```rust
pub struct PermissionValidator {
    role_permissions: HashMap<String, RolePermissions>,
}

impl PermissionValidator {
    pub fn validate_access(&self, request: &AccessRequest) -> AccessDecision {
        // Permission validation logic
    }
}
```

### Data Protection

- **Input Sanitization**: All user inputs are sanitized and validated
- **SQL Injection Prevention**: Parameterized queries with SQLx
- **XSS Protection**: Content Security Policy headers
- **CSRF Protection**: CSRF tokens for state-changing operations
- **Rate Limiting**: Request rate limiting to prevent abuse

### Security Headers

```rust
pub fn security_headers() -> DefaultHeaders {
    DefaultHeaders::new()
        .add(("X-Content-Type-Options", "nosniff"))
        .add(("X-Frame-Options", "DENY"))
        .add(("X-XSS-Protection", "1; mode=block"))
        .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
        .add(("Content-Security-Policy", "default-src 'self'"))
        .add(("Referrer-Policy", "strict-origin-when-cross-origin"))
        .add(("Permissions-Policy", "geolocation=(), microphone=(), camera=()"))
}
```

## Performance Optimization

### Database Optimization

1. **Indexing Strategy**
   - Primary key indexes on all tables
   - Composite indexes for common query patterns
   - Partial indexes for filtered queries
   - GIN indexes for JSONB columns

2. **Query Optimization**
   - Prepared statements with SQLx
   - Connection pooling
   - Query result caching
   - Lazy loading for large datasets

3. **Database Connection Management**
   ```rust
   pub struct Database {
       pub pool: PgPool,
   }
   
   impl Database {
       pub fn new(database_url: &str) -> Result<Self, sqlx::Error> {
           let pool = PgPool::builder()
               .max_connections(20)
               .min_connections(5)
               .acquire_timeout(Duration::from_secs(30))
               .build(database_url)
               .await?;
           
           Ok(Database { pool })
       }
   }
   ```

### Frontend Optimization

1. **Code Splitting**
   - Dynamic imports for large components
   - Route-based code splitting
   - Lazy loading of non-critical features

2. **Caching Strategy**
   - Browser caching with appropriate headers
   - Service worker for offline functionality
   - Memory caching for frequently accessed data

3. **Bundle Optimization**
   - Tree shaking to remove unused code
   - Minification and compression
   - Image optimization and lazy loading

## Caching Strategy

### Multi-layer Caching

1. **Application-level Cache**
   ```rust
   pub struct CacheService<T> {
       cache: Arc<RwLock<HashMap<String, CacheEntry<T>>>>,
       config: CacheConfig,
   }
   ```

2. **Database Query Cache**
   - Cached query results with TTL
   - Invalidation on data updates
   - Cache warming for frequently accessed data

3. **API Response Cache**
   - HTTP caching headers
   - ETag support for conditional requests
   - Cache invalidation strategies

### Cache Configuration

```rust
pub struct CacheConfig {
    pub default_ttl: Duration,        // 5 minutes
    pub max_entries: usize,           // 1000 entries
    pub cleanup_interval: Duration,   // 1 minute
    pub enable_metrics: bool,         // true
}
```

### Cache Invalidation

- **Time-based**: Automatic expiration
- **Event-based**: Invalidation on data changes
- **Manual**: Explicit cache clearing
- **Pattern-based**: Bulk invalidation by pattern

## Real-time Communication

### WebSocket Implementation

```rust
pub struct WebSocketManager {
    sessions: Arc<RwLock<HashMap<String, WebSocketSession>>>,
    rooms: Arc<RwLock<HashMap<String, HashSet<String>>>>,
}

impl WebSocketManager {
    pub async fn handle_connection(
        &self,
        req: HttpRequest,
        stream: web::Payload,
    ) -> Result<HttpResponse, Error> {
        // WebSocket connection handling
    }
}
```

### Message Types

```typescript
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  userId?: string;
  role?: string;
  department?: string;
}
```

### Event Handling

- **Dashboard Updates**: Real-time metric updates
- **System Alerts**: Critical system notifications
- **User Activities**: Live activity feeds
- **Data Changes**: Real-time data modifications

## Testing Strategy

### Backend Testing

1. **Unit Tests**
   ```rust
   #[cfg(test)]
   mod tests {
       use super::*;
       
       #[tokio::test]
       async fn test_dashboard_metrics() {
           // Test implementation
       }
   }
   ```

2. **Integration Tests**
   - API endpoint testing
   - Database integration tests
   - WebSocket connection tests

3. **Performance Tests**
   - Load testing with multiple concurrent users
   - Database performance under load
   - Cache effectiveness testing

### Frontend Testing

1. **Component Tests**
   ```typescript
   describe('Enhanced Dashboard Overview', () => {
     test('renders dashboard overview correctly', () => {
       render(<EnhancedDashboardOverview role="clinician" />);
       expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
     });
   });
   ```

2. **Integration Tests**
   - API integration testing
   - WebSocket connection testing
   - User workflow testing

3. **End-to-End Tests**
   - Complete user journey testing
   - Cross-browser compatibility
   - Mobile responsiveness testing

### Test Configuration

```javascript
// jest.config.js
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

## Deployment Guide

### Environment Setup

1. **Backend Deployment**
   ```dockerfile
   FROM rust:1.70 as builder
   WORKDIR /app
   COPY . .
   RUN cargo build --release
   
   FROM debian:bullseye-slim
   RUN apt-get update && apt-get install -y ca-certificates
   COPY --from=builder /app/target/release/clinic-management-backend /usr/local/bin/
   EXPOSE 8080
   CMD ["clinic-management-backend"]
   ```

2. **Frontend Deployment**
   ```dockerfile
   FROM node:18-alpine as builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build
   
   FROM nginx:alpine
   COPY --from=builder /app/out /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/nginx.conf
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

### Docker Compose

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/clinic_management
    depends_on:
      - db
      - redis
  
  frontend:
    build: .
    ports:
      - "3000:80"
    depends_on:
      - backend
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=clinic_management
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
```

### Production Configuration

1. **Environment Variables**
   ```bash
   # Backend
   DATABASE_URL=postgresql://user:pass@localhost:5432/clinic_management
   JWT_SECRET=your-secret-key
   REDIS_URL=redis://localhost:6379
   LOG_LEVEL=info
   
   # Frontend
   NEXT_PUBLIC_API_URL=https://api.clinic-management.com
   NEXT_PUBLIC_WS_URL=wss://api.clinic-management.com/ws
   ```

2. **SSL/TLS Configuration**
   - Let's Encrypt certificates
   - HTTP to HTTPS redirect
   - HSTS headers
   - Secure cookie settings

3. **Monitoring Setup**
   - Prometheus metrics collection
   - Grafana dashboards
   - Log aggregation with ELK stack
   - Health check endpoints

## Monitoring and Logging

### Logging Strategy

```rust
use log::{info, warn, error, debug};

// Structured logging with context
info!(
    "User dashboard accessed",
    user_id = %user.id,
    role = %user.role,
    department = ?user.department,
    ip_address = %req.connection_info().remote_addr().unwrap_or("unknown")
);
```

### Metrics Collection

```rust
pub struct MetricsService {
    request_count: Counter,
    request_duration: Histogram,
    active_connections: Gauge,
    cache_hits: Counter,
    cache_misses: Counter,
}
```

### Health Checks

```rust
pub async fn health_check() -> Result<HttpResponse, ApiError> {
    let health_status = HealthStatus {
        status: "healthy",
        timestamp: Utc::now(),
        services: vec![
            ServiceStatus {
                name: "database",
                status: "healthy",
                response_time: 45,
            },
            ServiceStatus {
                name: "cache",
                status: "healthy",
                response_time: 12,
            },
        ],
    };
    
    Ok(HttpResponse::Ok().json(health_status))
}
```

### Alerting

- **System Alerts**: Database connectivity, memory usage, disk space
- **Performance Alerts**: Response time thresholds, error rates
- **Security Alerts**: Failed login attempts, suspicious activity
- **Business Alerts**: Critical data issues, workflow problems

---

*This technical documentation is maintained alongside the codebase and updated with each release. For the latest version, please refer to the system repository.*
