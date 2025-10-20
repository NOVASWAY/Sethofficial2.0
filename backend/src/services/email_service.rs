use lettre::{
    message::{header::ContentType, Mailbox, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailTemplate {
    pub subject: String,
    pub html_body: String,
    pub text_body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailConfig {
    pub api_key: String,
    pub from_email: String,
    pub from_name: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_username: String,
    pub smtp_password: String,
    pub templates: HashMap<String, EmailTemplate>,
}

pub struct EmailService {
    config: EmailConfig,
    mailer: AsyncSmtpTransport<Tokio1Executor>,
}

impl EmailService {
    pub fn new(config: EmailConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let creds = Credentials::new(config.smtp_username.clone(), config.smtp_password.clone());
        
        let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay(&config.smtp_host)?
            .port(config.smtp_port)
            .credentials(creds)
            .build();

        Ok(EmailService { config, mailer })
    }

    pub async fn send_email(
        &self,
        to: &str,
        subject: &str,
        html_body: &str,
        text_body: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let from = format!("{} <{}>", self.config.from_name, self.config.from_email)
            .parse::<Mailbox>()?;
        let to = to.parse::<Mailbox>()?;

        let email = Message::builder()
            .from(from)
            .to(to)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_PLAIN)
                            .body(text_body.unwrap_or(html_body).to_string()),
                    )
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_HTML)
                            .body(html_body.to_string()),
                    ),
            )?;

        self.mailer.send(email).await?;
        Ok(())
    }

    pub async fn send_template_email(
        &self,
        to: &str,
        template_name: &str,
        variables: HashMap<String, String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let template = self.config.templates.get(template_name)
            .ok_or_else(|| "Template not found")?;

        let mut subject = template.subject.clone();
        let mut html_body = template.html_body.clone();
        let mut text_body = template.text_body.clone();

        // Replace variables in templates
        for (key, value) in variables {
            let placeholder = format!("{{{{{}}}}}", key);
            subject = subject.replace(&placeholder, &value);
            html_body = html_body.replace(&placeholder, &value);
            text_body = text_body.replace(&placeholder, &value);
        }

        self.send_email(to, &subject, &html_body, Some(&text_body)).await
    }

    pub async fn send_appointment_reminder(
        &self,
        to: &str,
        patient_name: &str,
        appointment_date: &str,
        appointment_time: &str,
        clinician_name: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut variables = HashMap::new();
        variables.insert("patient_name".to_string(), patient_name.to_string());
        variables.insert("appointment_date".to_string(), appointment_date.to_string());
        variables.insert("appointment_time".to_string(), appointment_time.to_string());
        variables.insert("clinician_name".to_string(), clinician_name.to_string());

        self.send_template_email(to, "appointment_reminder", variables).await
    }

    pub async fn send_prescription_ready(
        &self,
        to: &str,
        patient_name: &str,
        prescription_id: &str,
        medications: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut variables = HashMap::new();
        variables.insert("patient_name".to_string(), patient_name.to_string());
        variables.insert("prescription_id".to_string(), prescription_id.to_string());
        variables.insert("medications".to_string(), medications.to_string());

        self.send_template_email(to, "prescription_ready", variables).await
    }

    pub async fn send_invoice(
        &self,
        to: &str,
        patient_name: &str,
        invoice_number: &str,
        amount: &str,
        payment_method: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut variables = HashMap::new();
        variables.insert("patient_name".to_string(), patient_name.to_string());
        variables.insert("invoice_number".to_string(), invoice_number.to_string());
        variables.insert("amount".to_string(), amount.to_string());
        variables.insert("payment_method".to_string(), payment_method.to_string());

        self.send_template_email(to, "invoice", variables).await
    }

    pub async fn send_low_stock_alert(
        &self,
        to: &str,
        medicine_name: &str,
        current_stock: i32,
        min_stock: i32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut variables = HashMap::new();
        variables.insert("medicine_name".to_string(), medicine_name.to_string());
        variables.insert("current_stock".to_string(), current_stock.to_string());
        variables.insert("min_stock".to_string(), min_stock.to_string());

        self.send_template_email(to, "low_stock_alert", variables).await
    }

    pub async fn send_expiry_alert(
        &self,
        to: &str,
        medicine_name: &str,
        batch_number: &str,
        expiry_date: &str,
        days_until_expiry: i32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut variables = HashMap::new();
        variables.insert("medicine_name".to_string(), medicine_name.to_string());
        variables.insert("batch_number".to_string(), batch_number.to_string());
        variables.insert("expiry_date".to_string(), expiry_date.to_string());
        variables.insert("days_until_expiry".to_string(), days_until_expiry.to_string());

        self.send_template_email(to, "expiry_alert", variables).await
    }
}

impl Default for EmailConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            from_email: "noreply@sethmedicalclinic.com".to_string(),
            from_name: "Seth Medical Clinic".to_string(),
            smtp_host: "smtp.gmail.com".to_string(),
            smtp_port: 587,
            smtp_username: String::new(),
            smtp_password: String::new(),
            templates: Self::default_templates(),
        }
    }
}

impl EmailConfig {
    fn default_templates() -> HashMap<String, EmailTemplate> {
        let mut templates = HashMap::new();

        // Appointment reminder template
        templates.insert("appointment_reminder".to_string(), EmailTemplate {
            subject: "Appointment Reminder - Seth Medical Clinic".to_string(),
            html_body: r#"
                <html>
                <body>
                    <h2>Appointment Reminder</h2>
                    <p>Dear {{patient_name}},</p>
                    <p>This is a reminder that you have an appointment scheduled for:</p>
                    <ul>
                        <li><strong>Date:</strong> {{appointment_date}}</li>
                        <li><strong>Time:</strong> {{appointment_time}}</li>
                        <li><strong>Clinician:</strong> {{clinician_name}}</li>
                    </ul>
                    <p>Please arrive 15 minutes before your scheduled time.</p>
                    <p>If you need to reschedule, please contact us at +254700000000.</p>
                    <br>
                    <p>Best regards,<br>Seth Medical Clinic</p>
                </body>
                </html>
            "#.to_string(),
            text_body: r#"
                Appointment Reminder - Seth Medical Clinic
                
                Dear {{patient_name}},
                
                This is a reminder that you have an appointment scheduled for:
                - Date: {{appointment_date}}
                - Time: {{appointment_time}}
                - Clinician: {{clinician_name}}
                
                Please arrive 15 minutes before your scheduled time.
                If you need to reschedule, please contact us at +254700000000.
                
                Best regards,
                Seth Medical Clinic
            "#.to_string(),
        });

        // Prescription ready template
        templates.insert("prescription_ready".to_string(), EmailTemplate {
            subject: "Prescription Ready for Collection - Seth Medical Clinic".to_string(),
            html_body: r#"
                <html>
                <body>
                    <h2>Prescription Ready for Collection</h2>
                    <p>Dear {{patient_name}},</p>
                    <p>Your prescription (ID: {{prescription_id}}) is ready for collection at our pharmacy.</p>
                    <p><strong>Medications:</strong></p>
                    <p>{{medications}}</p>
                    <p>Please bring a valid ID when collecting your prescription.</p>
                    <p>Pharmacy hours: Monday-Friday 8:00 AM - 6:00 PM</p>
                    <br>
                    <p>Best regards,<br>Seth Medical Clinic Pharmacy</p>
                </body>
                </html>
            "#.to_string(),
            text_body: r#"
                Prescription Ready for Collection - Seth Medical Clinic
                
                Dear {{patient_name}},
                
                Your prescription (ID: {{prescription_id}}) is ready for collection at our pharmacy.
                
                Medications:
                {{medications}}
                
                Please bring a valid ID when collecting your prescription.
                Pharmacy hours: Monday-Friday 8:00 AM - 6:00 PM
                
                Best regards,
                Seth Medical Clinic Pharmacy
            "#.to_string(),
        });

        // Invoice template
        templates.insert("invoice".to_string(), EmailTemplate {
            subject: "Invoice - Seth Medical Clinic".to_string(),
            html_body: r#"
                <html>
                <body>
                    <h2>Invoice</h2>
                    <p>Dear {{patient_name}},</p>
                    <p>Please find attached your invoice for services rendered.</p>
                    <ul>
                        <li><strong>Invoice Number:</strong> {{invoice_number}}</li>
                        <li><strong>Amount:</strong> KSh {{amount}}</li>
                        <li><strong>Payment Method:</strong> {{payment_method}}</li>
                    </ul>
                    <p>Thank you for choosing Seth Medical Clinic.</p>
                    <br>
                    <p>Best regards,<br>Seth Medical Clinic</p>
                </body>
                </html>
            "#.to_string(),
            text_body: r#"
                Invoice - Seth Medical Clinic
                
                Dear {{patient_name}},
                
                Please find attached your invoice for services rendered.
                
                Invoice Number: {{invoice_number}}
                Amount: KSh {{amount}}
                Payment Method: {{payment_method}}
                
                Thank you for choosing Seth Medical Clinic.
                
                Best regards,
                Seth Medical Clinic
            "#.to_string(),
        });

        // Low stock alert template
        templates.insert("low_stock_alert".to_string(), EmailTemplate {
            subject: "Low Stock Alert - {{medicine_name}}".to_string(),
            html_body: r#"
                <html>
                <body>
                    <h2>Low Stock Alert</h2>
                    <p>The following medicine is running low on stock:</p>
                    <ul>
                        <li><strong>Medicine:</strong> {{medicine_name}}</li>
                        <li><strong>Current Stock:</strong> {{current_stock}}</li>
                        <li><strong>Minimum Stock:</strong> {{min_stock}}</li>
                    </ul>
                    <p>Please consider reordering soon.</p>
                    <br>
                    <p>Best regards,<br>Inventory Management System</p>
                </body>
                </html>
            "#.to_string(),
            text_body: r#"
                Low Stock Alert
                
                The following medicine is running low on stock:
                
                Medicine: {{medicine_name}}
                Current Stock: {{current_stock}}
                Minimum Stock: {{min_stock}}
                
                Please consider reordering soon.
                
                Best regards,
                Inventory Management System
            "#.to_string(),
        });

        // Expiry alert template
        templates.insert("expiry_alert".to_string(), EmailTemplate {
            subject: "Medicine Expiry Alert - {{medicine_name}}".to_string(),
            html_body: r#"
                <html>
                <body>
                    <h2>Medicine Expiry Alert</h2>
                    <p>The following medicine will expire soon:</p>
                    <ul>
                        <li><strong>Medicine:</strong> {{medicine_name}}</li>
                        <li><strong>Batch Number:</strong> {{batch_number}}</li>
                        <li><strong>Expiry Date:</strong> {{expiry_date}}</li>
                        <li><strong>Days Until Expiry:</strong> {{days_until_expiry}}</li>
                    </ul>
                    <p>Please use this batch first or consider returning it to the supplier.</p>
                    <br>
                    <p>Best regards,<br>Inventory Management System</p>
                </body>
                </html>
            "#.to_string(),
            text_body: r#"
                Medicine Expiry Alert
                
                The following medicine will expire soon:
                
                Medicine: {{medicine_name}}
                Batch Number: {{batch_number}}
                Expiry Date: {{expiry_date}}
                Days Until Expiry: {{days_until_expiry}}
                
                Please use this batch first or consider returning it to the supplier.
                
                Best regards,
                Inventory Management System
            "#.to_string(),
        });

        templates
    }
}
