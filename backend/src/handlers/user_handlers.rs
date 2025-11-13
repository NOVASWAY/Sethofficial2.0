use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use chrono::Utc;
use sqlx::Row;
use argon2::{Argon2, PasswordHasher, PasswordHash, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};

use crate::models::{User, CreateUser, UpdateUser, ApiResponse, PaginatedResponse};
use crate::AppState;
use crate::middleware::auth::get_current_user;
use crate::error::Validate;

pub async fn get_users(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let limit = query.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
    let role = query.get("role").and_then(|v| v.as_str());
    let department = query.get("department").and_then(|v| v.as_str());
    let is_active = query.get("is_active").and_then(|v| v.as_bool());

    let offset = (page - 1) * limit;

    let mut where_clause = String::new();
    let mut param_count = 0;

    if let Some(role_filter) = role {
        param_count += 1;
        where_clause.push_str(&format!(" AND role = ${}", param_count));
    }

    if let Some(dept_filter) = department {
        param_count += 1;
        where_clause.push_str(&format!(" AND department = ${}", param_count));
    }

    if let Some(active_filter) = is_active {
        param_count += 1;
        where_clause.push_str(&format!(" AND is_active = ${}", param_count));
    }

    let users_query = format!(
        "SELECT id, username, role, name, department, permissions, is_active, created_at, updated_at
         FROM users
         WHERE 1=1 {}
         ORDER BY created_at DESC 
         LIMIT {} OFFSET {}",
        where_clause, limit, offset
    );

    let count_query = format!(
        "SELECT COUNT(*) FROM users WHERE 1=1 {}",
        where_clause
    );

    let users_result = sqlx::query(&users_query)
        .fetch_all(&data.db_pool)
        .await;

    let count_result = sqlx::query_scalar::<_, i64>(&count_query)
        .fetch_one(&data.db_pool)
        .await;

    match (users_result, count_result) {
        (Ok(rows), Ok(total)) => {
            let users: Vec<serde_json::Value> = rows.iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, _>("id"),
                    "username": row.get::<String, _>("username"),
                    "role": row.get::<String, _>("role"),
                    "name": row.get::<String, _>("name"),
                    "department": row.get::<String, _>("department"),
                    "permissions": row.get::<serde_json::Value, _>("permissions"),
                    "is_active": row.get::<bool, _>("is_active"),
                    "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at")
                })
            }).collect();

            let paginated_response = PaginatedResponse {
                data: users,
                total,
                page: page as i32,
                per_page: limit as i32,
                total_pages: ((total as f64) / (limit as f64)).ceil() as i32,
            };

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!(paginated_response)),
                message: None,
                error: None,
            }))
        }
        (Err(e), _) | (_, Err(e)) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to fetch users: {}", e)),
            }))
        }
    }
}

pub async fn create_user(
    req: web::Json<CreateUser>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_data = req.into_inner();
    
    // Validate user data
    if let Err(validation_errors) = user_data.validate() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<serde_json::Value> {
            success: false,
            data: None,
            message: Some("Validation failed".to_string()),
            error: Some(validation_errors.to_api_error().message),
        }));
    }
    
    let user_id = Uuid::new_v4();
    let now = Utc::now();

    // Hash the password
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = match argon2.hash_password(user_data.password.as_bytes(), &salt) {
        Ok(hash) => hash.to_string(),
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to hash password: {}", e)),
            }));
        }
    };

    // Check if username already exists
    let existing_user = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM users WHERE username = $1"
    )
    .bind(&user_data.username)
    .fetch_one(&data.db_pool)
    .await;

    match existing_user {
        Ok(count) => {
            if count > 0 {
                return Ok(HttpResponse::Conflict().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("Username already exists".to_string()),
                }));
            }
        }
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to check existing user: {}", e)),
            }));
        }
    }

    let result = sqlx::query(
        r#"
        INSERT INTO users (
            id, username, password_hash, role, name, department, permissions, is_active, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        "#
    )
    .bind(user_id)
    .bind(&user_data.username)
    .bind(password_hash)
    .bind(&user_data.role)
    .bind(&user_data.name)
    .bind(&user_data.department)
    .bind(&user_data.permissions)
    .bind(true) // Default to active
    .bind(now)
    .bind(now)
    .execute(&data.db_pool)
    .await;

    match result {
        Ok(_) => {
            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(json!({"id": user_id})),
                message: Some("User created successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to create user: {}", e)),
            }))
        }
    }
}

pub async fn update_user(
    path: web::Path<Uuid>,
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = path.into_inner();
    let update_data = req.into_inner();
    let now = Utc::now();

    // Build dynamic update query based on provided fields
    let mut set_clauses = Vec::new();
    let mut param_count = 0;

    if let Some(username) = update_data.get("username").and_then(|v| v.as_str()) {
        param_count += 1;
        set_clauses.push(format!("username = ${}", param_count));
    }


    if let Some(password) = update_data.get("password").and_then(|v| v.as_str()) {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = match argon2.hash_password(password.as_bytes(), &salt) {
            Ok(hash) => hash.to_string(),
            Err(e) => {
                return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some(format!("Failed to hash password: {}", e)),
                }));
            }
        };
        param_count += 1;
        set_clauses.push(format!("password_hash = ${}", param_count));
    }

    if let Some(role) = update_data.get("role").and_then(|v| v.as_str()) {
        param_count += 1;
        set_clauses.push(format!("role = ${}", param_count));
    }

    if let Some(name) = update_data.get("name").and_then(|v| v.as_str()) {
        param_count += 1;
        set_clauses.push(format!("name = ${}", param_count));
    }

    if let Some(department) = update_data.get("department").and_then(|v| v.as_str()) {
        param_count += 1;
        set_clauses.push(format!("department = ${}", param_count));
    }

    if let Some(permissions) = update_data.get("permissions") {
        param_count += 1;
        set_clauses.push(format!("permissions = ${}", param_count));
    }

    if let Some(is_active) = update_data.get("is_active").and_then(|v| v.as_bool()) {
        param_count += 1;
        set_clauses.push(format!("is_active = ${}", param_count));
    }

    if set_clauses.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("No fields to update".to_string()),
        }));
    }

    param_count += 1;
    set_clauses.push(format!("updated_at = ${}", param_count));

    let update_query = format!(
        "UPDATE users SET {} WHERE id = ${}",
        set_clauses.join(", "),
        param_count + 1
    );

    let result = sqlx::query(&update_query)
        .bind(user_id)
        .execute(&data.db_pool)
        .await;

    match result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                    success: true,
                    data: None,
                    message: Some("User updated successfully".to_string()),
                    error: None,
                }))
            } else {
                Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("User not found".to_string()),
                }))
            }
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to update user: {}", e)),
            }))
        }
    }
}

pub async fn delete_user(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = path.into_inner();

    // Soft delete - set is_active to false instead of actually deleting
    let result = sqlx::query(
        "UPDATE users SET is_active = false, updated_at = $1 WHERE id = $2"
    )
    .bind(Utc::now())
    .bind(user_id)
    .execute(&data.db_pool)
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                    success: true,
                    data: None,
                    message: Some("User deactivated successfully".to_string()),
                    error: None,
                }))
            } else {
                Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("User not found".to_string()),
                }))
            }
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to delete user: {}", e)),
            }))
        }
    }
}

pub async fn get_user(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = path.into_inner();

    let result = sqlx::query(
        "SELECT id, username, role, name, department, permissions, is_active, created_at, updated_at
         FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(&data.db_pool)
    .await;

    match result {
        Ok(row) => {
            let user = json!({
                "id": row.get::<Uuid, _>("id"),
                "username": row.get::<String, _>("username"),
                "email": row.get::<String, _>("email"),
                "role": row.get::<String, _>("role"),
                "name": row.get::<String, _>("name"),
                "department": row.get::<String, _>("department"),
                "permissions": row.get::<serde_json::Value, _>("permissions"),
                "is_active": row.get::<bool, _>("is_active"),
                "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at")
            });

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(user),
                message: None,
                error: None,
            }))
        }
        Err(sqlx::Error::RowNotFound) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("User not found".to_string()),
            }))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to fetch user: {}", e)),
            }))
        }
    }
}

pub async fn update_user_permissions(
    path: web::Path<Uuid>,
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = path.into_inner();
    let update_data = req.into_inner();

    // Extract permissions from request
    let permissions = match update_data.get("permissions") {
        Some(perms) => perms.clone(),
        None => {
            return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Permissions field is required".to_string()),
            }));
        }
    };

    let result = sqlx::query(
        "UPDATE users SET permissions = $1, updated_at = $2 WHERE id = $3"
    )
    .bind(&permissions)
    .bind(Utc::now())
    .bind(user_id)
    .execute(&data.db_pool)
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                    success: true,
                    data: None,
                    message: Some("User permissions updated successfully".to_string()),
                    error: None,
                }))
            } else {
                Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("User not found".to_string()),
                }))
            }
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to update user permissions: {}", e)),
            }))
        }
    }
}

