use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry<T> {
    pub data: T,
    pub created_at: u64,
    pub expires_at: u64,
    pub access_count: u64,
    pub last_accessed: u64,
}

impl<T> CacheEntry<T> {
    pub fn new(data: T, ttl_seconds: u64) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        Self {
            data,
            created_at: now,
            expires_at: now + ttl_seconds,
            access_count: 0,
            last_accessed: now,
        }
    }

    pub fn is_expired(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        now > self.expires_at
    }

    pub fn access(&mut self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        self.access_count += 1;
        self.last_accessed = now;
    }
}

#[derive(Debug, Clone)]
pub struct CacheConfig {
    pub default_ttl: Duration,
    pub max_entries: usize,
    pub cleanup_interval: Duration,
    pub enable_metrics: bool,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            default_ttl: Duration::from_secs(300), // 5 minutes
            max_entries: 1000,
            cleanup_interval: Duration::from_secs(60), // 1 minute
            enable_metrics: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheMetrics {
    pub hits: u64,
    pub misses: u64,
    pub entries: usize,
    pub memory_usage: usize,
    pub evictions: u64,
    pub last_cleanup: u64,
}

pub struct CacheService<T> {
    cache: Arc<RwLock<HashMap<String, CacheEntry<T>>>>,
    config: CacheConfig,
    metrics: Arc<RwLock<CacheMetrics>>,
}

impl<T> CacheService<T>
where
    T: Clone + Send + Sync + 'static,
{
    pub fn new(config: CacheConfig) -> Self {
        let service = Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            config,
            metrics: Arc::new(RwLock::new(CacheMetrics {
                hits: 0,
                misses: 0,
                entries: 0,
                memory_usage: 0,
                evictions: 0,
                last_cleanup: 0,
            })),
        };

        // Start cleanup task
        service.start_cleanup_task();
        service
    }

    pub async fn get(&self, key: &str) -> Option<T> {
        let mut cache = self.cache.write().await;
        let mut metrics = self.metrics.write().await;

        if let Some(entry) = cache.get_mut(key) {
            if entry.is_expired() {
                cache.remove(key);
                metrics.misses += 1;
                metrics.entries = cache.len();
                return None;
            }

            entry.access();
            metrics.hits += 1;
            return Some(entry.data.clone());
        }

        metrics.misses += 1;
        None
    }

    pub async fn set(&self, key: String, value: T, ttl: Option<Duration>) -> Result<(), String> {
        let ttl = ttl.unwrap_or(self.config.default_ttl);
        let ttl_seconds = ttl.as_secs();
        
        let entry = CacheEntry::new(value, ttl_seconds);
        
        let mut cache = self.cache.write().await;
        let mut metrics = self.metrics.write().await;

        // Check if we need to evict entries
        if cache.len() >= self.config.max_entries {
            self.evict_entries(&mut cache, &mut metrics).await;
        }

        cache.insert(key, entry);
        metrics.entries = cache.len();
        
        Ok(())
    }

    pub async fn remove(&self, key: &str) -> Option<T> {
        let mut cache = self.cache.write().await;
        let mut metrics = self.metrics.write().await;

        if let Some(entry) = cache.remove(key) {
            metrics.entries = cache.len();
            return Some(entry.data);
        }
        None
    }

    pub async fn clear(&self) {
        let mut cache = self.cache.write().await;
        let mut metrics = self.metrics.write().await;
        
        cache.clear();
        metrics.entries = 0;
    }

    pub async fn exists(&self, key: &str) -> bool {
        let cache = self.cache.read().await;
        cache.get(key).map_or(false, |entry| !entry.is_expired())
    }

    pub async fn get_metrics(&self) -> CacheMetrics {
        let metrics = self.metrics.read().await;
        let cache = self.cache.read().await;
        
        CacheMetrics {
            hits: metrics.hits,
            misses: metrics.misses,
            entries: cache.len(),
            memory_usage: self.estimate_memory_usage(&cache).await,
            evictions: metrics.evictions,
            last_cleanup: metrics.last_cleanup,
        }
    }

    pub async fn get_or_set<F, Fut>(&self, key: String, f: F, ttl: Option<Duration>) -> Result<T, String>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T, String>>,
    {
        // Try to get from cache first
        if let Some(value) = self.get(&key).await {
            return Ok(value);
        }

        // Generate new value
        let value = f().await?;
        
        // Store in cache
        self.set(key, value.clone(), ttl).await?;
        
        Ok(value)
    }

    async fn evict_entries(&self, cache: &mut HashMap<String, CacheEntry<T>>, metrics: &mut CacheMetrics) {
        // Simple LRU eviction - remove oldest accessed entries
        let mut entries: Vec<_> = cache.iter().collect();
        entries.sort_by_key(|(_, entry)| entry.last_accessed);
        
        let to_remove = entries.len() / 4; // Remove 25% of entries
        for (key, _) in entries.iter().take(to_remove) {
            cache.remove(*key);
            metrics.evictions += 1;
        }
    }

    async fn estimate_memory_usage(&self, cache: &HashMap<String, CacheEntry<T>>) -> usize {
        // Rough estimation - in practice you'd want more accurate measurement
        cache.len() * std::mem::size_of::<CacheEntry<T>>()
    }

    fn start_cleanup_task(&self) {
        let cache = self.cache.clone();
        let metrics = self.metrics.clone();
        let cleanup_interval = self.config.cleanup_interval;

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(cleanup_interval);
            
            loop {
                interval.tick().await;
                
                let mut cache = cache.write().await;
                let mut metrics = metrics.write().await;
                
                let initial_count = cache.len();
                
                // Remove expired entries
                cache.retain(|_, entry| !entry.is_expired());
                
                let removed_count = initial_count - cache.len();
                if removed_count > 0 {
                    metrics.evictions += removed_count as u64;
                }
                
                metrics.entries = cache.len();
                metrics.last_cleanup = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
            }
        });
    }
}

// Specialized cache services for different data types
pub type DashboardCache = CacheService<serde_json::Value>;
pub type UserPreferencesCache = CacheService<serde_json::Value>;
pub type ActivityLogCache = CacheService<Vec<serde_json::Value>>;
pub type ValidationCache = CacheService<serde_json::Value>;

// Cache key generators
pub struct CacheKeys;

impl CacheKeys {
    pub fn dashboard_user_metrics(user_id: &Uuid) -> String {
        format!("dashboard:user:{}", user_id)
    }

    pub fn dashboard_role_metrics(role: &str) -> String {
        format!("dashboard:role:{}", role)
    }

    pub fn dashboard_department_metrics(department: &str) -> String {
        format!("dashboard:department:{}", department)
    }

    pub fn dashboard_system_health() -> String {
        "dashboard:system:health".to_string()
    }

    pub fn user_preferences(user_id: &Uuid) -> String {
        format!("user:preferences:{}", user_id)
    }

    pub fn user_activity(user_id: &Uuid, limit: u32) -> String {
        format!("user:activity:{}:{}", user_id, limit)
    }

    pub fn activity_stats(days: u32) -> String {
        format!("activity:stats:{}", days)
    }

    pub fn filtered_patients(role: &str, department: Option<&str>, page: u32, limit: u32) -> String {
        let dept_key = department.unwrap_or("none");
        format!("patients:filtered:{}:{}:{}:{}", role, dept_key, page, limit)
    }

    pub fn filtered_consultations(role: &str, department: Option<&str>, page: u32, limit: u32) -> String {
        let dept_key = department.unwrap_or("none");
        format!("consultations:filtered:{}:{}:{}:{}", role, dept_key, page, limit)
    }

    pub fn filtered_prescriptions(role: &str, department: Option<&str>, page: u32, limit: u32) -> String {
        let dept_key = department.unwrap_or("none");
        format!("prescriptions:filtered:{}:{}:{}:{}", role, dept_key, page, limit)
    }

    pub fn filtered_invoices(role: &str, department: Option<&str>, page: u32, limit: u32) -> String {
        let dept_key = department.unwrap_or("none");
        format!("invoices:filtered:{}:{}:{}:{}", role, dept_key, page, limit)
    }

    pub fn validation_patient(patient_data_hash: &str) -> String {
        format!("validation:patient:{}", patient_data_hash)
    }

    pub fn validation_user(user_data_hash: &str) -> String {
        format!("validation:user:{}", user_data_hash)
    }

    pub fn duplicate_check_patient(patient_data_hash: &str) -> String {
        format!("duplicate:patient:{}", patient_data_hash)
    }

    pub fn duplicate_check_user(user_data_hash: &str) -> String {
        format!("duplicate:user:{}", user_data_hash)
    }
}

// Cache invalidation patterns
pub struct CacheInvalidator<T> {
    cache: Arc<CacheService<T>>,
}

impl<T> CacheInvalidator<T>
where
    T: Clone + Send + Sync + 'static,
{
    pub fn new(cache: Arc<CacheService<T>>) -> Self {
        Self { cache }
    }

    pub async fn invalidate_pattern(&self, pattern: &str) {
        let mut cache = self.cache.cache.write().await;
        let keys_to_remove: Vec<String> = cache
            .keys()
            .filter(|key| key.contains(pattern))
            .cloned()
            .collect();

        for key in keys_to_remove {
            cache.remove(&key);
        }
    }

    pub async fn invalidate_user_data(&self, user_id: &Uuid) {
        let patterns = vec![
            &CacheKeys::dashboard_user_metrics(user_id),
            &CacheKeys::user_preferences(user_id),
            &format!("user:activity:{}", user_id),
        ];

        for pattern in patterns {
            self.invalidate_pattern(pattern).await;
        }
    }

    pub async fn invalidate_dashboard_data(&self) {
        self.invalidate_pattern("dashboard:").await;
    }

    pub async fn invalidate_activity_data(&self) {
        self.invalidate_pattern("activity:").await;
    }

    pub async fn invalidate_validation_data(&self) {
        self.invalidate_pattern("validation:").await;
        self.invalidate_pattern("duplicate:").await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn test_cache_basic_operations() {
        let cache = CacheService::new(CacheConfig::default());
        
        // Test set and get
        cache.set("key1".to_string(), "value1".to_string(), None).await.unwrap();
        assert_eq!(cache.get("key1").await, Some("value1".to_string()));
        
        // Test non-existent key
        assert_eq!(cache.get("nonexistent").await, None);
        
        // Test remove
        assert_eq!(cache.remove("key1").await, Some("value1".to_string()));
        assert_eq!(cache.get("key1").await, None);
    }

    #[tokio::test]
    async fn test_cache_expiration() {
        let config = CacheConfig {
            default_ttl: Duration::from_millis(100),
            ..Default::default()
        };
        let cache = CacheService::new(config);
        
        cache.set("key1".to_string(), "value1".to_string(), None).await.unwrap();
        assert_eq!(cache.get("key1").await, Some("value1".to_string()));
        
        // Wait for expiration
        tokio::time::sleep(Duration::from_millis(150)).await;
        assert_eq!(cache.get("key1").await, None);
    }

    #[tokio::test]
    async fn test_cache_metrics() {
        let cache = CacheService::new(CacheConfig::default());
        
        // Generate some cache activity
        cache.set("key1".to_string(), "value1".to_string(), None).await.unwrap();
        cache.get("key1").await; // hit
        cache.get("nonexistent").await; // miss
        
        let metrics = cache.get_metrics().await;
        assert_eq!(metrics.hits, 1);
        assert_eq!(metrics.misses, 1);
        assert_eq!(metrics.entries, 1);
    }
}
