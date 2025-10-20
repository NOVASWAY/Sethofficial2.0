use actix_web::{web, App, HttpResponse, HttpServer, Result, middleware};
use std::env;
use serde_json::json;
use sqlx::PgPool;

// Import our modules
mod models;
mod auth;
mod database;
mod service_catalog;
mod workflow_engine;
mod handlers;
mod middleware;
mod security;
mod websocket;
mod error;
mod validation;
mod cache;

use models::*;
use auth::AuthService;
use service_catalog::{ServiceCatalog, InsuranceType, PatientType};
use workflow_engine::WorkflowEngine;

// Application state
#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool,
    pub auth_service: AuthService,
    pub service_catalog: ServiceCatalog,
    pub workflow_engine: WorkflowEngine,
}

// Health check endpoint
async fn health() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Backend is running"
    })))
}

// System status endpoint  
async fn system_status() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "initialized": true,
        "backend": "ready",
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

// Setup check endpoint
async fn setup_check() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "needs_setup": false,
            "system_ready": true
        }
    })))
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables
    dotenvy::dotenv().ok();
    
    // Initialize logging
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("{}:{}", host, port);
    
    eprintln!("🚀 Starting Clinic Management Backend");
    eprintln!("📡 Server will listen on: {}", bind_address);
    
    // Initialize database
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@postgres:5432/clinic_management".to_string());
    
    eprintln!("🔗 Connecting to database...");
    let db_pool = match database::create_pool().await {
        Ok(pool) => {
            eprintln!("✅ Database connection established");
            pool
        }
        Err(e) => {
            eprintln!("❌ Failed to connect to database: {}", e);
            eprintln!("❌ Database URL: {}", database_url.replace(&database_url.split('@').nth(0).unwrap_or(""), "***"));
            eprintln!("❌ Retrying database connection in 5 seconds...");
            std::thread::sleep(std::time::Duration::from_secs(5));
            match database::create_pool().await {
                Ok(pool) => {
                    eprintln!("✅ Database connection established on retry");
                    pool
                }
                Err(e2) => {
                    eprintln!("❌ Failed to connect to database on retry: {}", e2);
                    eprintln!("❌ Exiting...");
                    return Ok(());
                }
            }
        }
    };
    
    // Initialize auth service
    let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "your-super-secret-jwt-key-change-this-in-production".to_string());
    let jwt_expiration = env::var("JWT_EXPIRATION").unwrap_or_else(|_| "86400".to_string()).parse::<u64>().unwrap_or(86400);
    
    let auth_service = AuthService::new(&jwt_secret, jwt_expiration / 3600, 7); // 7 days for refresh token
    
    // Initialize service catalog and workflow engine
    let service_catalog = ServiceCatalog::new();
    let workflow_engine = WorkflowEngine::new();
    
    // Create app state
    let app_state = AppState {
        db_pool: db_pool.clone(),
        auth_service,
        service_catalog,
        workflow_engine,
    };
    
    eprintln!("🌐 Starting HTTP server...");
    
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .wrap(middleware::Logger::default())
            .route("/health", web::get().to(health))
            .route("/api/v1/system/status", web::get().to(system_status))
            .route("/api/v1/setup/check", web::get().to(setup_check))
    })
    .bind(&bind_address)?
    .run()
    .await
}
