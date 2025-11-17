use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SMSConfig {
    pub api_key: String,
    pub username: String,
    pub sender_id: String,
    pub base_url: String,
    pub templates: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SMSMessage {
    pub to: String,
    pub message: String,
    pub from: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SMSResponse {
    pub sms: SMSDetails,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SMSDetails {
    pub message_id: String,
    pub cost: String,
    pub status: String,
    pub number: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SMSError {
    pub message: String,
    pub status: String,
}

pub struct SMSService {
    config: SMSConfig,
    client: Client,
}

impl SMSService {
    pub fn new(config: SMSConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    pub async fn send_sms(
        &self,
        to: &str,
        message: &str,
    ) -> Result<SMSResponse, Box<dyn std::error::Error>> {
        let url = format!("{}/messaging", self.config.base_url);
        
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "apiKey",
            reqwest::header::HeaderValue::from_str(&self.config.api_key)?,
        );
        headers.insert(
            "Content-Type",
            reqwest::header::HeaderValue::from_static("application/json"),
        );

        let payload = serde_json::json!({
            "username": self.config.username,
            "to": to,
            "message": message,
            "from": self.config.sender_id
        });

        let response = self
            .client
            .post(&url)
            .headers(headers)
            .json(&payload)
            .send()
            .await?;

        if response.status().is_success() {
            let sms_response: SMSResponse = response.json().await?;
            Ok(sms_response)
        } else {
            let error: SMSError = response.json().await?;
            Err(format!("SMS API Error: {}", error.message).into())
        }
    }

    pub async fn send_template_sms(
        &self,
        to: &str,
        template_name: &str,
        variables: HashMap<String, String>,
    ) -> Result<SMSResponse, Box<dyn std::error::Error>> {
        let template = self.config.templates.get(template_name)
            .ok_or_else(|| "Template not found")?;

        let mut message = template.clone();
        
        // Replace variables in template
        for (key, value) in variables {
            let placeholder = format!("{{{{{}}}}}", key);
            message = message.replace(&placeholder, &value);
        }

        self.send_sms(to, &message).await
    }

    pub async fn send_appointment_reminder(
        &self,
        to: &str,
        patient_name: &str,
        appointment_date: &str,
        appointment_time: &str,
        clinician_name: &str,
    ) -> Result<SMSResponse, Box<dyn std::error::Error>> {
        let mut variables = HashMap::new();
        variables.insert("patient_name".to_string(), patient_name.to_string());
        variables.insert("appointment_date".to_string(), appointment_date.to_string());
        variables.insert("appointment_time".to_string(), appointment_time.to_string());
        variables.insert("clinician_name".to_string(), clinician_name.to_string());

        self.send_template_sms(to, "appointment_reminder", variables).await
    }

    pub async fn send_prescription_ready(
        &self,
        to: &str,
        patient_name: &str,
        prescription_id: &str,
    ) -> Result<SMSResponse, Box<dyn std::error::Error>> {
        let mut variables = HashMap::new();
        variables.insert("patient_name".to_string(), patient_name.to_string());
        variables.insert("prescription_id".to_string(), prescription_id.to_string());

        self.send_template_sms(to, "prescription_ready", variables).await
    }

    pub async fn send_payment_confirmation(
        &self,
        to: &str,
        patient_name: &str,
        invoice_number: &str,
        amount: &str,
        payment_method: &str,
    ) -> Result<SMSResponse, Box<dyn std::error::Error>> {
        let mut variables = HashMap::new();
        variables.insert("patient_name".to_string(), patient_name.to_string());
        variables.insert("invoice_number".to_string(), invoice_number.to_string());
        variables.insert("amount".to_string(), amount.to_string());
        variables.insert("payment_method".to_string(), payment_method.to_string());

        self.send_template_sms(to, "payment_confirmation", variables).await
    }

    pub async fn send_queue_notification(
        &self,
        to: &str,
        patient_name: &str,
        queue_position: i32,
        estimated_wait_time: &str,
    ) -> Result<SMSResponse, Box<dyn std::error::Error>> {
        let mut variables = HashMap::new();
        variables.insert("patient_name".to_string(), patient_name.to_string());
        variables.insert("queue_position".to_string(), queue_position.to_string());
        variables.insert("estimated_wait_time".to_string(), estimated_wait_time.to_string());

        self.send_template_sms(to, "queue_notification", variables).await
    }

    pub async fn send_low_stock_alert(
        &self,
        to: &str,
        medicine_name: &str,
        current_stock: i32,
    ) -> Result<SMSResponse, Box<dyn std::error::Error>> {
        let mut variables = HashMap::new();
        variables.insert("medicine_name".to_string(), medicine_name.to_string());
        variables.insert("current_stock".to_string(), current_stock.to_string());

        self.send_template_sms(to, "low_stock_alert", variables).await
    }

    pub async fn send_expiry_alert(
        &self,
        to: &str,
        medicine_name: &str,
        batch_number: &str,
        days_until_expiry: i32,
    ) -> Result<SMSResponse, Box<dyn std::error::Error>> {
        let mut variables = HashMap::new();
        variables.insert("medicine_name".to_string(), medicine_name.to_string());
        variables.insert("batch_number".to_string(), batch_number.to_string());
        variables.insert("days_until_expiry".to_string(), days_until_expiry.to_string());

        self.send_template_sms(to, "expiry_alert", variables).await
    }

    pub async fn get_balance(&self) -> Result<f64, Box<dyn std::error::Error>> {
        let url = format!("{}/user", self.config.base_url);
        
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "apiKey",
            reqwest::header::HeaderValue::from_str(&self.config.api_key)?,
        );
        headers.insert(
            "Content-Type",
            reqwest::header::HeaderValue::from_static("application/json"),
        );

        let payload = serde_json::json!({
            "username": self.config.username
        });

        let response = self
            .client
            .post(&url)
            .headers(headers)
            .json(&payload)
            .send()
            .await?;

        if response.status().is_success() {
            let balance_response: serde_json::Value = response.json().await?;
            let balance = balance_response["UserData"]["balance"]
                .as_str()
                .unwrap_or("0")
                .parse::<f64>()?;
            Ok(balance)
        } else {
            let error: SMSError = response.json().await?;
            Err(format!("SMS API Error: {}", error.message).into())
        }
    }
}

impl Default for SMSConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            username: String::new(),
            sender_id: "SETHMED".to_string(),
            base_url: "https://api.africastalking.com/version1".to_string(),
            templates: Self::default_templates(),
        }
    }
}

impl SMSConfig {
    pub fn default_templates() -> HashMap<String, String> {
        let mut templates = HashMap::new();

        // Appointment reminder template
        templates.insert("appointment_reminder".to_string(), 
            "Hi {{patient_name}}, you have an appointment on {{appointment_date}} at {{appointment_time}} with {{clinician_name}}. Please arrive 15 mins early. Seth Medical Clinic".to_string()
        );

        // Prescription ready template
        templates.insert("prescription_ready".to_string(), 
            "Hi {{patient_name}}, your prescription {{prescription_id}} is ready for collection at our pharmacy. Bring valid ID. Seth Medical Clinic".to_string()
        );

        // Payment confirmation template
        templates.insert("payment_confirmation".to_string(), 
            "Hi {{patient_name}}, payment of KSh {{amount}} for invoice {{invoice_number}} via {{payment_method}} received. Thank you! Seth Medical Clinic".to_string()
        );

        // Queue notification template
        templates.insert("queue_notification".to_string(), 
            "Hi {{patient_name}}, you are #{{queue_position}} in queue. Est. wait time: {{estimated_wait_time}} mins. Seth Medical Clinic".to_string()
        );

        // Low stock alert template
        templates.insert("low_stock_alert".to_string(), 
            "ALERT: {{medicine_name}} stock is low ({{current_stock}} units). Please reorder soon. Seth Medical Clinic".to_string()
        );

        // Expiry alert template
        templates.insert("expiry_alert".to_string(), 
            "ALERT: {{medicine_name}} batch {{batch_number}} expires in {{days_until_expiry}} days. Use first or return to supplier. Seth Medical Clinic".to_string()
        );

        templates
    }
}
