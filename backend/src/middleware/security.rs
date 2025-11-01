use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, HttpResponse, Result,
};
use futures_util::future::LocalBoxFuture;
use std::{
    future::{ready, Ready},
    rc::Rc,
};
use governor::{Quota, RateLimiter};
use nonzero_ext::nonzero;
use std::num::NonZeroU32;

use crate::auth::{AuthService, Claims};

// Rate limiter configuration
const REQUESTS_PER_MINUTE: u32 = 100;
const REQUESTS_PER_MINUTE_STRICT: u32 = 30; // For auth endpoints

/// Comprehensive security middleware that combines:
/// - JWT authentication
/// - Rate limiting
/// - RBAC (can be added via wrapper)
pub struct SecurityMiddleware {
    auth_service: Rc<AuthService>,
    rate_limiter: Option<Rc<RateLimiter<String>>>,
}

impl SecurityMiddleware {
    pub fn new(auth_service: AuthService) -> Self {
        // Create rate limiter: 100 requests per minute per user
        let quota = Quota::per_minute(nonzero!(REQUESTS_PER_MINUTE));
        let rate_limiter = Some(Rc::new(RateLimiter::keyed(quota)));

        Self {
            auth_service: Rc::new(auth_service),
            rate_limiter,
        }
    }

    pub fn with_strict_rate_limit(auth_service: AuthService) -> Self {
        // Stricter rate limit: 30 requests per minute (for auth endpoints)
        let quota = Quota::per_minute(nonzero!(REQUESTS_PER_MINUTE_STRICT));
        let rate_limiter = Some(Rc::new(RateLimiter::keyed(quota)));

        Self {
            auth_service: Rc::new(auth_service),
            rate_limiter,
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for SecurityMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = SecurityMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(SecurityMiddlewareService {
            service: Rc::new(service),
            auth_service: self.auth_service.clone(),
            rate_limiter: self.rate_limiter.clone(),
        }))
    }
}

pub struct SecurityMiddlewareService<S> {
    service: Rc<S>,
    auth_service: Rc<AuthService>,
    rate_limiter: Option<Rc<RateLimiter<String>>>,
}

impl<S, B> Service<ServiceRequest> for SecurityMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let auth_service = self.auth_service.clone();
        let rate_limiter = self.rate_limiter.clone();

        Box::pin(async move {
            // 1. Rate Limiting
            if let Some(limiter) = &rate_limiter {
                let key = get_rate_limit_key(&req);
                
                // Check rate limit
                match limiter.check_key(&key) {
                    Ok(_) => {
                        // Rate limit OK, continue
                    }
                    Err(_) => {
                        // Rate limit exceeded
                        let response = HttpResponse::TooManyRequests()
                            .insert_header(("X-RateLimit-Limit", REQUESTS_PER_MINUTE.to_string()))
                            .insert_header(("Retry-After", "60"))
                            .json(serde_json::json!({
                                "success": false,
                                "error": "Rate limit exceeded. Please try again later.",
                                "retry_after": 60
                            }));
                        return Ok(ServiceResponse::new(req.into_parts().0, response));
                    }
                }
            }

            // 2. JWT Authentication
            let token = extract_token_from_request(&req);
            
            match token {
                Some(token) => {
                    // Verify the token
                    match auth_service.verify_access_token(&token) {
                        Ok(claims) => {
                            // Add claims to request extensions for use in handlers
                            req.extensions_mut().insert(claims);
                            service.call(req).await
                        }
                        Err(e) => {
                            // Token is invalid or expired
                            let response = HttpResponse::Unauthorized()
                                .json(serde_json::json!({
                                    "success": false,
                                    "error": format!("Invalid or expired token: {}", e)
                                }));
                            Ok(ServiceResponse::new(req.into_parts().0, response))
                        }
                    }
                }
                None => {
                    // No token provided
                    let response = HttpResponse::Unauthorized()
                        .json(serde_json::json!({
                            "success": false,
                            "error": "Authorization token required. Please include 'Authorization: Bearer <token>' header."
                        }));
                    Ok(ServiceResponse::new(req.into_parts().0, response))
                }
            }
        })
    }
}

/// Extract rate limit key from request (IP address or user ID)
fn get_rate_limit_key(req: &ServiceRequest) -> String {
    // Try to get user ID from token first
    if let Some(token) = extract_token_from_request(req) {
        // Try to extract user ID from token without full validation (just for rate limiting)
        // For now, use IP address
        if let Some(peer_addr) = req.peer_addr() {
            return peer_addr.ip().to_string();
        }
    }
    
    // Fallback to IP address
    if let Some(peer_addr) = req.peer_addr() {
        return peer_addr.ip().to_string();
    }
    
    // Final fallback
    "unknown".to_string()
}

/// Extract JWT token from request
fn extract_token_from_request(req: &ServiceRequest) -> Option<String> {
    // Try to get token from Authorization header (preferred)
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                return Some(auth_str[7..].to_string());
            }
        }
    }
    
    // Try to get token from query parameter (for development/testing only)
    // Note: In production, this should be disabled for security
    #[cfg(debug_assertions)]
    {
        if let Some(token) = req.query_string()
            .split('&')
            .find(|param| param.starts_with("token="))
            .and_then(|param| param.split('=').nth(1))
        {
            return Some(token.to_string());
        }
    }
    
    None
}

/// Helper function to extract claims from request in handlers
pub fn get_claims_from_request(req: &actix_web::HttpRequest) -> Option<Claims> {
    req.extensions().get::<Claims>().cloned()
}

/// Helper function to extract user ID from request
pub fn get_user_id_from_request(req: &actix_web::HttpRequest) -> Option<uuid::Uuid> {
    get_claims_from_request(req).map(|claims| claims.user_id)
}

/// Helper function to extract user role from request
pub fn get_user_role_from_request(req: &actix_web::HttpRequest) -> Option<String> {
    get_claims_from_request(req).map(|claims| claims.role)
}

/// Helper function to check if user has a specific permission
pub fn has_permission(req: &actix_web::HttpRequest, required_permission: &str) -> bool {
    if let Some(claims) = get_claims_from_request(req) {
        crate::auth::has_permission(&claims.permissions, required_permission)
    } else {
        false
    }
}

/// Helper function to check if user has a specific role
pub fn has_role(req: &actix_web::HttpRequest, required_role: &str) -> bool {
    if let Some(claims) = get_claims_from_request(req) {
        claims.role == required_role || claims.role == "admin"
    } else {
        false
    }
}

/// Helper function to check if user is admin
pub fn is_admin(req: &actix_web::HttpRequest) -> bool {
    has_role(req, "admin")
}

