use sqlx::{Pool, Postgres};
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::time::Duration;
use tracing::info;

pub type DatabasePool = Pool<Postgres>;

pub async fn create_pool() -> Result<DatabasePool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@localhost:5432/clinic_management".to_string());
    
    eprintln!("🔗 DATABASE_URL is set: {}", if database_url.is_empty() { "NO (empty)" } else { "YES" });
    eprintln!("🔗 Connecting to database...");
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

pub async fn run_migrations(pool: &DatabasePool) -> Result<(), sqlx::Error> {
    eprintln!("🔄 Running database migrations...");
    info!("Running database migrations...");
    
    // Use runtime migration API instead of compile-time macro
    // This allows us to specify the migrations path at runtime
    let migrations_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    eprintln!("📁 Migrations path: {}", migrations_path.display());
    
    // Convert PathBuf to &Path for Migrator::new()
    match sqlx::migrate::Migrator::new(migrations_path.as_path()).await {
        Ok(migrator) => {
            match migrator.run(pool).await {
                Ok(_) => {
                    eprintln!("✅ Database migrations completed successfully");
                    info!("✅ Database migrations completed successfully");
                    Ok(())
                }
                Err(e) => {
                    eprintln!("❌ Migration error: {}", e);
                    eprintln!("❌ Migration error details: {:?}", e);
                    Err(e.into())
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to create migrator: {}", e);
            eprintln!("❌ Migrations path: {}", migrations_path.display());
            Err(e.into())
        }
    }
}

pub async fn health_check(pool: &DatabasePool) -> Result<bool, sqlx::Error> {
    sqlx::query("SELECT 1").fetch_one(pool).await?;
    Ok(true)
}