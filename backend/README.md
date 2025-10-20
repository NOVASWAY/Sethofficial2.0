# 🏥 Seth Medical Clinic - Rust Backend

A high-performance, real-time backend for the Seth Medical Clinic Management System built with Rust, Actix-web, PostgreSQL, and Redis.

## 🚀 Features

- **High Performance**: Built with Rust and Actix-web for maximum performance
- **Real-time Communication**: WebSocket support for live updates
- **Secure Authentication**: JWT-based authentication with refresh tokens
- **Role-based Access Control**: Granular permissions for different user roles
- **Database Integration**: PostgreSQL with SQLx for type-safe database operations
- **Caching**: Redis integration for session management and caching
- **Comprehensive API**: RESTful API for all clinic operations
- **Health Monitoring**: Built-in health checks and monitoring

## 🛠️ Technology Stack

- **Framework**: Actix-web 4.4
- **Database**: PostgreSQL 15 with SQLx
- **Cache**: Redis 7
- **Authentication**: JWT with Argon2 password hashing
- **Real-time**: WebSockets with Actix-web
- **Serialization**: Serde with JSON
- **Validation**: Validator with derive macros
- **Containerization**: Docker with multi-stage builds

## 📋 Prerequisites

- Rust 1.75+
- PostgreSQL 15+
- Redis 7+
- Docker (optional)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
cd backend
cp env.example .env
# Edit .env with your configuration
```

### 2. Database Setup

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Or install locally and create database
createdb sethmed_clinic
```

### 3. Run Migrations

```bash
# Install sqlx-cli if not already installed
cargo install sqlx-cli

# Run migrations
sqlx migrate run
```

### 4. Start the Server

```bash
# Development
cargo run

# Production
cargo build --release
./target/release/seth-med-backend
```

### 5. Using Docker

```bash
# Build and start all services
docker-compose up --build

# Or just the backend
docker-compose up backend
```

## 🔧 Configuration

Environment variables (see `env.example`):

```bash
# Database
DATABASE_URL=postgresql://sethmed:password@localhost:5432/sethmed_clinic
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379
REDIS_POOL_SIZE=10

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRATION_HOURS=24
REFRESH_TOKEN_EXPIRATION_DAYS=7

# Server
HOST=0.0.0.0
PORT=8080
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002

# External APIs
SHA_API_URL=https://api.sha.ke
MPESA_API_URL=https://api.safaricom.co.ke
SMS_API_URL=https://api.africastalking.com
```

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info

### Patient Management

- `GET /api/patients` - List patients
- `POST /api/patients` - Create patient
- `GET /api/patients/{id}` - Get patient
- `PUT /api/patients/{id}` - Update patient
- `DELETE /api/patients/{id}` - Delete patient
- `GET /api/patients/search?q=query` - Search patients

### Appointment Management

- `GET /api/appointments` - List appointments
- `POST /api/appointments` - Create appointment
- `GET /api/appointments/{id}` - Get appointment
- `PUT /api/appointments/{id}` - Update appointment
- `DELETE /api/appointments/{id}` - Delete appointment
- `GET /api/appointments/date/{date}` - Get appointments by date
- `GET /api/appointments/patient/{patient_id}` - Get patient appointments

### Medication Management

- `GET /api/medications` - List medications
- `POST /api/medications` - Create medication
- `GET /api/medications/{id}` - Get medication
- `PUT /api/medications/{id}` - Update medication
- `DELETE /api/medications/{id}` - Delete medication
- `GET /api/medications/low-stock` - Get low stock medications
- `GET /api/medications/expiring` - Get expiring medications
- `GET /api/medications/search?q=query` - Search medications

### Invoice Management

- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/{id}` - Get invoice
- `PUT /api/invoices/{id}` - Update invoice
- `DELETE /api/invoices/{id}` - Delete invoice
- `GET /api/invoices/patient/{patient_id}` - Get patient invoices
- `GET /api/invoices/date-range` - Get invoices by date range
- `GET /api/invoices/type/{type}` - Get invoices by type

### Reports

- `GET /api/reports/financial` - Financial reports
- `GET /api/reports/medical` - Medical reports
- `GET /api/reports/operational` - Operational reports
- `GET /api/reports/invoices/{period}` - Invoice reports

### WebSocket

- `GET /ws?token={jwt_token}` - WebSocket connection for real-time updates

### Health Check

- `GET /health` - Health check endpoint

## 🔐 Authentication

The API uses JWT-based authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### User Roles

- **Admin**: Full system access
- **Receptionist**: Patient registration, appointments, basic billing
- **Nurse**: Patient vitals, visit records, basic reports
- **Clinician**: Patient visits, prescriptions, medical records
- **Pharmacist**: Medication dispensing, inventory, billing

## 🌐 WebSocket Events

### Client to Server

- `ping` - Ping server
- `subscribe` - Subscribe to specific channels

### Server to Client

- `pong` - Pong response
- `appointment_update` - Appointment status changes
- `inventory_update` - Inventory level changes
- `payment_update` - Payment status changes

## 🧪 Testing

```bash
# Run tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name
```

## 📊 Monitoring

- Health check: `GET /health`
- Metrics: Built-in performance monitoring
- Logging: Structured logging with configurable levels

## 🚀 Deployment

### Docker Deployment

```bash
# Build production image
docker build -t seth-med-backend .

# Run with docker-compose
docker-compose up -d
```

### Manual Deployment

```bash
# Build release
cargo build --release

# Run with systemd (example)
sudo systemctl start seth-med-backend
```

## 🔧 Development

### Project Structure

```
src/
├── main.rs              # Application entry point
├── config.rs            # Configuration management
├── database.rs          # Database connection and setup
├── redis_client.rs      # Redis client and operations
├── auth.rs              # Authentication and authorization
├── models.rs            # Data models and types
├── handlers/            # HTTP request handlers
│   ├── auth.rs
│   ├── patients.rs
│   ├── appointments.rs
│   ├── medications.rs
│   ├── invoices.rs
│   ├── reports.rs
│   └── health.rs
├── middleware.rs        # Custom middleware
├── websocket.rs         # WebSocket handling
└── utils.rs             # Utility functions

migrations/              # Database migrations
├── 001_initial_schema.sql
```

### Adding New Features

1. Add models to `models.rs`
2. Create database migration
3. Add handlers to `handlers/`
4. Update routes in `main.rs`
5. Add tests

### Code Style

- Follow Rust conventions
- Use `cargo fmt` for formatting
- Use `cargo clippy` for linting
- Document public APIs

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For support and questions, please contact the development team.
