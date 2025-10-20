use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub jwt_expiration: u64,
    pub host: String,
    pub port: u16,
    pub sendgrid_api_key: String,
    pub from_email: String,
    pub from_name: String,
    pub africastalking_api_key: String,
    pub africastalking_username: String,
    pub africastalking_sender_id: String,
    pub max_file_size: u64,
    pub upload_dir: String,
    pub allowed_origins: Vec<String>,
    pub rate_limit_requests: u32,
    pub rate_limit_window: u64,
}

impl Config {
    pub fn from_env() -> Result<Self, env::VarError> {
        Ok(Config {
            database_url: env::var("DATABASE_URL")?,
            redis_url: env::var("REDIS_URL")?,
            jwt_secret: env::var("JWT_SECRET")?,
            jwt_expiration: env::var("JWT_EXPIRATION")
                .unwrap_or_else(|_| "86400".to_string())
                .parse()
                .unwrap_or(86400),
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            sendgrid_api_key: env::var("SENDGRID_API_KEY")?,
            from_email: env::var("FROM_EMAIL")?,
            from_name: env::var("FROM_NAME")?,
            africastalking_api_key: env::var("AFRICASTALKING_API_KEY")?,
            africastalking_username: env::var("AFRICASTALKING_USERNAME")?,
            africastalking_sender_id: env::var("AFRICASTALKING_SENDER_ID")?,
            max_file_size: env::var("MAX_FILE_SIZE")
                .unwrap_or_else(|_| "10485760".to_string())
                .parse()
                .unwrap_or(10485760),
            upload_dir: env::var("UPLOAD_DIR").unwrap_or_else(|_| "./uploads".to_string()),
            allowed_origins: env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:3000".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            rate_limit_requests: env::var("RATE_LIMIT_REQUESTS")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
            rate_limit_window: env::var("RATE_LIMIT_WINDOW")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .unwrap_or(60),
        })
    }
}