use sqlx::PgPool;
use chrono::{NaiveDate, NaiveTime, NaiveDateTime};
use uuid::Uuid;
use crate::errors::{AppError, appointment_conflict_error, insufficient_inventory_error, expired_medication_error};
use crate::models::{Appointment, Medication, Invoice, InvoiceItem};

// Appointment conflict detection
pub async fn check_appointment_conflict(
    pool: &PgPool,
    clinician_id: &str,
    appointment_date: &str,
    appointment_time: &str,
    exclude_appointment_id: Option<&str>,
) -> Result<(), AppError> {
    let date = NaiveDate::parse_from_str(appointment_date, "%Y-%m-%d")
        .map_err(|_| AppError::InvalidInput("Invalid appointment date format".to_string()))?;
    
    let time = NaiveTime::parse_from_str(appointment_time, "%H:%M")
        .map_err(|_| AppError::InvalidInput("Invalid appointment time format".to_string()))?;
    
    // Check for existing appointments at the same time
    let query = if let Some(exclude_id) = exclude_appointment_id {
        sqlx::query!(
            "SELECT id, patient_id, appointment_time, status FROM appointments 
             WHERE clinician_id = $1 AND appointment_date = $2 AND appointment_time = $3 
             AND id != $4 AND status IN ('pending', 'confirmed')",
            Uuid::parse_str(clinician_id)?,
            date,
            time,
            Uuid::parse_str(exclude_id)?
        )
    } else {
        sqlx::query!(
            "SELECT id, patient_id, appointment_time, status FROM appointments 
             WHERE clinician_id = $1 AND appointment_date = $2 AND appointment_time = $3 
             AND status IN ('pending', 'confirmed')",
            Uuid::parse_str(clinician_id)?,
            date,
            time
        )
    };
    
    let existing_appointments = query.fetch_all(pool).await?;
    
    if !existing_appointments.is_empty() {
        let appointment = &existing_appointments[0];
        return Err(appointment_conflict_error(
            &format!("Appointment ID: {}", appointment.id),
            &format!("{} at {}", appointment_date, appointment_time)
        ));
    }
    
    // Check for appointments within 30 minutes (buffer time)
    let buffer_start = time - chrono::Duration::minutes(30);
    let buffer_end = time + chrono::Duration::minutes(30);
    
    let buffer_query = if let Some(exclude_id) = exclude_appointment_id {
        sqlx::query!(
            "SELECT id, patient_id, appointment_time, status FROM appointments 
             WHERE clinician_id = $1 AND appointment_date = $2 
             AND appointment_time BETWEEN $3 AND $4 
             AND id != $5 AND status IN ('pending', 'confirmed')",
            Uuid::parse_str(clinician_id)?,
            date,
            buffer_start,
            buffer_end,
            Uuid::parse_str(exclude_id)?
        )
    } else {
        sqlx::query!(
            "SELECT id, patient_id, appointment_time, status FROM appointments 
             WHERE clinician_id = $1 AND appointment_date = $2 
             AND appointment_time BETWEEN $3 AND $4 
             AND status IN ('pending', 'confirmed')",
            Uuid::parse_str(clinician_id)?,
            date,
            buffer_start,
            buffer_end
        )
    };
    
    let buffer_appointments = buffer_query.fetch_all(pool).await?;
    
    if !buffer_appointments.is_empty() {
        let appointment = &buffer_appointments[0];
        return Err(appointment_conflict_error(
            &format!("Appointment ID: {}", appointment.id),
            &format!("{} at {} (within 30-minute buffer)", appointment_date, appointment_time)
        ));
    }
    
    Ok(())
}

// Validate appointment business hours
pub fn validate_appointment_business_hours(
    appointment_date: &str,
    appointment_time: &str,
) -> Result<(), AppError> {
    let date = NaiveDate::parse_from_str(appointment_date, "%Y-%m-%d")
        .map_err(|_| AppError::InvalidInput("Invalid appointment date format".to_string()))?;
    
    let time = NaiveTime::parse_from_str(appointment_time, "%H:%M")
        .map_err(|_| AppError::InvalidInput("Invalid appointment time format".to_string()))?;
    
    // Check if it's a weekend
    let weekday = date.weekday();
    if weekday == chrono::Weekday::Sat || weekday == chrono::Weekday::Sun {
        return Err(AppError::BusinessRule(
            "Appointments are not available on weekends".to_string()
        ));
    }
    
    // Check business hours (8 AM to 6 PM)
    let business_start = NaiveTime::from_hms_opt(8, 0, 0).unwrap();
    let business_end = NaiveTime::from_hms_opt(18, 0, 0).unwrap();
    
    if time < business_start || time > business_end {
        return Err(AppError::BusinessRule(
            "Appointments are only available between 8:00 AM and 6:00 PM".to_string()
        ));
    }
    
    // Check if appointment is in the past
    let now = chrono::Utc::now().naive_utc();
    let appointment_datetime = NaiveDateTime::new(date, time);
    
    if appointment_datetime < now {
        return Err(AppError::BusinessRule(
            "Cannot schedule appointments in the past".to_string()
        ));
    }
    
    // Check if appointment is too far in the future (max 1 year)
    let max_future_date = now + chrono::Duration::days(365);
    if appointment_datetime > max_future_date {
        return Err(AppError::BusinessRule(
            "Cannot schedule appointments more than 1 year in advance".to_string()
        ));
    }
    
    Ok(())
}

// Inventory validation
pub async fn validate_medication_availability(
    pool: &PgPool,
    medication_id: &str,
    requested_quantity: i32,
) -> Result<(), AppError> {
    let medication = sqlx::query!(
        "SELECT name, quantity, expiry_date FROM medications WHERE id = $1",
        Uuid::parse_str(medication_id)?
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Medication not found".to_string()))?;
    
    // Check if medication is expired
    if let Some(expiry_date) = medication.expiry_date {
        let today = chrono::Utc::now().date_naive();
        if expiry_date <= today {
            return Err(expired_medication_error(
                &medication.name,
                &expiry_date.format("%Y-%m-%d").to_string()
            ));
        }
    }
    
    // Check if sufficient quantity is available
    if medication.quantity < requested_quantity {
        return Err(insufficient_inventory_error(
            &medication.name,
            requested_quantity,
            medication.quantity
        ));
    }
    
    Ok(())
}

// Prescription validation
pub async fn validate_prescription(
    pool: &PgPool,
    patient_id: &str,
    medication_id: &str,
    quantity: i32,
    dosage: &str,
) -> Result<(), AppError> {
    // Check if patient exists
    let patient_exists = sqlx::query!(
        "SELECT id FROM patients WHERE id = $1",
        Uuid::parse_str(patient_id)?
    )
    .fetch_optional(pool)
    .await?
    .is_some();
    
    if !patient_exists {
        return Err(AppError::NotFound("Patient not found".to_string()));
    }
    
    // Check if medication exists and is available
    validate_medication_availability(pool, medication_id, quantity).await?;
    
    // Validate dosage format (basic validation)
    if dosage.is_empty() || dosage.len() > 100 {
        return Err(AppError::InvalidInput(
            "Dosage must be between 1 and 100 characters".to_string()
        ));
    }
    
    // Check for drug interactions (simplified - in real system, use drug interaction database)
    let patient_allergies = sqlx::query!(
        "SELECT allergies FROM patients WHERE id = $1",
        Uuid::parse_str(patient_id)?
    )
    .fetch_optional(pool)
    .await?
    .and_then(|row| row.allergies);
    
    if let Some(allergies) = patient_allergies {
        let medication = sqlx::query!(
            "SELECT name, side_effects FROM medications WHERE id = $1",
            Uuid::parse_str(medication_id)?
        )
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Medication not found".to_string()))?;
        
        // Simple allergy check (in real system, use proper drug interaction database)
        if allergies.to_lowercase().contains(&medication.name.to_lowercase()) {
            return Err(AppError::BusinessRule(format!(
                "Patient is allergic to {}",
                medication.name
            )));
        }
    }
    
    Ok(())
}

// Invoice validation
pub async fn validate_invoice(
    pool: &PgPool,
    invoice: &Invoice,
    items: &[InvoiceItem],
) -> Result<(), AppError> {
    // Validate patient exists (if not a walk-in sale)
    if let Some(patient_id) = &invoice.patient_id {
        let patient_exists = sqlx::query!(
            "SELECT id FROM patients WHERE id = $1",
            Uuid::parse_str(patient_id)?
        )
        .fetch_optional(pool)
        .await?
        .is_some();
        
        if !patient_exists {
            return Err(AppError::NotFound("Patient not found".to_string()));
        }
    }
    
    // Validate items
    if items.is_empty() {
        return Err(AppError::InvalidInput(
            "Invoice must have at least one item".to_string()
        ));
    }
    
    // Validate each item
    for item in items {
        if item.quantity <= 0 {
            return Err(AppError::InvalidInput(
                "Item quantity must be greater than 0".to_string()
            ));
        }
        
        if item.unit_price <= 0.0 {
            return Err(AppError::InvalidInput(
                "Item unit price must be greater than 0".to_string()
            ));
        }
        
        // Check if calculated total matches
        let calculated_total = item.quantity as f64 * item.unit_price;
        if (calculated_total - item.total_price).abs() > 0.01 {
            return Err(AppError::InvalidInput(
                "Item total price calculation mismatch".to_string()
            ));
        }
    }
    
    // Validate invoice totals
    let calculated_subtotal: f64 = items.iter().map(|item| item.total_price).sum();
    if (calculated_subtotal - invoice.subtotal).abs() > 0.01 {
        return Err(AppError::InvalidInput(
            "Invoice subtotal calculation mismatch".to_string()
        ));
    }
    
    // Validate tax calculation (16% VAT)
    let expected_tax = calculated_subtotal * 0.16;
    if (expected_tax - invoice.tax).abs() > 0.01 {
        return Err(AppError::InvalidInput(
            "Invoice tax calculation mismatch (should be 16% VAT)".to_string()
        ));
    }
    
    let expected_total = calculated_subtotal + expected_tax;
    if (expected_total - invoice.total).abs() > 0.01 {
        return Err(AppError::InvalidInput(
            "Invoice total calculation mismatch".to_string()
        ));
    }
    
    Ok(())
}

// SHA member validation (placeholder for external API integration)
pub async fn validate_sha_member(
    member_number: &str,
    patient_name: &str,
) -> Result<bool, AppError> {
    // In a real implementation, this would call the SHA API
    // For now, we'll simulate the validation
    
    if member_number.is_empty() || member_number.len() < 5 {
        return Err(AppError::InvalidInput(
            "Invalid SHA member number format".to_string()
        ));
    }
    
    if patient_name.is_empty() {
        return Err(AppError::InvalidInput(
            "Patient name is required for SHA validation".to_string()
        ));
    }
    
    // Simulate API call delay
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    // Simulate validation result (in real system, this would be the actual API response)
    Ok(true)
}

// M-Pesa payment validation (placeholder for external API integration)
pub async fn validate_mpesa_payment(
    phone_number: &str,
    amount: f64,
    reference: &str,
) -> Result<bool, AppError> {
    // In a real implementation, this would call the M-Pesa API
    
    if phone_number.is_empty() || !phone_number.starts_with("+254") {
        return Err(AppError::InvalidInput(
            "Invalid phone number format for M-Pesa".to_string()
        ));
    }
    
    if amount <= 0.0 {
        return Err(AppError::InvalidInput(
            "Payment amount must be greater than 0".to_string()
        ));
    }
    
    if reference.is_empty() {
        return Err(AppError::InvalidInput(
            "Payment reference is required".to_string()
        ));
    }
    
    // Simulate API call delay
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    
    // Simulate payment validation result
    Ok(true)
}
