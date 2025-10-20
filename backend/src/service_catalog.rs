use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub cash_price: f64,
    pub sha_price: f64,
    pub nhif_price: Option<f64>,
    pub is_active: bool,
    pub requires_prescription: bool,
    pub icd_codes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceCategory {
    pub id: String,
    pub name: String,
    pub description: String,
    pub services: Vec<Service>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingRule {
    pub service_id: String,
    pub patient_type: PatientType,
    pub insurance_type: InsuranceType,
    pub price: f64,
    pub discount_percentage: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PatientType {
    Adult,
    Child,
    Senior,
    Emergency,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InsuranceType {
    Cash,
    SHA,
    NHIF,
    Private,
    Mixed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillingItem {
    pub service_id: String,
    pub service_name: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub total_price: f64,
    pub insurance_coverage: f64,
    pub patient_payment: f64,
    pub discount_applied: Option<f64>,
}

#[derive(Clone)]
pub struct ServiceCatalog {
    services: HashMap<String, Service>,
    categories: HashMap<String, ServiceCategory>,
    pricing_rules: Vec<PricingRule>,
}

impl ServiceCatalog {
    pub fn new() -> Self {
        let mut catalog = Self {
            services: HashMap::new(),
            categories: HashMap::new(),
            pricing_rules: Vec::new(),
        };
        
        catalog.initialize_default_services();
        catalog
    }

    fn initialize_default_services(&mut self) {
        // Consultation Services
        let consultation_services = vec![
            Service {
                id: "CONS_GEN_001".to_string(),
                name: "General Consultation".to_string(),
                description: "Standard general medical consultation".to_string(),
                category: "consultation".to_string(),
                cash_price: 500.0,
                sha_price: 300.0,
                nhif_price: Some(200.0),
                is_active: true,
                requires_prescription: false,
                icd_codes: vec!["Z00.00".to_string()],
            },
            Service {
                id: "CONS_SPEC_001".to_string(),
                name: "Specialist Consultation".to_string(),
                description: "Specialist medical consultation".to_string(),
                category: "consultation".to_string(),
                cash_price: 1000.0,
                sha_price: 600.0,
                nhif_price: Some(400.0),
                is_active: true,
                requires_prescription: false,
                icd_codes: vec!["Z00.01".to_string()],
            },
            Service {
                id: "CONS_EMERG_001".to_string(),
                name: "Emergency Consultation".to_string(),
                description: "Emergency medical consultation".to_string(),
                category: "consultation".to_string(),
                cash_price: 800.0,
                sha_price: 500.0,
                nhif_price: Some(300.0),
                is_active: true,
                requires_prescription: false,
                icd_codes: vec!["Z00.02".to_string()],
            },
        ];

        // Laboratory Services
        let lab_services = vec![
            Service {
                id: "LAB_CBC_001".to_string(),
                name: "Complete Blood Count (CBC)".to_string(),
                description: "Full blood count test".to_string(),
                category: "laboratory".to_string(),
                cash_price: 300.0,
                sha_price: 200.0,
                nhif_price: Some(150.0),
                is_active: true,
                requires_prescription: true,
                icd_codes: vec!["Z00.00".to_string()],
            },
            Service {
                id: "LAB_URINE_001".to_string(),
                name: "Urinalysis".to_string(),
                description: "Complete urine analysis".to_string(),
                category: "laboratory".to_string(),
                cash_price: 200.0,
                sha_price: 150.0,
                nhif_price: Some(100.0),
                is_active: true,
                requires_prescription: true,
                icd_codes: vec!["Z00.00".to_string()],
            },
            Service {
                id: "LAB_GLUCOSE_001".to_string(),
                name: "Blood Glucose Test".to_string(),
                description: "Random blood glucose test".to_string(),
                category: "laboratory".to_string(),
                cash_price: 150.0,
                sha_price: 100.0,
                nhif_price: Some(80.0),
                is_active: true,
                requires_prescription: true,
                icd_codes: vec!["Z00.00".to_string()],
            },
        ];

        // Pharmacy Services
        let pharmacy_services = vec![
            Service {
                id: "PHARM_DISP_001".to_string(),
                name: "Prescription Dispensing".to_string(),
                description: "Dispensing prescribed medications".to_string(),
                category: "pharmacy".to_string(),
                cash_price: 50.0,
                sha_price: 30.0,
                nhif_price: Some(20.0),
                is_active: true,
                requires_prescription: true,
                icd_codes: vec!["Z00.00".to_string()],
            },
            Service {
                id: "PHARM_COUNS_001".to_string(),
                name: "Pharmacy Counseling".to_string(),
                description: "Medication counseling and education".to_string(),
                category: "pharmacy".to_string(),
                cash_price: 100.0,
                sha_price: 60.0,
                nhif_price: Some(40.0),
                is_active: true,
                requires_prescription: false,
                icd_codes: vec!["Z00.00".to_string()],
            },
        ];

        // Add all services to catalog
        for service in consultation_services.iter().chain(lab_services.iter()).chain(pharmacy_services.iter()) {
            self.services.insert(service.id.clone(), service.clone());
        }

        // Create categories
        self.categories.insert("consultation".to_string(), ServiceCategory {
            id: "consultation".to_string(),
            name: "Consultation Services".to_string(),
            description: "Medical consultation and examination services".to_string(),
            services: consultation_services,
        });

        self.categories.insert("laboratory".to_string(), ServiceCategory {
            id: "laboratory".to_string(),
            name: "Laboratory Services".to_string(),
            description: "Diagnostic laboratory tests and procedures".to_string(),
            services: lab_services,
        });

        self.categories.insert("pharmacy".to_string(), ServiceCategory {
            id: "pharmacy".to_string(),
            name: "Pharmacy Services".to_string(),
            description: "Medication dispensing and counseling services".to_string(),
            services: pharmacy_services,
        });
    }

    pub fn get_service(&self, service_id: &str) -> Option<&Service> {
        self.services.get(service_id)
    }

    pub fn get_services_by_category(&self, category: &str) -> Vec<&Service> {
        self.categories
            .get(category)
            .map(|cat| cat.services.iter().collect())
            .unwrap_or_default()
    }

    pub fn get_all_services(&self) -> Vec<&Service> {
        self.services.values().collect()
    }

    pub fn update_service_prices(&mut self, service_id: &str, cash_price: f64, nhif_price: f64, sha_price: f64) -> bool {
        if let Some(service) = self.services.get_mut(service_id) {
            service.cash_price = cash_price;
            service.nhif_price = Some(nhif_price);
            service.sha_price = sha_price;
            true
        } else {
            false
        }
    }

    pub fn add_service(&mut self, service_id: &str, name: &str, category: &str, description: &str, 
                      cash_price: f64, nhif_price: f64, sha_price: f64, requires_prescription: bool) -> bool {
        if self.services.contains_key(service_id) {
            return false; // Service already exists
        }

        let service = Service {
            id: service_id.to_string(),
            name: name.to_string(),
            category: category.to_string(),
            description: description.to_string(),
            cash_price,
            nhif_price: Some(nhif_price),
            sha_price,
            is_active: true,
            requires_prescription,
            icd_codes: Vec::new(),
        };

        self.services.insert(service_id.to_string(), service);
        true
    }

    pub fn calculate_price(&self, service_id: &str, insurance_type: &InsuranceType, patient_type: &PatientType) -> Option<f64> {
        let service = self.get_service(service_id)?;
        
        let base_price = match insurance_type {
            InsuranceType::Cash => service.cash_price,
            InsuranceType::SHA => service.sha_price,
            InsuranceType::NHIF => service.nhif_price.unwrap_or(service.cash_price),
            InsuranceType::Private => service.cash_price,
            InsuranceType::Mixed => service.sha_price, // Default to SHA for mixed
        };

        // Apply patient type discounts
        let final_price = match patient_type {
            PatientType::Child => base_price * 0.8, // 20% discount for children
            PatientType::Senior => base_price * 0.9, // 10% discount for seniors
            PatientType::Emergency => base_price * 1.2, // 20% premium for emergency
            PatientType::Adult => base_price,
        };

        Some(final_price)
    }

    pub fn create_billing_item(&self, service_id: &str, quantity: i32, insurance_type: &InsuranceType, patient_type: &PatientType) -> Option<BillingItem> {
        let service = self.get_service(service_id)?;
        let unit_price = self.calculate_price(service_id, insurance_type, patient_type)?;
        let total_price = unit_price * quantity as f64;

        // Calculate insurance coverage and patient payment
        let (insurance_coverage, patient_payment) = match insurance_type {
            InsuranceType::Cash => (0.0, total_price),
            InsuranceType::SHA => (total_price, 0.0),
            InsuranceType::NHIF => (total_price * 0.8, total_price * 0.2), // 80% coverage
            InsuranceType::Private => (total_price * 0.9, total_price * 0.1), // 90% coverage
            InsuranceType::Mixed => (total_price * 0.7, total_price * 0.3), // 70% coverage
        };

        Some(BillingItem {
            service_id: service.id.clone(),
            service_name: service.name.clone(),
            quantity,
            unit_price,
            total_price,
            insurance_coverage,
            patient_payment,
            discount_applied: None,
        })
    }

    pub fn get_services_for_consultation(&self, diagnosis_codes: &[String]) -> Vec<&Service> {
        // Return services that match the diagnosis codes
        self.services
            .values()
            .filter(|service| {
                service.is_active && 
                diagnosis_codes.iter().any(|code| service.icd_codes.contains(code))
            })
            .collect()
    }

    pub fn validate_service_combination(&self, service_ids: &[String]) -> Result<(), String> {
        let services: Vec<&Service> = service_ids
            .iter()
            .filter_map(|id| self.get_service(id))
            .collect();

        if services.len() != service_ids.len() {
            return Err("Some services not found".to_string());
        }

        // Check for conflicting services
        let has_consultation = services.iter().any(|s| s.category == "consultation");
        let has_lab = services.iter().any(|s| s.category == "laboratory");
        let has_pharmacy = services.iter().any(|s| s.category == "pharmacy");

        // Lab and pharmacy services require consultation
        if (has_lab || has_pharmacy) && !has_consultation {
            return Err("Laboratory and pharmacy services require a consultation".to_string());
        }

        Ok(())
    }
}

impl Default for ServiceCatalog {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_catalog_creation() {
        let catalog = ServiceCatalog::new();
        assert!(!catalog.services.is_empty());
        assert!(!catalog.categories.is_empty());
    }

    #[test]
    fn test_price_calculation() {
        let catalog = ServiceCatalog::new();
        let price = catalog.calculate_price("CONS_GEN_001", &InsuranceType::Cash, &PatientType::Adult);
        assert_eq!(price, Some(500.0));
    }

    #[test]
    fn test_billing_item_creation() {
        let catalog = ServiceCatalog::new();
        let item = catalog.create_billing_item("CONS_GEN_001", 1, &InsuranceType::SHA, &PatientType::Adult);
        assert!(item.is_some());
        let item = item.unwrap();
        assert_eq!(item.service_name, "General Consultation");
        assert_eq!(item.insurance_coverage, 300.0);
        assert_eq!(item.patient_payment, 0.0);
    }
}
