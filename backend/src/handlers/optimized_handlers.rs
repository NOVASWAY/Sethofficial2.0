use actix_web::{web, HttpRequest, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{info, warn, debug, error};

use crate::{
    AppState,
    cache::{CacheService, CacheKeys, QueryOptimizer},
    database_optimization::DatabaseOptimization,
    performance_monitoring::PerformanceMonitor,
    error::ApiError,
    models::*,
};

// Optimized patient handlers with caching
pub struct OptimizedPatientHandlers;

impl OptimizedPatientHandlers {
    /// Get patient with caching
    pub async fn get_patient_optimized(
        path: web::Path<String>,
        data: web::Data<AppState>,
        cache_service: web::Data<CacheService>,
    ) -> Result<HttpResponse> {
        let patient_id = path.into_inner();
        let start_time = SystemTime::now();

        // Try to get from cache first
        if let Some(cached_patient) = cache_service.get_patient(&patient_id).await {
            debug!("Patient {} served from cache", patient_id);
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "data": cached_patient,
                "cached": true,
                "response_time_ms": start_time.elapsed().unwrap_or_default().as_millis()
            })));
        }

        // If not in cache, fetch from database
        let patient = match sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients WHERE id = $1"
        )
        .bind(&patient_id)
        .fetch_optional(&data.database.pool)
        .await
        {
            Ok(Some(patient)) => patient,
            Ok(None) => {
                return Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "success": false,
                    "message": "Patient not found"
                })));
            }
            Err(e) => {
                error!("Database error: {}", e);
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "success": false,
                    "message": "Database error"
                })));
            }
        };

        // Cache the result
        let patient_json = serde_json::to_value(&patient).unwrap_or_default();
        if let Err(e) = cache_service.set_patient(&patient_id, patient_json.clone()).await {
            warn!("Failed to cache patient {}: {}", patient_id, e);
        }

        let response_time = start_time.elapsed().unwrap_or_default().as_millis();
        debug!("Patient {} served from database in {}ms", patient_id, response_time);

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "data": patient_json,
            "cached": false,
            "response_time_ms": response_time
        })))
    }

    /// Get patients list with caching and optimization
    pub async fn get_patients_optimized(
        query: web::Query<HashMap<String, String>>,
        data: web::Data<AppState>,
        cache_service: web::Data<CacheService>,
    ) -> Result<HttpResponse> {
        let start_time = SystemTime::now();
        
        // Extract query parameters
        let page = query.get("page").and_then(|p| p.parse::<u32>().ok()).unwrap_or(1);
        let limit = query.get("limit").and_then(|l| l.parse::<u32>().ok()).unwrap_or(20);
        let search = query.get("search").cloned();
        let sort_by = query.get("sort_by").cloned().unwrap_or_else(|| "created_at".to_string());
        let sort_order = query.get("sort_order").cloned().unwrap_or_else(|| "desc".to_string());

        // Check cache first
        if let Some(cached_patients) = cache_service.get_patient_list(page, limit, search.as_deref()).await {
            debug!("Patients list served from cache");
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "data": cached_patients,
                "cached": true,
                "response_time_ms": start_time.elapsed().unwrap_or_default().as_millis()
            })));
        }

        // Build optimized query
        let mut base_query = "SELECT * FROM patients WHERE 1=1".to_string();
        let mut filters = HashMap::new();
        
        if let Some(ref search_term) = search {
            filters.insert("search".to_string(), search_term.clone());
        }

        let optimized_query = QueryOptimizer::optimize_patient_search_query(&base_query, search.as_deref().unwrap_or(""));
        let ordered_query = QueryOptimizer::add_ordering(&optimized_query, &sort_by, &sort_order);
        let paginated_query = QueryOptimizer::add_pagination(&ordered_query, page - 1, limit);

        // Execute query
        let patients = match sqlx::query_as::<_, Patient>(&paginated_query)
            .fetch_all(&data.database.pool)
            .await
        {
            Ok(patients) => patients,
            Err(e) => {
                error!("Database error: {}", e);
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "success": false,
                    "message": "Database error"
                })));
            }
        };

        // Get total count for pagination
        let count_query = format!("SELECT COUNT(*) FROM patients WHERE 1=1{}", 
            if let Some(ref search_term) = search {
                format!(" AND (first_name ILIKE '%{}%' OR last_name ILIKE '%{}%' OR phone ILIKE '%{}%')", 
                    search_term, search_term, search_term)
            } else {
                String::new()
            }
        );

        let total_count = match sqlx::query_scalar::<_, i64>(&count_query)
            .fetch_one(&data.database.pool)
            .await
        {
            Ok(count) => count,
            Err(e) => {
                error!("Count query error: {}", e);
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "success": false,
                    "message": "Database error"
                })));
            }
        };

        // Cache the result
        let patients_json = serde_json::to_value(&patients).unwrap_or_default();
        let response_data = serde_json::json!({
            "patients": patients_json,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count as f64 / limit as f64).ceil() as u32
            }
        });

        if let Err(e) = cache_service.set_patient_list(page, limit, search.as_deref(), response_data.clone()).await {
            warn!("Failed to cache patients list: {}", e);
        }

        let response_time = start_time.elapsed().unwrap_or_default().as_millis();
        debug!("Patients list served from database in {}ms", response_time);

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "data": response_data,
            "cached": false,
            "response_time_ms": response_time
        })))
    }
}

// Optimized appointment handlers
pub struct OptimizedAppointmentHandlers;

impl OptimizedAppointmentHandlers {
    /// Get appointments by date with caching
    pub async fn get_appointments_by_date_optimized(
        path: web::Path<String>,
        data: web::Data<AppState>,
        cache_service: web::Data<CacheService>,
    ) -> Result<HttpResponse> {
        let date = path.into_inner();
        let start_time = SystemTime::now();

        // Check cache first
        if let Some(cached_appointments) = cache_service.get_appointments_by_date(&date).await {
            debug!("Appointments for {} served from cache", date);
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "data": cached_appointments,
                "cached": true,
                "response_time_ms": start_time.elapsed().unwrap_or_default().as_millis()
            })));
        }

        // Fetch from database
        let appointments = match sqlx::query_as::<_, Appointment>(
            "SELECT * FROM appointments WHERE DATE(appointment_date) = $1 ORDER BY appointment_date ASC"
        )
        .bind(&date)
        .fetch_all(&data.database.pool)
        .await
        {
            Ok(appointments) => appointments,
            Err(e) => {
                error!("Database error: {}", e);
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "success": false,
                    "message": "Database error"
                })));
            }
        };

        // Cache the result
        let appointments_json = serde_json::to_value(&appointments).unwrap_or_default();
        if let Err(e) = cache_service.set_appointments_by_date(&date, appointments_json.clone()).await {
            warn!("Failed to cache appointments for {}: {}", date, e);
        }

        let response_time = start_time.elapsed().unwrap_or_default().as_millis();
        debug!("Appointments for {} served from database in {}ms", date, response_time);

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "data": appointments_json,
            "cached": false,
            "response_time_ms": response_time
        })))
    }
}

// Optimized medicine handlers
pub struct OptimizedMedicineHandlers;

impl OptimizedMedicineHandlers {
    /// Get medicines with caching and optimization
    pub async fn get_medicines_optimized(
        query: web::Query<HashMap<String, String>>,
        data: web::Data<AppState>,
        cache_service: web::Data<CacheService>,
    ) -> Result<HttpResponse> {
        let start_time = SystemTime::now();
        
        // Extract query parameters
        let page = query.get("page").and_then(|p| p.parse::<u32>().ok()).unwrap_or(1);
        let limit = query.get("limit").and_then(|l| l.parse::<u32>().ok()).unwrap_or(20);
        let category = query.get("category").cloned();
        let search = query.get("search").cloned();
        let low_stock_only = query.get("low_stock").map(|v| v == "true").unwrap_or(false);

        // Check cache first
        if let Some(cached_medicines) = cache_service.get_medicine_list(page, limit, category.as_deref()).await {
            debug!("Medicines list served from cache");
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "data": cached_medicines,
                "cached": true,
                "response_time_ms": start_time.elapsed().unwrap_or_default().as_millis()
            })));
        }

        // Build optimized query
        let mut base_query = "SELECT * FROM medicines WHERE 1=1".to_string();
        let mut filters = HashMap::new();
        
        if let Some(ref cat) = category {
            filters.insert("category".to_string(), cat.clone());
        }
        
        if let Some(ref search_term) = search {
            filters.insert("search".to_string(), search_term.clone());
        }

        let optimized_query = QueryOptimizer::optimize_medicine_query(&base_query, &filters);
        let stock_optimized_query = QueryOptimizer::optimize_medicine_stock_query(&optimized_query, low_stock_only);
        let ordered_query = QueryOptimizer::add_ordering(&stock_optimized_query, "name", "asc");
        let paginated_query = QueryOptimizer::add_pagination(&ordered_query, page - 1, limit);

        // Execute query
        let medicines = match sqlx::query_as::<_, Medicine>(&paginated_query)
            .fetch_all(&data.database.pool)
            .await
        {
            Ok(medicines) => medicines,
            Err(e) => {
                error!("Database error: {}", e);
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "success": false,
                    "message": "Database error"
                })));
            }
        };

        // Cache the result
        let medicines_json = serde_json::to_value(&medicines).unwrap_or_default();
        if let Err(e) = cache_service.set_medicine_list(page, limit, category.as_deref(), medicines_json.clone()).await {
            warn!("Failed to cache medicines list: {}", e);
        }

        let response_time = start_time.elapsed().unwrap_or_default().as_millis();
        debug!("Medicines list served from database in {}ms", response_time);

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "data": medicines_json,
            "cached": false,
            "response_time_ms": response_time
        })))
    }
}

// Performance monitoring handlers
pub struct PerformanceHandlers;

impl PerformanceHandlers {
    /// Get performance metrics
    pub async fn get_performance_metrics(
        monitor: web::Data<PerformanceMonitor>,
    ) -> Result<HttpResponse> {
        match monitor.collect_metrics().await {
            Ok(metrics) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "data": metrics
            }))),
            Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": format!("Failed to collect metrics: {}", e)
            })))
        }
    }

    /// Get performance summary
    pub async fn get_performance_summary(
        monitor: web::Data<PerformanceMonitor>,
    ) -> Result<HttpResponse> {
        match monitor.get_performance_summary().await {
            Ok(summary) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "data": summary
            }))),
            Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": format!("Failed to get performance summary: {}", e)
            })))
        }
    }

    /// Get performance alerts
    pub async fn get_performance_alerts(
        monitor: web::Data<PerformanceMonitor>,
    ) -> Result<HttpResponse> {
        let alerts = monitor.get_active_alerts().await;
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "data": alerts
        })))
    }

    /// Get cache statistics
    pub async fn get_cache_stats(
        cache_service: web::Data<CacheService>,
    ) -> Result<HttpResponse> {
        let stats = cache_service.get_all_stats().await;
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "data": stats
        })))
    }

    /// Clear cache
    pub async fn clear_cache(
        cache_service: web::Data<CacheService>,
    ) -> Result<HttpResponse> {
        cache_service.clear_all().await;
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "Cache cleared successfully"
        })))
    }

    /// Get database optimization recommendations
    pub async fn get_database_recommendations(
        data: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let db_optimizer = DatabaseOptimization::new(data.database.pool.clone());
        
        match db_optimizer.get_optimization_recommendations().await {
            Ok(recommendations) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "data": recommendations
            }))),
            Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": format!("Failed to get recommendations: {}", e)
            })))
        }
    }

    /// Optimize database
    pub async fn optimize_database(
        data: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let db_optimizer = DatabaseOptimization::new(data.database.pool.clone());
        
        match db_optimizer.optimize_database().await {
            Ok(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": "Database optimization completed successfully"
            }))),
            Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": format!("Database optimization failed: {}", e)
            })))
        }
    }
}

// Dashboard handlers with caching
pub struct OptimizedDashboardHandlers;

impl OptimizedDashboardHandlers {
    /// Get dashboard statistics with caching
    pub async fn get_dashboard_stats_optimized(
        data: web::Data<AppState>,
        cache_service: web::Data<CacheService>,
    ) -> Result<HttpResponse> {
        let start_time = SystemTime::now();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();

        // Check cache first
        if let Some(cached_stats) = cache_service.get_dashboard_stats(&today).await {
            debug!("Dashboard stats served from cache");
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "data": cached_stats,
                "cached": true,
                "response_time_ms": start_time.elapsed().unwrap_or_default().as_millis()
            })));
        }

        // Fetch statistics from database
        let stats = match Self::fetch_dashboard_stats(&data.database.pool).await {
            Ok(stats) => stats,
            Err(e) => {
                error!("Failed to fetch dashboard stats: {}", e);
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "success": false,
                    "message": "Failed to fetch dashboard statistics"
                })));
            }
        };

        // Cache the result
        let stats_json = serde_json::to_value(&stats).unwrap_or_default();
        if let Err(e) = cache_service.set_dashboard_stats(&today, stats_json.clone()).await {
            warn!("Failed to cache dashboard stats: {}", e);
        }

        let response_time = start_time.elapsed().unwrap_or_default().as_millis();
        debug!("Dashboard stats served from database in {}ms", response_time);

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "data": stats_json,
            "cached": false,
            "response_time_ms": response_time
        })))
    }

    async fn fetch_dashboard_stats(pool: &sqlx::PgPool) -> Result<DashboardStats, sqlx::Error> {
        // Fetch multiple statistics in parallel
        let (patient_count, appointment_count, medicine_count, invoice_count) = tokio::try_join!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM patients"),
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM appointments WHERE DATE(appointment_date) = CURRENT_DATE"),
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM medicines WHERE stock_quantity <= reorder_level"),
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM invoices WHERE DATE(invoice_date) = CURRENT_DATE")
        )?;

        Ok(DashboardStats {
            total_patients: patient_count,
            today_appointments: appointment_count,
            low_stock_medicines: medicine_count,
            today_invoices: invoice_count,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct DashboardStats {
    total_patients: i64,
    today_appointments: i64,
    low_stock_medicines: i64,
    today_invoices: i64,
}
