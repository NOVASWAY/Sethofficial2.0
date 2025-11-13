use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tracing::{info, warn, debug, error};

use crate::error::ApiError;

// Cache entry with expiration
#[derive(Debug, Clone)]
pub struct CacheEntry<T> {
    pub data: T,
    pub expires_at: u64,
    pub created_at: u64,
}

impl<T> CacheEntry<T> {
    pub fn new(data: T, ttl_seconds: u64) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        Self {
            data,
            expires_at: now + ttl_seconds,
            created_at: now,
        }
    }

    pub fn is_expired(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        now > self.expires_at
    }
}

// Cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub total_entries: usize,
    pub memory_usage_bytes: usize,
    pub hit_ratio: f64,
}

// Cache configuration
#[derive(Debug, Clone)]
pub struct CacheConfig {
    pub default_ttl_seconds: u64,
    pub max_entries: usize,
    pub cleanup_interval_seconds: u64,
    pub enable_compression: bool,
    pub enable_statistics: bool,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            default_ttl_seconds: 300, // 5 minutes
            max_entries: 10000,
            cleanup_interval_seconds: 60, // 1 minute
            enable_compression: false,
            enable_statistics: true,
        }
    }
}

// In-memory cache implementation
pub struct MemoryCache<T> {
    data: Arc<RwLock<HashMap<String, CacheEntry<T>>>>,
    config: CacheConfig,
    stats: Arc<RwLock<CacheStats>>,
}

impl<T: Clone + Send + Sync + 'static> MemoryCache<T> {
    pub fn new(config: CacheConfig) -> Self {
        let cache = Self {
            data: Arc::new(RwLock::new(HashMap::new())),
            config: config.clone(),
            stats: Arc::new(RwLock::new(CacheStats {
                hits: 0,
                misses: 0,
                evictions: 0,
                total_entries: 0,
                memory_usage_bytes: 0,
                hit_ratio: 0.0,
            })),
        };

        // Start cleanup task
        if config.cleanup_interval_seconds > 0 {
            cache.start_cleanup_task();
        }

        cache
    }

    pub async fn get(&self, key: &str) -> Option<T> {
        let mut data = self.data.write().await;
        let mut stats = self.stats.write().await;

        if let Some(entry) = data.get(key) {
            if entry.is_expired() {
                data.remove(key);
                stats.misses += 1;
                stats.total_entries = data.len();
                return None;
            }

            stats.hits += 1;
            stats.total_entries = data.len();
            stats.hit_ratio = stats.hits as f64 / (stats.hits + stats.misses) as f64;
            return Some(entry.data.clone());
        }

        stats.misses += 1;
        stats.hit_ratio = stats.hits as f64 / (stats.hits + stats.misses) as f64;
        None
    }

    pub async fn set(&self, key: String, value: T, ttl_seconds: Option<u64>) -> Result<(), ApiError> {
        let ttl = ttl_seconds.unwrap_or(self.config.default_ttl_seconds);
        let entry = CacheEntry::new(value, ttl);

        let mut data = self.data.write().await;
        let mut stats = self.stats.write().await;

        // Check if we need to evict entries
        if data.len() >= self.config.max_entries {
            self.evict_oldest_entries(&mut data, &mut stats).await;
        }

        data.insert(key, entry);
        stats.total_entries = data.len();
        Ok(())
    }

    pub async fn delete(&self, key: &str) -> bool {
        let mut data = self.data.write().await;
        let mut stats = self.stats.write().await;

        if data.remove(key).is_some() {
            stats.total_entries = data.len();
            true
        } else {
            false
        }
    }

    pub async fn clear(&self) {
        let mut data = self.data.write().await;
        let mut stats = self.stats.write().await;

        data.clear();
        stats.total_entries = 0;
    }

    pub async fn exists(&self, key: &str) -> bool {
        let data = self.data.read().await;
        if let Some(entry) = data.get(key) {
            !entry.is_expired()
        } else {
            false
        }
    }

    pub async fn get_stats(&self) -> CacheStats {
        let stats = self.stats.read().await;
        stats.clone()
    }

    async fn evict_oldest_entries(&self, data: &mut HashMap<String, CacheEntry<T>>, stats: &mut CacheStats) {
        // Remove expired entries first
        data.retain(|_, entry| !entry.is_expired());

        // If still over limit, remove oldest entries
        if data.len() >= self.config.max_entries {
            let mut entries: Vec<_> = data.iter().collect();
            entries.sort_by_key(|(_, entry)| entry.created_at);

            let to_remove = data.len() - self.config.max_entries + 1;
            for (key, _) in entries.iter().take(to_remove) {
                data.remove(*key);
                stats.evictions += 1;
            }
        }
    }

    fn start_cleanup_task(&self) {
        let data = Arc::clone(&self.data);
        let stats = Arc::clone(&self.stats);
        let interval = self.config.cleanup_interval_seconds;

        tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(Duration::from_secs(interval));
            
            loop {
                interval_timer.tick().await;
                
                let mut data_guard = data.write().await;
                let mut stats_guard = stats.write().await;
                
                let initial_count = data_guard.len();
                data_guard.retain(|_, entry| !entry.is_expired());
                let removed_count = initial_count - data_guard.len();
                
                if removed_count > 0 {
                    debug!("Cache cleanup: removed {} expired entries", removed_count);
                    stats_guard.total_entries = data_guard.len();
                }
            }
        });
    }
}

// Cache key generators
pub struct CacheKeys;

impl CacheKeys {
    pub fn patient(id: &str) -> String {
        format!("patient:{}", id)
    }

    pub fn patient_list(page: u32, limit: u32, search: Option<&str>) -> String {
        match search {
            Some(s) => format!("patients:list:{}:{}:{}", page, limit, s),
            None => format!("patients:list:{}:{}", page, limit),
        }
    }

    pub fn user(id: &str) -> String {
        format!("user:{}", id)
    }

    pub fn user_by_username(username: &str) -> String {
        format!("user:username:{}", username)
    }

    pub fn appointment(id: &str) -> String {
        format!("appointment:{}", id)
    }

    pub fn appointments_by_date(date: &str) -> String {
        format!("appointments:date:{}", date)
    }

    pub fn appointments_by_patient(patient_id: &str) -> String {
        format!("appointments:patient:{}", patient_id)
    }

    pub fn medicine(id: &str) -> String {
        format!("medicine:{}", id)
    }

    pub fn medicine_list(page: u32, limit: u32, category: Option<&str>) -> String {
        match category {
            Some(c) => format!("medicines:list:{}:{}:{}", page, limit, c),
            None => format!("medicines:list:{}:{}", page, limit),
        }
    }

    pub fn prescription(id: &str) -> String {
        format!("prescription:{}", id)
    }

    pub fn prescriptions_by_patient(patient_id: &str) -> String {
        format!("prescriptions:patient:{}", patient_id)
    }

    pub fn invoice(id: &str) -> String {
        format!("invoice:{}", id)
    }

    pub fn invoices_by_patient(patient_id: &str) -> String {
        format!("invoices:patient:{}", patient_id)
    }

    pub fn system_settings() -> String {
        "system:settings".to_string()
    }

    pub fn user_settings(user_id: &str) -> String {
        format!("user:settings:{}", user_id)
    }

    pub fn dashboard_stats(date: &str) -> String {
        format!("dashboard:stats:{}", date)
    }

    pub fn reports_summary(period: &str, report_type: &str) -> String {
        format!("reports:{}:{}", report_type, period)
    }
}

// Cache service for different data types
pub struct CacheService {
    pub patients: MemoryCache<serde_json::Value>,
    pub users: MemoryCache<serde_json::Value>,
    pub appointments: MemoryCache<serde_json::Value>,
    pub medicines: MemoryCache<serde_json::Value>,
    pub prescriptions: MemoryCache<serde_json::Value>,
    pub invoices: MemoryCache<serde_json::Value>,
    pub settings: MemoryCache<serde_json::Value>,
    pub reports: MemoryCache<serde_json::Value>,
}

impl CacheService {
    pub fn new() -> Self {
        let config = CacheConfig::default();
        
        Self {
            patients: MemoryCache::new(CacheConfig {
                default_ttl_seconds: 300, // 5 minutes
                max_entries: 1000,
                ..config.clone()
            }),
            users: MemoryCache::new(CacheConfig {
                default_ttl_seconds: 600, // 10 minutes
                max_entries: 500,
                ..config.clone()
            }),
            appointments: MemoryCache::new(CacheConfig {
                default_ttl_seconds: 180, // 3 minutes
                max_entries: 2000,
                ..config.clone()
            }),
            medicines: MemoryCache::new(CacheConfig {
                default_ttl_seconds: 900, // 15 minutes
                max_entries: 1000,
                ..config.clone()
            }),
            prescriptions: MemoryCache::new(CacheConfig {
                default_ttl_seconds: 300, // 5 minutes
                max_entries: 1000,
                ..config.clone()
            }),
            invoices: MemoryCache::new(CacheConfig {
                default_ttl_seconds: 600, // 10 minutes
                max_entries: 1000,
                ..config.clone()
            }),
            settings: MemoryCache::new(CacheConfig {
                default_ttl_seconds: 1800, // 30 minutes
                max_entries: 100,
                ..config.clone()
            }),
            reports: MemoryCache::new(CacheConfig {
                default_ttl_seconds: 3600, // 1 hour
                max_entries: 100,
                ..config.clone()
            }),
        }
    }

    // Patient cache operations
    pub async fn get_patient(&self, id: &str) -> Option<serde_json::Value> {
        self.patients.get(&CacheKeys::patient(id)).await
    }

    pub async fn set_patient(&self, id: &str, patient: serde_json::Value) -> Result<(), ApiError> {
        self.patients.set(CacheKeys::patient(id), patient, None).await
    }

    pub async fn delete_patient(&self, id: &str) -> bool {
        self.patients.delete(&CacheKeys::patient(id)).await
    }

    pub async fn get_patient_list(&self, page: u32, limit: u32, search: Option<&str>) -> Option<serde_json::Value> {
        self.patients.get(&CacheKeys::patient_list(page, limit, search)).await
    }

    pub async fn set_patient_list(&self, page: u32, limit: u32, search: Option<&str>, patients: serde_json::Value) -> Result<(), ApiError> {
        self.patients.set(CacheKeys::patient_list(page, limit, search), patients, None).await
    }

    // User cache operations
    pub async fn get_user(&self, id: &str) -> Option<serde_json::Value> {
        self.users.get(&CacheKeys::user(id)).await
    }

    pub async fn set_user(&self, id: &str, user: serde_json::Value) -> Result<(), ApiError> {
        self.users.set(CacheKeys::user(id), user, None).await
    }

    pub async fn get_user_by_username(&self, username: &str) -> Option<serde_json::Value> {
        self.users.get(&CacheKeys::user_by_username(username)).await
    }

    pub async fn set_user_by_username(&self, username: &str, user: serde_json::Value) -> Result<(), ApiError> {
        self.users.set(CacheKeys::user_by_username(username), user, None).await
    }

    // Appointment cache operations
    pub async fn get_appointment(&self, id: &str) -> Option<serde_json::Value> {
        self.appointments.get(&CacheKeys::appointment(id)).await
    }

    pub async fn set_appointment(&self, id: &str, appointment: serde_json::Value) -> Result<(), ApiError> {
        self.appointments.set(CacheKeys::appointment(id), appointment, None).await
    }

    pub async fn get_appointments_by_date(&self, date: &str) -> Option<serde_json::Value> {
        self.appointments.get(&CacheKeys::appointments_by_date(date)).await
    }

    pub async fn set_appointments_by_date(&self, date: &str, appointments: serde_json::Value) -> Result<(), ApiError> {
        self.appointments.set(CacheKeys::appointments_by_date(date), appointments, None).await
    }

    // Medicine cache operations
    pub async fn get_medicine(&self, id: &str) -> Option<serde_json::Value> {
        self.medicines.get(&CacheKeys::medicine(id)).await
    }

    pub async fn set_medicine(&self, id: &str, medicine: serde_json::Value) -> Result<(), ApiError> {
        self.medicines.set(CacheKeys::medicine(id), medicine, None).await
    }

    pub async fn get_medicine_list(&self, page: u32, limit: u32, category: Option<&str>) -> Option<serde_json::Value> {
        self.medicines.get(&CacheKeys::medicine_list(page, limit, category)).await
    }

    pub async fn set_medicine_list(&self, page: u32, limit: u32, category: Option<&str>, medicines: serde_json::Value) -> Result<(), ApiError> {
        self.medicines.set(CacheKeys::medicine_list(page, limit, category), medicines, None).await
    }

    // Settings cache operations
    pub async fn get_system_settings(&self) -> Option<serde_json::Value> {
        self.settings.get(&CacheKeys::system_settings()).await
    }

    pub async fn set_system_settings(&self, settings: serde_json::Value) -> Result<(), ApiError> {
        self.settings.set(CacheKeys::system_settings(), settings, None).await
    }

    pub async fn get_user_settings(&self, user_id: &str) -> Option<serde_json::Value> {
        self.settings.get(&CacheKeys::user_settings(user_id)).await
    }

    pub async fn set_user_settings(&self, user_id: &str, settings: serde_json::Value) -> Result<(), ApiError> {
        self.settings.set(CacheKeys::user_settings(user_id), settings, None).await
    }

    // Dashboard cache operations
    pub async fn get_dashboard_stats(&self, date: &str) -> Option<serde_json::Value> {
        self.reports.get(&CacheKeys::dashboard_stats(date)).await
    }

    pub async fn set_dashboard_stats(&self, date: &str, stats: serde_json::Value) -> Result<(), ApiError> {
        self.reports.set(CacheKeys::dashboard_stats(date), stats, None).await
    }

    // Clear all caches
    pub async fn clear_all(&self) {
        self.patients.clear().await;
        self.users.clear().await;
        self.appointments.clear().await;
        self.medicines.clear().await;
        self.prescriptions.clear().await;
        self.invoices.clear().await;
        self.settings.clear().await;
        self.reports.clear().await;
    }

    // Get cache statistics
    pub async fn get_all_stats(&self) -> HashMap<String, CacheStats> {
        let mut stats = HashMap::new();
        stats.insert("patients".to_string(), self.patients.get_stats().await);
        stats.insert("users".to_string(), self.users.get_stats().await);
        stats.insert("appointments".to_string(), self.appointments.get_stats().await);
        stats.insert("medicines".to_string(), self.medicines.get_stats().await);
        stats.insert("prescriptions".to_string(), self.prescriptions.get_stats().await);
        stats.insert("invoices".to_string(), self.invoices.get_stats().await);
        stats.insert("settings".to_string(), self.settings.get_stats().await);
        stats.insert("reports".to_string(), self.reports.get_stats().await);
        stats
    }
}

// Cache middleware for automatic caching
pub struct CacheMiddleware {
    cache_service: Arc<CacheService>,
}

impl CacheMiddleware {
    pub fn new(cache_service: Arc<CacheService>) -> Self {
        Self { cache_service }
    }

    pub async fn cache_get<T, F, Fut>(&self, key: &str, cache: &MemoryCache<T>, fetch_fn: F) -> Result<T, ApiError>
    where
        T: Clone + Send + Sync + 'static,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T, ApiError>>,
    {
        if let Some(cached) = cache.get(key).await {
            return Ok(cached);
        }

        let result = fetch_fn().await?;
        cache.set(key.to_string(), result.clone(), None).await?;
        Ok(result)
    }
}

// Query optimization utilities
pub struct QueryOptimizer;

impl QueryOptimizer {
    // Optimize patient queries
    pub fn optimize_patient_query(query: &str, filters: &HashMap<String, String>) -> String {
        let mut optimized_query = query.to_string();
        
        // Add appropriate WHERE clauses based on filters
        if let Some(search) = filters.get("search") {
            if !search.is_empty() {
                optimized_query = format!(
                    "{} AND (first_name ILIKE '%{}%' OR last_name ILIKE '%{}%' OR phone ILIKE '%{}%')",
                    optimized_query, search, search, search
                );
            }
        }

        if let Some(role) = filters.get("role") {
            if !role.is_empty() {
                optimized_query = format!("{} AND role = '{}'", optimized_query, role);
            }
        }

        // Add ORDER BY for consistent results
        if !optimized_query.contains("ORDER BY") {
            optimized_query = format!("{} ORDER BY created_at DESC", optimized_query);
        }

        optimized_query
    }

    // Optimize appointment queries
    pub fn optimize_appointment_query(query: &str, filters: &HashMap<String, String>) -> String {
        let mut optimized_query = query.to_string();
        
        if let Some(date) = filters.get("date") {
            if !date.is_empty() {
                optimized_query = format!("{} AND DATE(appointment_date) = '{}'", optimized_query, date);
            }
        }

        if let Some(status) = filters.get("status") {
            if !status.is_empty() {
                optimized_query = format!("{} AND status = '{}'", optimized_query, status);
            }
        }

        if let Some(doctor_id) = filters.get("doctor_id") {
            if !doctor_id.is_empty() {
                optimized_query = format!("{} AND doctor_id = '{}'", optimized_query, doctor_id);
            }
        }

        if !optimized_query.contains("ORDER BY") {
            optimized_query = format!("{} ORDER BY appointment_date ASC", optimized_query);
        }

        optimized_query
    }

    // Optimize medicine queries
    pub fn optimize_medicine_query(query: &str, filters: &HashMap<String, String>) -> String {
        let mut optimized_query = query.to_string();
        
        if let Some(category) = filters.get("category") {
            if !category.is_empty() {
                optimized_query = format!("{} AND category = '{}'", optimized_query, category);
            }
        }

        if let Some(search) = filters.get("search") {
            if !search.is_empty() {
                optimized_query = format!(
                    "{} AND (name ILIKE '%{}%' OR description ILIKE '%{}%')",
                    optimized_query, search, search
                );
            }
        }

        if let Some(low_stock) = filters.get("low_stock") {
            if low_stock == "true" {
                optimized_query = format!("{} AND stock_quantity <= reorder_level", optimized_query);
            }
        }

        if !optimized_query.contains("ORDER BY") {
            optimized_query = format!("{} ORDER BY name ASC", optimized_query);
        }

        optimized_query
    }
}
