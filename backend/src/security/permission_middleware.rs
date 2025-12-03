use actix_web::{dev::ServiceRequest, Error, HttpMessage, Result};
use actix_web::dev::{ServiceResponse, Transform};
use actix_web::body::BoxBody;
use actix_web::middleware::Next;
use actix_web::web::Data;
use actix_web::HttpRequest;
use futures_util::future::{ok, Ready};
use std::collections::HashMap;
use std::rc::Rc;
use uuid::Uuid;

use crate::auth::Claims;
use crate::security::permission_validator::{AccessRequest, PermissionValidator};

pub struct PermissionMiddleware {
    validator: Rc<PermissionValidator>,
}

impl PermissionMiddleware {
    pub fn new() -> Self {
        Self {
            validator: Rc::new(PermissionValidator::new()),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for PermissionMiddleware
where
    S: actix_web::dev::Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: actix_web::body::MessageBody + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type Transform = PermissionMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(PermissionMiddlewareService {
            service: Rc::new(service),
            validator: self.validator.clone(),
        })
    }
}

pub struct PermissionMiddlewareService<S> {
    service: Rc<S>,
    validator: Rc<PermissionValidator>,
}

impl<S, B> actix_web::dev::Service<ServiceRequest> for PermissionMiddlewareService<S>
where
    S: actix_web::dev::Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: actix_web::body::MessageBody + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type Future = std::pin::Pin<Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&self, cx: &mut std::task::Context<'_>) -> std::task::Poll<Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let validator = self.validator.clone();

        Box::pin(async move {
            // Extract claims from request extensions before moving req
            let should_deny = if let Some(claims) = req.extensions().get::<Claims>() {
                // Determine resource and action from the request
                let (resource, action) = extract_resource_and_action(&req);
                
                // Create access request
                let access_request = AccessRequest {
                    user_id: claims.user_id,
                    role: claims.role.clone(),
                    department: claims.department.clone(),
                    resource: resource.to_string(),
                    action: action.to_string(),
                    entity_id: extract_entity_id(&req),
                    entity_data: None, // Could be populated from request body if needed
                    context: Some(create_request_context(&req)),
                };

                // Validate access
                let decision = validator.validate_access(&access_request);
                
                if !decision.allowed {
                    // Log the access denial
                    log::warn!(
                        "Access denied for user {} (role: {}) to {}:{} - {}",
                        claims.user_id,
                        claims.role,
                        resource,
                        action,
                        decision.reason.as_deref().unwrap_or("Unknown reason")
                    );

                    // Return 403 Forbidden
                    let (req_parts, _) = req.into_parts();
                    let response = actix_web::HttpResponse::Forbidden()
                        .json(serde_json::json!({
                            "success": false,
                            "message": "Access denied",
                            "error": decision.reason,
                            "resource": resource,
                            "action": action
                        }));
                    return Ok(ServiceResponse::new(req_parts, response).map_into_boxed_body());
                }

                // Log successful access
                log::debug!(
                    "Access granted for user {} (role: {}) to {}:{}",
                    claims.user_id,
                    claims.role,
                    resource,
                    action
                );
                false
            } else {
                false
            };

            // Continue with the request
            service.call(req).await.map(|res| res.map_into_boxed_body())
        })
    }
}

fn extract_resource_and_action(req: &ServiceRequest) -> (&str, &str) {
    let path = req.path();
    let method = req.method().as_str();

    // Extract resource from path
    let resource = if path.starts_with("/api/v1/") {
        let path_parts: Vec<&str> = path.split('/').collect();
        if path_parts.len() > 3 {
            path_parts[3] // e.g., "patients", "consultations", etc.
        } else {
            "unknown"
        }
    } else {
        "unknown"
    };

    // Map HTTP method to action
    let action = match method {
        "GET" => "read",
        "POST" => "write",
        "PUT" | "PATCH" => "write",
        "DELETE" => "delete",
        _ => "unknown",
    };

    (resource, action)
}

fn extract_entity_id(req: &ServiceRequest) -> Option<Uuid> {
    // Try to extract entity ID from path parameters
    if let Some(path_params) = req.match_info().get("id") {
        if let Ok(uuid) = Uuid::parse_str(path_params) {
            return Some(uuid);
        }
    }

    // Try to extract from query parameters
    if let Some(id_param) = req.query_string().split('&')
        .find(|param| param.starts_with("id="))
        .and_then(|param| param.split('=').nth(1))
    {
        if let Ok(uuid) = Uuid::parse_str(id_param) {
            return Some(uuid);
        }
    }

    None
}

fn create_request_context(req: &ServiceRequest) -> HashMap<String, serde_json::Value> {
    let mut context = HashMap::new();
    
    context.insert("method".to_string(), serde_json::Value::String(req.method().to_string()));
    context.insert("path".to_string(), serde_json::Value::String(req.path().to_string()));
    context.insert("user_agent".to_string(), serde_json::Value::String(
        req.headers().get("User-Agent")
            .and_then(|h| h.to_str().ok())
            .unwrap_or("unknown")
            .to_string()
    ));
    context.insert("ip_address".to_string(), serde_json::Value::String(
        req.connection_info().remote_addr().unwrap_or("unknown").to_string()
    ));
    context.insert("timestamp".to_string(), serde_json::Value::String(
        chrono::Utc::now().to_rfc3339()
    ));

    // Add query parameters
    if !req.query_string().is_empty() {
        let query_params: HashMap<String, String> = req.query_string()
            .split('&')
            .filter_map(|param| {
                let mut parts = param.split('=');
                if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
                    Some((key.to_string(), value.to_string()))
                } else {
                    None
                }
            })
            .collect();
        
        context.insert("query_params".to_string(), serde_json::to_value(query_params).unwrap_or(serde_json::Value::Null));
    }

    context
}

// Helper function to validate access in handlers
pub fn validate_access(
    claims: &Claims,
    resource: &str,
    action: &str,
    entity_id: Option<Uuid>,
    validator: &PermissionValidator,
) -> Result<(), actix_web::Error> {
    let decision = validator.validate_claims_access(claims, resource, action, entity_id);
    
    if !decision.allowed {
        log::warn!(
            "Access denied for user {} (role: {}) to {}:{} - {}",
            claims.user_id,
            claims.role,
            resource,
            action,
            decision.reason.as_deref().unwrap_or("Unknown reason")
        );

        return Err(actix_web::error::ErrorForbidden(
            decision.reason.unwrap_or_else(|| "Access denied".to_string())
        ));
    }

    Ok(())
}

// Helper function to get data isolation rules
pub fn get_data_isolation_rules(
    role: &str,
    resource: &str,
    validator: &PermissionValidator,
) -> Option<serde_json::Value> {
    validator.get_data_isolation_rules(role, resource)
}

// Helper function to create filtered query conditions
pub fn create_filtered_query_conditions(
    claims: &Claims,
    resource: &str,
    validator: &PermissionValidator,
) -> HashMap<String, serde_json::Value> {
    let mut conditions = HashMap::new();

    if let Some(isolation_rules) = validator.get_data_isolation_rules(&claims.role, resource) {
        if let Some(filter) = isolation_rules.get("filter") {
            if let Some(filter_str) = filter.as_str() {
                // Replace $USER_ID placeholder with actual user ID
                let processed_filter = filter_str.replace("$USER_ID", &claims.user_id.to_string());
                
                // Parse the filter and add to conditions
                // This is a simplified implementation - in practice, you'd want more sophisticated parsing
                if processed_filter.contains("assigned_clinician_id") {
                    conditions.insert("assigned_clinician_id".to_string(), serde_json::Value::String(claims.user_id.to_string()));
                }
                if processed_filter.contains("assigned_nurse_id") {
                    conditions.insert("assigned_nurse_id".to_string(), serde_json::Value::String(claims.user_id.to_string()));
                }
                if processed_filter.contains("doctor_id") {
                    conditions.insert("doctor_id".to_string(), serde_json::Value::String(claims.user_id.to_string()));
                }
                if processed_filter.contains("prescribing_doctor_id") {
                    conditions.insert("prescribing_doctor_id".to_string(), serde_json::Value::String(claims.user_id.to_string()));
                }
                if processed_filter.contains("department") {
                    if let Some(department) = &claims.department {
                        conditions.insert("department".to_string(), serde_json::Value::String(department.clone()));
                    }
                }
            }
        }
    }

    conditions
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test::TestRequest;
    use actix_web::web::Data;

    #[test]
    fn test_extract_resource_and_action() {
        let req = TestRequest::get()
            .uri("/api/v1/patients/123")
            .to_srv_request();
        
        let (resource, action) = extract_resource_and_action(&req);
        assert_eq!(resource, "patients");
        assert_eq!(action, "read");
    }

    #[test]
    fn test_extract_entity_id() {
        let req = TestRequest::get()
            .uri("/api/v1/patients/550e8400-e29b-41d4-a716-446655440000")
            .to_srv_request();
        
        let entity_id = extract_entity_id(&req);
        assert!(entity_id.is_some());
    }
}
