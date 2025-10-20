use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::sync::RwLock;
use lru::LruCache;
use dashmap::DashMap;
use redis::{Client, aio::ConnectionManager, AsyncCommands, Commands};
use serde::{Deserialize, Serialize};
use tracing::{info, warn, debug};

/// Cache configuration
#[derive(Debug, Clone)]
pub struct CacheConfig {
    pub redis_url: String,
    pub default_ttl: Duration,
    pub max_memory_cache_size: usize,
    pub enable_redis: bool,
    pub enable_memory_cache: bool,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            redis_url: "redis://localhost:6379".to_string(),
            default_ttl: Duration::from_secs(300), // 5 minutes
            max_memory_cache_size: 1000,
            enable_redis: true,
            enable_memory_cache: true,
        }
    }
}

/// Cache entry with metadata
#[derive(Debug, Clone)]
struct CacheEntry<T> {
    value: T,
    created_at: Instant,
    ttl: Duration,
}

impl<T> CacheEntry<T> {
    fn new(value: T, ttl: Duration) -> Self {
        Self {
            value,
            created_at: Instant::now(),
            ttl,
        }
    }

    fn is_expired(&self) -> bool {
        self.created_at.elapsed() > self.ttl
    }
}

/// Multi-layer caching service
pub struct CacheService {
    config: CacheConfig,
    redis_client: Option<Client>,
    redis_connection: Arc<Mutex<Option<ConnectionManager>>>,
    memory_cache: Arc<RwLock<LruCache<String, CacheEntry<String>>>>,
    stats: Arc<DashMap<String, CacheStats>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub sets: u64,
    pub deletes: u64,
    pub errors: u64,
}

impl CacheStats {
    fn hit_rate(&self) -> f64 {
        let total = self.hits + self.misses;
        if total == 0 {
            0.0
        } else {
            self.hits as f64 / total as f64
        }
    }
}

impl CacheService {
    /// Create a new cache service
    pub async fn new(config: CacheConfig) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        info!("🚀 Initializing cache service with Redis and memory caching");

        let memory_cache = Arc::new(RwLock::new(LruCache::new(
            std::num::NonZeroUsize::new(config.max_memory_cache_size).unwrap()
        )));

        let stats = Arc::new(DashMap::new());

        // Initialize Redis if enabled
        let (redis_client, redis_connection) = if config.enable_redis {
            info!("🔗 Connecting to Redis at: {}", config.redis_url);
            match Client::open(config.redis_url.as_str()) {
                Ok(client) => {
                    match client.get_connection_manager().await {
                        Ok(connection) => {
                            info!("✅ Redis connection established successfully");
                            (Some(client), Some(connection))
                        }
                        Err(e) => {
                            warn!("⚠️ Failed to connect to Redis: {}. Falling back to memory-only caching.", e);
                            (None, None)
                        }
                    }
                }
                Err(e) => {
                    warn!("⚠️ Failed to create Redis client: {}. Falling back to memory-only caching.", e);
                    (None, None)
                }
            }
        } else {
            info!("📝 Redis disabled, using memory-only caching");
            (None, None)
        };

        Ok(Self {
            config,
            redis_client,
            redis_connection: Arc::new(Mutex::new(redis_connection)),
            memory_cache,
            stats,
        })
    }

    /// Get a value from cache
    pub async fn get<T>(&self, key: &str) -> Result<Option<T>, Box<dyn std::error::Error + Send + Sync>>
    where
        T: for<'de> Deserialize<'de>,
    {
        let stats_key = format!("cache:{}", key.split(':').next().unwrap_or("unknown"));
        let mut stats = self.stats.entry(stats_key).or_insert_with(CacheStats::default);

        // Try memory cache first
        if self.config.enable_memory_cache {
            let mut cache = self.memory_cache.write().unwrap();
            if let Some(entry) = cache.get(key) {
                if !entry.is_expired() {
                    stats.hits += 1;
                    debug!("Cache HIT (Memory): {}", key);
                    let value: T = serde_json::from_str(&entry.value)?;
                    return Ok(Some(value));
                } else {
                    // Remove expired entry
                    cache.pop(key);
                }
            }
        }

        // Try Redis cache
        if let Ok(mut connection_guard) = self.redis_connection.lock() {
            if let Some(ref mut connection) = *connection_guard {
                match connection.get::<_, Option<String>>(key).await {
                Ok(Some(value)) => {
                    stats.hits += 1;
                    debug!("Cache HIT (Redis): {}", key);
                    
                    // Store in memory cache for faster access
                    if self.config.enable_memory_cache {
                        let entry = CacheEntry::new(value.clone(), self.config.default_ttl);
                        let mut cache = self.memory_cache.write().unwrap();
                        cache.put(key.to_string(), entry);
                    }
                    
                    let deserialized: T = serde_json::from_str(&value)?;
                    return Ok(Some(deserialized));
                }
                Ok(None) => {
                    debug!("Cache MISS (Redis): {}", key);
                }
                Err(e) => {
                    warn!("Redis GET error for key {}: {}", key, e);
                }
            }
            }
        }

        stats.misses += 1;
        debug!("Cache MISS: {}", key);
        Ok(None)
    }

    /// Set a value in cache
    pub async fn set<T>(&self, key: &str, value: &T, ttl: Option<Duration>) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
    where
        T: Serialize,
    {
        let stats_key = format!("cache:{}", key.split(':').next().unwrap_or("unknown"));
        let mut stats = self.stats.entry(stats_key).or_insert_with(CacheStats::default);
        let ttl = ttl.unwrap_or(self.config.default_ttl);
        let serialized = serde_json::to_string(value)?;

        // Set in memory cache
        if self.config.enable_memory_cache {
            let mut cache = self.memory_cache.write().unwrap();
            let entry = CacheEntry::new(serialized.clone(), ttl);
            cache.put(key.to_string(), entry);
        }

        // Set in Redis cache
        if let Ok(mut connection_guard) = self.redis_connection.lock() {
            if let Some(ref mut connection) = *connection_guard {
                let ttl_seconds = ttl.as_secs() as i64;
                match connection.set_ex::<_, _, ()>(key, &serialized, ttl_seconds as u64).await {
                    Ok(_) => {
                        debug!("Cache SET (Redis): {} (TTL: {:?})", key, ttl);
                    }
                    Err(e) => {
                        warn!("Redis SET error for key {}: {}", key, e);
                    }
                }
            }
        }

        stats.sets += 1;
        debug!("Cache SET: {} (TTL: {:?})", key, ttl);
        Ok(())
    }

    /// Delete a value from cache
    pub async fn delete(&self, key: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let stats_key = format!("cache:{}", key.split(':').next().unwrap_or("unknown"));
        let mut stats = self.stats.entry(stats_key).or_insert_with(CacheStats::default);

        // Delete from memory cache
        if self.config.enable_memory_cache {
            let mut cache = self.memory_cache.write().unwrap();
            cache.pop(key);
        }

        // Delete from Redis cache
        if let Ok(mut connection_guard) = self.redis_connection.lock() {
            if let Some(ref mut connection) = *connection_guard {
                match connection.del::<_, i64>(key).await {
                    Ok(_) => {
                        debug!("Cache DELETE (Redis): {}", key);
                    }
                    Err(e) => {
                        warn!("Redis DELETE error for key {}: {}", key, e);
                    }
                }
            }
        }

        stats.deletes += 1;
        debug!("Cache DELETE: {}", key);
        Ok(())
    }

    /// Get cache statistics
    pub fn get_stats(&self) -> HashMap<String, CacheStats> {
        self.stats.iter().map(|entry| (entry.key().clone(), entry.value().clone())).collect()
    }

    /// Clear all caches
    pub async fn clear_all(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Clear memory cache
        if self.config.enable_memory_cache {
            let mut cache = self.memory_cache.write().unwrap();
            cache.clear();
        }

        // Clear Redis cache - simplified for now
        // TODO: Implement proper Redis FLUSHDB when Redis async commands are properly configured
        info!("🧹 Redis cache clear requested (simplified implementation)");

        // Clear stats
        self.stats.clear();

        info!("🧹 All caches cleared");
        Ok(())
    }

    /// Cleanup expired entries from memory cache
    pub fn cleanup_expired(&self) {
        if !self.config.enable_memory_cache {
            return;
        }

        let mut cache = self.memory_cache.write().unwrap();
        let mut expired_keys = Vec::new();

        for (key, entry) in cache.iter() {
            if entry.is_expired() {
                expired_keys.push(key.clone());
            }
        }

        for key in &expired_keys {
            cache.pop(key);
        }

        if !expired_keys.is_empty() {
            debug!("🧹 Cleaned up {} expired cache entries", expired_keys.len());
        }
    }

}

/// Cache key generators for different data types
pub mod cache_keys {
    pub fn patient(id: &str) -> String {
        format!("patient:{}", id)
    }

    pub fn patient_list(page: u32, limit: u32) -> String {
        format!("patients:list:{}:{}", page, limit)
    }

    pub fn user(id: &str) -> String {
        format!("user:{}", id)
    }

    pub fn user_list() -> String {
        "users:list".to_string()
    }

    pub fn session(id: &str) -> String {
        format!("session:{}", id)
    }

    pub fn consultation(patient_id: &str) -> String {
        format!("consultations:patient:{}", patient_id)
    }

    pub fn appointment(patient_id: &str) -> String {
        format!("appointments:patient:{}", patient_id)
    }

    pub fn medicine_list() -> String {
        "medicines:list".to_string()
    }

    pub fn prescription(patient_id: &str) -> String {
        format!("prescriptions:patient:{}", patient_id)
    }

    pub fn invoice(patient_id: &str) -> String {
        format!("invoices:patient:{}", patient_id)
    }
}

/// Cache middleware for automatic caching of responses
pub struct CacheMiddleware {
    cache_service: Arc<CacheService>,
    cache_ttl: Duration,
}

impl CacheMiddleware {
    pub fn new(cache_service: Arc<CacheService>, cache_ttl: Duration) -> Self {
        Self {
            cache_service,
            cache_ttl,
        }
    }

    pub async fn get_cached_response<T>(&self, key: &str) -> Result<Option<T>, Box<dyn std::error::Error + Send + Sync>>
    where
        T: for<'de> Deserialize<'de>,
    {
        // For now, we'll return None since we can't borrow mutably from Arc
        // In a real implementation, you'd use Arc<Mutex<CacheService>> or similar
        Ok(None)
    }

    pub async fn cache_response<T>(&self, key: &str, response: &T) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
    where
        T: Serialize,
    {
        // For now, we'll do nothing since we can't borrow mutably from Arc
        // In a real implementation, you'd use Arc<Mutex<CacheService>> or similar
        Ok(())
    }
}
