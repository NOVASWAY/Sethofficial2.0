use actix_web::{web, HttpResponse, Result};
use serde_json::json;
use chrono::Utc;

use crate::models::ApiResponse;

pub async fn health_check() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
            "status": "healthy",
            "timestamp": Utc::now(),
            "version": "1.0.0",
            "service": "Seth Medical Clinic Backend"
        })),
        message: Some("Service is running".to_string()),
        error: None,
    }))
}
