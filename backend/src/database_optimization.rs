use sqlx::{PgPool, Row, Postgres, Transaction};
use serde::{Deserialize, Serialize};
use tracing::{info, warn, debug, error};
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::error::ApiError;

/// Database optimization service
pub struct DatabaseOptimization {
    pool: PgPool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryStats {
    pub query: String,
    pub execution_time_ms: f64,
    pub rows_returned: i64,
    pub cache_hit_ratio: f64,
    pub calls: i64,
    pub total_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStats {
    pub table_name: String,
    pub index_name: String,
    pub index_size: String,
    pub index_usage: i64,
    pub index_scan_ratio: f64,
    pub is_used: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableStats {
    pub table_name: String,
    pub row_count: i64,
    pub table_size: String,
    pub index_size: String,
    pub total_size: String,
    pub last_vacuum: Option<String>,
    pub last_analyze: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseStats {
    pub total_size: String,
    pub table_count: i64,
    pub index_count: i64,
    pub connection_count: i64,
    pub cache_hit_ratio: f64,
    pub slow_queries: Vec<QueryStats>,
    pub unused_indexes: Vec<IndexStats>,
    pub table_stats: Vec<TableStats>,
    pub connection_stats: ConnectionStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStats {
    pub active_connections: i64,
    pub idle_connections: i64,
    pub max_connections: i64,
    pub connection_utilization: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationRecommendation {
    pub category: String,
    pub priority: String,
    pub description: String,
    pub impact: String,
    pub sql_command: Option<String>,
}

impl DatabaseOptimization {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Create optimized indexes for better query performance
    pub async fn create_optimized_indexes(&self) -> Result<(), sqlx::Error> {
        info!("🔧 Creating optimized database indexes...");

        let indexes = vec![
            // Patient indexes - Updated for new schema
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_name_search ON patients USING gin(to_tsvector('english', first_name || ' ' || last_name))",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_phone ON patients (phone)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_location ON patients (location)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_created_at ON patients (created_at)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_updated_at ON patients (updated_at)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_gender ON patients (gender)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_date_of_birth ON patients (date_of_birth)",
            
            // User indexes - Updated for new schema
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users (username)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users (role)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_department ON users (department)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_active ON users (is_active)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users (created_at)",
            
            // Session indexes
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_created_at ON sessions (created_at)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_is_active ON sessions (is_active)",
            
            // Consultation indexes
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_patient_id ON consultations (patient_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_doctor_id ON consultations (doctor_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_date ON consultations (consultation_date)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_status ON consultations (status)",
            
            // Appointment indexes
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_patient_id ON appointments (patient_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_doctor_id ON appointments (doctor_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_date ON appointments (appointment_date)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_status ON appointments (status)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_date_status ON appointments (appointment_date, status)",
            
            // Medicine indexes
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_name_search ON medicines USING gin(to_tsvector('english', name))",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_category ON medicines (category)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_stock ON medicines (stock_quantity)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_reorder_level ON medicines (reorder_level)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_expiry_date ON medicines (expiry_date)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_low_stock ON medicines (stock_quantity) WHERE stock_quantity <= reorder_level",
            
            // Prescription indexes
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions (patient_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions (doctor_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescriptions_date ON prescriptions (prescription_date)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prescriptions_status ON prescriptions (status)",
            
            // Invoice indexes
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_patient_id ON invoices (patient_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_date ON invoices (invoice_date)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_status ON invoices (status)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_total ON invoices (total_amount)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_date_status ON invoices (invoice_date, status)",
            
            // System settings indexes
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_settings_category ON system_settings (category)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_settings_key ON system_settings (key)",
            
            // User settings indexes
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_settings_user_id ON user_settings (user_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_settings_category ON user_settings (category)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_settings_key ON user_settings (key)",
            
            // Audit log indexes
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action ON audit_logs (user_id, action)",
            
            // Notification indexes
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id ON notifications (user_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type ON notifications (notification_type)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_status ON notifications (status)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at ON notifications (created_at)",
        ];

        for (i, index_sql) in indexes.iter().enumerate() {
            match sqlx::query(index_sql).execute(&self.pool).await {
                Ok(_) => {
                    debug!("✅ Created index {}/{}", i + 1, indexes.len());
                }
                Err(e) => {
                    warn!("⚠️ Failed to create index: {} - Error: {}", index_sql, e);
                }
            }
        }

        info!("✅ Database indexing optimization completed");
        Ok(())
    }

    /// Analyze database performance and get statistics
    pub async fn get_database_stats(&self) -> Result<DatabaseStats, sqlx::Error> {
        // Get database size
        let size_query = r#"
            SELECT pg_size_pretty(pg_database_size(current_database())) as total_size
        "#;
        let size_row = sqlx::query(size_query).fetch_one(&self.pool).await?;
        let total_size = size_row.get::<String, _>("total_size");

        // Get table count
        let table_count_query = r#"
            SELECT COUNT(*) as table_count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        "#;
        let table_count_row = sqlx::query(table_count_query).fetch_one(&self.pool).await?;
        let table_count = table_count_row.get::<i64, _>("table_count");

        // Get index count
        let index_count_query = r#"
            SELECT COUNT(*) as index_count 
            FROM pg_indexes 
            WHERE schemaname = 'public'
        "#;
        let index_count_row = sqlx::query(index_count_query).fetch_one(&self.pool).await?;
        let index_count = index_count_row.get::<i64, _>("index_count");

        // Get connection count
        let connection_count_query = r#"
            SELECT COUNT(*) as connection_count 
            FROM pg_stat_activity 
            WHERE state = 'active'
        "#;
        let connection_count_row = sqlx::query(connection_count_query).fetch_one(&self.pool).await?;
        let connection_count = connection_count_row.get::<i64, _>("connection_count");

        // Get cache hit ratio
        let cache_hit_ratio = self.get_cache_hit_ratio().await?;

        // Get slow queries
        let slow_queries = self.get_slow_queries().await?;

        // Get unused indexes
        let unused_indexes = self.get_unused_indexes().await?;

        // Get table statistics
        let table_stats = self.get_table_stats().await?;

        // Get connection statistics
        let connection_stats = self.get_connection_stats().await?;

        Ok(DatabaseStats {
            total_size,
            table_count,
            index_count,
            connection_count,
            cache_hit_ratio,
            slow_queries,
            unused_indexes,
            table_stats,
            connection_stats,
        })
    }

    /// Get cache hit ratio
    async fn get_cache_hit_ratio(&self) -> Result<f64, sqlx::Error> {
        let query = r#"
            SELECT 
                round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) as cache_hit_ratio
            FROM pg_stat_database 
            WHERE datname = current_database()
        "#;

        let row = sqlx::query(query).fetch_one(&self.pool).await?;
        Ok(row.get::<f64, _>("cache_hit_ratio").unwrap_or(0.0))
    }

    /// Get slow queries from pg_stat_statements (if available)
    async fn get_slow_queries(&self) -> Result<Vec<QueryStats>, sqlx::Error> {
        let query = r#"
            SELECT 
                query,
                mean_exec_time as execution_time_ms,
                calls,
                total_exec_time as total_time_ms,
                round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 2) as cache_hit_ratio
            FROM pg_stat_statements 
            WHERE mean_exec_time > 100
            ORDER BY mean_exec_time DESC 
            LIMIT 10
        "#;

        let rows = sqlx::query(query).fetch_all(&self.pool).await?;
        let mut slow_queries = Vec::new();

        for row in rows {
            slow_queries.push(QueryStats {
                query: row.get("query"),
                execution_time_ms: row.get("execution_time_ms"),
                rows_returned: row.get("calls"),
                cache_hit_ratio: row.get("cache_hit_ratio"),
                calls: row.get("calls"),
                total_time_ms: row.get("total_time_ms"),
            });
        }

        Ok(slow_queries)
    }

    /// Get unused indexes
    async fn get_unused_indexes(&self) -> Result<Vec<IndexStats>, sqlx::Error> {
        let query = r#"
            SELECT 
                schemaname,
                tablename as table_name,
                indexname as index_name,
                pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
                idx_scan as index_usage,
                round(100.0 * idx_scan / nullif(idx_tup_read + idx_tup_fetch, 0), 2) as index_scan_ratio
            FROM pg_stat_user_indexes 
            WHERE idx_scan = 0 
            AND schemaname = 'public'
            ORDER BY pg_relation_size(indexrelid) DESC
            LIMIT 10
        "#;

        let rows = sqlx::query(query).fetch_all(&self.pool).await?;
        let mut unused_indexes = Vec::new();

        for row in rows {
            unused_indexes.push(IndexStats {
                table_name: row.get("table_name"),
                index_name: row.get("index_name"),
                index_size: row.get("index_size"),
                index_usage: row.get("index_usage"),
                index_scan_ratio: row.get("index_scan_ratio"),
                is_used: false,
            });
        }

        Ok(unused_indexes)
    }

    /// Get table statistics
    async fn get_table_stats(&self) -> Result<Vec<TableStats>, sqlx::Error> {
        let query = r#"
            SELECT 
                schemaname,
                tablename as table_name,
                n_tup_ins + n_tup_upd + n_tup_del as row_count,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
                pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
                last_vacuum::text,
                last_autovacuum::text,
                last_analyze::text,
                last_autoanalyze::text
            FROM pg_stat_user_tables 
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        "#;

        let rows = sqlx::query(query).fetch_all(&self.pool).await?;
        let mut table_stats = Vec::new();

        for row in rows {
            table_stats.push(TableStats {
                table_name: row.get("table_name"),
                row_count: row.get("row_count"),
                table_size: row.get("table_size"),
                index_size: row.get("index_size"),
                total_size: row.get("total_size"),
                last_vacuum: row.get("last_vacuum"),
                last_analyze: row.get("last_analyze"),
            });
        }

        Ok(table_stats)
    }

    /// Get connection statistics
    async fn get_connection_stats(&self) -> Result<ConnectionStats, sqlx::Error> {
        let query = r#"
            SELECT 
                COUNT(*) FILTER (WHERE state = 'active') as active_connections,
                COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
                (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
            FROM pg_stat_activity
        "#;

        let row = sqlx::query(query).fetch_one(&self.pool).await?;
        let active_connections: i64 = row.get("active_connections");
        let idle_connections: i64 = row.get("idle_connections");
        let max_connections: i64 = row.get("max_connections");

        let connection_utilization = (active_connections as f64 / max_connections as f64) * 100.0;

        Ok(ConnectionStats {
            active_connections,
            idle_connections,
            max_connections,
            connection_utilization,
        })
    }

    /// Get optimization recommendations
    pub async fn get_optimization_recommendations(&self) -> Result<Vec<OptimizationRecommendation>, sqlx::Error> {
        let mut recommendations = Vec::new();

        // Check cache hit ratio
        let cache_hit_ratio = self.get_cache_hit_ratio().await?;
        if cache_hit_ratio < 90.0 {
            recommendations.push(OptimizationRecommendation {
                category: "Performance".to_string(),
                priority: "High".to_string(),
                description: format!("Cache hit ratio is {:.2}%, should be above 90%", cache_hit_ratio),
                impact: "Low cache hit ratio can cause slow queries".to_string(),
                sql_command: Some("Consider increasing shared_buffers in postgresql.conf".to_string()),
            });
        }

        // Check for unused indexes
        let unused_indexes = self.get_unused_indexes().await?;
        for index in unused_indexes.iter().take(5) {
            recommendations.push(OptimizationRecommendation {
                category: "Indexes".to_string(),
                priority: "Medium".to_string(),
                description: format!("Unused index '{}' on table '{}'", index.index_name, index.table_name),
                impact: format!("Index uses {} of storage space", index.index_size),
                sql_command: Some(format!("DROP INDEX IF EXISTS {}", index.index_name)),
            });
        }

        // Check for slow queries
        let slow_queries = self.get_slow_queries().await?;
        for query in slow_queries.iter().take(3) {
            recommendations.push(OptimizationRecommendation {
                category: "Queries".to_string(),
                priority: "High".to_string(),
                description: format!("Slow query with {:.2}ms average execution time", query.execution_time_ms),
                impact: "Slow queries affect user experience".to_string(),
                sql_command: Some("Consider adding indexes or optimizing the query".to_string()),
            });
        }

        // Check table statistics
        let table_stats = self.get_table_stats().await?;
        for table in table_stats.iter().take(3) {
            if table.last_vacuum.is_none() && table.last_analyze.is_none() {
                recommendations.push(OptimizationRecommendation {
                    category: "Maintenance".to_string(),
                    priority: "Medium".to_string(),
                    description: format!("Table '{}' has never been vacuumed or analyzed", table.table_name),
                    impact: "Outdated statistics can lead to poor query plans".to_string(),
                    sql_command: Some(format!("VACUUM ANALYZE {}", table.table_name)),
                });
            }
        }

        Ok(recommendations)
    }

    /// Optimize database by running maintenance tasks
    pub async fn optimize_database(&self) -> Result<(), sqlx::Error> {
        info!("🔧 Starting database optimization...");

        // Update table statistics
        let update_stats_query = "ANALYZE";
        sqlx::query(update_stats_query).execute(&self.pool).await?;
        info!("✅ Updated table statistics");

        // Vacuum tables
        let vacuum_query = "VACUUM";
        sqlx::query(vacuum_query).execute(&self.pool).await?;
        info!("✅ Vacuumed tables");

        // Reindex if needed
        let reindex_query = "REINDEX DATABASE";
        sqlx::query(reindex_query).execute(&self.pool).await?;
        info!("✅ Reindexed database");

        info!("✅ Database optimization completed");
        Ok(())
    }

    /// Create database partitions for large tables
    pub async fn create_partitions(&self) -> Result<(), sqlx::Error> {
        info!("🔧 Creating database partitions...");

        // Create partitioned tables for time-series data
        let partitions = vec![
            // Partition audit_logs by month
            r#"
                CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
                    LIKE audit_logs INCLUDING ALL
                ) PARTITION BY RANGE (timestamp);
            "#,
            // Partition notifications by month
            r#"
                CREATE TABLE IF NOT EXISTS notifications_partitioned (
                    LIKE notifications INCLUDING ALL
                ) PARTITION BY RANGE (created_at);
            "#,
        ];

        for partition_sql in partitions {
            match sqlx::query(partition_sql).execute(&self.pool).await {
                Ok(_) => debug!("✅ Created partition"),
                Err(e) => warn!("⚠️ Failed to create partition: {}", e),
            }
        }

        info!("✅ Database partitioning completed");
        Ok(())
    }

    /// Monitor query performance
    pub async fn monitor_query_performance(&self, query: &str) -> Result<QueryStats, sqlx::Error> {
        let start_time = SystemTime::now();
        
        let result = sqlx::query(query).fetch_all(&self.pool).await?;
        
        let execution_time = start_time.elapsed().unwrap_or_default();
        let execution_time_ms = execution_time.as_millis() as f64;

        Ok(QueryStats {
            query: query.to_string(),
            execution_time_ms,
            rows_returned: result.len() as i64,
            cache_hit_ratio: 0.0, // Would need pg_stat_statements for this
            calls: 1,
            total_time_ms: execution_time_ms,
        })
    }

    /// Get database health status
    pub async fn get_database_health(&self) -> Result<HashMap<String, String>, sqlx::Error> {
        let mut health = HashMap::new();

        // Check database connectivity
        let connectivity_query = "SELECT 1";
        match sqlx::query(connectivity_query).fetch_one(&self.pool).await {
            Ok(_) => health.insert("connectivity".to_string(), "OK".to_string()),
            Err(_) => health.insert("connectivity".to_string(), "FAILED".to_string()),
        }

        // Check cache hit ratio
        let cache_hit_ratio = self.get_cache_hit_ratio().await?;
        health.insert("cache_hit_ratio".to_string(), format!("{:.2}%", cache_hit_ratio));

        // Check connection count
        let connection_stats = self.get_connection_stats().await?;
        health.insert("active_connections".to_string(), connection_stats.active_connections.to_string());
        health.insert("connection_utilization".to_string(), format!("{:.2}%", connection_stats.connection_utilization));

        // Check for locks
        let locks_query = r#"
            SELECT COUNT(*) as lock_count
            FROM pg_locks
            WHERE NOT granted
        "#;
        let locks_row = sqlx::query(locks_query).fetch_one(&self.pool).await?;
        let lock_count: i64 = locks_row.get("lock_count");
        health.insert("blocking_locks".to_string(), lock_count.to_string());

        Ok(health)
    }
}

// Query optimization utilities
pub struct QueryOptimizer;

impl QueryOptimizer {
    /// Optimize patient search queries
    pub fn optimize_patient_search_query(base_query: &str, search_term: &str) -> String {
        if search_term.is_empty() {
            return base_query.to_string();
        }

        // Use full-text search for better performance
        format!(
            "{} AND to_tsvector('english', first_name || ' ' || last_name) @@ plainto_tsquery('english', '{}')",
            base_query, search_term
        )
    }

    /// Optimize appointment queries with date ranges
    pub fn optimize_appointment_date_query(base_query: &str, start_date: &str, end_date: &str) -> String {
        format!(
            "{} AND appointment_date BETWEEN '{}' AND '{}'",
            base_query, start_date, end_date
        )
    }

    /// Optimize medicine stock queries
    pub fn optimize_medicine_stock_query(base_query: &str, low_stock_only: bool) -> String {
        if low_stock_only {
            format!("{} AND stock_quantity <= reorder_level", base_query)
        } else {
            base_query.to_string()
        }
    }

    /// Add pagination to queries
    pub fn add_pagination(query: &str, page: u32, limit: u32) -> String {
        let offset = page * limit;
        format!("{} LIMIT {} OFFSET {}", query, limit, offset)
    }

    /// Add ordering to queries
    pub fn add_ordering(query: &str, order_by: &str, direction: &str) -> String {
        let dir = if direction.to_lowercase() == "desc" { "DESC" } else { "ASC" };
        format!("{} ORDER BY {} {}", query, order_by, dir)
    }
}

// Database connection pool optimization
pub struct ConnectionPoolOptimizer;

impl ConnectionPoolOptimizer {
    /// Get optimal connection pool settings
    pub fn get_optimal_pool_settings() -> HashMap<String, String> {
        let mut settings = HashMap::new();
        
        // Based on typical clinic management system requirements
        settings.insert("max_connections".to_string(), "20".to_string());
        settings.insert("min_connections".to_string(), "5".to_string());
        settings.insert("max_lifetime".to_string(), "1800".to_string()); // 30 minutes
        settings.insert("idle_timeout".to_string(), "600".to_string()); // 10 minutes
        settings.insert("acquire_timeout".to_string(), "30".to_string()); // 30 seconds
        
        settings
    }

    /// Monitor connection pool health
    pub async fn monitor_pool_health(pool: &PgPool) -> Result<HashMap<String, String>, sqlx::Error> {
        let mut health = HashMap::new();
        
        // Get connection count
        let connection_query = r#"
            SELECT COUNT(*) as connection_count
            FROM pg_stat_activity
            WHERE state = 'active'
        "#;
        let connection_row = sqlx::query(connection_query).fetch_one(pool).await?;
        let connection_count: i64 = connection_row.get("connection_count");
        
        health.insert("active_connections".to_string(), connection_count.to_string());
        
        // Test connection
        let start_time = SystemTime::now();
        let _ = sqlx::query("SELECT 1").fetch_one(pool).await?;
        let response_time = start_time.elapsed().unwrap_or_default();
        
        health.insert("response_time_ms".to_string(), response_time.as_millis().to_string());
        
        Ok(health)
    }
}