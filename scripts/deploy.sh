#!/bin/bash

# Enhanced Dashboard Deployment Script
# This script handles the complete deployment of the clinic management system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="clinic-management"
BACKUP_DIR="./backups"
LOG_DIR="./logs"
ENV_FILE=".env.production"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "./nginx/logs"
    mkdir -p "./nginx/ssl"
    mkdir -p "./monitoring/grafana/dashboards"
    mkdir -p "./monitoring/grafana/datasources"
    
    log_success "Directories created"
}

# Generate environment file
generate_env_file() {
    log_info "Generating environment file..."
    
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning "Environment file not found. Creating template..."
        
        cat > "$ENV_FILE" << EOF
# Production Environment Configuration

# Database Configuration
DATABASE_URL=postgresql://clinic_user:\${DB_PASSWORD}@db:5432/clinic_management
DB_PASSWORD=change_this_secure_password

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=change_this_redis_password

# JWT Configuration
JWT_SECRET=change_this_jwt_secret_minimum_32_characters_long
JWT_ACCESS_TOKEN_TTL=86400
JWT_REFRESH_TOKEN_TTL=604800

# Application Configuration
RUST_LOG=info
LOG_LEVEL=info
NODE_ENV=production

# Frontend Configuration
NEXT_PUBLIC_API_URL=https://api.clinic-management.com
NEXT_PUBLIC_WS_URL=wss://api.clinic-management.com/ws
NEXT_PUBLIC_APP_NAME=Clinic Management System
NEXT_PUBLIC_APP_VERSION=2.0.0

# Security Configuration
CORS_ORIGINS=https://clinic-management.com,https://www.clinic-management.com
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# Monitoring Configuration
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
GRAFANA_PASSWORD=change_this_grafana_password

# Feature Flags
ENABLE_REAL_TIME_UPDATES=true
ENABLE_ACTIVITY_LOGGING=true
ENABLE_DATA_ISOLATION=true
ENABLE_ADVANCED_VALIDATION=true
ENABLE_CACHING=true
ENABLE_MONITORING=true
ENABLE_BACKUP=true

# Development/Testing Flags (should be false in production)
DEBUG_MODE=false
ENABLE_DEBUG_ROUTES=false
ENABLE_TEST_DATA=false
EOF
        
        log_warning "Please edit $ENV_FILE with your actual configuration values"
        log_warning "Especially change the passwords and secrets!"
        read -p "Press Enter to continue after editing the environment file..."
    fi
    
    log_success "Environment file ready"
}

# Generate SSL certificates (self-signed for development)
generate_ssl_certificates() {
    log_info "Generating SSL certificates..."
    
    if [[ ! -f "./nginx/ssl/cert.pem" ]] || [[ ! -f "./nginx/ssl/key.pem" ]]; then
        log_warning "SSL certificates not found. Generating self-signed certificates..."
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ./nginx/ssl/key.pem \
            -out ./nginx/ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=clinic-management.com"
        
        log_warning "Self-signed certificates generated. For production, use proper SSL certificates."
    fi
    
    log_success "SSL certificates ready"
}

# Create monitoring configuration
create_monitoring_config() {
    log_info "Creating monitoring configuration..."
    
    # Prometheus configuration
    cat > "./monitoring/prometheus.yml" << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'clinic-backend'
    static_configs:
      - targets: ['backend:8080']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:8080']
    metrics_path: '/nginx_status'
    scrape_interval: 10s
EOF

    # Grafana datasource configuration
    mkdir -p "./monitoring/grafana/datasources"
    cat > "./monitoring/grafana/datasources/prometheus.yml" << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

    log_success "Monitoring configuration created"
}

# Create backup script
create_backup_script() {
    log_info "Creating backup script..."
    
    cat > "./scripts/backup.sh" << 'EOF'
#!/bin/bash

# Database backup script
BACKUP_DIR="/backups"
DB_NAME="clinic_management"
DB_USER="clinic_user"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/clinic_backup_$TIMESTAMP.sql"

# Create backup
pg_dump -h db -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "clinic_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
EOF

    chmod +x "./scripts/backup.sh"
    log_success "Backup script created"
}

# Build and deploy
deploy() {
    log_info "Building and deploying application..."
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    docker compose -f docker compose.prod.yml down || true
    
    # Build images
    log_info "Building Docker images..."
    docker compose -f docker compose.prod.yml build --no-cache
    
    # Start services
    log_info "Starting services..."
    docker compose -f docker compose.prod.yml up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    check_service_health
    
    log_success "Deployment completed successfully!"
}

# Check service health
check_service_health() {
    log_info "Checking service health..."
    
    # Check backend
    if curl -f http://localhost:8080/health &> /dev/null; then
        log_success "Backend is healthy"
    else
        log_error "Backend health check failed"
        return 1
    fi
    
    # Check frontend
    if curl -f http://localhost:3000 &> /dev/null; then
        log_success "Frontend is healthy"
    else
        log_error "Frontend health check failed"
        return 1
    fi
    
    # Check database
    if docker compose -f docker compose.prod.yml exec -T db pg_isready -U clinic_user &> /dev/null; then
        log_success "Database is healthy"
    else
        log_error "Database health check failed"
        return 1
    fi
    
    # Check Redis
    if docker compose -f docker compose.prod.yml exec -T redis redis-cli ping &> /dev/null; then
        log_success "Redis is healthy"
    else
        log_error "Redis health check failed"
        return 1
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Wait for database to be ready
    sleep 10
    
    # Run migrations
    docker compose -f docker compose.prod.yml exec -T backend cargo run --bin migrate || {
        log_error "Database migrations failed"
        return 1
    }
    
    log_success "Database migrations completed"
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    echo ""
    
    # Show running containers
    docker compose -f docker compose.prod.yml ps
    
    echo ""
    log_info "Service URLs:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8080"
    echo "  Prometheus: http://localhost:9090"
    echo "  Grafana: http://localhost:3001"
    echo "  Kibana: http://localhost:5601"
    echo ""
    
    log_info "Useful Commands:"
    echo "  View logs: docker compose -f docker compose.prod.yml logs -f"
    echo "  Stop services: docker compose -f docker compose.prod.yml down"
    echo "  Restart services: docker compose -f docker compose.prod.yml restart"
    echo "  Scale services: docker compose -f docker compose.prod.yml up -d --scale backend=3"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    log_info "Starting Enhanced Dashboard deployment..."
    
    check_root
    check_prerequisites
    create_directories
    generate_env_file
    generate_ssl_certificates
    create_monitoring_config
    create_backup_script
    deploy
    run_migrations
    show_status
    cleanup
    
    log_success "Enhanced Dashboard deployment completed successfully!"
    log_info "Please update your DNS records to point to this server"
    log_info "And replace the self-signed SSL certificates with proper ones"
}

# Handle script arguments
case "${1:-}" in
    "deploy")
        main
        ;;
    "status")
        show_status
        ;;
    "health")
        check_service_health
        ;;
    "logs")
        docker compose -f docker compose.prod.yml logs -f
        ;;
    "stop")
        docker compose -f docker compose.prod.yml down
        ;;
    "restart")
        docker compose -f docker compose.prod.yml restart
        ;;
    "backup")
        docker compose -f docker compose.prod.yml exec backup /backup.sh
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        echo "Usage: $0 {deploy|status|health|logs|stop|restart|backup|cleanup}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Deploy the complete application"
        echo "  status   - Show deployment status"
        echo "  health   - Check service health"
        echo "  logs     - View application logs"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  backup   - Create database backup"
        echo "  cleanup  - Clean up unused Docker resources"
        exit 1
        ;;
esac