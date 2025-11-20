#!/bin/bash

# Monitoring Services Setup Script
# This script helps set up Prometheus and Grafana for monitoring

set -e

echo "=========================================="
echo "Monitoring Services Setup"
echo "=========================================="
echo ""

read -p "Do you want to set up monitoring services (Prometheus & Grafana)? (y/n): " setup
if [ "$setup" != "y" ]; then
    echo "Skipping monitoring setup."
    exit 0
fi

# Check if monitoring-docker-compose.yml exists
MONITORING_COMPOSE="monitoring-docker-compose.yml"
if [ ! -f "$MONITORING_COMPOSE" ]; then
    echo "⚠️  $MONITORING_COMPOSE not found."
    echo "Creating basic monitoring configuration..."
    
    cat > "$MONITORING_COMPOSE" << 'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: clinic_prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - clinic-network
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: clinic_grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    networks:
      - clinic-network
    restart: unless-stopped
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:

networks:
  clinic-network:
    external: true
EOF
    echo "✅ Created $MONITORING_COMPOSE"
fi

# Create monitoring directories
mkdir -p monitoring/prometheus
mkdir -p monitoring/grafana/provisioning/datasources
mkdir -p monitoring/grafana/provisioning/dashboards

# Create Prometheus configuration if it doesn't exist
if [ ! -f "monitoring/prometheus/prometheus.yml" ]; then
    cat > monitoring/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'clinic-backend'
    static_configs:
      - targets: ['backend:8080']
    metrics_path: '/metrics'
    
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF
    echo "✅ Created Prometheus configuration"
fi

# Create Grafana datasource configuration
if [ ! -f "monitoring/grafana/provisioning/datasources/prometheus.yml" ]; then
    cat > monitoring/grafana/provisioning/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF
    echo "✅ Created Grafana datasource configuration"
fi

# Check if clinic-network exists
if ! docker network ls | grep -q "clinic-network"; then
    echo "Creating clinic-network..."
    docker network create clinic-network || echo "Network may already exist"
fi

echo ""
echo "Starting monitoring services..."
docker-compose -f "$MONITORING_COMPOSE" up -d

echo ""
echo "✅ Monitoring services started!"
echo ""
echo "Access URLs:"
echo "  Prometheus: http://localhost:9090"
echo "  Grafana: http://localhost:3001"
echo "    Username: admin"
echo "    Password: admin (change on first login)"
echo ""
echo "⚠️  Remember to:"
echo "  1. Change Grafana admin password"
echo "  2. Configure Grafana dashboards"
echo "  3. Set up alerting rules in Prometheus"
echo "  4. Configure notification channels"

