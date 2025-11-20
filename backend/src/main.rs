use actix_web::{web, App, HttpResponse, HttpServer, Result, middleware::Logger};
use std::env;
use serde_json::json;
use sqlx::PgPool;
use actix_cors::Cors;
use actix::{Actor, System};
use middleware::SecurityMiddleware;
use security::security_headers;

mod database;
mod auth;
mod models;
mod simple_handlers;
mod jwt_utils;
mod middleware;
mod mpesa;
mod services;
mod websocket;
mod cache;
mod redis_client;
mod mfa;
mod errors;
mod error;
mod handlers;
mod audit;
mod backup;
mod encryption;
mod monitoring;
mod metrics;
mod validation;
mod csrf;
mod backup_scheduler;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool,
    pub auth_service: auth::AuthService,
    pub redis_client: Option<std::sync::Arc<redis_client::RedisClient>>,
    pub websocket_manager: actix::Addr<websocket::WebSocketManager>,
}

// Make AppState available for tests
#[cfg(test)]
pub use AppState;

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

// WebSocket handler wrapper to include auth service
async fn websocket_handler_wrapper(
    req: actix_web::HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> actix_web::Result<HttpResponse> {
    let manager = web::Data::new(state.websocket_manager.clone());
    websocket::websocket_handler(req, stream, manager, web::Data::new(state.auth_service.clone())).await
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("{}:{}", host, port);

    eprintln!("🚀 Starting Clinic Management Backend");
    eprintln!("📡 Server will listen on: {}", bind_address);
    eprintln!("🌍 Environment: {}", if cfg!(debug_assertions) { "development" } else { "production" });

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

    // Initialize Redis client (optional - gracefully handles if Redis is unavailable)
    let redis_client = {
        let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
        eprintln!("🔗 Attempting to connect to Redis at: {}", redis_url);
        match redis_client::RedisClient::new(&redis_url).await {
            Ok(client) => {
                eprintln!("✅ Redis connection established successfully");
                Some(std::sync::Arc::new(client))
            },
            Err(e) => {
                eprintln!("⚠️  Redis not available ({}). Caching disabled. System will work without cache.", e);
                None
            }
        }
    };

    // Initialize CSRF service
    let enable_csrf = env::var("ENABLE_CSRF_PROTECTION")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(true);
    let csrf_token_length = env::var("CSRF_TOKEN_LENGTH")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(32);
    let csrf_expiration_minutes = env::var("CSRF_TOKEN_EXPIRATION_MINUTES")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(60);
    
    let csrf_service = csrf::CsrfService::new(
        redis_client.clone(),
        csrf_token_length,
        csrf_expiration_minutes,
    );
    
    if enable_csrf {
        eprintln!("🛡️  CSRF protection enabled (token length: {}, expiration: {} minutes)", csrf_token_length, csrf_expiration_minutes);
    } else {
        eprintln!("⚠️  CSRF protection disabled");
    }

    // Initialize backup scheduler if enabled
    let backup_enabled = env::var("BACKUP_ENABLED")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(true);
    
    if backup_enabled {
        // Create backup config from environment variables
        let backup_config = backup::BackupConfig {
            enabled: true,
            cron_expression: env::var("BACKUP_CRON_EXPRESSION")
                .unwrap_or_else(|_| "0 2 * * *".to_string()),
            retention_days: env::var("BACKUP_RETENTION_DAYS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(30),
            backup_path: env::var("BACKUP_PATH")
                .unwrap_or_else(|_| "./backups".to_string()),
            compression: env::var("BACKUP_COMPRESSION")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            include_files: env::var("BACKUP_INCLUDE_FILES")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            max_backup_size_mb: env::var("BACKUP_MAX_SIZE_MB")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(1024),
        };
        
        match backup_scheduler::init_backup_scheduler(db_pool.clone(), backup_config.clone()).await {
            Ok(_) => {
                eprintln!("✅ Backup scheduler started");
            }
            Err(e) => {
                eprintln!("⚠️  Failed to start backup scheduler: {}. Backups will need to be triggered manually.", e);
            }
        }
    } else {
        eprintln!("⚠️  Backup scheduler disabled");
    }

    // Configure CORS
    let cors_origins = env::var("CORS_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000,http://localhost:3001".to_string());
    
    eprintln!("🌐 Starting HTTP server...");
    eprintln!("🔓 CORS enabled for: {}", cors_origins);
    
    // Use OnceLock to store WebSocket manager (initialized once in HttpServer closure)
    use std::sync::OnceLock;
    static WEBSOCKET_MANAGER: OnceLock<actix::Addr<websocket::WebSocketManager>> = OnceLock::new();
    
    // Create app_state with components (websocket will be added in HttpServer closure)
    let db_pool_clone = db_pool.clone();
    let auth_service_clone = auth_service.clone();
    let redis_client_clone = redis_client.clone();
    let csrf_service_clone = csrf_service.clone();
    let enable_csrf_clone = enable_csrf;
    
    HttpServer::new(move || {
        // Initialize WebSocket Manager on first call (System is available here)
        let websocket_addr = WEBSOCKET_MANAGER.get_or_init(|| {
            websocket::WebSocketManager::new().start()
        }).clone();
        
        let app_state = AppState {
            db_pool: db_pool_clone.clone(),
            auth_service: auth_service_clone.clone(),
            redis_client: redis_client_clone.clone(),
            websocket_manager: websocket_addr,
        };
        // Build CORS configuration
        let mut cors = Cors::default()
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::ACCEPT,
            ])
            .max_age(3600);
        
        // Add allowed origins
        let origins: Vec<&str> = cors_origins.split(',').map(|s| s.trim()).collect();
        for origin in &origins {
            cors = cors.allowed_origin(origin);
        }

        // Create security middleware instances
        let security_middleware = SecurityMiddleware::new(app_state.auth_service.clone());
        let auth_middleware_strict = SecurityMiddleware::with_strict_rate_limit(app_state.auth_service.clone());

        // Build base app
        let mut app = App::new()
            // Global middleware
            .wrap(Logger::default())
            .wrap(security_headers()) // Security headers (X-Frame-Options, CSP, etc.)
            .wrap(cors)
            // Application state
            .app_data(web::Data::new(app_state.clone()))
            .app_data(web::Data::new(csrf_service_clone.clone()));

        // Add CSRF middleware conditionally (before routes)
        if enable_csrf_clone {
            app = app.wrap(actix_web::middleware::from_fn(
                move |req: actix_web::dev::ServiceRequest, next: actix_web::middleware::Next<impl actix_web::body::MessageBody>| {
                    let csrf_service = csrf_service_clone.clone();
                    async move {
                        middleware::security_middleware::csrf_protection_middleware(
                            req,
                            next,
                            web::Data::new(csrf_service),
                        ).await
                    }
                }
            ));
        }

        app
            // ===========================================
            // PUBLIC ROUTES (No authentication required)
            // ===========================================
            // Health check endpoints
            .route("/health", web::get().to(health))
            .route("/status", web::get().to(status))
            .route("/api/test/database", web::get().to(database_test))
            
            // CSRF token generation endpoint (public, but recommended to be called after login)
            .route("/api/csrf/token", web::get().to(handlers::csrf_handlers::generate_csrf_token))
            
            // ===========================================
            // AUTHENTICATION ROUTES (Public - no JWT required)
            // Login, logout, refresh are public
            // /me and /profile require JWT (handled in handlers)
            // ===========================================
            .route("/api/auth/login", web::post().to(simple_handlers::login))
            .route("/api/auth/logout", web::post().to(simple_handlers::logout))
            .route("/api/auth/refresh", web::post().to(simple_handlers::refresh_token))
            
            // ===========================================
            // M-PESA ROUTES
            // Callback is public (called by Safaricom)
            // STK push and status require authentication
            // ===========================================
            .route("/api/mpesa/callback", web::post().to(simple_handlers::mpesa_callback))
            
            // ===========================================
            // WEBSOCKET ROUTE (Protected - requires JWT)
            // ===========================================
            .route("/api/ws", web::get().to(websocket_handler_wrapper))
            
            // Protected auth routes
            .service(
                web::scope("/api/auth")
                    .wrap(security_middleware.clone())
                    .route("/me", web::get().to(simple_handlers::get_me))
                    .route("/profile", web::get().to(simple_handlers::get_profile))
            )
            
            // MFA routes (protected)
            .service(
                web::scope("/api/mfa")
                    .wrap(security_middleware.clone())
                    .route("/status", web::get().to(handlers::mfa_handlers::get_mfa_status))
                    .route("/setup/totp", web::post().to(handlers::mfa_handlers::setup_totp))
                    .route("/verify", web::post().to(handlers::mfa_handlers::verify_mfa))
                    .route("/disable", web::delete().to(handlers::mfa_handlers::disable_mfa))
            )
            .route("/api/mfa/session/{token}", web::get().to(handlers::mfa_handlers::get_mfa_session))
            
            // Password reset routes (public)
            .route("/api/auth/password-reset/request", web::post().to(handlers::password_reset_handlers::request_password_reset))
            .route("/api/auth/password-reset/verify/{token}", web::get().to(handlers::password_reset_handlers::verify_reset_token))
            .route("/api/auth/password-reset", web::post().to(handlers::password_reset_handlers::reset_password))
            
            // Email verification routes (public)
            .route("/api/auth/verify-email/{token}", web::get().to(handlers::email_verification_handlers::verify_email))
            .route("/api/auth/resend-verification", web::post().to(handlers::email_verification_handlers::resend_verification))
            
            // ===========================================
            // PROTECTED ROUTES (JWT + Rate Limiting Required)
            // ===========================================
            .service(
                web::scope("/api")
                    .wrap(security_middleware.clone())
                    // USER MANAGEMENT ROUTES
                    .route("/users", web::get().to(simple_handlers::get_users))
                    .route("/users", web::post().to(simple_handlers::create_user))
                    .route("/users/{id}", web::get().to(simple_handlers::get_user_by_id))
                    
                    // PATIENT MANAGEMENT ROUTES
                    .route("/patients", web::get().to(simple_handlers::get_patients))
                    .route("/patients", web::post().to(simple_handlers::create_patient))
                    .route("/patients/{id}", web::get().to(simple_handlers::get_patient))
                    .route("/patients/{id}", web::put().to(simple_handlers::update_patient))
                    .route("/patients/{id}", web::delete().to(simple_handlers::delete_patient))
                    .route("/patients/search", web::get().to(simple_handlers::search_patients))
                    .route("/patients/import", web::post().to(simple_handlers::import_patients))
                    
                    // CONSULTATION MANAGEMENT ROUTES
                    .route("/consultations", web::get().to(simple_handlers::get_consultations))
                    .route("/consultations", web::post().to(simple_handlers::create_consultation))
                    .route("/consultations/{id}", web::get().to(simple_handlers::get_consultation))
                    .route("/consultations/{id}", web::put().to(simple_handlers::update_consultation))
                    .route("/consultations/{id}", web::delete().to(simple_handlers::delete_consultation))
                    .route("/consultations/patient/{patientId}", web::get().to(simple_handlers::get_patient_consultations))
                    
                    // APPOINTMENT MANAGEMENT ROUTES
                    .route("/appointments", web::get().to(simple_handlers::get_appointments))
                    .route("/appointments", web::post().to(simple_handlers::create_appointment))
                    .route("/appointments/{id}", web::get().to(simple_handlers::get_appointment))
                    .route("/appointments/{id}", web::put().to(simple_handlers::update_appointment))
                    .route("/appointments/{id}", web::delete().to(simple_handlers::delete_appointment))
                    .route("/appointments/date/{date}", web::get().to(simple_handlers::get_appointments_by_date))
                    
                    // BILLING & INVOICE MANAGEMENT ROUTES
                    .route("/invoices", web::get().to(simple_handlers::get_invoices))
                    .route("/invoices", web::post().to(simple_handlers::create_invoice))
                    .route("/invoices/{id}", web::get().to(simple_handlers::get_invoice))
                    .route("/invoices/{id}", web::put().to(simple_handlers::update_invoice))
                    .route("/invoices/{id}", web::delete().to(simple_handlers::delete_invoice))
                    .route("/invoices/{id}/pay", web::post().to(simple_handlers::pay_invoice))
                    .route("/invoices/reports", web::get().to(simple_handlers::get_invoice_reports))
                    
                    // M-PESA PAYMENT ROUTES (Protected)
                    .route("/mpesa/stk-push", web::post().to(simple_handlers::initiate_stk_push))
                    .route("/mpesa/transaction/{checkout_request_id}", web::get().to(simple_handlers::get_mpesa_transaction_status))
                    .route("/mpesa/invoice/{invoice_id}/transactions", web::get().to(simple_handlers::get_invoice_mpesa_transactions))
                    
                    // SMS ROUTES (Protected)
                    .route("/sms/send", web::post().to(simple_handlers::send_sms))
                    .route("/sms/send-template", web::post().to(simple_handlers::send_template_sms))
                    .route("/sms/balance", web::get().to(simple_handlers::get_sms_balance))
                    
                    // EMAIL ROUTES (Protected)
                    .route("/email/send", web::post().to(simple_handlers::send_email))
                    .route("/email/send-template", web::post().to(simple_handlers::send_template_email))
                    
                    // PHARMACY MANAGEMENT ROUTES
                    // Medicines
                    .route("/medicines", web::get().to(simple_handlers::get_medicines))
                    .route("/medicines", web::post().to(simple_handlers::create_medicine))
                    .route("/medicines/{id}", web::get().to(simple_handlers::get_medicine))
                    .route("/medicines/{id}", web::put().to(simple_handlers::update_medicine))
                    .route("/medicines/{id}", web::delete().to(simple_handlers::delete_medicine))
                    .route("/medicines/{id}/receive", web::post().to(simple_handlers::receive_stock))
                    
                    // Prescriptions
                    .route("/prescriptions", web::get().to(simple_handlers::get_prescriptions))
                    .route("/prescriptions", web::post().to(simple_handlers::create_prescription))
                    .route("/prescriptions/{id}", web::get().to(simple_handlers::get_prescription))
                    .route("/prescriptions/{id}", web::put().to(simple_handlers::update_prescription))
                    .route("/prescriptions/{id}", web::delete().to(simple_handlers::delete_prescription))
                    .route("/prescriptions/{id}/dispense", web::post().to(simple_handlers::dispense_prescription))
                    
                    // INVENTORY MANAGEMENT ROUTES
                    .route("/inventory/low-stock", web::get().to(simple_handlers::get_low_stock))
                    .route("/inventory/expiring", web::get().to(simple_handlers::get_expiring_medicines))
                    .route("/inventory/alerts", web::get().to(simple_handlers::get_stock_alerts))
                    .route("/inventory/reconciliation", web::get().to(simple_handlers::get_stock_reconciliation))
                    .route("/inventory/adjust/{id}", web::post().to(simple_handlers::adjust_stock))
                    
                    // SHA CLAIMS ROUTES
                    .route("/sha-claims", web::post().to(simple_handlers::create_sha_claim))
                    
                    // REPORTS ROUTES
                    .route("/reports/financial", web::get().to(simple_handlers::get_financial_report))
                    .route("/reports/sha-claims", web::get().to(simple_handlers::get_sha_claims_report))
                    .route("/reports/audit", web::get().to(simple_handlers::get_audit_report))
                    .route("/reports/dashboard", web::get().to(simple_handlers::get_dashboard_report))
            )
            
            // ===========================================
            // FUTURE ROUTES TO IMPLEMENT:
            // ===========================================
    })
    .bind(&bind_address)?
    .run()
    .await
}
