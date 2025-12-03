use actix_web::{web, HttpRequest, HttpResponse, Result};
use serde_json::json;

use crate::csrf::CsrfService;
use crate::middleware::security::get_user_id_from_request;

/// Generate a CSRF token for the current user/session
pub async fn generate_csrf_token(
    req: HttpRequest,
    csrf_service: web::Data<CsrfService>,
) -> Result<HttpResponse> {
    // Extract user ID and session ID from request
    let (user_id, session_id) = CsrfService::extract_context_from_request(&req);
    
    // Generate token
    match csrf_service.generate_token(user_id, session_id).await {
        Ok(token) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "token": token,
                "message": "CSRF token generated successfully"
            })))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to generate CSRF token: {}", e)
            })))
        }
    }
}

/// Validate a CSRF token (useful for testing or manual validation)
pub async fn validate_csrf_token(
    req: HttpRequest,
    csrf_service: web::Data<CsrfService>,
    body: web::Json<serde_json::Value>,
) -> Result<HttpResponse> {
    let token = match body.get("token").and_then(|t| t.as_str()) {
        Some(t) => t,
        None => {
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Token is required"
            })));
        }
    };
    
    // Extract user ID and session ID from request
    let (user_id, session_id) = CsrfService::extract_context_from_request(&req);
    
    // Validate token
    match csrf_service.validate_token(token, user_id, session_id).await {
        Ok(is_valid) => {
            if is_valid {
                Ok(HttpResponse::Ok().json(json!({
                    "success": true,
                    "valid": true,
                    "message": "CSRF token is valid"
                })))
            } else {
                Ok(HttpResponse::Ok().json(json!({
                    "success": false,
                    "valid": false,
                    "message": "CSRF token is invalid or expired"
                })))
            }
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to validate CSRF token: {}", e)
            })))
        }
    }
}

