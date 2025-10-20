use std::env;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    println!("🚀 Starting clinic management backend test...");
    
    // Load environment variables
    dotenvy::dotenv().ok();
    println!("✅ Environment variables loaded");
    
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("clinic_management_backend=debug,actix_web=debug")
        .init();
    println!("✅ Tracing initialized");
    
    info!("🚀 Starting clinic management backend test...");
    
    // Test database connection
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@localhost:5432/clinic_management".to_string());
    
    println!("Database URL: {}", database_url.replace(&database_url.split('@').nth(0).unwrap_or(""), "***"));
    
    match sqlx::PgPool::connect(&database_url).await {
        Ok(pool) => {
            println!("✅ Database connection established");
            
            // Test a simple query
            match sqlx::query("SELECT 1").fetch_one(&pool).await {
                Ok(_) => println!("✅ Database query successful"),
                Err(e) => println!("❌ Database query failed: {}", e),
            }
        }
        Err(e) => {
            println!("❌ Failed to connect to database: {}", e);
            return Ok(());
        }
    }
    
    println!("✅ Test completed successfully");
    Ok(())
}
