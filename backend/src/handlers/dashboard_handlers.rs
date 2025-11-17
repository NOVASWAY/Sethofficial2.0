use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{DateTime, Utc, Duration, Datelike, NaiveDate};
use std::collections::HashMap;
use sqlx::types::BigDecimal;

use crate::models::ApiResponse;
use crate::auth::verify_jwt_token;

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardMetrics {
    pub total_patients: i64,
    pub today_consultations: i64,
    pub pending_prescriptions: i64,
    pub low_stock_items: i64,
    pub out_of_stock_items: i64,
    pub total_revenue: f64,
    pub monthly_revenue: f64,
    pub revenue_change: f64,
    pub active_users: i64,
    pub system_health: f64,
    pub critical_alerts: i64,
    pub pending_tasks: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoleMetrics {
    pub role: String,
    pub metrics: DashboardMetrics,
    pub custom_metrics: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserActivity {
    pub id: Uuid,
    pub action: String,
    pub module: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub details: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemHealth {
    pub database_status: String,
    pub redis_status: String,
    pub api_response_time: f64,
    pub memory_usage: f64,
    pub cpu_usage: f64,
    pub disk_usage: f64,
    pub active_connections: i64,
    pub uptime: i64,
}

// Get user-specific dashboard metrics
pub async fn get_user_dashboard_metrics(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse> {
    let user_id = path.into_inner();
    
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

    // Check if user is requesting their own data or has admin permissions
    if claims.user_id != user_id && claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Access denied".to_string()),
            error: Some("Insufficient permissions".to_string()),
        }));
    }

    // Get user role and department
    let user = match sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT role, department FROM users WHERE id = $1",
    )
    .bind(user_id)
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

    // Calculate metrics based on user role and permissions
    let role_str = user.0.as_str();
    let dept_str = user.1.as_deref().unwrap_or("");
    let metrics = match calculate_user_metrics(&pool, &user_id, role_str, dept_str).await {
        Ok(metrics) => metrics,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to calculate metrics".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(metrics),
        message: Some("Dashboard metrics retrieved successfully".to_string()),
        error: None,
    }))
}

// Get role-specific dashboard metrics
pub async fn get_role_dashboard_metrics(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let role = path.into_inner();
    
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

    // Only admin can access role-specific metrics
    if claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Access denied".to_string()),
            error: Some("Admin access required".to_string()),
        }));
    }

    // Calculate role-specific metrics
    let metrics = match calculate_role_metrics(&pool, &role).await {
        Ok(metrics) => metrics,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to calculate role metrics".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    let role_metrics = RoleMetrics {
        role: role.clone(),
        metrics,
        custom_metrics: get_role_custom_metrics(&role),
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(role_metrics),
        message: Some("Role metrics retrieved successfully".to_string()),
        error: None,
    }))
}

// Get department-specific dashboard metrics
pub async fn get_department_dashboard_metrics(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let department = path.into_inner();
    
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

    // Check if user has access to department data
    if claims.role != "admin" && claims.department.as_deref() != Some(&department) {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Access denied".to_string()),
            error: Some("Insufficient permissions".to_string()),
        }));
    }

    // Calculate department-specific metrics
    let metrics = match calculate_department_metrics(&pool, &department).await {
        Ok(metrics) => metrics,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to calculate department metrics".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(metrics),
        message: Some("Department metrics retrieved successfully".to_string()),
        error: None,
    }))
}

// Get system health metrics
pub async fn get_system_health_metrics(
    req: HttpRequest,
    pool: web::Data<PgPool>,
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

    // Only admin can access system health metrics
    if claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Access denied".to_string()),
            error: Some("Admin access required".to_string()),
        }));
    }

    // Calculate system health metrics
    let health = match calculate_system_health(&pool).await {
        Ok(health) => health,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to calculate system health".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(health),
        message: Some("System health metrics retrieved successfully".to_string()),
        error: None,
    }))
}

// Helper function to calculate user-specific metrics
async fn calculate_user_metrics(
    pool: &PgPool,
    user_id: &Uuid,
    role: &str,
    department: &str,
) -> Result<DashboardMetrics, sqlx::Error> {
    let today = Utc::now().date_naive();
    // Get first day of month using format parsing
    let first_day_str = format!("{}-{:02}-01", today.format("%Y"), today.format("%m"));
    let start_of_month = NaiveDate::parse_from_str(&first_day_str, "%Y-%m-%d").unwrap_or(today);
    let start_of_last_month = start_of_month - Duration::days(30);

    // Base metrics that apply to all users
    let total_patients = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM patients WHERE created_at >= $1"
    )
    .bind(start_of_month)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let today_consultations = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM consultations WHERE date = $1",
        today
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let pending_prescriptions = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM prescriptions WHERE status = 'pending'"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let low_stock_items = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM medicines WHERE current_stock <= minimum_stock"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let out_of_stock_items = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM medicines WHERE current_stock = 0"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    // Role-specific calculations
    let (total_revenue, monthly_revenue, revenue_change, active_users, system_health, critical_alerts, pending_tasks) = 
        match role {
            "admin" => {
                let total_revenue = sqlx::query_scalar::<_, Option<BigDecimal>>(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE created_at >= $1"
                )
                .bind(start_of_month)
                .fetch_one(pool)
                .await?
                .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0))
                .unwrap_or(0.0);

                let monthly_revenue = sqlx::query_scalar::<_, Option<BigDecimal>>(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE created_at >= $1"
                )
                .bind(start_of_month)
                .fetch_one(pool)
                .await?
                .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0))
                .unwrap_or(0.0);

                let last_month_revenue = sqlx::query_scalar::<_, Option<BigDecimal>>(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE created_at >= $1 AND created_at < $2"
                )
                .bind(start_of_last_month)
                .bind(start_of_month)
                .fetch_one(pool)
                .await?
                .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0))
                .unwrap_or(0.0);

                let revenue_change = if last_month_revenue > 0.0 {
                    ((monthly_revenue - last_month_revenue) / last_month_revenue) * 100.0
                } else {
                    0.0
                };

                let active_users = sqlx::query_scalar!(
                    "SELECT COUNT(*) FROM users WHERE is_active = true"
                )
                .fetch_one(pool)
                .await?
                .unwrap_or(0);

                let system_health = 98.5; // Mock system health
                let critical_alerts = sqlx::query_scalar!(
                    "SELECT COUNT(*) FROM medicines WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days'"
                )
                .fetch_one(pool)
                .await?
                .unwrap_or(0);

                let pending_tasks = sqlx::query_scalar!(
                    "SELECT COUNT(*) FROM prescriptions WHERE status = 'pending'"
                )
                .fetch_one(pool)
                .await?
                .unwrap_or(0);

                (total_revenue, monthly_revenue, revenue_change, active_users, system_health, critical_alerts, pending_tasks)
            }
            _ => {
                // For non-admin users, calculate department-specific metrics
    let total_revenue_result = sqlx::query_scalar::<_, Option<BigDecimal>>(
        "SELECT COALESCE(SUM(i.total_amount), 0) FROM invoices i 
         JOIN consultations c ON i.consultation_id = c.id 
         WHERE c.doctor_id = $1 AND i.created_at >= $2"
    )
    .bind(user_id)
    .bind(start_of_month)
    .fetch_one(pool)
    .await?
    .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0))
    .unwrap_or(0.0);

    let monthly_revenue = total_revenue_result;
                let revenue_change = 0.0; // Simplified for non-admin users
                let active_users = 1; // Current user
                let system_health = 100.0; // Mock
                let critical_alerts = 0; // Simplified
                let pending_tasks = pending_prescriptions;

                (total_revenue_result, monthly_revenue, revenue_change, active_users, system_health, critical_alerts, pending_tasks)
            }
        };

    Ok(DashboardMetrics {
        total_patients,
        today_consultations,
        pending_prescriptions,
        low_stock_items,
        out_of_stock_items,
        total_revenue,
        monthly_revenue,
        revenue_change,
        active_users,
        system_health,
        critical_alerts,
        pending_tasks,
    })
}

// Helper function to calculate role-specific metrics
async fn calculate_role_metrics(
    pool: &PgPool,
    role: &str,
) -> Result<DashboardMetrics, sqlx::Error> {
    let today = Utc::now().date_naive();
    // Get first day of month using format parsing
    let first_day_str = format!("{}-{:02}-01", today.format("%Y"), today.format("%m"));
    let start_of_month = NaiveDate::parse_from_str(&first_day_str, "%Y-%m-%d").unwrap_or(today);

    // Calculate metrics for all users with the specified role
    let total_patients = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM patients WHERE created_at >= $1"
    )
    .bind(start_of_month)
    .fetch_one(pool)
    .await?;

    let today_consultations = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM consultations c 
         JOIN users u ON c.doctor_id = u.id 
         WHERE u.role = $1 AND c.date = $2",
        role,
        today
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let pending_prescriptions = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM prescriptions WHERE status = 'pending'"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let low_stock_items = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM medicines WHERE current_stock <= minimum_stock"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let out_of_stock_items = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM medicines WHERE current_stock = 0"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let total_revenue_result = sqlx::query_scalar::<_, Option<BigDecimal>>(
        "SELECT COALESCE(SUM(i.total_amount), 0) FROM invoices i 
         JOIN consultations c ON i.consultation_id = c.id 
         JOIN users u ON c.doctor_id = u.id 
         WHERE u.role = $1 AND i.created_at >= $2"
    )
    .bind(role)
    .bind(start_of_month)
    .fetch_one(pool)
    .await?
    .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0))
    .unwrap_or(0.0);

    let monthly_revenue = total_revenue_result;
    let revenue_change = 0.0; // Simplified
    let active_users = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users WHERE role = $1 AND is_active = true",
        role
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let system_health = 100.0; // Mock
    let critical_alerts = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM medicines WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days'"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let pending_tasks = pending_prescriptions;

    Ok(DashboardMetrics {
        total_patients,
        today_consultations,
        pending_prescriptions,
        low_stock_items,
        out_of_stock_items,
        total_revenue,
        monthly_revenue,
        revenue_change,
        active_users,
        system_health,
        critical_alerts,
        pending_tasks,
    })
}

// Helper function to calculate department-specific metrics
async fn calculate_department_metrics(
    pool: &PgPool,
    department: &str,
) -> Result<DashboardMetrics, sqlx::Error> {
    let today = Utc::now().date_naive();
    // Get first day of month using format parsing
    let first_day_str = format!("{}-{:02}-01", today.format("%Y"), today.format("%m"));
    let start_of_month = NaiveDate::parse_from_str(&first_day_str, "%Y-%m-%d").unwrap_or(today);

    // Calculate metrics for all users in the specified department
    let total_patients = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM patients WHERE created_at >= $1"
    )
    .bind(start_of_month)
    .fetch_one(pool)
    .await?;

    let today_consultations = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM consultations c 
         JOIN users u ON c.doctor_id = u.id 
         WHERE u.department = $1 AND c.date = $2",
        department,
        today
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let pending_prescriptions = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM prescriptions WHERE status = 'pending'"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let low_stock_items = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM medicines WHERE current_stock <= minimum_stock"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let out_of_stock_items = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM medicines WHERE current_stock = 0"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let total_revenue_result = sqlx::query_scalar::<_, Option<BigDecimal>>(
        "SELECT COALESCE(SUM(i.total_amount), 0) FROM invoices i 
         JOIN consultations c ON i.consultation_id = c.id 
         JOIN users u ON c.doctor_id = u.id 
         WHERE u.department = $1 AND i.created_at >= $2"
    )
    .bind(department)
    .bind(start_of_month)
    .fetch_one(pool)
    .await?
    .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0))
    .unwrap_or(0.0);

    let monthly_revenue = total_revenue_result;
    let revenue_change = 0.0; // Simplified
    let active_users = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users WHERE department = $1 AND is_active = true",
        department
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let system_health = 100.0; // Mock
    let critical_alerts = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM medicines WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days'"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let pending_tasks = pending_prescriptions;

    Ok(DashboardMetrics {
        total_patients,
        today_consultations,
        pending_prescriptions,
        low_stock_items,
        out_of_stock_items,
        total_revenue,
        monthly_revenue,
        revenue_change,
        active_users,
        system_health,
        critical_alerts,
        pending_tasks,
    })
}

// Helper function to calculate system health metrics
async fn calculate_system_health(
    pool: &PgPool,
) -> Result<SystemHealth, sqlx::Error> {
    // Test database connection
    let database_status = match sqlx::query_scalar!("SELECT 1").fetch_one(pool).await {
        Ok(_) => "healthy".to_string(),
        Err(_) => "unhealthy".to_string(),
    };

    // Mock other system metrics (in a real implementation, these would come from system monitoring)
    let redis_status = "healthy".to_string();
    let api_response_time = 45.2; // milliseconds
    let memory_usage = 67.8; // percentage
    let cpu_usage = 23.4; // percentage
    let disk_usage = 45.6; // percentage
    let active_connections = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    let uptime = 86400; // Mock uptime in seconds

    Ok(SystemHealth {
        database_status,
        redis_status,
        api_response_time,
        memory_usage,
        cpu_usage,
        disk_usage,
        active_connections,
        uptime,
    })
}

// Helper function to get role-specific custom metrics
fn get_role_custom_metrics(role: &str) -> HashMap<String, serde_json::Value> {
    let mut custom_metrics = HashMap::new();

    match role {
        "admin" => {
            custom_metrics.insert("system_health".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(98.5).unwrap()));
            custom_metrics.insert("audit_logs".to_string(), serde_json::Value::Number(serde_json::Number::from(245)));
            custom_metrics.insert("backup_status".to_string(), serde_json::Value::String("successful".to_string()));
        }
        "clinician" => {
            custom_metrics.insert("diagnoses_made".to_string(), serde_json::Value::Number(serde_json::Number::from(8)));
            custom_metrics.insert("follow_up_required".to_string(), serde_json::Value::Number(serde_json::Number::from(5)));
        }
        "nurse" => {
            custom_metrics.insert("vitals_recorded".to_string(), serde_json::Value::Number(serde_json::Number::from(15)));
            custom_metrics.insert("medications_administered".to_string(), serde_json::Value::Number(serde_json::Number::from(8)));
        }
        "pharmacist" => {
            custom_metrics.insert("prescriptions_dispensed".to_string(), serde_json::Value::Number(serde_json::Number::from(15)));
            custom_metrics.insert("stock_movements".to_string(), serde_json::Value::Number(serde_json::Number::from(8)));
            custom_metrics.insert("expiry_alerts".to_string(), serde_json::Value::Number(serde_json::Number::from(2)));
        }
        "receptionist" => {
            custom_metrics.insert("new_patients_today".to_string(), serde_json::Value::Number(serde_json::Number::from(5)));
            custom_metrics.insert("appointments_today".to_string(), serde_json::Value::Number(serde_json::Number::from(18)));
            custom_metrics.insert("billing_pending".to_string(), serde_json::Value::Number(serde_json::Number::from(7)));
        }
        _ => {}
    }

    custom_metrics
}
