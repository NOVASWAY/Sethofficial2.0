# Clinic Management System

A comprehensive, modern clinic management system built with Rust (backend) and React (frontend), designed to streamline healthcare operations and improve patient care.

## 🏥 Features

### Core Functionality
- **Patient Management**: Complete patient registration, records, and history tracking
- **Appointment Scheduling**: Advanced scheduling system with conflict detection
- **User Management**: Role-based access control (Admin, Doctor, Nurse, Receptionist)
- **Medicine Inventory**: Pharmacy management with stock tracking and alerts
- **Consultation Management**: Digital consultation notes and prescriptions
- **Billing & Invoicing**: Comprehensive billing system with payment tracking
- **Reports & Analytics**: Detailed reports for patients, appointments, and finances

### Technical Features
- **Real-time Updates**: WebSocket integration for live data synchronization
- **Advanced Security**: 
  - JWT authentication with refresh tokens
  - CSRF protection with Redis-backed tokens
  - Security headers (X-Frame-Options, CSP, HSTS)
  - Rate limiting (100 req/min standard, 30 req/min auth)
  - MFA/2FA support (TOTP and SMS)
  - Role-based access control (RBAC)
  - Admin-only endpoint protection
- **Performance Optimized**: 
  - Redis caching (optional, graceful degradation)
  - Database connection pooling
  - Query optimization
- **Production Ready**: 
  - Docker containerization
  - Health checks and monitoring
  - Comprehensive logging
  - Backup system

## 🚀 Quick Start

**New to the project?** See [QUICK_START.md](QUICK_START.md) for a 5-minute setup guide!

### Automated Setup
```bash
# Run complete setup script
./scripts/setup-all.sh

# Start services
docker-compose up -d

# Verify installation
curl http://localhost:8080/health
```

For detailed instructions, see [QUICK_START.md](QUICK_START.md).

## 📖 Documentation

### Quick Start
- **[QUICK_START.md](QUICK_START.md)** - Get started in 5 minutes

### Comprehensive Guides
- **[CONFIGURATION_GUIDE.md](CONFIGURATION_GUIDE.md)** - Complete configuration instructions
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Testing procedures and examples
- **[PERFORMANCE_TESTING_GUIDE.md](PERFORMANCE_TESTING_GUIDE.md)** - Performance testing strategies
- **[COMPLETE_SYSTEM_OVERVIEW.md](COMPLETE_SYSTEM_OVERVIEW.md)** - Full system architecture and features

### Reference Documentation
- **[ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)** - Complete environment variable reference
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Pre-deployment verification checklist
- **[PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md)** - Production deployment guide

### Status & Security
- **[FINAL_STATUS.md](FINAL_STATUS.md)** - Current system status and completion summary
- **[SECURITY_AUDIT.md](SECURITY_AUDIT.md)** - Security assessment and recommendations

### Prerequisites
- Docker and Docker Compose (20.10+)
- Git
- 8GB+ RAM recommended
- 100GB+ storage recommended

### Development Setup
```bash
# Clone the repository
git clone https://github.com/NOVASWAY/Sethofficial2.0.git
cd Sethofficial2.0

# Copy environment configuration files
cp env.example .env
cp backend/env.example backend/.env

# Generate secure secrets (required for production)
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 24  # For POSTGRES_PASSWORD
openssl rand -base64 24  # For REDIS_PASSWORD

# Update .env files with your values
# See ENVIRONMENT_VARIABLES.md for complete reference

# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Access the application
# Frontend: http://localhost
# Backend API: http://localhost:8080
# Health Check: http://localhost:8080/health
```

### First-Time Setup
1. **Configure Environment Variables**: See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)
2. **Start Services**: `docker-compose up -d`
3. **Verify Services**: Check `docker-compose ps` - all services should be "Up" and "healthy"
4. **Access Application**: Navigate to http://localhost

### Production Deployment
```bash
# Configure environment variables
cp env.example .env
nano .env  # Update with your production values

# Deploy using the deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh production deploy

# Or use Docker Compose directly
docker-compose -f docker-compose.prod.yml up -d
```

## 📁 Project Structure

```
clinic-management/
├── backend/                 # Rust backend application
│   ├── src/
│   │   ├── handlers/       # API request handlers
│   │   ├── models/         # Data models and structures
│   │   ├── middleware/     # Custom middleware
│   │   ├── security/       # Security utilities
│   │   ├── cache/          # Caching system
│   │   └── tests/          # Backend tests
│   ├── migrations/         # Database migrations
│   └── Cargo.toml         # Rust dependencies
├── components/             # React frontend components
│   ├── ui/                # Reusable UI components
│   ├── patient-management/ # Patient-specific components
│   └── examples/          # Example implementations
├── contexts/              # React contexts for state management
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
├── scripts/               # Deployment and utility scripts
├── monitoring/            # Monitoring configuration
├── docker-compose.yml     # Development Docker setup
├── docker-compose.prod.yml # Production Docker setup
└── docs/                  # Documentation
```

## 🛠 Technology Stack

### Backend
- **Rust**: High-performance systems programming language
- **Actix-web**: Fast, powerful web framework
- **SQLx**: Async SQL toolkit with compile-time checked queries
- **PostgreSQL**: Robust, open-source relational database
- **Redis**: In-memory data structure store for caching
- **JWT**: JSON Web Tokens for authentication
- **Argon2**: Secure password hashing

### Frontend
- **React**: Modern UI library
- **Next.js**: React framework for production
- **TypeScript**: Type-safe JavaScript
- **Shadcn UI**: Modern component library
- **Tailwind CSS**: Utility-first CSS framework

### DevOps & Infrastructure
- **Docker**: Containerization platform
- **Docker Compose**: Multi-container application orchestration
- **Nginx**: High-performance web server and reverse proxy
- **Prometheus**: Monitoring and alerting toolkit
- **Grafana**: Metrics visualization and monitoring
- **GitHub Actions**: CI/CD pipeline

## 📚 Documentation

### Essential Guides
- **[Environment Variables](ENVIRONMENT_VARIABLES.md)**: Complete reference for all environment variables
- **[Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)**: Step-by-step production deployment instructions
- **[Deployment Checklist](DEPLOYMENT_CHECKLIST.md)**: Pre-deployment verification checklist
- **[Security Audit](SECURITY_AUDIT.md)**: Comprehensive security audit report
- **[Final Status](FINAL_STATUS.md)**: Current system status and completion summary

### Additional Documentation
- **[API Documentation](docs/API_DOCUMENTATION.md)**: Complete API reference with examples
- **[User Guide](docs/USER_GUIDE.md)**: Comprehensive user manual
- **[Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md)**: System architecture and implementation details
- **[Testing Guide](TESTING_GUIDE.md)**: Testing strategies and procedures

## 🧪 Testing

### Run All Tests
```bash
# Make test script executable
chmod +x run_tests.sh

# Run comprehensive test suite
./run_tests.sh
```

### Individual Test Suites
```bash
# Backend unit tests
cd backend && cargo test --lib

# Backend integration tests
cd backend && cargo test --test integration_tests

# End-to-end tests
cd backend && cargo test --test e2e_tests

# Frontend tests
npm test
```

## 🔧 Development

### Backend Development
```bash
cd backend

# Install dependencies
cargo build

# Run development server
cargo run

# Run tests
cargo test

# Check code formatting
cargo fmt

# Run linter
cargo clippy
```

### Frontend Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run linter
npm run lint
```

### Database Management
```bash
# Run migrations
cd backend
DATABASE_URL="postgresql://clinic_user:clinic_password@localhost:5432/clinic_management" sqlx migrate run

# Create new migration
sqlx migrate add migration_name

# Reset database
sqlx database drop
sqlx database create
sqlx migrate run
```

## 🔒 Security

The system implements comprehensive security measures:

### Authentication & Authorization
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **MFA/2FA Support**: TOTP and SMS-based multi-factor authentication
- **Role-Based Access Control (RBAC)**: Granular permissions per role
- **Admin Protection**: Sensitive operations require admin privileges

### Security Features
- **CSRF Protection**: Redis-backed CSRF token validation
- **Security Headers**: X-Frame-Options, CSP, HSTS, X-Content-Type-Options
- **Rate Limiting**: 100 req/min (standard), 30 req/min (auth endpoints)
- **Input Validation**: Server-side validation and sanitization
- **SQL Injection Protection**: Parameterized queries (SQLx)
- **XSS Prevention**: Input sanitization and output encoding
- **Password Security**: Argon2 hashing with salt, password policies
- **Session Management**: Secure session tracking with timeout
- **WebSocket Authentication**: JWT validation on WebSocket connections

### Security Status
- **Security Score**: 85/100 (Good)
- **Security Audit**: See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for details

## 📊 Monitoring

### Health Checks
- **Backend**: `GET /health` - Application health status
- **Frontend**: `GET /health` - Frontend health status
- **Database**: Connection and query performance monitoring
- **Cache**: Redis connection and performance monitoring

### Metrics
- **Application Metrics**: Request rates, response times, error rates
- **System Metrics**: CPU, memory, disk usage
- **Database Metrics**: Query performance, connection pool status
- **Cache Metrics**: Hit rates, memory usage, eviction rates

### Logging
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Log Levels**: Debug, Info, Warn, Error with appropriate filtering
- **Log Aggregation**: Centralized log collection and analysis
- **Audit Logging**: Security and compliance event logging

## 📱 Mobile Support

**Yes, the system works perfectly on mobile devices!**

The Clinic Management System is a **web application** that is fully responsive and optimized for mobile phones and tablets:

- ✅ **Web App**: Runs in your mobile browser (no installation required)
- ✅ **Responsive Design**: Automatically adapts to any screen size
- ✅ **Mobile-First**: Built with mobile devices in mind
- ✅ **Touch-Optimized**: All controls are touch-friendly
- ✅ **Mobile Sidebar**: Collapsible navigation drawer on mobile
- ✅ **Fast Performance**: Optimized for mobile networks

**See [MOBILE_USAGE_GUIDE.md](MOBILE_USAGE_GUIDE.md) for complete mobile documentation.**

### Quick Mobile Access
1. Open your mobile browser (Chrome, Safari, Firefox, etc.)
2. Navigate to your clinic URL
3. Login and start using - it works just like on desktop!

---

## 🚀 Deployment

### Development
```bash
# Quick start with Docker
docker-compose up -d

# Access services
# Frontend: http://localhost
# Backend: http://localhost:8080
# Database: localhost:5432
```

### Production
```bash
# Configure environment
cp env.example .env
# Edit .env with production values

# Deploy with script
./scripts/deploy.sh production deploy

# Or use Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### CI/CD Pipeline
The system includes a comprehensive CI/CD pipeline with:
- **Automated Testing**: Unit, integration, and E2E tests
- **Security Scanning**: Vulnerability and dependency scanning
- **Code Quality**: Linting, formatting, and coverage analysis
- **Docker Builds**: Automated image building and pushing
- **Deployment**: Automated deployment to staging and production
- **Monitoring**: Post-deployment health checks and monitoring

## 🔄 Backup & Recovery

### Automated Backups
```bash
# Create backup
./scripts/backup.sh backup

# List backups
./scripts/backup.sh list

# Restore from backup
./scripts/backup.sh restore backups/clinic_backup_20240101_120000.tar.gz
```

### Backup Features
- **Daily Automated Backups**: Scheduled database backups
- **Cloud Storage**: Optional S3 integration for off-site storage
- **Backup Verification**: Automated backup integrity checks
- **Retention Policy**: Configurable backup retention periods
- **Point-in-Time Recovery**: Database restoration capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow Rust and TypeScript best practices
- Write comprehensive tests for new features
- Update documentation for API changes
- Ensure all tests pass before submitting PR
- Follow the existing code style and conventions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
- **Documentation**: Check the comprehensive documentation in the `docs/` directory
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join community discussions in GitHub Discussions
- **Email**: Contact the development team at support@yourclinic.com

### Common Issues
- **Database Connection**: Check PostgreSQL service and connection string
- **Port Conflicts**: Ensure ports 80, 443, 8080, 5432, 6379 are available
- **Permission Issues**: Check file permissions and Docker access
- **Memory Issues**: Ensure sufficient RAM (8GB+ recommended)

## 🎯 Roadmap

### Upcoming Features
- [ ] Mobile application (React Native)
- [ ] Advanced analytics dashboard
- [ ] Integration with external healthcare systems
- [ ] AI-powered diagnosis assistance
- [ ] Telemedicine capabilities
- [ ] Multi-language support
- [ ] Advanced reporting and business intelligence

### Performance Improvements
- [ ] Database query optimization
- [ ] Caching layer enhancements
- [ ] CDN integration
- [ ] Load balancing improvements
- [ ] Microservices architecture migration

---

**Built with ❤️ for healthcare professionals**

For more information, visit our [documentation](docs/) or contact us at [support@yourclinic.com](mailto:support@yourclinic.com).