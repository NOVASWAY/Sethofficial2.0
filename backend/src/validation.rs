use crate::error::{ApiError, ValidationErrors, validate_email, validate_phone_number, validate_required_string, validate_string_length, validate_positive_number, validate_date_range, Validate};
use crate::models::*;
use chrono::{NaiveDate, Utc, Datelike};
use uuid::Uuid;

// Patient validation
impl Validate for CreatePatient {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();

        // Required fields
        if let Err(err) = validate_required_string(&self.first_name, "First name") {
            errors.add_error("first_name".to_string(), err, Some(serde_json::Value::String(self.first_name.clone())));
        } else if let Err(err) = validate_string_length(&self.first_name, 1, 100, "First name") {
            errors.add_error("first_name".to_string(), err, Some(serde_json::Value::String(self.first_name.clone())));
        }

        if let Err(err) = validate_required_string(&self.last_name, "Last name") {
            errors.add_error("last_name".to_string(), err, Some(serde_json::Value::String(self.last_name.clone())));
        } else if let Err(err) = validate_string_length(&self.last_name, 1, 100, "Last name") {
            errors.add_error("last_name".to_string(), err, Some(serde_json::Value::String(self.last_name.clone())));
        }

        // Location validation (optional)
        if let Some(location) = &self.location {
            if !location.is_empty() {
                if let Err(err) = validate_string_length(location, 1, 200, "Location") {
                    errors.add_error("location".to_string(), err, Some(serde_json::Value::String(location.clone())));
                }
            }
        }

        // Phone validation
        if !self.phone.is_empty() {
            if let Err(err) = validate_phone_number(&self.phone) {
                errors.add_error("phone".to_string(), err, Some(serde_json::Value::String(self.phone.clone())));
            }
        }

        // Date of birth validation
        let today = Utc::now();
        if self.date_of_birth > today {
            errors.add_error("date_of_birth".to_string(), "Date of birth cannot be in the future".to_string(), Some(serde_json::Value::String(self.date_of_birth.to_string())));
        }

        // Check if patient is too old (e.g., over 150 years)
        let age = today.year() - self.date_of_birth.year();
        if age > 150 {
            errors.add_error("date_of_birth".to_string(), "Invalid date of birth".to_string(), Some(serde_json::Value::String(self.date_of_birth.to_string())));
        }

        // Gender validation
        if !["Male", "Female", "Other"].contains(&self.gender.as_str()) {
            errors.add_error("gender".to_string(), "Gender must be Male, Female, or Other".to_string(), Some(serde_json::Value::String(self.gender.clone())));
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// UpdatePatient validation
impl Validate for UpdatePatient {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();

        // First name validation (if provided)
        if let Some(first_name) = &self.first_name {
            if let Err(err) = validate_required_string(first_name, "First name") {
                errors.add_error("first_name".to_string(), err, Some(serde_json::Value::String(first_name.clone())));
            } else if let Err(err) = validate_string_length(first_name, 1, 100, "First name") {
                errors.add_error("first_name".to_string(), err, Some(serde_json::Value::String(first_name.clone())));
            }
        }

        // Last name validation (if provided)
        if let Some(last_name) = &self.last_name {
            if let Err(err) = validate_required_string(last_name, "Last name") {
                errors.add_error("last_name".to_string(), err, Some(serde_json::Value::String(last_name.clone())));
            } else if let Err(err) = validate_string_length(last_name, 1, 100, "Last name") {
                errors.add_error("last_name".to_string(), err, Some(serde_json::Value::String(last_name.clone())));
            }
        }

        // Location validation (if provided)
        if let Some(location) = &self.location {
            if !location.is_empty() {
                if let Err(err) = validate_string_length(location, 1, 200, "Location") {
                    errors.add_error("location".to_string(), err, Some(serde_json::Value::String(location.clone())));
                }
            }
        }

        // Phone validation (if provided)
        if let Some(phone) = &self.phone {
            if !phone.is_empty() {
                if let Err(err) = validate_phone_number(phone) {
                    errors.add_error("phone".to_string(), err, Some(serde_json::Value::String(phone.clone())));
                }
            }
        }

        // Date of birth validation (if provided)
        if let Some(date_of_birth) = &self.date_of_birth {
            let today = Utc::now().date_naive();
            if *date_of_birth > today {
                errors.add_error("date_of_birth".to_string(), "Date of birth cannot be in the future".to_string(), Some(serde_json::Value::String(date_of_birth.to_string())));
            }

            // Check if patient is too old (e.g., over 150 years)
            let age = today.year() - date_of_birth.year();
            if age > 150 {
                errors.add_error("date_of_birth".to_string(), "Invalid date of birth".to_string(), Some(serde_json::Value::String(date_of_birth.to_string())));
            }
        }

        // Gender validation (if provided)
        if let Some(gender) = &self.gender {
            if !["Male", "Female", "Other"].contains(&gender.as_str()) {
                errors.add_error("gender".to_string(), "Gender must be Male, Female, or Other".to_string(), Some(serde_json::Value::String(gender.clone())));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// User validation
impl Validate for CreateUser {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();

        // Username validation
        if let Err(err) = validate_required_string(&self.username, "Username") {
            errors.add_error("username".to_string(), err, Some(serde_json::Value::String(self.username.clone())));
        } else if let Err(err) = validate_string_length(&self.username, 3, 50, "Username") {
            errors.add_error("username".to_string(), err, Some(serde_json::Value::String(self.username.clone())));
        } else if !self.username.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
            errors.add_error("username".to_string(), "Username can only contain letters, numbers, underscores, and hyphens".to_string(), Some(serde_json::Value::String(self.username.clone())));
        }

        // Department validation (optional)
        if let Some(department) = &self.department {
            if !department.is_empty() {
                if let Err(err) = validate_string_length(department, 1, 100, "Department") {
                    errors.add_error("department".to_string(), err, Some(serde_json::Value::String(department.clone())));
                }
            }
        }

        // Password validation
        if let Err(err) = validate_required_string(&self.password, "Password") {
            errors.add_error("password".to_string(), err, None);
        } else if let Err(err) = validate_password_strength(&self.password) {
            errors.add_error("password".to_string(), err, None);
        }

        // Role validation
        if let Err(err) = validate_required_string(&self.role, "Role") {
            errors.add_error("role".to_string(), err, Some(serde_json::Value::String(self.role.clone())));
        } else if !["admin", "doctor", "nurse", "receptionist", "pharmacist"].contains(&self.role.as_str()) {
            errors.add_error("role".to_string(), "Role must be one of: admin, doctor, nurse, receptionist, pharmacist".to_string(), Some(serde_json::Value::String(self.role.clone())));
        }

        // Name validation
        if let Err(err) = validate_string_length(&self.name, 1, 100, "Name") {
            errors.add_error("name".to_string(), err, Some(serde_json::Value::String(self.name.clone())));
        }

        if errors.is_empty() {
        Ok(())
    } else {
            Err(errors)
        }
    }
}

// Appointment validation
impl Validate for CreateAppointment {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();

        // Date validation - appointment_date is already a NaiveDate
        let today = Utc::now().date_naive();
        if self.appointment_date < today {
            errors.add_error("appointment_date".to_string(), "Appointment date cannot be in the past".to_string(), Some(serde_json::Value::String(self.appointment_date.to_string())));
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// Invoice validation
impl Validate for CreateInvoice {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();

        // Items validation
        if self.items.is_empty() {
            errors.add_error("items".to_string(), "Invoice must have at least one item".to_string(), None);
        } else {
            for (index, item) in self.items.iter().enumerate() {
                if let Err(err) = validate_required_string(&item.description, "Item description") {
                    errors.add_error(format!("items[{}].description", index), err, Some(serde_json::Value::String(item.description.clone())));
                }

                if let Err(err) = validate_positive_number(item.unit_price, "Item unit price") {
                    errors.add_error(format!("items[{}].unit_price", index), err, Some(serde_json::Value::Number(serde_json::Number::from_f64(item.unit_price).unwrap_or(serde_json::Number::from(0)))));
                }

                if item.quantity <= 0 {
                    errors.add_error(format!("items[{}].quantity", index), "Quantity must be positive".to_string(), Some(serde_json::Value::Number(serde_json::Number::from(item.quantity))));
                }
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// Medicine validation
impl Validate for CreateMedicine {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();

        // Name validation
        if let Err(err) = validate_required_string(&self.name, "Medicine name") {
            errors.add_error("name".to_string(), err, Some(serde_json::Value::String(self.name.clone())));
        } else if let Err(err) = validate_string_length(&self.name, 1, 200, "Medicine name") {
            errors.add_error("name".to_string(), err, Some(serde_json::Value::String(self.name.clone())));
        }

        // Generic name validation
        if let Some(generic_name) = &self.generic_name {
            if let Err(err) = validate_string_length(generic_name, 1, 200, "Generic name") {
                errors.add_error("generic_name".to_string(), err, Some(serde_json::Value::String(generic_name.clone())));
            }
        }

        // Dosage form validation
        if !["tablet", "capsule", "syrup", "injection", "cream", "ointment", "drops", "inhaler", "patch"].contains(&self.dosage_form.as_str()) {
            errors.add_error("dosage_form".to_string(), "Invalid dosage form".to_string(), Some(serde_json::Value::String(self.dosage_form.clone())));
        }

        // Strength validation
        if let Err(err) = validate_string_length(&self.strength, 1, 50, "Strength") {
            errors.add_error("strength".to_string(), err, Some(serde_json::Value::String(self.strength.clone())));
        }

        // Price validation
        if let Err(err) = validate_positive_number(self.unit_price, "Unit price") {
            errors.add_error("unit_price".to_string(), err, Some(serde_json::Value::Number(serde_json::Number::from_f64(self.unit_price).unwrap_or(serde_json::Number::from(0)))));
        }

        // Stock quantity validation
        if self.stock_quantity < 0 {
            errors.add_error("stock_quantity".to_string(), "Stock quantity cannot be negative".to_string(), Some(serde_json::Value::Number(serde_json::Number::from(self.stock_quantity))));
        }

        // Minimum stock validation
        if self.minimum_stock < 0 {
            errors.add_error("minimum_stock".to_string(), "Minimum stock cannot be negative".to_string(), Some(serde_json::Value::Number(serde_json::Number::from(self.minimum_stock))));
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// Consultation validation
impl Validate for CreateConsultation {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();

        // Chief complaint validation
        if let Err(err) = validate_string_length(&self.chief_complaint, 1, 1000, "Chief complaint") {
            errors.add_error("chief_complaint".to_string(), err, Some(serde_json::Value::String(self.chief_complaint.clone())));
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// Password strength validation
fn validate_password_strength(password: &str) -> Result<(), String> {
    if password.len() < 8 {
        return Err("Password must be at least 8 characters long".to_string());
    }

    if password.len() > 128 {
        return Err("Password must be no more than 128 characters long".to_string());
    }

    let has_uppercase = password.chars().any(|c| c.is_uppercase());
    let has_lowercase = password.chars().any(|c| c.is_lowercase());
    let has_digit = password.chars().any(|c| c.is_ascii_digit());
    let has_special = password.chars().any(|c| "!@#$%^&*()_+-=[]{}|;:,.<>?".contains(c));

    if !has_uppercase {
        return Err("Password must contain at least one uppercase letter".to_string());
    }

    if !has_lowercase {
        return Err("Password must contain at least one lowercase letter".to_string());
    }

    if !has_digit {
        return Err("Password must contain at least one digit".to_string());
    }

    if !has_special {
        return Err("Password must contain at least one special character".to_string());
    }

    Ok(())
}

// Date range validation for reports
pub fn validate_report_date_range(date_from: Option<&str>, date_to: Option<&str>) -> Result<(Option<NaiveDate>, Option<NaiveDate>), ApiError> {
    let from_date = if let Some(from) = date_from {
        Some(NaiveDate::parse_from_str(from, "%Y-%m-%d")
            .map_err(|_| ApiError::validation_error("Invalid date_from format. Use YYYY-MM-DD".to_string()))?)
    } else {
        None
    };

    let to_date = if let Some(to) = date_to {
        Some(NaiveDate::parse_from_str(to, "%Y-%m-%d")
            .map_err(|_| ApiError::validation_error("Invalid date_to format. Use YYYY-MM-DD".to_string()))?)
    } else {
        None
    };

    if let (Some(from), Some(to)) = (from_date, to_date) {
        validate_date_range(from, to)
            .map_err(|err| ApiError::validation_error(err))?;
    }

    Ok((from_date, to_date))
}

// Pagination validation
pub fn validate_pagination(page: Option<u32>, per_page: Option<u32>) -> Result<(u32, u32), ApiError> {
    let page = page.unwrap_or(1);
    let per_page = per_page.unwrap_or(20);

    if page == 0 {
        return Err(ApiError::validation_error("Page must be greater than 0".to_string()));
    }

    if per_page == 0 || per_page > 100 {
        return Err(ApiError::validation_error("Per page must be between 1 and 100".to_string()));
    }

    Ok((page, per_page))
}