use actix_web::{HttpRequest, HttpResponse, Result};
use serde_json::json;

use crate::auth::{AuthService, Claims};

// Simple JWT verification utility
pub fn verify_jwt_from_request(req: &HttpRequest, auth_service: &AuthService) -> Result<Claims, HttpResponse> {
    // Try to get token from Authorization header
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..];
                match auth_service.verify_access_token(token) {
                    Ok(claims) => return Ok(claims),
                    Err(_) => {
                        return Err(HttpResponse::Unauthorized()
                            .json(json!({
                                "success": false,
                                "error": "Invalid or expired token"
                            })));
                    }
                }
            }
        }
    }
    
    // Try to get token from query parameter (for testing)
    let query = req.query_string();
    for param in query.split('&') {
        if param.starts_with("token=") {
            if let Some(token) = param.split('=').nth(1) {
                match auth_service.verify_access_token(token) {
                    Ok(claims) => return Ok(claims),
                    Err(_) => {
                        return Err(HttpResponse::Unauthorized()
                            .json(json!({
                                "success": false,
                                "error": "Invalid or expired token"
                            })));
                    }
                }
            }
        }
    }
    
    // No valid token found
    Err(HttpResponse::Unauthorized()
        .json(json!({
            "success": false,
            "error": "Authorization token required"
        })))
}
