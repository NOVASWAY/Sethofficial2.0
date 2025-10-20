use actix_web::{web, App, HttpResponse, HttpServer, Result};
use std::env;
use serde_json::json;
use sqlx::PgPool;

mod database;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool,
}

async fn health() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Backend is running",
        "timestamp": chrono::Utc::now()
    })))
}

async fn status() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "status": "healthy",
        "version": "1.0.0",
        "uptime": "running",
        "services": {
            "database": "connected",
            "api": "active"
        }
    })))
}

async fn database_test(state: web::Data<AppState>) -> Result<HttpResponse> {
    match sqlx::query("SELECT 1 as test").fetch_one(&state.db_pool).await {
        Ok(_) => Ok(HttpResponse::Ok().json(json!({
            "status": "ok",
            "message": "Database connection successful"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "status": "error",
            "message": format!("Database connection failed: {}", e)
        })))
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("{}:{}", host, port);

    eprintln!("🚀 Starting Clinic Management Backend (Minimal Version)");
    eprintln!("📡 Server will listen on: {}", bind_address);

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@postgres:5432/clinic_management".to_string());

    eprintln!("🔗 Connecting to database...");
    let db_pool = match sqlx::PgPool::connect(&database_url).await {
        Ok(pool) => {
            eprintln!("✅ Database connection established");
            pool
        }
        Err(e) => {
            eprintln!("❌ Failed to connect to database: {}", e);
            eprintln!("❌ Exiting...");
            std::process::exit(1);
        }
    };

    let app_state = AppState { db_pool };

    eprintln!("🌐 Starting HTTP server...");
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .route("/health", web::get().to(health))
            .route("/status", web::get().to(status))
            .route("/api/test/database", web::get().to(database_test))
    })
    .bind(&bind_address)?
    .run()
    .await
}
