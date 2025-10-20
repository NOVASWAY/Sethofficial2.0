use sqlx::{PgPool, Pool, Postgres};
use std::env;
use tracing::info;

pub type DatabasePool = Pool<Postgres>;

pub async fn create_pool() -> Result<DatabasePool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@localhost:5432/clinic_management".to_string());
    
    info!("Connecting to database: {}", database_url.replace(&database_url.split('@').nth(0).unwrap_or(""), "***"));
    
    let pool = PgPool::connect(&database_url).await?;
    
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