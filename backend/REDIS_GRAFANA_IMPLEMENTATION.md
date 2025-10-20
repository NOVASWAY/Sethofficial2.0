# Redis Distributed Caching & Grafana Metrics Implementation

## Overview

This document describes the Redis distributed caching and Grafana metrics visualization implementation for the Seth Medical Clinic Management System.

---

## 1. Redis Distributed Caching ✅

### Implementation Status: COMPLETED

### Features Implemented

1. **Multi-Layer Caching Architecture**
   - L1 Cache: In-memory LRU cache (fast access)
   - L2 Cache: Redis distributed cache (shared across instances)
   - Automatic fallback to memory-only if Redis is unavailable

2. **Redis Integration**
   - Redis client with connection pooling
   - Async/await support with Tokio runtime
   - Connection health monitoring
   - Graceful degradation on Redis failures

3. **Cache Operations**
   - GET: Retrieve from memory cache → Redis cache → return miss
   - SET: Store in both memory and Redis with TTL
   - DELETE: Remove from both layers
   - CLEAR: Flush all caches

4. **Configuration**
   - Redis URL: Configurable via `REDIS_URL` environment variable
   - Redis enable/disable: Configurable via `REDIS_ENABLED` environment variable
   - Default TTL: 5 minutes (configurable)
   - Max memory cache size: 1000 entries (configurable)

5. **Docker Integration**
   - Redis 7-alpine container
   - Health checks every 10 seconds
   - Persistent storage with volume mount
   - Port 6379 exposed

### Files Modified

- `src/caching.rs`: Updated with Redis integration
- `docker-compose.yml`: Redis service already configured
- `env.production`: Redis configuration variables added
- `Cargo.toml`: Redis dependency with tokio-comp features

### Environment Variables

```bash
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
```

### Usage Example

```rust
// Initialize cache service
let cache_config = CacheConfig {
    redis_url: "redis://localhost:6379".to_string(),
    default_ttl: Duration::from_secs(300),
    max_memory_cache_size: 1000,
    enable_redis: true,
    enable_memory_cache: true,
};

let cache_service = CacheService::new(cache_config).await?;

// Set value
cache_service.set("user:123", &user_data, None).await?;

// Get value
if let Some(user) = cache_service.get::<User>("user:123").await? {
    // Use cached user data
}

// Delete value
cache_service.delete("user:123").await?;

// Clear all caches
cache_service.clear_all().await?;
```

### Redis Commands

```bash
# Start Redis
docker compose up -d redis

# Check Redis health
docker exec clinic_redis redis-cli ping

# Monitor Redis operations
docker exec -it clinic_redis redis-cli monitor

# View cache keys
docker exec clinic_redis redis-cli keys "*"

# Get cache statistics
docker exec clinic_redis redis-cli info stats
```

---

## 2. Grafana Metrics Visualization 🚧

### Implementation Status: IN PROGRESS

### Features to Implement

1. **Prometheus Metrics Collection**
   - HTTP request metrics (count, duration, status codes)
   - Database query metrics (count, duration, operation types)
   - Cache metrics (hit ratio, operations, size)
   - Business metrics (patients, consultations, appointments, etc.)
   - System metrics (memory, CPU, uptime)
   - Compliance metrics (audit events, compliance score, retention operations)

2. **Metrics Service**
   - Prometheus registry
   - Counter metrics (incremental counts)
   - Gauge metrics (current values)
   - Histogram metrics (distributions)
   - Label-based metric tagging

3. **Metrics Endpoints**
   - `GET /metrics` - Prometheus format metrics
   - `GET /api/v1/metrics/summary` - JSON metrics summary

4. **Grafana Dashboard**
   - Real-time system monitoring
   - HTTP request rate and latency charts
   - Database performance charts
   - Cache hit rate charts
   - Business metrics charts
   - Compliance metrics charts
   - Alert rules for critical thresholds

### Files Created

- `src/metrics.rs`: Metrics service implementation
- `Cargo.toml`: Added prometheus and actix-web-prometheus dependencies

### Dependencies Added

```toml
prometheus = "0.13"
actix-web-prometheus = "0.6"
```

### Next Steps

1. **Complete Metrics Service Integration**
   - Add metrics_service to AppState struct
   - Add metrics endpoints to main.rs
   - Integrate metrics middleware into Actix Web app

2. **Create Grafana Configuration**
   - Add Grafana service to docker-compose.yml
   - Create Grafana datasource configuration
   - Create Grafana dashboard JSON

3. **Create Prometheus Configuration**
   - Add Prometheus service to docker-compose.yml
   - Create prometheus.yml scrape configuration
   - Configure Prometheus to scrape metrics endpoint

4. **Test Metrics Collection**
   - Verify metrics endpoint returns data
   - Test Grafana visualization
   - Configure alerts

---

## 3. Docker Compose Configuration

### Current Services

```yaml
services:
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx-ssl.conf:/etc/nginx/conf.d/default.conf
      - ./certs:/etc/nginx/certs
```

### Services to Add (Grafana Implementation)

```yaml
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/dashboards
      - ./grafana/datasources:/etc/grafana/datasources
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_SECURITY_ADMIN_USER=admin
    depends_on:
      - prometheus

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

---

## 4. Prometheus Configuration

### prometheus.yml (To Be Created)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'clinic-backend'
    static_configs:
      - targets: ['host.docker.internal:8080']
    metrics_path: '/metrics'
```

---

## 5. Grafana Dashboard Configuration

### Dashboard Panels

1. **HTTP Metrics**
   - Request rate (requests/second)
   - Request duration (p50, p95, p99)
   - Error rate (4xx, 5xx status codes)
   - Requests by endpoint

2. **Database Metrics**
   - Query rate (queries/second)
   - Query duration (p50, p95, p99)
   - Active connections
   - Query errors

3. **Cache Metrics**
   - Cache hit ratio
   - Cache operations (get, set, delete)
   - Cache size
   - Cache hit rate by cache type

4. **Business Metrics**
   - Total patients
   - Total consultations
   - Total appointments
   - Total prescriptions
   - Total invoices

5. **System Metrics**
   - Memory usage
   - CPU usage
   - Uptime
   - Active requests

6. **Compliance Metrics**
   - Total audit events
   - Audit events by severity
   - Compliance score
   - Data retention operations

---

## 6. Benefits

### Redis Distributed Caching

1. **Performance**
   - Reduced database load
   - Faster response times
   - Improved scalability

2. **Reliability**
   - Graceful degradation on failures
   - Automatic fallback to memory cache
   - Health monitoring

3. **Scalability**
   - Shared cache across multiple backend instances
   - Horizontal scaling support
   - Load distribution

### Grafana Metrics

1. **Observability**
   - Real-time system monitoring
   - Performance insights
   - Trend analysis

2. **Troubleshooting**
   - Quick problem identification
   - Root cause analysis
   - Performance bottleneck detection

3. **Capacity Planning**
   - Resource utilization tracking
   - Growth trend analysis
   - Capacity forecasting

4. **Compliance Monitoring**
   - Audit event tracking
   - Compliance score monitoring
   - Alert on compliance violations

---

## 7. Testing

### Redis Testing

```bash
# Start Redis
docker compose up -d redis

# Test Redis connection
docker exec clinic_redis redis-cli ping

# Start backend with Redis enabled
cd /home/njau-wangari/Downloads/backend
DATABASE_URL=postgresql://clinic_user:clinic_password@localhost:5432/clinic_management \
REDIS_ENABLED=true \
REDIS_URL=redis://localhost:6379 \
RUST_LOG=info \
cargo run

# Test cache operations
curl http://localhost:8080/api/v1/performance/cache/stats
curl -X POST http://localhost:8080/api/v1/performance/cache/clear
```

### Grafana Testing (After Implementation)

```bash
# Start all services
docker compose up -d

# Access Grafana
open http://localhost:3000

# Login with admin/admin

# View dashboards
# Navigate to Dashboards → Clinic Management Dashboard

# Test Prometheus metrics
open http://localhost:9090

# Query metrics
# http_requests_total
# database_queries_total
# cache_operations_total
```

---

## 8. Monitoring & Alerts

### Recommended Alerts

1. **High Error Rate**
   - Threshold: >5% of requests result in 5xx errors
   - Action: Investigate backend issues

2. **Slow Response Times**
   - Threshold: p95 response time >1s
   - Action: Optimize slow endpoints

3. **Low Cache Hit Ratio**
   - Threshold: <70% cache hit rate
   - Action: Review cache strategy

4. **High Database Load**
   - Threshold: >80% active connections
   - Action: Scale database or optimize queries

5. **Compliance Violations**
   - Threshold: Any critical audit event
   - Action: Investigate security incident

---

## 9. Maintenance

### Redis Maintenance

```bash
# View Redis memory usage
docker exec clinic_redis redis-cli info memory

# Clear Redis cache
docker exec clinic_redis redis-cli flushdb

# Backup Redis data
docker exec clinic_redis redis-cli save

# Monitor Redis operations
docker exec -it clinic_redis redis-cli monitor
```

### Grafana Maintenance

```bash
# Backup Grafana dashboards
docker cp clinic_grafana:/var/lib/grafana/dashboards ./grafana/dashboards/backup

# Update Grafana configuration
docker restart clinic_grafana

# View Grafana logs
docker logs clinic_grafana
```

---

## 10. Summary

### Redis Distributed Caching: ✅ COMPLETED

- Redis integration fully implemented
- Multi-layer caching with graceful degradation
- Docker container running and healthy
- Cache service configured and ready

### Grafana Metrics Visualization: 🚧 IN PROGRESS

- Metrics service created
- Dependencies added
- Next steps: Complete integration and configuration

---

**Status:** Redis caching is production-ready. Grafana metrics requires completion of integration and configuration steps outlined above.

**Generated:** October 6, 2025
**Version:** 1.1.0

