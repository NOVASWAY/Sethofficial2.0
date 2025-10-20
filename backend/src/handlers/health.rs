use actix_web::{web, HttpResponse, Result};
use serde::{Deserialize, Serialize};

use crate::config::Config;
use crate::database::Database;
use crate::redis_client::RedisClient;

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub services: ServiceHealth,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceHealth {
    pub database: String,
    pub redis: String,
    pub websocket: String,
}

pub async fn health_check(
    config: web::Data<Config>,
    database: web::Data<Database>,
    redis_client: web::Data<RedisClient>,
) -> Result<HttpResponse> {
    let mut db_status = "healthy".to_string();
    let mut redis_status = "healthy".to_string();
    let ws_status = "healthy".to_string();

    // Check database connection
    if let Err(e) = database.health_check().await {
        db_status = format!("unhealthy: {}", e);
    }

    // Check Redis connection
    if let Err(e) = redis_client.health_check().await {
        redis_status = format!("unhealthy: {}", e);
    }

    let overall_status = if db_status == "healthy" && redis_status == "healthy" && ws_status == "healthy" {
        "healthy"
    } else {
        "unhealthy"
    };

    let response = HealthResponse {
        status: overall_status.to_string(),
        timestamp: chrono::Utc::now(),
        services: ServiceHealth {
            database: db_status,
            redis: redis_status,
            websocket: ws_status,
        },
    };

    Ok(HttpResponse::Ok().json(response))
}
