use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use std::collections::HashMap;

use crate::models::{ApiResponse, Patient, Consultation, Prescription, Invoice};
use crate::auth::verify_jwt_token;

#[derive(Debug, Serialize, Deserialize)]
pub struct DataFilters {
    pub entity_type: String,
    pub user_id: Option<Uuid>,
    pub role: Option<String>,
    pub department: Option<String>,
    pub date_from: Option<chrono::NaiveDate>,
    pub date_to: Option<chrono::NaiveDate>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataAccessValidation {
    pub has_access: bool,
    pub permissions: Vec<String>,
    pub restrictions: Vec<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IsolationRule {
    pub id: Uuid,
    pub role: String,
    pub entity_type: String,
    pub filter_rules: serde_json::Value,
    pub permissions: serde_json::Value,
    pub is_active: bool,
}

// Get filtered patients based on user permissions
pub async fn get_filtered_patients(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    query: web::Query<HashMap<String, String>>,
) -> Result<HttpResponse> {
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Get user details
    let user = match sqlx::query!(
        "SELECT role, department FROM users WHERE id = $1",
        claims.user_id
    )
    .fetch_one(&**pool)
    .await
    {
        Ok(user) => user,
        Err(_) => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("User not found".to_string()),
                error: Some("User does not exist".to_string()),
            }));
        }
    };

    // Parse query parameters
    let limit = query
        .get("limit")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(50)
        .min(100);

    let offset = query
        .get("offset")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);

    let status_filter = query.get("status");
    let search_term = query.get("search");

    // Build query based on user role and permissions
    let patients = match build_filtered_patients_query(&pool, &claims.user_id, &user.role, &user.department, limit, offset, status_filter, search_term).await {
        Ok(patients) => patients,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch filtered patients".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(patients),
        message: Some("Filtered patients retrieved successfully".to_string()),
        error: None,
    }))
}

// Get filtered consultations based on user permissions
pub async fn get_filtered_consultations(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    query: web::Query<HashMap<String, String>>,
) -> Result<HttpResponse> {
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Get user details
    let user = match sqlx::query!(
        "SELECT role, department FROM users WHERE id = $1",
        claims.user_id
    )
    .fetch_one(&**pool)
    .await
    {
        Ok(user) => user,
        Err(_) => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("User not found".to_string()),
                error: Some("User does not exist".to_string()),
            }));
        }
    };

    // Parse query parameters
    let limit = query
        .get("limit")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(50)
        .min(100);

    let offset = query
        .get("offset")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);

    let status_filter = query.get("status");
    let date_from = query.get("date_from").and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let date_to = query.get("date_to").and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    // Build query based on user role and permissions
    let consultations = match build_filtered_consultations_query(&pool, &claims.user_id, &user.role, &user.department, limit, offset, status_filter, date_from, date_to).await {
        Ok(consultations) => consultations,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch filtered consultations".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(consultations),
        message: Some("Filtered consultations retrieved successfully".to_string()),
        error: None,
    }))
}

// Get filtered prescriptions based on user permissions
pub async fn get_filtered_prescriptions(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    query: web::Query<HashMap<String, String>>,
) -> Result<HttpResponse> {
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Get user details
    let user = match sqlx::query!(
        "SELECT role, department FROM users WHERE id = $1",
        claims.user_id
    )
    .fetch_one(&**pool)
    .await
    {
        Ok(user) => user,
        Err(_) => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("User not found".to_string()),
                error: Some("User does not exist".to_string()),
            }));
        }
    };

    // Parse query parameters
    let limit = query
        .get("limit")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(50)
        .min(100);

    let offset = query
        .get("offset")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);

    let status_filter = query.get("status");

    // Build query based on user role and permissions
    let prescriptions = match build_filtered_prescriptions_query(&pool, &claims.user_id, &user.role, &user.department, limit, offset, status_filter).await {
        Ok(prescriptions) => prescriptions,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch filtered prescriptions".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(prescriptions),
        message: Some("Filtered prescriptions retrieved successfully".to_string()),
        error: None,
    }))
}

// Get filtered invoices based on user permissions
pub async fn get_filtered_invoices(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    query: web::Query<HashMap<String, String>>,
) -> Result<HttpResponse> {
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Get user details
    let user = match sqlx::query!(
        "SELECT role, department FROM users WHERE id = $1",
        claims.user_id
    )
    .fetch_one(&**pool)
    .await
    {
        Ok(user) => user,
        Err(_) => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("User not found".to_string()),
                error: Some("User does not exist".to_string()),
            }));
        }
    };

    // Parse query parameters
    let limit = query
        .get("limit")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(50)
        .min(100);

    let offset = query
        .get("offset")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);

    let status_filter = query.get("status");
    let date_from = query.get("date_from").and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let date_to = query.get("date_to").and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    // Build query based on user role and permissions
    let invoices = match build_filtered_invoices_query(&pool, &claims.user_id, &user.role, &user.department, limit, offset, status_filter, date_from, date_to).await {
        Ok(invoices) => invoices,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch filtered invoices".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(invoices),
        message: Some("Filtered invoices retrieved successfully".to_string()),
        error: None,
    }))
}

// Validate data access permissions
pub async fn validate_data_access(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    validation_data: web::Json<DataFilters>,
) -> Result<HttpResponse> {
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Get user details
    let user = match sqlx::query!(
        "SELECT role, department FROM users WHERE id = $1",
        claims.user_id
    )
    .fetch_one(&**pool)
    .await
    {
        Ok(user) => user,
        Err(_) => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("User not found".to_string()),
                error: Some("User does not exist".to_string()),
            }));
        }
    };

    // Get isolation rules for the user's role and entity type
    let isolation_rule = match sqlx::query_as!(
        IsolationRule,
        "SELECT id, role, entity_type, filter_rules, permissions, is_active
         FROM data_isolation_rules 
         WHERE role = $1 AND entity_type = $2 AND is_active = true",
        user.role,
        validation_data.entity_type
    )
    .fetch_optional(&**pool)
    .await
    {
        Ok(Some(rule)) => rule,
        Ok(None) => {
            return Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(DataAccessValidation {
                    has_access: false,
                    permissions: vec![],
                    restrictions: vec!["No access rules defined for this role and entity type".to_string()],
                    reason: Some("No isolation rule found".to_string()),
                }),
                message: Some("Data access validation completed".to_string()),
                error: None,
            }));
        }
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to validate data access".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    // Parse permissions from JSON
    let permissions = match isolation_rule.permissions.as_object() {
        Some(perms) => {
            let mut permission_list = Vec::new();
            for (key, value) in perms {
                if value.as_bool().unwrap_or(false) {
                    permission_list.push(key.clone());
                }
            }
            permission_list
        }
        None => vec![],
    };

    // Check if user has access
    let has_access = !permissions.is_empty();

    // Build restrictions list
    let mut restrictions = Vec::new();
    if !has_access {
        restrictions.push("No permissions granted for this entity type".to_string());
    }

    let validation = DataAccessValidation {
        has_access,
        permissions,
        restrictions,
        reason: if has_access { None } else { Some("Insufficient permissions".to_string()) },
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(validation),
        message: Some("Data access validation completed".to_string()),
        error: None,
    }))
}

// Helper function to build filtered patients query
async fn build_filtered_patients_query(
    pool: &PgPool,
    user_id: &Uuid,
    role: &str,
    department: &str,
    limit: i64,
    offset: i64,
    status_filter: Option<&String>,
    search_term: Option<&String>,
) -> Result<Vec<Patient>, sqlx::Error> {
    let mut query_builder = sqlx::QueryBuilder::new(
        "SELECT id, first_name, last_name, date_of_birth, gender, phone_number, 
                location, insurance_number, created_at, updated_at 
         FROM patients"
    );

    let mut conditions = Vec::new();
    let mut param_count = 0;

    // Apply role-based filtering
    match role {
        "admin" => {
            // Admin can see all patients
        }
        "receptionist" => {
            param_count += 1;
            conditions.push(format!("created_by = ${}", param_count));
        }
        _ => {
            // Other roles can see patients from their department
            param_count += 1;
            conditions.push(format!("department = ${}", param_count));
        }
    }

    // Apply status filter if provided
    if let Some(status) = status_filter {
        param_count += 1;
        conditions.push(format!("status = ${}", param_count));
    }

    // Apply search term if provided
    if let Some(search) = search_term {
        param_count += 1;
        conditions.push(format!("(first_name ILIKE ${} OR last_name ILIKE ${} OR phone_number ILIKE ${})", param_count, param_count, param_count));
    }

    if !conditions.is_empty() {
        query_builder.push(" WHERE ");
        query_builder.push(conditions.join(" AND "));
    }

    query_builder.push(" ORDER BY created_at DESC LIMIT $");
    param_count += 1;
    query_builder.push(param_count);
    query_builder.push(" OFFSET $");
    param_count += 1;
    query_builder.push(param_count);

    // Build parameters vector
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();

    match role {
        "receptionist" => {
            params.push(Box::new(user_id.clone()));
        }
        _ => {
            params.push(Box::new(department.to_string()));
        }
    }

    if let Some(status) = status_filter {
        params.push(Box::new(status.clone()));
    }

    if let Some(search) = search_term {
        let search_pattern = format!("%{}%", search);
        params.push(Box::new(search_pattern.clone()));
    }

    params.push(Box::new(limit));
    params.push(Box::new(offset));

    // Execute query
    let patients = sqlx::query_as::<_, Patient>(&query_builder.build().sql())
        .bind_all(params.iter().map(|p| p.as_ref()))
        .fetch_all(pool)
        .await?;

    Ok(patients)
}

// Helper function to build filtered consultations query
async fn build_filtered_consultations_query(
    pool: &PgPool,
    user_id: &Uuid,
    role: &str,
    department: &str,
    limit: i64,
    offset: i64,
    status_filter: Option<&String>,
    date_from: Option<chrono::NaiveDate>,
    date_to: Option<chrono::NaiveDate>,
) -> Result<Vec<Consultation>, sqlx::Error> {
    let mut query_builder = sqlx::QueryBuilder::new(
        "SELECT c.id, c.patient_id, c.doctor_id, c.date, c.time, c.notes, 
                c.diagnosis, c.treatment_plan, c.follow_up_date, c.status, 
                c.created_at, c.updated_at 
         FROM consultations c"
    );

    let mut conditions = Vec::new();
    let mut param_count = 0;

    // Apply role-based filtering
    match role {
        "admin" => {
            // Admin can see all consultations
        }
        "clinician" | "nurse" => {
            param_count += 1;
            conditions.push(format!("c.doctor_id = ${}", param_count));
        }
        _ => {
            // Other roles can see consultations from their department
            param_count += 1;
            conditions.push(format!("u.department = ${}", param_count));
            query_builder.push(" JOIN users u ON c.doctor_id = u.id");
        }
    }

    // Apply status filter if provided
    if let Some(status) = status_filter {
        param_count += 1;
        conditions.push(format!("c.status = ${}", param_count));
    }

    // Apply date filters if provided
    if let Some(date_from) = date_from {
        param_count += 1;
        conditions.push(format!("c.date >= ${}", param_count));
    }

    if let Some(date_to) = date_to {
        param_count += 1;
        conditions.push(format!("c.date <= ${}", param_count));
    }

    if !conditions.is_empty() {
        query_builder.push(" WHERE ");
        query_builder.push(conditions.join(" AND "));
    }

    query_builder.push(" ORDER BY c.created_at DESC LIMIT $");
    param_count += 1;
    query_builder.push(param_count);
    query_builder.push(" OFFSET $");
    param_count += 1;
    query_builder.push(param_count);

    // Build parameters vector
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();

    match role {
        "clinician" | "nurse" => {
            params.push(Box::new(user_id.clone()));
        }
        _ => {
            params.push(Box::new(department.to_string()));
        }
    }

    if let Some(status) = status_filter {
        params.push(Box::new(status.clone()));
    }

    if let Some(date_from) = date_from {
        params.push(Box::new(date_from));
    }

    if let Some(date_to) = date_to {
        params.push(Box::new(date_to));
    }

    params.push(Box::new(limit));
    params.push(Box::new(offset));

    // Execute query
    let consultations = sqlx::query_as::<_, Consultation>(&query_builder.build().sql())
        .bind_all(params.iter().map(|p| p.as_ref()))
        .fetch_all(pool)
        .await?;

    Ok(consultations)
}

// Helper function to build filtered prescriptions query
async fn build_filtered_prescriptions_query(
    pool: &PgPool,
    user_id: &Uuid,
    role: &str,
    department: &str,
    limit: i64,
    offset: i64,
    status_filter: Option<&String>,
) -> Result<Vec<Prescription>, sqlx::Error> {
    let mut query_builder = sqlx::QueryBuilder::new(
        "SELECT p.id, p.patient_id, p.doctor_id, p.medicine_id, p.dosage, 
                p.frequency, p.duration, p.instructions, p.status, p.assigned_to, 
                p.created_at, p.updated_at 
         FROM prescriptions p"
    );

    let mut conditions = Vec::new();
    let mut param_count = 0;

    // Apply role-based filtering
    match role {
        "admin" => {
            // Admin can see all prescriptions
        }
        "clinician" => {
            param_count += 1;
            conditions.push(format!("p.doctor_id = ${}", param_count));
        }
        "pharmacist" => {
            param_count += 1;
            conditions.push(format!("p.assigned_to = ${}", param_count));
        }
        _ => {
            // Other roles can see prescriptions from their department
            param_count += 1;
            conditions.push(format!("u.department = ${}", param_count));
            query_builder.push(" JOIN users u ON p.doctor_id = u.id");
        }
    }

    // Apply status filter if provided
    if let Some(status) = status_filter {
        param_count += 1;
        conditions.push(format!("p.status = ${}", param_count));
    }

    if !conditions.is_empty() {
        query_builder.push(" WHERE ");
        query_builder.push(conditions.join(" AND "));
    }

    query_builder.push(" ORDER BY p.created_at DESC LIMIT $");
    param_count += 1;
    query_builder.push(param_count);
    query_builder.push(" OFFSET $");
    param_count += 1;
    query_builder.push(param_count);

    // Build parameters vector
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();

    match role {
        "clinician" => {
            params.push(Box::new(user_id.clone()));
        }
        "pharmacist" => {
            params.push(Box::new(user_id.clone()));
        }
        _ => {
            params.push(Box::new(department.to_string()));
        }
    }

    if let Some(status) = status_filter {
        params.push(Box::new(status.clone()));
    }

    params.push(Box::new(limit));
    params.push(Box::new(offset));

    // Execute query
    let prescriptions = sqlx::query_as::<_, Prescription>(&query_builder.build().sql())
        .bind_all(params.iter().map(|p| p.as_ref()))
        .fetch_all(pool)
        .await?;

    Ok(prescriptions)
}

// Helper function to build filtered invoices query
async fn build_filtered_invoices_query(
    pool: &PgPool,
    user_id: &Uuid,
    role: &str,
    department: &str,
    limit: i64,
    offset: i64,
    status_filter: Option<&String>,
    date_from: Option<chrono::NaiveDate>,
    date_to: Option<chrono::NaiveDate>,
) -> Result<Vec<Invoice>, sqlx::Error> {
    let mut query_builder = sqlx::QueryBuilder::new(
        "SELECT i.id, i.patient_id, i.consultation_id, i.total_amount, i.paid_amount, 
                i.balance, i.status, i.payment_method, i.payment_date, i.created_by, 
                i.created_at, i.updated_at 
         FROM invoices i"
    );

    let mut conditions = Vec::new();
    let mut param_count = 0;

    // Apply role-based filtering
    match role {
        "admin" => {
            // Admin can see all invoices
        }
        "receptionist" => {
            param_count += 1;
            conditions.push(format!("i.created_by = ${}", param_count));
        }
        _ => {
            // Other roles can see invoices from their department
            param_count += 1;
            conditions.push(format!("u.department = ${}", param_count));
            query_builder.push(" JOIN consultations c ON i.consultation_id = c.id");
            query_builder.push(" JOIN users u ON c.doctor_id = u.id");
        }
    }

    // Apply status filter if provided
    if let Some(status) = status_filter {
        param_count += 1;
        conditions.push(format!("i.status = ${}", param_count));
    }

    // Apply date filters if provided
    if let Some(date_from) = date_from {
        param_count += 1;
        conditions.push(format!("i.created_at >= ${}", param_count));
    }

    if let Some(date_to) = date_to {
        param_count += 1;
        conditions.push(format!("i.created_at <= ${}", param_count));
    }

    if !conditions.is_empty() {
        query_builder.push(" WHERE ");
        query_builder.push(conditions.join(" AND "));
    }

    query_builder.push(" ORDER BY i.created_at DESC LIMIT $");
    param_count += 1;
    query_builder.push(param_count);
    query_builder.push(" OFFSET $");
    param_count += 1;
    query_builder.push(param_count);

    // Build parameters vector
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();

    match role {
        "receptionist" => {
            params.push(Box::new(user_id.clone()));
        }
        _ => {
            params.push(Box::new(department.to_string()));
        }
    }

    if let Some(status) = status_filter {
        params.push(Box::new(status.clone()));
    }

    if let Some(date_from) = date_from {
        params.push(Box::new(date_from));
    }

    if let Some(date_to) = date_to {
        params.push(Box::new(date_to));
    }

    params.push(Box::new(limit));
    params.push(Box::new(offset));

    // Execute query
    let invoices = sqlx::query_as::<_, Invoice>(&query_builder.build().sql())
        .bind_all(params.iter().map(|p| p.as_ref()))
        .fetch_all(pool)
        .await?;

    Ok(invoices)
}
