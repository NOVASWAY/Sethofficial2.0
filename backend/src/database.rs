use sqlx::{Pool, Postgres};
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::time::Duration;
use tracing::info;

pub type DatabasePool = Pool<Postgres>;

pub async fn create_pool() -> Result<DatabasePool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@localhost:5432/clinic_management".to_string());
    
    info!("Connecting to database: {}", database_url.replace(&database_url.split('@').nth(0).unwrap_or(""), "***"));

    // Pool tuning (defaults chosen to match env.example + sane fallbacks)
    // Prefer DB_POOL_MAX_CONNECTIONS if set; fallback to DB_POOL_SIZE; fallback to 10.
    let max_connections: u32 = env::var("DB_POOL_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse().ok())
        .or_else(|| env::var("DB_POOL_SIZE").ok().and_then(|v| v.parse().ok()))
        .unwrap_or(10);

    // Acquire timeout in seconds (how long to wait for a connection from the pool)
    let acquire_timeout_secs: u64 = env::var("DB_POOL_TIMEOUT_SECONDS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);

    // Minimum number of connections to keep in the pool (optional)
    let min_connections: u32 = env::var("DB_POOL_MIN_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let pool = PgPoolOptions::new()
        .max_connections(max_connections)
        .min_connections(min_connections)
        .acquire_timeout(Duration::from_secs(acquire_timeout_secs))
        .connect(&database_url)
        .await?;
    
    // Test the connection
    sqlx::query("SELECT 1").fetch_one(&pool).await?;
    
    info!("✅ Database connection established successfully");
    
    Ok(pool)
}

pub async fn run_migrations(_pool: &DatabasePool) -> Result<(), sqlx::Error> {
    info!("Skipping database migrations for now...");
    // TODO: Add migration logic back when needed
    Ok(())
}

pub async fn health_check(pool: &DatabasePool) -> Result<bool, sqlx::Error> {
    sqlx::query("SELECT 1").fetch_one(pool).await?;
    Ok(true)
}