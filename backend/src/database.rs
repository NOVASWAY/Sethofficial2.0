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
    
    // Find migrations directory at runtime
    // Try multiple locations in order of preference:
    // 1. Environment variable MIGRATIONS_PATH
    // 2. ./migrations (relative to current working directory) - works in Docker
    // 3. CARGO_MANIFEST_DIR/migrations (compile-time path fallback)
    let migrations_path = if let Ok(env_path) = env::var("MIGRATIONS_PATH") {
        std::path::PathBuf::from(env_path)
    } else if let Ok(cwd) = std::env::current_dir() {
        let cwd_migrations = cwd.join("migrations");
        if cwd_migrations.exists() && cwd_migrations.is_dir() {
            eprintln!("📁 Using migrations from current directory: {}", cwd_migrations.display());
            cwd_migrations
        } else {
            eprintln!("⚠️  ./migrations not found in current dir, trying CARGO_MANIFEST_DIR");
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations")
        }
    } else {
        eprintln!("⚠️  Could not get current directory, using CARGO_MANIFEST_DIR");
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations")
    };
    
    eprintln!("📁 Migrations path: {}", migrations_path.display());
    eprintln!("📁 Path exists: {}", migrations_path.exists());
    eprintln!("📁 Current working directory: {:?}", std::env::current_dir());
    
    // List current directory contents for debugging
    if let Ok(cwd) = std::env::current_dir() {
        eprintln!("📂 Contents of current directory ({:?}):", cwd);
        if let Ok(entries) = std::fs::read_dir(&cwd) {
            for entry in entries.flatten() {
                eprintln!("   - {:?}", entry.path());
            }
        }
    }
    
    // List migrations directory if it exists
    if migrations_path.exists() {
        eprintln!("📂 Contents of migrations directory:");
        if let Ok(entries) = std::fs::read_dir(&migrations_path) {
            for entry in entries.flatten() {
                eprintln!("   - {:?}", entry.path());
            }
        }
    } else {
        eprintln!("❌ Migrations directory does not exist at: {}", migrations_path.display());
    }
    
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