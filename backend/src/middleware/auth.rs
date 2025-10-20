use actix_web::HttpRequest;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user id
    pub username: String,
    pub role: String,
    pub permissions: serde_json::Value,
    pub exp: u64,
    pub iat: u64,
    pub jti: String,
}

pub fn get_current_user(req: &HttpRequest) -> Option<Claims> {
    // Extract token from Authorization header
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..];
                return validate_token(token);
            }
        }
    }
    None
}

pub fn validate_token(token: &str) -> Option<Claims> {
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "your-super-secret-jwt-key-change-this-in-production".to_string());
    let key = DecodingKey::from_secret(jwt_secret.as_ref());
    let validation = Validation::new(Algorithm::HS256);
    
    match decode::<Claims>(token, &key, &validation) {
        Ok(token_data) => Some(token_data.claims),
        Err(_) => None,
    }
}

pub fn extract_user_id(req: &HttpRequest) -> Option<String> {
    get_current_user(req).map(|claims| claims.sub)
}

pub fn extract_user_role(req: &HttpRequest) -> Option<String> {
    get_current_user(req).map(|claims| claims.role)
}

pub fn has_role(req: &HttpRequest, required_role: &str) -> bool {
    if let Some(role) = extract_user_role(req) {
        role == required_role || role == "admin"
    } else {
        false
    }
}

pub fn is_admin(req: &HttpRequest) -> bool {
    has_role(req, "admin")
}

pub fn is_doctor(req: &HttpRequest) -> bool {
    has_role(req, "doctor")
}

pub fn is_nurse(req: &HttpRequest) -> bool {
    has_role(req, "nurse")
}

pub fn is_receptionist(req: &HttpRequest) -> bool {
    has_role(req, "receptionist")
}