use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, HttpRequest, HttpResponse, Result,
};
use futures_util::future::LocalBoxFuture;
use std::{
    future::{ready, Ready},
    rc::Rc,
};

use crate::auth::{AuthService, Claims};

// JWT Middleware for protecting routes
pub struct JwtMiddleware {
    auth_service: Rc<AuthService>,
}

impl JwtMiddleware {
    pub fn new(auth_service: AuthService) -> Self {
        Self {
            auth_service: Rc::new(auth_service),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for JwtMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = JwtMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(JwtMiddlewareService {
            service: Rc::new(service),
            auth_service: self.auth_service.clone(),
        }))
    }
}

pub struct JwtMiddlewareService<S> {
    service: Rc<S>,
    auth_service: Rc<AuthService>,
}

impl<S, B> Service<ServiceRequest> for JwtMiddlewareService<S>
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

        Box::pin(async move {
            // Extract token from Authorization header
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
                        Err(_) => {
                            // Token is invalid
                            let response = HttpResponse::Unauthorized()
                                .json(serde_json::json!({
                                    "success": false,
                                    "error": "Invalid or expired token"
                                }));
                            Ok(req.into_response(response))
                        }
                    }
                }
                None => {
                    // No token provided
                    let response = HttpResponse::Unauthorized()
                        .json(serde_json::json!({
                            "success": false,
                            "error": "Authorization token required"
                        }));
                    Ok(req.into_response(response))
                }
            }
        })
    }
}

fn extract_token_from_request(req: &ServiceRequest) -> Option<String> {
    // Try to get token from Authorization header
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                return Some(auth_str[7..].to_string());
            }
        }
    }
    
    // Try to get token from query parameter (for testing)
    if let Some(token) = req.query_string().split('&')
        .find(|param| param.starts_with("token="))
        .and_then(|param| param.split('=').nth(1))
    {
        return Some(token.to_string());
    }
    
    None
}

// Helper function to extract claims from request in handlers
pub fn get_claims_from_request(req: &HttpRequest) -> Option<Claims> {
    req.extensions().get::<Claims>().cloned()
}
