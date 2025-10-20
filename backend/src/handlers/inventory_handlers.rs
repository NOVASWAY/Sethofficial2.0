use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;

use crate::models::{Medicine, ApiResponse};
use crate::AppState;
use crate::middleware::auth::get_current_user;

pub async fn get_inventory(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!([])),
        message: None,
        error: None,
    }))
}

pub async fn add_item(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    Ok(HttpResponse::Created().json(ApiResponse {
        success: true,
        data: Some(json!({"id": Uuid::new_v4()})),
        message: Some("Item added successfully".to_string()),
        error: None,
    }))
}

pub async fn update_item(
    path: web::Path<Uuid>,
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
      Ok(HttpResponse::Ok().json(ApiResponse::<()> {
        success: true,
        data: None,
        message: Some("Item updated successfully".to_string()),
        error: None,
    }))
}

pub async fn delete_item(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
      Ok(HttpResponse::Ok().json(ApiResponse::<()> {
        success: true,
        data: None,
        message: Some("Item deleted successfully".to_string()),
        error: None,
    }))
}

pub async fn get_low_stock(
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!([])),
        message: None,
        error: None,
    }))
}

pub async fn get_expiring_items(
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!([])),
        message: None,
        error: None,
    }))
}

pub async fn get_movements(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!([])),
        message: None,
        error: None,
    }))
}
