use sqlx::{Pool, Postgres};
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::time::Duration;
use tracing::info;
use include_dir::{include_dir, Dir};
use std::fs;

pub type DatabasePool = Pool<Postgres>;

// Embed migrations directory into binary at compile time
// This ensures migrations are ALWAYS available, regardless of filesystem issues
static MIGRATIONS_DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/migrations");

pub async fn create_pool() -> Result<DatabasePool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@localhost:5432/clinic_management".to_string());
    
    eprintln!("🔗 DATABASE_URL is set: {}", if database_url.is_empty() { "NO (empty)" } else { "YES" });
    eprintln!("🔗 DATABASE_URL length: {} characters", database_url.len());
    eprintln!("🔗 DATABASE_URL starts with: {}", if database_url.len() > 20 { &database_url[..20] } else { &database_url });
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
    eprintln!("📦 Using EMBEDDED migrations (compiled into binary)");
    info!("Running database migrations from embedded source...");
    
    // Verify embedded migrations are present
    let embedded_file_count = MIGRATIONS_DIR.files().count();
    eprintln!("📊 Embedded migration files count: {}", embedded_file_count);
    
    if embedded_file_count == 0 {
        eprintln!("❌ CRITICAL ERROR: No migration files found in embedded directory!");
        eprintln!("❌ This means migrations were not embedded at compile time!");
        return Err(sqlx::Error::Configuration(
            Box::new(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "No migration files embedded in binary - check include_dir! macro at compile time"
            ))
        ));
    }
    
    eprintln!("✅ Found {} embedded migration file(s)", embedded_file_count);
    
    // NEW APPROACH: Extract embedded migrations to temporary directory
    // This completely eliminates filesystem dependency issues
    let temp_dir = std::env::temp_dir().join(format!("clinic-migrations-{}", uuid::Uuid::new_v4()));
    
    eprintln!("📁 Creating temporary migrations directory: {}", temp_dir.display());
    
    // Create temp directory
    fs::create_dir_all(&temp_dir).map_err(|e| {
        eprintln!("❌ Failed to create temp directory: {}", e);
        sqlx::Error::Configuration(
            Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to create temp directory: {}", e)
            ))
        )
    })?;
    
    // Extract all migration files from embedded directory
    eprintln!("📤 Extracting embedded migration files...");
    let mut migration_count = 0;
    
    for entry in MIGRATIONS_DIR.files() {
        let file_name = entry.path().file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| {
                sqlx::Error::Configuration(
                    Box::new(std::io::Error::new(
                        std::io::ErrorKind::InvalidInput,
                        "Invalid migration file name"
                    ))
                )
            })?;
        
        let file_path = temp_dir.join(file_name);
        eprintln!("   📄 Extracting: {}", file_name);
        
        fs::write(&file_path, entry.contents()).map_err(|e| {
            eprintln!("❌ Failed to write migration file {}: {}", file_name, e);
            sqlx::Error::Configuration(
                Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to write migration file: {}", e)
                ))
            )
        })?;
        
        migration_count += 1;
    }
    
    eprintln!("✅ Extracted {} migration file(s) to temporary directory", migration_count);
    
    if migration_count == 0 {
        eprintln!("❌ ERROR: No migration files found in embedded directory!");
        return Err(sqlx::Error::Configuration(
            Box::new(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "No migration files embedded in binary"
            ))
        ));
    }
    
    // Run migrations from temporary directory
    eprintln!("🔧 Creating migrator from temporary directory: {}", temp_dir.display());
    
    // Convert PathBuf to &Path for Migrator::new()
    match sqlx::migrate::Migrator::new(temp_dir.as_path()).await {
        Ok(migrator) => {
            eprintln!("✅ Migrator created successfully");
            eprintln!("🔄 Running {} migration(s)...", migration_count);
            
            let result = migrator.run(pool).await;
            
            // Clean up temporary directory (best effort - don't fail if cleanup fails)
            if let Err(e) = fs::remove_dir_all(&temp_dir) {
                eprintln!("⚠️  Warning: Failed to clean up temp directory: {}", e);
            } else {
                eprintln!("🧹 Cleaned up temporary migrations directory");
            }
            
            match result {
                Ok(_) => {
                    eprintln!("✅ Database migrations completed successfully");
                    info!("✅ Database migrations completed successfully");
                    Ok(())
                }
                Err(e) => {
                    eprintln!("❌ Migration execution error: {}", e);
                    eprintln!("❌ Migration error type: {:?}", e);
                    eprintln!("❌ Migration error details: {:?}", e);
                    Err(e.into())
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to create migrator: {}", e);
            eprintln!("❌ Migrations path attempted: {}", temp_dir.display());
            eprintln!("❌ Error type: {:?}", e);
            
            // Clean up on error
            let _ = fs::remove_dir_all(&temp_dir);
            
            Err(e.into())
        }
    }
}

pub async fn health_check(pool: &DatabasePool) -> Result<bool, sqlx::Error> {
    sqlx::query("SELECT 1").fetch_one(pool).await?;
    Ok(true)
}