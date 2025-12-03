use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;

use crate::models::ApiResponse;
use crate::AppState;
use crate::middleware::auth::get_current_user;

pub async fn get_financial_report(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let date_from = query.get("date_from").and_then(|v| v.as_str()).unwrap_or("2024-01-01");
    let date_to = query.get("date_to").and_then(|v| v.as_str()).unwrap_or("2024-12-31");

    // Get total revenue from invoices
    let total_revenue_result = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(final_amount), 0) FROM invoices WHERE invoice_date BETWEEN $1 AND $2 AND status = 'paid'"
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_one(&data.db_pool)
    .await;

    let total_revenue = total_revenue_result.unwrap_or(0.0);

    // Get monthly revenue breakdown
    let monthly_revenue_result = sqlx::query_as::<(String, f64)>(
        "SELECT TO_CHAR(invoice_date, 'YYYY-MM') as month, COALESCE(SUM(final_amount), 0) as revenue 
         FROM invoices 
         WHERE invoice_date BETWEEN $1 AND $2 AND status = 'paid'
         GROUP BY TO_CHAR(invoice_date, 'YYYY-MM')
         ORDER BY month"
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_all(&data.db_pool)
    .await;

    let monthly_revenue = monthly_revenue_result.unwrap_or_default()
        .into_iter()
        .map(|(month, revenue)| json!({
            "month": month,
            "revenue": revenue
        }))
        .collect::<Vec<_>>();

    // Get outstanding payments
    let outstanding_result = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(final_amount), 0) FROM invoices WHERE status IN ('pending', 'overdue')"
    )
    .fetch_one(&data.db_pool)
    .await;

    let outstanding_payments = outstanding_result.unwrap_or(0.0);

    // Get payment methods distribution (mock data for now since we don't have payment_method in invoices)
    let payment_methods = json!({
        "cash": total_revenue * 0.4,
        "mpesa": total_revenue * 0.5,
        "insurance": total_revenue * 0.1
    });

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
            "total_revenue": total_revenue,
            "monthly_revenue": monthly_revenue,
            "payment_methods": payment_methods,
            "outstanding_payments": outstanding_payments,
            "date_range": {
                "from": date_from,
                "to": date_to
            }
        })),
        message: None,
        error: None,
    }))
}

pub async fn get_patient_report(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let date_from = query.get("date_from").and_then(|v| v.as_str()).unwrap_or("2024-01-01");
    let date_to = query.get("date_to").and_then(|v| v.as_str()).unwrap_or("2024-12-31");

    // Get total patients
    let total_patients_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM patients"
    )
    .fetch_one(&data.db_pool)
    .await;

    let total_patients = total_patients_result.unwrap_or(0);

    // Get new patients in date range
    let new_patients_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM patients WHERE created_at::date BETWEEN $1 AND $2"
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_one(&data.db_pool)
    .await;

    let new_patients = new_patients_result.unwrap_or(0);

    // Get gender distribution
    let gender_distribution_result = sqlx::query_as::<(String, i64)>(
        "SELECT gender, COUNT(*) as count FROM patients GROUP BY gender"
    )
    .fetch_all(&data.db_pool)
    .await;

    let gender_distribution = gender_distribution_result.unwrap_or_default()
        .into_iter()
        .map(|(gender, count)| json!({
            "gender": gender,
            "count": count
        }))
        .collect::<Vec<_>>();

    // Get age distribution
    let age_distribution_result = sqlx::query_as::<(String, i64)>(
        "SELECT 
            CASE 
                WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 18 THEN '0-17'
                WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 18 AND 30 THEN '18-30'
                WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 31 AND 50 THEN '31-50'
                WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 51 AND 70 THEN '51-70'
                ELSE '70+'
            END as age_group,
            COUNT(*) as count
         FROM patients 
         GROUP BY 
            CASE 
                WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 18 THEN '0-17'
                WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 18 AND 30 THEN '18-30'
                WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 31 AND 50 THEN '31-50'
                WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 51 AND 70 THEN '51-70'
                ELSE '70+'
            END
         ORDER BY age_group"
    )
    .fetch_all(&data.db_pool)
    .await;

    let age_distribution = age_distribution_result.unwrap_or_default()
        .into_iter()
        .map(|(age_group, count)| json!({
            "age_group": age_group,
            "count": count
        }))
        .collect::<Vec<_>>();

    // Get patient visits in date range
    let patient_visits_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM consultations WHERE date BETWEEN $1 AND $2"
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_one(&data.db_pool)
    .await;

    let patient_visits = patient_visits_result.unwrap_or(0);

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
            "total_patients": total_patients,
            "new_patients": new_patients,
            "patient_visits": patient_visits,
            "age_distribution": age_distribution,
            "gender_distribution": gender_distribution,
            "date_range": {
                "from": date_from,
                "to": date_to
            }
        })),
        message: None,
        error: None,
    }))
}

pub async fn get_inventory_report(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    // Get total items
    let total_items_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM medicines WHERE is_active = true"
    )
    .fetch_one(&data.db_pool)
    .await;

    let total_items = total_items_result.unwrap_or(0);

    // Get low stock items (stock below minimum_stock)
    let low_stock_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM medicines WHERE stock_quantity <= minimum_stock AND is_active = true"
    )
    .fetch_one(&data.db_pool)
    .await;

    let low_stock_items = low_stock_result.unwrap_or(0);

    // Get expiring items (expiring within next 30 days)
    let expiring_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM medicines WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND is_active = true"
    )
    .fetch_one(&data.db_pool)
    .await;

    let expiring_items = expiring_result.unwrap_or(0);

    // Get total inventory value
    let total_value_result = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(stock_quantity * unit_price), 0) FROM medicines WHERE is_active = true"
    )
    .fetch_one(&data.db_pool)
    .await;

    let total_value = total_value_result.unwrap_or(0.0);

    // Get low stock items details
    let low_stock_details_result = sqlx::query_as::<(String, i32, i32, f64)>(
        "SELECT name, stock_quantity, minimum_stock, unit_price 
         FROM medicines 
         WHERE stock_quantity <= minimum_stock AND is_active = true 
         ORDER BY stock_quantity ASC 
         LIMIT 10"
    )
    .fetch_all(&data.db_pool)
    .await;

    let low_stock_details = low_stock_details_result.unwrap_or_default()
        .into_iter()
        .map(|(name, stock, min_stock, price)| json!({
            "name": name,
            "current_stock": stock,
            "minimum_stock": min_stock,
            "unit_price": price,
            "value": stock as f64 * price
        }))
        .collect::<Vec<_>>();

    // Get expiring items details
    let expiring_details_result = sqlx::query_as::<(String, String, i32, f64)>(
        "SELECT name, expiry_date::text, stock_quantity, unit_price 
         FROM medicines 
         WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND is_active = true 
         ORDER BY expiry_date ASC 
         LIMIT 10"
    )
    .fetch_all(&data.db_pool)
    .await;

    let expiring_details = expiring_details_result.unwrap_or_default()
        .into_iter()
        .map(|(name, expiry_date, stock, price)| json!({
            "name": name,
            "expiry_date": expiry_date,
            "stock_quantity": stock,
            "unit_price": price,
            "value": stock as f64 * price
        }))
        .collect::<Vec<_>>();

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
            "total_items": total_items,
            "low_stock_items": low_stock_items,
            "expiring_items": expiring_items,
            "total_value": total_value,
            "low_stock_details": low_stock_details,
            "expiring_details": expiring_details
        })),
        message: None,
        error: None,
    }))
}

pub async fn get_audit_logs(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let date_from = query.get("date_from").and_then(|v| v.as_str()).unwrap_or("2024-01-01");
    let date_to = query.get("date_to").and_then(|v| v.as_str()).unwrap_or("2024-12-31");
    let limit = query.get("limit").and_then(|v| v.as_i64()).unwrap_or(100);

    // Since we don't have a dedicated audit_logs table, we'll create a combined view
    // from various tables that track changes (consultations, patients, invoices, etc.)
    
    // Get recent consultations as audit entries
    let consultations_result = sqlx::query_as::<(String, String, String, String, String)>(
        "SELECT 
            'consultation' as action_type,
            'Created consultation for patient' as action_description,
            u.name as user_name,
            p.first_name || ' ' || p.last_name as patient_name,
            c.created_at::text as timestamp
         FROM consultations c
         JOIN users u ON c.doctor_id = u.id
         JOIN patients p ON c.patient_id = p.id
         WHERE c.created_at::date BETWEEN $1 AND $2
         ORDER BY c.created_at DESC
         LIMIT $3"
    )
    .bind(date_from)
    .bind(date_to)
    .bind(limit)
    .fetch_all(&data.db_pool)
    .await;

    let consultations = consultations_result.unwrap_or_default()
        .into_iter()
        .map(|(action_type, description, user_name, patient_name, timestamp)| json!({
            "action_type": action_type,
            "description": description,
            "user_name": user_name,
            "patient_name": patient_name,
            "timestamp": timestamp,
            "details": format!("Consultation created for {}", patient_name)
        }))
        .collect::<Vec<_>>();

    // Get recent patient registrations
    let patients_result = sqlx::query_as::<(String, String, String, String, String)>(
        "SELECT 
            'patient_registration' as action_type,
            'New patient registered' as action_description,
            'System' as user_name,
            first_name || ' ' || last_name as patient_name,
            created_at::text as timestamp
         FROM patients
         WHERE created_at::date BETWEEN $1 AND $2
         ORDER BY created_at DESC
         LIMIT $3"
    )
    .bind(date_from)
    .bind(date_to)
    .bind(limit)
    .fetch_all(&data.db_pool)
    .await;

    let patients = patients_result.unwrap_or_default()
        .into_iter()
        .map(|(action_type, description, user_name, patient_name, timestamp)| json!({
            "action_type": action_type,
            "description": description,
            "user_name": user_name,
            "patient_name": patient_name,
            "timestamp": timestamp,
            "details": format!("New patient {} registered", patient_name)
        }))
        .collect::<Vec<_>>();

    // Get recent invoices
    let invoices_result = sqlx::query_as::<(String, String, String, String, String)>(
        "SELECT 
            'invoice_created' as action_type,
            'Invoice created' as action_description,
            u.name as user_name,
            p.first_name || ' ' || p.last_name as patient_name,
            i.created_at::text as timestamp
         FROM invoices i
         JOIN users u ON i.created_by = u.id
         JOIN patients p ON i.patient_id = p.id
         WHERE i.created_at::date BETWEEN $1 AND $2
         ORDER BY i.created_at DESC
         LIMIT $3"
    )
    .bind(date_from)
    .bind(date_to)
    .bind(limit)
    .fetch_all(&data.db_pool)
    .await;

    let invoices = invoices_result.unwrap_or_default()
        .into_iter()
        .map(|(action_type, description, user_name, patient_name, timestamp)| json!({
            "action_type": action_type,
            "description": description,
            "user_name": user_name,
            "patient_name": patient_name,
            "timestamp": timestamp,
            "details": format!("Invoice created for {}", patient_name)
        }))
        .collect::<Vec<_>>();

    // Combine all audit entries and sort by timestamp
    let mut all_logs = Vec::new();
    all_logs.extend(consultations);
    all_logs.extend(patients);
    all_logs.extend(invoices);

    // Sort by timestamp (most recent first)
    all_logs.sort_by(|a, b| {
        let timestamp_a = a["timestamp"].as_str().unwrap_or("");
        let timestamp_b = b["timestamp"].as_str().unwrap_or("");
        timestamp_b.cmp(timestamp_a)
    });

    // Limit the final results
    all_logs.truncate(limit as usize);

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
            "audit_logs": all_logs,
            "total_count": all_logs.len(),
            "date_range": {
                "from": date_from,
                "to": date_to
            }
        })),
        message: None,
        error: None,
    }))
}

pub async fn get_consultation_analytics(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let date_from = query.get("date_from").and_then(|v| v.as_str()).unwrap_or("2024-01-01");
    let date_to = query.get("date_to").and_then(|v| v.as_str()).unwrap_or("2024-12-31");

    // Get top diagnoses
    let diagnoses_result = sqlx::query_as::<(String, i64)>(
        "SELECT diagnosis, COUNT(*) as count 
         FROM consultations 
         WHERE date BETWEEN $1 AND $2 AND diagnosis IS NOT NULL AND diagnosis != ''
         GROUP BY diagnosis 
         ORDER BY count DESC 
         LIMIT 10"
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_all(&data.db_pool)
    .await;

    let total_consultations = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM consultations WHERE date BETWEEN $1 AND $2"
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_one(&data.db_pool)
    .await
    .unwrap_or(0);

    let top_diagnoses = diagnoses_result.unwrap_or_default()
        .into_iter()
        .map(|(diagnosis, count)| {
            let percentage = if total_consultations > 0 {
                ((count as f64 / total_consultations as f64) * 100.0).round() as i32
            } else {
                0
            };
            json!({
                "diagnosis": diagnosis,
                "count": count,
                "percentage": percentage
            })
        })
        .collect::<Vec<_>>();

    // Get staff performance (doctors and their consultation counts)
    let staff_performance_result = sqlx::query_as::<(String, String, i64)>(
        "SELECT u.name, u.department, COUNT(c.id) as consultation_count
         FROM users u
         LEFT JOIN consultations c ON u.id = c.doctor_id AND c.date BETWEEN $1 AND $2
         WHERE u.role = 'doctor' AND u.is_active = true
         GROUP BY u.id, u.name, u.department
         ORDER BY consultation_count DESC
         LIMIT 10"
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_all(&data.db_pool)
    .await;

    let staff_performance = staff_performance_result.unwrap_or_default()
        .into_iter()
        .map(|(name, department, consultation_count)| json!({
            "name": name,
            "department": department,
            "consultations": consultation_count,
            "rating": 4.5 + (consultation_count as f64 / 100.0).min(0.5) // Mock rating based on consultation count
        }))
        .collect::<Vec<_>>();

    // Get daily patient visits for the date range
    let daily_visits_result = sqlx::query_as::<(String, i64)>(
        "SELECT date::text, COUNT(*) as visits
         FROM consultations
         WHERE date BETWEEN $1 AND $2
         GROUP BY date
         ORDER BY date"
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_all(&data.db_pool)
    .await;

    let daily_visits = daily_visits_result.unwrap_or_default()
        .into_iter()
        .map(|(date, visits)| json!({
            "date": date,
            "visits": visits
        }))
        .collect::<Vec<_>>();

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
            "top_diagnoses": top_diagnoses,
            "staff_performance": staff_performance,
            "daily_visits": daily_visits,
            "total_consultations": total_consultations,
            "date_range": {
                "from": date_from,
                "to": date_to
            }
        })),
        message: None,
        error: None,
    }))
}
