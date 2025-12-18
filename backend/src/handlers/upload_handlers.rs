use actix_multipart::Multipart;
use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use std::path::Path;
use std::fs;
use std::io::Write;
use futures_util::stream::TryStreamExt;
use sqlx::Row;

use crate::models::ApiResponse;
use crate::AppState;
use crate::middleware::auth::get_current_user;

pub async fn upload_avatar(
    mut payload: Multipart,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Unauthorized"))?;

    // Create uploads directory if it doesn't exist
    let uploads_dir = Path::new("uploads/avatars");
    if !uploads_dir.exists() {
        fs::create_dir_all(uploads_dir)
            .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to create directory: {}", e)))?;
    }

    let mut file_data = Vec::new();
    let mut filename = String::new();
    let mut content_type = String::new();

    // Process multipart data
    while let Some(item) = payload.try_next().await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Multipart error: {}", e)))? {
        
        let field = item.content_disposition();
            if field.get_name() == Some("avatar") {
                if let Some(name) = field.get_filename() {
                    filename = name.to_string();
                }
                
                if let Some(ct) = item.content_type() {
                    content_type = ct.to_string();
                }

                // Read file data
                let mut bytes = Vec::new();
                let mut stream = item;
                while let Some(chunk) = stream.try_next().await
                    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Stream error: {}", e)))? {
                    bytes.extend_from_slice(&chunk);
                }
                file_data = bytes;
                break;
            }
    }

    if file_data.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("No file uploaded".to_string()),
        }));
    }

    // Generate unique filename
    let file_id = Uuid::new_v4();
    let file_extension = Path::new(&filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("bin");
    let new_filename = format!("{}.{}", file_id, file_extension);
    let file_path = uploads_dir.join(&new_filename);

    // Save file to disk
    let mut file = fs::File::create(&file_path)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to create file: {}", e)))?;
    file.write_all(&file_data)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to write file: {}", e)))?;

    // Save file metadata to database
    let file_size = file_data.len() as i64;
    let file_type = "avatar".to_string();
    let entity_type = "user".to_string();
    let entity_id = Uuid::parse_str(&_claims.sub).unwrap_or_default();
    let uploaded_by = Uuid::parse_str(&_claims.sub).unwrap_or_default();
    let description = format!("Avatar for user {}", _claims.username);
    let is_public = false;

    let result = sqlx::query(
        r#"
        INSERT INTO files (
            filename, original_filename, file_path, file_size, mime_type, file_type,
            entity_type, entity_id, uploaded_by, description, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, created_at
        "#
    )
    .bind(&new_filename)
    .bind(&filename)
    .bind(file_path.to_string_lossy().to_string())
    .bind(file_size)
    .bind(&content_type)
    .bind(&file_type)
    .bind(&entity_type)
    .bind(entity_id)
    .bind(uploaded_by)
    .bind(&description)
    .bind(is_public)
    .fetch_one(&data.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Database error: {}", e)))?;

    let inserted_id: Uuid = result.get("id");
    let created_at: chrono::DateTime<chrono::Utc> = result.get("created_at");

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
        "id": inserted_id,
        "filename": new_filename,
        "original_filename": filename,
        "file_size": file_size,
        "mime_type": content_type,
        "file_type": file_type,
        "created_at": created_at
    })),
        message: Some("File uploaded successfully".to_string()),
        error: None,
    }))
}

pub async fn upload_document(
    mut payload: Multipart,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Unauthorized"))?;

    // Create uploads directory if it doesn't exist
    let uploads_dir = Path::new("uploads/documents");
    if !uploads_dir.exists() {
        fs::create_dir_all(uploads_dir)
            .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to create directory: {}", e)))?;
    }

    let mut file_data = Vec::new();
    let mut filename = String::new();
    let mut content_type = String::new();
    let mut entity_type = String::new();
    let mut entity_id: Option<Uuid> = None;
    let mut description = String::new();

    // Process multipart data
    while let Some(item) = payload.try_next().await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Multipart error: {}", e)))? {
        
        let field = item.content_disposition();
        if field.get_name() == Some("document") {
            if let Some(name) = field.get_filename() {
                filename = name.to_string();
            }
            
            if let Some(ct) = item.content_type() {
                content_type = ct.to_string();
            }

            // Read file data
            let mut bytes = Vec::new();
            let mut stream = item;
            while let Some(chunk) = stream.try_next().await
                .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Stream error: {}", e)))? {
                bytes.extend_from_slice(&chunk);
            }
            file_data = bytes;
        } else if field.get_name() == Some("entity_type") {
            let mut bytes = Vec::new();
            let mut stream = item;
            while let Some(chunk) = stream.try_next().await
                .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Stream error: {}", e)))? {
                bytes.extend_from_slice(&chunk);
            }
            entity_type = String::from_utf8_lossy(&bytes).to_string();
        } else if field.get_name() == Some("entity_id") {
            let mut bytes = Vec::new();
            let mut stream = item;
            while let Some(chunk) = stream.try_next().await
                .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Stream error: {}", e)))? {
                bytes.extend_from_slice(&chunk);
            }
            let entity_id_str = String::from_utf8_lossy(&bytes).to_string();
            entity_id = Uuid::parse_str(&entity_id_str).ok();
        } else if field.get_name() == Some("description") {
            let mut bytes = Vec::new();
            let mut stream = item;
            while let Some(chunk) = stream.try_next().await
                .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Stream error: {}", e)))? {
                bytes.extend_from_slice(&chunk);
            }
            description = String::from_utf8_lossy(&bytes).to_string();
        }
    }

    if file_data.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("No file uploaded".to_string()),
        }));
    }

    if entity_type.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Entity type is required".to_string()),
        }));
    }

    // Generate unique filename
    let file_id = Uuid::new_v4();
    let file_extension = Path::new(&filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("bin");
    let new_filename = format!("{}.{}", file_id, file_extension);
    let file_path = uploads_dir.join(&new_filename);

    // Save file to disk
    let mut file = fs::File::create(&file_path)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to create file: {}", e)))?;
    file.write_all(&file_data)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to write file: {}", e)))?;

    // Save file metadata to database
    let file_size = file_data.len() as i64;
    let file_type = "document".to_string();
    let uploaded_by = Uuid::parse_str(&_claims.sub).unwrap_or_default();
    let is_public = false;

    let result = sqlx::query(
        r#"
        INSERT INTO files (
            filename, original_filename, file_path, file_size, mime_type, file_type,
            entity_type, entity_id, uploaded_by, description, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, created_at
        "#
    )
    .bind(&new_filename)
    .bind(&filename)
    .bind(file_path.to_string_lossy().to_string())
    .bind(file_size)
    .bind(&content_type)
    .bind(&file_type)
    .bind(&entity_type)
    .bind(entity_id)
    .bind(uploaded_by)
    .bind(&description)
    .bind(is_public)
    .fetch_one(&data.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Database error: {}", e)))?;

    let inserted_id: Uuid = result.get("id");
    let created_at: chrono::DateTime<chrono::Utc> = result.get("created_at");

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
        "id": inserted_id,
        "filename": new_filename,
        "original_filename": filename,
        "file_size": file_size,
        "mime_type": content_type,
        "file_type": file_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "description": description,
        "created_at": created_at
    })),
        message: Some("File uploaded successfully".to_string()),
        error: None,
    }))
}

pub async fn get_file(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Unauthorized"))?;

    let file_id = path.into_inner();

    let file = sqlx::query(
        r#"
        SELECT id, filename, original_filename, file_path, file_size, mime_type, file_type,
               entity_type, entity_id, uploaded_by, description, is_public, created_at
        FROM files
        WHERE id = $1
        "#
    )
    .bind(file_id)
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Database error: {}", e)))?;

    match file {
        Some(file) => {
            // Check if user has access to this file
            let is_public: bool = file.try_get("is_public").unwrap_or(false);
            let uploaded_by: Option<Uuid> = file.try_get("uploaded_by").ok();
            if !is_public && uploaded_by != Some(Uuid::parse_str(&_claims.sub).unwrap_or_default()) {
                return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Access denied".to_string()),
        }));
            }

            Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
                "id": file.get::<Uuid,_>("id"),
                "filename": file.get::<String,_>("filename"),
                "original_filename": file.get::<String,_>("original_filename"),
                "file_path": file.get::<String,_>("file_path"),
                "file_size": file.get::<i64,_>("file_size"),
                "mime_type": file.get::<String,_>("mime_type"),
                "file_type": file.get::<String,_>("file_type"),
                "entity_type": file.get::<String,_>("entity_type"),
                "entity_id": file.get::<Uuid,_>("entity_id"),
                "uploaded_by": uploaded_by,
                "description": file.try_get::<String,_>("description").ok(),
                "is_public": is_public,
            "created_at": file.get::<chrono::DateTime<chrono::Utc>,_>("created_at")
        })),
        message: Some("File retrieved successfully".to_string()),
        error: None,
    }))
        }
        None => Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("File not found".to_string()),
        }))
    }
}

pub async fn get_files(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Unauthorized"))?;

    let entity_type = query.get("entity_type").and_then(|v| v.as_str());
    let entity_id = query.get("entity_id").and_then(|v| v.as_str());
    let file_type = query.get("file_type").and_then(|v| v.as_str());
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(20);

    let offset = (page - 1) * per_page;

    let mut where_clause = String::from("WHERE (is_public = true OR uploaded_by = $1)");
    let mut param_count = 1;
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = vec![Box::new(Uuid::parse_str(&_claims.sub).unwrap_or_default())];

    if let Some(entity_type) = entity_type {
        param_count += 1;
        where_clause.push_str(&format!(" AND entity_type = ${}", param_count));
        params.push(Box::new(entity_type.to_string()));
    }

    if let Some(entity_id) = entity_id {
        if let Ok(entity_uuid) = Uuid::parse_str(entity_id) {
            param_count += 1;
            where_clause.push_str(&format!(" AND entity_id = ${}", param_count));
            params.push(Box::new(entity_uuid));
        }
    }

    if let Some(file_type) = file_type {
        param_count += 1;
        where_clause.push_str(&format!(" AND file_type = ${}", param_count));
        params.push(Box::new(file_type.to_string()));
    }

    // Get total count
    let count_query = format!("SELECT COUNT(*) as total FROM files {}", where_clause);
    let total: i64 = sqlx::query_scalar(&count_query)
        .bind(&Uuid::parse_str(&_claims.sub).unwrap_or_default())
        .fetch_one(&data.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Database error: {}", e)))?;

    // Get files
    let files_query = format!(
        r#"
        SELECT id, filename, original_filename, file_path, file_size, mime_type, file_type,
               entity_type, entity_id, uploaded_by, description, is_public, created_at
        FROM files {}
        ORDER BY created_at DESC
        LIMIT ${} OFFSET ${}
        "#,
        where_clause,
        param_count + 1,
        param_count + 2
    );

    let files = sqlx::query(&files_query)
        .bind(&Uuid::parse_str(&_claims.sub).unwrap_or_default())
        .fetch_all(&data.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Database error: {}", e)))?;

    let files_data: Vec<serde_json::Value> = files.iter().map(|row| {
        json!({
            "id": row.get::<Uuid, _>("id"),
            "filename": row.get::<String, _>("filename"),
            "original_filename": row.get::<String, _>("original_filename"),
            "file_path": row.get::<String, _>("file_path"),
            "file_size": row.get::<i64, _>("file_size"),
            "mime_type": row.get::<String, _>("mime_type"),
            "file_type": row.get::<String, _>("file_type"),
            "entity_type": row.get::<Option<String>, _>("entity_type"),
            "entity_id": row.get::<Option<Uuid>, _>("entity_id"),
            "uploaded_by": row.get::<Option<Uuid>, _>("uploaded_by"),
            "description": row.get::<Option<String>, _>("description"),
            "is_public": row.get::<Option<bool>, _>("is_public").unwrap_or(false),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
        })
    }).collect();

    let total_pages = (total as f64 / per_page as f64).ceil() as i32;

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
        "data": files_data,
        "pagination": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages
        }
    })),
        message: Some("Files retrieved successfully".to_string()),
        error: None,
    }))
}

pub async fn delete_file(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Unauthorized"))?;

    let file_id = path.into_inner();

    // Get file info first
    let file = sqlx::query(
        r#"
        SELECT filename, file_path, uploaded_by
        FROM files
        WHERE id = $1
        "#
    )
    .bind(file_id)
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Database error: {}", e)))?;

    match file {
        Some(file) => {
            // Check if user has permission to delete this file
            let uploaded_by: Option<Uuid> = file.try_get("uploaded_by").ok();
            let file_path: String = file.get("file_path");
            if uploaded_by != Some(Uuid::parse_str(&_claims.sub).unwrap_or_default()) {
                return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Access denied".to_string()),
        }));
            }

            // Delete file from disk
            let file_path = Path::new(&file_path);
            if file_path.exists() {
                fs::remove_file(file_path)
                    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to delete file: {}", e)))?;
            }

            // Delete file record from database
            sqlx::query("DELETE FROM files WHERE id = $1")
                .bind(file_id)
            .execute(&data.db_pool)
            .await
            .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Database error: {}", e)))?;

            Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
                "message": "File deleted successfully"
            })),
        message: Some("File deleted successfully".to_string()),
        error: None,
    }))
        }
        None => Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("File not found".to_string()),
        }))
    }
}
