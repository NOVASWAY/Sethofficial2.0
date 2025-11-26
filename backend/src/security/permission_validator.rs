use crate::auth::Claims;
use crate::models::User;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permission {
    pub resource: String,
    pub action: String,
    pub conditions: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RolePermissions {
    pub role: String,
    pub permissions: Vec<Permission>,
    pub department_restrictions: Option<Vec<String>>,
    pub data_isolation_rules: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessRequest {
    pub user_id: Uuid,
    pub role: String,
    pub department: Option<String>,
    pub resource: String,
    pub action: String,
    pub entity_id: Option<Uuid>,
    pub entity_data: Option<HashMap<String, serde_json::Value>>,
    pub context: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessDecision {
    pub allowed: bool,
    pub reason: Option<String>,
    pub conditions: Option<HashMap<String, serde_json::Value>>,
    pub audit_log: Option<HashMap<String, serde_json::Value>>,
}

pub struct PermissionValidator {
    role_permissions: HashMap<String, RolePermissions>,
}

impl PermissionValidator {
    pub fn new() -> Self {
        let mut validator = Self {
            role_permissions: HashMap::new(),
        };
        validator.initialize_default_permissions();
        validator
    }

    fn initialize_default_permissions(&mut self) {
        // Admin permissions - full access
        self.role_permissions.insert("admin".to_string(), RolePermissions {
            role: "admin".to_string(),
            permissions: vec![
                Permission {
                    resource: "patients".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "patients".to_string(),
                    action: "write".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "patients".to_string(),
                    action: "delete".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "consultations".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "consultations".to_string(),
                    action: "write".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "consultations".to_string(),
                    action: "delete".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "prescriptions".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "prescriptions".to_string(),
                    action: "write".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "prescriptions".to_string(),
                    action: "delete".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "invoices".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "invoices".to_string(),
                    action: "write".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "invoices".to_string(),
                    action: "delete".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "users".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "users".to_string(),
                    action: "write".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "users".to_string(),
                    action: "delete".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "dashboard".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "reports".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "reports".to_string(),
                    action: "write".to_string(),
                    conditions: None,
                },
            ],
            department_restrictions: None,
            data_isolation_rules: None,
        });

        // Clinician permissions - patient care focused
        self.role_permissions.insert("clinician".to_string(), RolePermissions {
            role: "clinician".to_string(),
            permissions: vec![
                Permission {
                    resource: "patients".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("assigned_clinician_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "patients".to_string(),
                    action: "write".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("assigned_clinician_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "consultations".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("doctor_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "consultations".to_string(),
                    action: "write".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("doctor_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "prescriptions".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("prescribing_doctor_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "prescriptions".to_string(),
                    action: "write".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("prescribing_doctor_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "invoices".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("consultation_doctor_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "dashboard".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
            ],
            department_restrictions: Some(vec!["clinical".to_string()]),
            data_isolation_rules: Some({
                let mut rules = HashMap::new();
                rules.insert("patients".to_string(), serde_json::json!({
                    "filter": "assigned_clinician_id = $USER_ID",
                    "can_view_all": false
                }));
                rules.insert("consultations".to_string(), serde_json::json!({
                    "filter": "doctor_id = $USER_ID",
                    "can_view_all": false
                }));
                rules
            }),
        });

        // Nurse permissions - patient care support
        self.role_permissions.insert("nurse".to_string(), RolePermissions {
            role: "nurse".to_string(),
            permissions: vec![
                Permission {
                    resource: "patients".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("assigned_nurse_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "patients".to_string(),
                    action: "write".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("assigned_nurse_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "consultations".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("assigned_nurse_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "consultations".to_string(),
                    action: "write".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("assigned_nurse_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "prescriptions".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("assigned_nurse_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "invoices".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("patient_assigned_nurse_id".to_string(), serde_json::Value::String("$USER_ID".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "dashboard".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
            ],
            department_restrictions: Some(vec!["clinical".to_string()]),
            data_isolation_rules: Some({
                let mut rules = HashMap::new();
                rules.insert("patients".to_string(), serde_json::json!({
                    "filter": "assigned_nurse_id = $USER_ID",
                    "can_view_all": false
                }));
                rules.insert("consultations".to_string(), serde_json::json!({
                    "filter": "assigned_nurse_id = $USER_ID",
                    "can_view_all": false
                }));
                rules
            }),
        });

        // Pharmacist permissions - pharmacy focused
        self.role_permissions.insert("pharmacist".to_string(), RolePermissions {
            role: "pharmacist".to_string(),
            permissions: vec![
                Permission {
                    resource: "patients".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("pharmacy".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "consultations".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("pharmacy".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "prescriptions".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("pharmacy".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "prescriptions".to_string(),
                    action: "write".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("pharmacy".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "invoices".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("pharmacy".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "invoices".to_string(),
                    action: "write".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("pharmacy".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "dashboard".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
            ],
            department_restrictions: Some(vec!["pharmacy".to_string()]),
            data_isolation_rules: Some({
                let mut rules = HashMap::new();
                rules.insert("patients".to_string(), serde_json::json!({
                    "filter": "department = 'pharmacy'",
                    "can_view_all": false
                }));
                rules.insert("prescriptions".to_string(), serde_json::json!({
                    "filter": "department = 'pharmacy'",
                    "can_view_all": false
                }));
                rules
            }),
        });

        // Receptionist permissions - administrative
        self.role_permissions.insert("receptionist".to_string(), RolePermissions {
            role: "receptionist".to_string(),
            permissions: vec![
                Permission {
                    resource: "patients".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("reception".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "patients".to_string(),
                    action: "write".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("reception".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "consultations".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("reception".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "invoices".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("reception".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "invoices".to_string(),
                    action: "write".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("reception".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "dashboard".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
            ],
            department_restrictions: Some(vec!["reception".to_string()]),
            data_isolation_rules: Some({
                let mut rules = HashMap::new();
                rules.insert("patients".to_string(), serde_json::json!({
                    "filter": "department = 'reception'",
                    "can_view_all": false
                }));
                rules.insert("invoices".to_string(), serde_json::json!({
                    "filter": "department = 'reception'",
                    "can_view_all": false
                }));
                rules
            }),
        });

        // Lab Technician permissions - lab focused
        self.role_permissions.insert("lab_technician".to_string(), RolePermissions {
            role: "lab_technician".to_string(),
            permissions: vec![
                Permission {
                    resource: "patients".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("laboratory".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "lab_orders".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "lab_orders".to_string(),
                    action: "write".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "lab_results".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "lab_results".to_string(),
                    action: "write".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "lab_results".to_string(),
                    action: "verify".to_string(),
                    conditions: None,
                },
                Permission {
                    resource: "consultations".to_string(),
                    action: "read".to_string(),
                    conditions: Some({
                        let mut conditions = HashMap::new();
                        conditions.insert("department".to_string(), serde_json::Value::String("laboratory".to_string()));
                        conditions
                    }),
                },
                Permission {
                    resource: "dashboard".to_string(),
                    action: "read".to_string(),
                    conditions: None,
                },
            ],
            department_restrictions: Some(vec!["laboratory".to_string()]),
            data_isolation_rules: Some({
                let mut rules = HashMap::new();
                rules.insert("patients".to_string(), serde_json::json!({
                    "filter": "department = 'laboratory'",
                    "can_view_all": false
                }));
                rules.insert("lab_orders".to_string(), serde_json::json!({
                    "filter": "status IN ('pending', 'collected', 'in_progress')",
                    "can_view_all": true
                }));
                rules.insert("lab_results".to_string(), serde_json::json!({
                    "filter": "status IN ('pending', 'verified')",
                    "can_view_all": true
                }));
                rules
            }),
        });
    }

    pub fn validate_access(&self, request: &AccessRequest) -> AccessDecision {
        // Get role permissions
        let role_permissions = match self.role_permissions.get(&request.role) {
            Some(perms) => perms,
            None => {
                return AccessDecision {
                    allowed: false,
                    reason: Some(format!("Unknown role: {}", request.role)),
                    conditions: None,
                    audit_log: Some(self.create_audit_log(request, false, "Unknown role")),
                };
            }
        };

        // Check department restrictions
        if let Some(department_restrictions) = &role_permissions.department_restrictions {
            if let Some(user_department) = &request.department {
                if !department_restrictions.contains(user_department) {
                    return AccessDecision {
                        allowed: false,
                        reason: Some(format!("Department '{}' not allowed for role '{}'", user_department, request.role)),
                        conditions: None,
                        audit_log: Some(self.create_audit_log(request, false, "Department restriction")),
                    };
                }
            }
        }

        // Find matching permission
        let matching_permission = role_permissions.permissions.iter().find(|perm| {
            perm.resource == request.resource && perm.action == request.action
        });

        match matching_permission {
            Some(permission) => {
                // Check conditions if any
                if let Some(conditions) = &permission.conditions {
                    if !self.check_conditions(conditions, request) {
                        return AccessDecision {
                            allowed: false,
                            reason: Some("Access conditions not met".to_string()),
                            conditions: Some(conditions.clone()),
                            audit_log: Some(self.create_audit_log(request, false, "Conditions not met")),
                        };
                    }
                }

                AccessDecision {
                    allowed: true,
                    reason: None,
                    conditions: permission.conditions.clone(),
                    audit_log: Some(self.create_audit_log(request, true, "Access granted")),
                }
            }
            None => {
                AccessDecision {
                    allowed: false,
                    reason: Some(format!("No permission for {}:{}", request.resource, request.action)),
                    conditions: None,
                    audit_log: Some(self.create_audit_log(request, false, "No permission")),
                }
            }
        }
    }

    fn check_conditions(&self, conditions: &HashMap<String, serde_json::Value>, request: &AccessRequest) -> bool {
        for (key, value) in conditions {
            match key.as_str() {
                "assigned_clinician_id" | "doctor_id" | "prescribing_doctor_id" | "assigned_nurse_id" | "patient_assigned_nurse_id" => {
                    if let Some(entity_data) = &request.entity_data {
                        if let Some(entity_value) = entity_data.get(key) {
                            if value.as_str() == Some("$USER_ID") {
                                if entity_value.as_str() != Some(&request.user_id.to_string()) {
                                    return false;
                                }
                            } else if entity_value != value {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                "department" => {
                    if let Some(user_department) = &request.department {
                        if value.as_str() != Some(user_department) {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                _ => {
                    // For other conditions, check if they match
                    if let Some(entity_data) = &request.entity_data {
                        if let Some(entity_value) = entity_data.get(key) {
                            if entity_value != value {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
            }
        }
        true
    }

    fn create_audit_log(&self, request: &AccessRequest, allowed: bool, reason: &str) -> HashMap<String, serde_json::Value> {
        let mut audit_log = HashMap::new();
        audit_log.insert("user_id".to_string(), serde_json::Value::String(request.user_id.to_string()));
        audit_log.insert("role".to_string(), serde_json::Value::String(request.role.clone()));
        audit_log.insert("department".to_string(), serde_json::Value::String(request.department.clone().unwrap_or_default()));
        audit_log.insert("resource".to_string(), serde_json::Value::String(request.resource.clone()));
        audit_log.insert("action".to_string(), serde_json::Value::String(request.action.clone()));
        audit_log.insert("entity_id".to_string(), serde_json::Value::String(request.entity_id.map(|id| id.to_string()).unwrap_or_default()));
        audit_log.insert("allowed".to_string(), serde_json::Value::Bool(allowed));
        audit_log.insert("reason".to_string(), serde_json::Value::String(reason.to_string()));
        audit_log.insert("timestamp".to_string(), serde_json::Value::String(chrono::Utc::now().to_rfc3339()));
        
        if let Some(context) = &request.context {
            audit_log.insert("context".to_string(), serde_json::Value::Object(
                context.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
            ));
        }
        
        audit_log
    }

    pub fn get_data_isolation_rules(&self, role: &str, resource: &str) -> Option<serde_json::Value> {
        if let Some(role_permissions) = self.role_permissions.get(role) {
            if let Some(data_isolation_rules) = &role_permissions.data_isolation_rules {
                return data_isolation_rules.get(resource).cloned();
            }
        }
        None
    }

    pub fn can_access_resource(&self, user: &User, resource: &str, action: &str) -> bool {
        let request = AccessRequest {
            user_id: user.id,
            role: user.role.clone(),
            department: user.department.clone(),
            resource: resource.to_string(),
            action: action.to_string(),
            entity_id: None,
            entity_data: None,
            context: None,
        };

        let decision = self.validate_access(&request);
        decision.allowed
    }

    pub fn validate_claims_access(&self, claims: &Claims, resource: &str, action: &str, entity_id: Option<Uuid>) -> AccessDecision {
        let request = AccessRequest {
            user_id: claims.user_id,
            role: claims.role.clone(),
            department: claims.department.clone(),
            resource: resource.to_string(),
            action: action.to_string(),
            entity_id,
            entity_data: None,
            context: None,
        };

        self.validate_access(&request)
    }
}

impl Default for PermissionValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_admin_permissions() {
        let validator = PermissionValidator::new();
        let user = User {
            id: Uuid::new_v4(),
            username: "admin".to_string(),
            role: "admin".to_string(),
            department: Some("admin".to_string()),
            permissions: serde_json::Value::Object(serde_json::Map::new()),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        assert!(validator.can_access_resource(&user, "patients", "read"));
        assert!(validator.can_access_resource(&user, "patients", "write"));
        assert!(validator.can_access_resource(&user, "patients", "delete"));
        assert!(validator.can_access_resource(&user, "users", "read"));
        assert!(validator.can_access_resource(&user, "users", "write"));
    }

    #[test]
    fn test_clinician_permissions() {
        let validator = PermissionValidator::new();
        let user = User {
            id: Uuid::new_v4(),
            username: "clinician".to_string(),
            role: "clinician".to_string(),
            department: Some("clinical".to_string()),
            permissions: serde_json::Value::Object(serde_json::Map::new()),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        assert!(validator.can_access_resource(&user, "patients", "read"));
        assert!(validator.can_access_resource(&user, "patients", "write"));
        assert!(!validator.can_access_resource(&user, "patients", "delete"));
        assert!(!validator.can_access_resource(&user, "users", "read"));
    }

    #[test]
    fn test_department_restrictions() {
        let validator = PermissionValidator::new();
        let user = User {
            id: Uuid::new_v4(),
            username: "clinician".to_string(),
            role: "clinician".to_string(),
            department: Some("pharmacy".to_string()), // Wrong department
            permissions: serde_json::Value::Object(serde_json::Map::new()),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        assert!(!validator.can_access_resource(&user, "patients", "read"));
    }
}
