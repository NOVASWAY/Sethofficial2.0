use serde::{Deserialize, Serialize};
use validator::Validate;
use argon2::{Argon2, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{PasswordHash, SaltString};
use rand::rngs::OsRng;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tracing::{info, warn, error};
use uuid::Uuid;
use chrono::{Utc, Duration};

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct UserRegistration {
    #[validate(length(min = 3, max = 50))]
    pub username: String,
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8, max = 100))]
    pub password: String,
    #[validate(length(min = 2, max = 50))]
    pub first_name: String,
    #[validate(length(min = 2, max = 50))]
    pub last_name: String,
    pub role: String,
    pub name: String,
    pub department: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct PasswordResetRequest {
    #[validate(email)]
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct PasswordReset {
    pub token: String,
    #[validate(length(min = 8, max = 100))]
    pub new_password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub role: String,
    pub permissions: Vec<String>,
    pub is_active: bool,
    pub email_verified: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_login: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserWithPassword {
    pub id: String,
    pub username: String,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub role: String,
    pub permissions: Vec<String>,
    pub is_active: bool,
    pub email_verified: bool,
    pub password_hash: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_login: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordResetToken {
    pub token: String,
    pub user_id: String,
    pub email: String,
    pub expires_at: String,
    pub used: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailVerificationToken {
    pub token: String,
    pub user_id: String,
    pub email: String,
    pub expires_at: String,
    pub used: bool,
    pub created_at: String,
}

pub struct UserManagementService {
    users: Arc<Mutex<HashMap<String, UserWithPassword>>>,
    password_reset_tokens: Arc<Mutex<HashMap<String, PasswordResetToken>>>,
    email_verification_tokens: Arc<Mutex<HashMap<String, EmailVerificationToken>>>,
}

impl UserManagementService {
    pub fn new() -> Self {
        let mut service = UserManagementService {
            users: Arc::new(Mutex::new(HashMap::new())),
            password_reset_tokens: Arc::new(Mutex::new(HashMap::new())),
            email_verification_tokens: Arc::new(Mutex::new(HashMap::new())),
        };
        
        // Initialize with default admin user
        service.initialize_default_users();
        service
    }

    fn initialize_default_users(&mut self) {
        let admin_user = UserWithPassword {
            id: "U001".to_string(),
            username: "admin".to_string(),
            email: "admin@clinic.com".to_string(),
            first_name: "System".to_string(),
            last_name: "Administrator".to_string(),
            role: "admin".to_string(),
            permissions: vec!["all".to_string()],
            is_active: true,
            email_verified: true,
            password_hash: Self::hash_password("admin123").unwrap_or_else(|_| "hash_failed".to_string()),
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
            last_login: None,
        };

        let mut users = self.users.lock().unwrap();
        users.insert(admin_user.id.clone(), admin_user);
        info!("Default admin user initialized");
    }

    pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2.hash_password(password.as_bytes(), &salt)?;
        Ok(password_hash.to_string())
    }

    pub fn verify_password(password: &str, hash: &str) -> bool {
        let parsed_hash = match PasswordHash::new(hash) {
            Ok(hash) => hash,
            Err(_) => return false,
        };

        Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok()
    }

    pub fn register_user(&self, registration: UserRegistration) -> Result<User, String> {
        info!("Registering new user: {}", registration.username);

        // Check if username already exists
        let users = self.users.lock().unwrap();
        if users.values().any(|u| u.username == registration.username) {
            return Err("Username already exists".to_string());
        }

        // Check if email already exists
        if users.values().any(|u| u.email == registration.email) {
            return Err("Email already exists".to_string());
        }

        drop(users);

        // Hash password
        let password_hash = match Self::hash_password(&registration.password) {
            Ok(hash) => hash,
            Err(e) => {
                error!("Failed to hash password: {}", e);
                return Err("Failed to process password".to_string());
            }
        };

        // Create user
        let user_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let user_with_password = UserWithPassword {
            id: user_id.clone(),
            username: registration.username.clone(),
            email: registration.email.clone(),
            first_name: registration.first_name.clone(),
            last_name: registration.last_name.clone(),
            role: registration.role.clone(),
            permissions: Self::get_role_permissions(&registration.role),
            is_active: true,
            email_verified: false,
            password_hash,
            created_at: now.clone(),
            updated_at: now.clone(),
            last_login: None,
        };

        // Store user
        let mut users = self.users.lock().unwrap();
        users.insert(user_id.clone(), user_with_password);

        // Create email verification token
        let _verification_token = self.create_email_verification_token(&user_id, &registration.email);

        info!("User registered successfully: {} ({})", registration.username, user_id);

        // Return user without password
        Ok(User {
            id: user_id,
            username: registration.username,
            email: registration.email,
            first_name: registration.first_name,
            last_name: registration.last_name,
            role: registration.role.clone(),
            permissions: Self::get_role_permissions(&registration.role),
            is_active: true,
            email_verified: false,
            created_at: now.clone(),
            updated_at: now,
            last_login: None,
        })
    }

    pub fn authenticate_user(&self, username: &str, password: &str) -> Option<User> {
        let user_with_password = {
            let users = self.users.lock().unwrap();
            users.values().find(|u| u.username == username && u.is_active).cloned()
        };
        
        if let Some(user_with_password) = user_with_password {
            if Self::verify_password(password, &user_with_password.password_hash) {
                self.update_last_login(&user_with_password.id);
                
                info!("User authenticated successfully: {}", username);
                
                // Return user without password
                return Some(User {
                    id: user_with_password.id.clone(),
                    username: user_with_password.username.clone(),
                    email: user_with_password.email.clone(),
                    first_name: user_with_password.first_name.clone(),
                    last_name: user_with_password.last_name.clone(),
                    role: user_with_password.role.clone(),
                    permissions: user_with_password.permissions.clone(),
                    is_active: user_with_password.is_active,
                    email_verified: user_with_password.email_verified,
                    created_at: user_with_password.created_at.clone(),
                    updated_at: user_with_password.updated_at.clone(),
                    last_login: user_with_password.last_login.clone(),
                });
            }
        }

        warn!("Authentication failed for user: {}", username);
        None
    }

    pub fn request_password_reset(&self, email: String) -> Result<String, String> {
        info!("Password reset requested for email: {}", email);

        let user = {
            let users = self.users.lock().unwrap();
            users.values().find(|u| u.email == email && u.is_active).cloned()
        };
        
        if let Some(user) = user {
            let token = self.create_password_reset_token(&user.id, &email);
            info!("Password reset token created for user: {}", user.username);
            Ok(token)
        } else {
            Err("User not found or inactive".to_string())
        }
    }

    pub fn reset_password(&self, token: String, new_password: String) -> Result<(), String> {
        info!("Password reset attempt with token");

        let mut reset_tokens = self.password_reset_tokens.lock().unwrap();
        if let Some(reset_token) = reset_tokens.get_mut(&token) {
            if reset_token.used {
                return Err("Token already used".to_string());
            }

            let now = Utc::now();
            let expires_at = chrono::DateTime::parse_from_rfc3339(&reset_token.expires_at)
                .map_err(|_| "Invalid token expiration")?;

            if now > expires_at {
                return Err("Token expired".to_string());
            }

            // Hash new password
            let password_hash = match Self::hash_password(&new_password) {
                Ok(hash) => hash,
                Err(e) => {
                    error!("Failed to hash new password: {}", e);
                    return Err("Failed to process password".to_string());
                }
            };

            // Update user password
            let mut users = self.users.lock().unwrap();
            if let Some(user) = users.get_mut(&reset_token.user_id) {
                user.password_hash = password_hash;
                user.updated_at = Utc::now().to_rfc3339();
                reset_token.used = true;
                
                info!("Password reset successful for user: {}", user.username);
                Ok(())
            } else {
                Err("User not found".to_string())
            }
        } else {
            Err("Invalid token".to_string())
        }
    }

    pub fn verify_email(&self, token: String) -> Result<(), String> {
        info!("Email verification attempt with token");

        let mut verification_tokens = self.email_verification_tokens.lock().unwrap();
        if let Some(verification_token) = verification_tokens.get_mut(&token) {
            if verification_token.used {
                return Err("Token already used".to_string());
            }

            let now = Utc::now();
            let expires_at = chrono::DateTime::parse_from_rfc3339(&verification_token.expires_at)
                .map_err(|_| "Invalid token expiration")?;

            if now > expires_at {
                return Err("Token expired".to_string());
            }

            // Update user email verification status
            let mut users = self.users.lock().unwrap();
            if let Some(user) = users.get_mut(&verification_token.user_id) {
                user.email_verified = true;
                user.updated_at = Utc::now().to_rfc3339();
                verification_token.used = true;
                
                info!("Email verified successfully for user: {}", user.username);
                Ok(())
            } else {
                Err("User not found".to_string())
            }
        } else {
            Err("Invalid token".to_string())
        }
    }

    pub fn get_user_by_id(&self, user_id: &str) -> Option<User> {
        let users = self.users.lock().unwrap();
        users.get(user_id).map(|u| User {
            id: u.id.clone(),
            username: u.username.clone(),
            email: u.email.clone(),
            first_name: u.first_name.clone(),
            last_name: u.last_name.clone(),
            role: u.role.clone(),
            permissions: u.permissions.clone(),
            is_active: u.is_active,
            email_verified: u.email_verified,
            created_at: u.created_at.clone(),
            updated_at: u.updated_at.clone(),
            last_login: u.last_login.clone(),
        })
    }

    pub fn get_all_users(&self) -> Vec<User> {
        let users = self.users.lock().unwrap();
        users.values().map(|u| User {
            id: u.id.clone(),
            username: u.username.clone(),
            email: u.email.clone(),
            first_name: u.first_name.clone(),
            last_name: u.last_name.clone(),
            role: u.role.clone(),
            permissions: u.permissions.clone(),
            is_active: u.is_active,
            email_verified: u.email_verified,
            created_at: u.created_at.clone(),
            updated_at: u.updated_at.clone(),
            last_login: u.last_login.clone(),
        }).collect()
    }

    pub fn update_user(&self, user_id: &str, updates: UserUpdate) -> Result<User, String> {
        let mut users = self.users.lock().unwrap();
        if let Some(user) = users.get_mut(user_id) {
            if let Some(first_name) = updates.first_name {
                user.first_name = first_name;
            }
            if let Some(last_name) = updates.last_name {
                user.last_name = last_name;
            }
            if let Some(email) = updates.email {
                user.email = email;
                user.email_verified = false; // Require re-verification
            }
            if let Some(role) = updates.role {
                user.role = role.clone();
                user.permissions = Self::get_role_permissions(&role);
            }
            if let Some(is_active) = updates.is_active {
                user.is_active = is_active;
            }

            user.updated_at = Utc::now().to_rfc3339();

            info!("User updated: {}", user.username);

            Ok(User {
                id: user.id.clone(),
                username: user.username.clone(),
                email: user.email.clone(),
                first_name: user.first_name.clone(),
                last_name: user.last_name.clone(),
                role: user.role.clone(),
                permissions: user.permissions.clone(),
                is_active: user.is_active,
                email_verified: user.email_verified,
                created_at: user.created_at.clone(),
                updated_at: user.updated_at.clone(),
                last_login: user.last_login.clone(),
            })
        } else {
            Err("User not found".to_string())
        }
    }

    fn create_password_reset_token(&self, user_id: &str, email: &str) -> String {
        let token = Uuid::new_v4().to_string();
        let expires_at = Utc::now() + Duration::hours(1); // 1 hour expiry

        let reset_token = PasswordResetToken {
            token: token.clone(),
            user_id: user_id.to_string(),
            email: email.to_string(),
            expires_at: expires_at.to_rfc3339(),
            used: false,
            created_at: Utc::now().to_rfc3339(),
        };

        let mut tokens = self.password_reset_tokens.lock().unwrap();
        tokens.insert(token.clone(), reset_token);
        token
    }

    fn create_email_verification_token(&self, user_id: &str, email: &str) -> String {
        let token = Uuid::new_v4().to_string();
        let expires_at = Utc::now() + Duration::days(7); // 7 days expiry

        let verification_token = EmailVerificationToken {
            token: token.clone(),
            user_id: user_id.to_string(),
            email: email.to_string(),
            expires_at: expires_at.to_rfc3339(),
            used: false,
            created_at: Utc::now().to_rfc3339(),
        };

        let mut tokens = self.email_verification_tokens.lock().unwrap();
        tokens.insert(token.clone(), verification_token);
        token
    }

    fn update_last_login(&self, user_id: &str) {
        let mut users = self.users.lock().unwrap();
        if let Some(user) = users.get_mut(user_id) {
            user.last_login = Some(Utc::now().to_rfc3339());
        }
    }

    fn get_role_permissions(role: &str) -> Vec<String> {
        match role {
            "admin" => vec!["all".to_string()],
            "doctor" => vec![
                "patients:read".to_string(),
                "patients:write".to_string(),
                "consultations:read".to_string(),
                "consultations:write".to_string(),
                "prescriptions:read".to_string(),
                "prescriptions:write".to_string(),
                "appointments:read".to_string(),
                "appointments:write".to_string(),
            ],
            "nurse" => vec![
                "patients:read".to_string(),
                "patients:write".to_string(),
                "appointments:read".to_string(),
                "appointments:write".to_string(),
            ],
            "receptionist" => vec![
                "patients:read".to_string(),
                "patients:write".to_string(),
                "appointments:read".to_string(),
                "appointments:write".to_string(),
                "invoices:read".to_string(),
                "invoices:write".to_string(),
            ],
            _ => vec!["patients:read".to_string()],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserUpdate {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub role: Option<String>,
    pub is_active: Option<bool>,
}

impl Default for UserManagementService {
    fn default() -> Self {
        Self::new()
    }
}
