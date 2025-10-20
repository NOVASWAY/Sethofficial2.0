use actix_web::{web, App, HttpResponse, HttpServer, Result};
use std::env;
use serde_json::json;
use sqlx::PgPool;

mod database;
mod auth;
mod models;
mod simple_handlers;
mod jwt_utils;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool,
    pub auth_service: auth::AuthService,
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

    // Initialize AuthService
    let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "your-secret-key".to_string());
    let jwt_expiration_hours = env::var("JWT_EXPIRATION_HOURS")
        .unwrap_or_else(|_| "24".to_string())
        .parse::<u64>()
        .unwrap_or(24);
    let refresh_token_expiration_days = env::var("REFRESH_TOKEN_EXPIRATION_DAYS")
        .unwrap_or_else(|_| "7".to_string())
        .parse::<u64>()
        .unwrap_or(7);
    
    let auth_service = auth::AuthService::new(
        &jwt_secret,
        jwt_expiration_hours,
        refresh_token_expiration_days,
    );
    
    eprintln!("🔐 AuthService initialized");

    let app_state = AppState { 
        db_pool,
        auth_service,
    };

    eprintln!("🌐 Starting HTTP server...");
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            // Health and status routes (public)
            .route("/health", web::get().to(health))
            .route("/status", web::get().to(status))
            .route("/api/test/database", web::get().to(database_test))
            // Authentication routes (public)
            .route("/api/auth/login", web::post().to(simple_handlers::login))
            // User management routes (public for now - should be protected in production)
            .route("/api/users", web::get().to(simple_handlers::get_users))
            .route("/api/users", web::post().to(simple_handlers::create_user))
            .route("/api/users/{id}", web::get().to(simple_handlers::get_user_by_id))
            // Protected routes (require JWT)
            .route("/api/auth/profile", web::get().to(simple_handlers::get_profile))
    })
    .bind(&bind_address)?
    .run()
    .await
}
