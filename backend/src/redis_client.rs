use redis::{Client, aio::ConnectionManager, AsyncCommands, RedisResult};
use std::time::Duration;

#[derive(Clone)]
pub struct RedisClient {
    pub connection_manager: ConnectionManager,
}

impl RedisClient {
    pub async fn new(redis_url: &str) -> RedisResult<Self> {
        let client = Client::open(redis_url)?;
        let connection_manager = ConnectionManager::new(client).await?;
        
        Ok(RedisClient {
            connection_manager,
        })
    }

    pub async fn set(&self, key: &str, value: &str, ttl: Option<Duration>) -> RedisResult<()> {
        let mut conn = self.connection_manager.clone();
        
        if let Some(ttl) = ttl {
            conn.set_ex::<_, _, ()>(key, value, ttl.as_secs() as u64).await?;
        } else {
            conn.set::<_, _, ()>(key, value).await?;
        }
        
        Ok(())
    }

    pub async fn get(&self, key: &str) -> RedisResult<Option<String>> {
        let mut conn = self.connection_manager.clone();
        let result: Option<String> = conn.get(key).await?;
        
        Ok(result)
    }

    pub async fn del(&self, key: &str) -> RedisResult<()> {
        let mut conn = self.connection_manager.clone();
        conn.del::<_, ()>(key).await?;
        
        Ok(())
    }

    pub async fn exists(&self, key: &str) -> RedisResult<bool> {
        let mut conn = self.connection_manager.clone();
        let result: i64 = conn.exists(key).await?;
        
        Ok(result > 0)
    }

    pub async fn publish(&self, channel: &str, message: &str) -> RedisResult<()> {
        let mut conn = self.connection_manager.clone();
        conn.publish::<_, _, ()>(channel, message).await?;
        
        Ok(())
    }

    // Session management methods
    pub async fn set_session(&self, session_id: &str, user_data: &str, ttl: Duration) -> RedisResult<()> {
        let key = format!("session:{}", session_id);
        self.set(&key, user_data, Some(ttl)).await
    }

    pub async fn get_session(&self, session_id: &str) -> RedisResult<Option<String>> {
        let key = format!("session:{}", session_id);
        self.get(&key).await
    }

    pub async fn delete_session(&self, session_id: &str) -> RedisResult<()> {
        let key = format!("session:{}", session_id);
        self.del(&key).await
    }

    // Cache methods
    pub async fn cache_set(&self, key: &str, value: &str, ttl: Duration) -> RedisResult<()> {
        let cache_key = format!("cache:{}", key);
        self.set(&cache_key, value, Some(ttl)).await
    }

    pub async fn cache_get(&self, key: &str) -> RedisResult<Option<String>> {
        let cache_key = format!("cache:{}", key);
        self.get(&cache_key).await
    }

    pub async fn cache_delete(&self, key: &str) -> RedisResult<()> {
        let cache_key = format!("cache:{}", key);
        self.del(&cache_key).await
    }

    // Health check
    pub async fn health_check(&self) -> RedisResult<()> {
        let mut conn = self.connection_manager.clone();
        // Use get with a test key or just check connection
        let _: Option<String> = conn.get("__health_check__").await?;
        Ok(())
    }
}
