use std::collections::HashMap;
use serde_json::json;
use uuid::Uuid;

use crate::services::{EmailService, SMSService};
use crate::websocket::{WebSocketManager, broadcast_queue_update, broadcast_stock_alert, broadcast_expiry_alert, send_notification_to_user};

pub struct NotificationService {
    email_service: EmailService,
    sms_service: SMSService,
    websocket_server: actix::Addr<WebSocketManager>,
}

impl NotificationService {
    pub fn new(
        email_service: EmailService,
        sms_service: SMSService,
        websocket_server: actix::Addr<WebSocketManager>,
    ) -> Self {
        Self {
            email_service,
            sms_service,
            websocket_server,
        }
    }

    pub async fn send_appointment_reminder(
        &self,
        patient_email: Option<&str>,
        patient_phone: Option<&str>,
        patient_name: &str,
        appointment_date: &str,
        appointment_time: &str,
        clinician_name: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Send email if available
        if let Some(email) = patient_email {
            let _ = self.email_service
                .send_appointment_reminder(email, patient_name, appointment_date, appointment_time, clinician_name)
                .await;
        }

        // Send SMS if available
        if let Some(phone) = patient_phone {
            let _ = self.sms_service
                .send_appointment_reminder(phone, patient_name, appointment_date, appointment_time, clinician_name)
                .await;
        }

        Ok(())
    }

    pub async fn send_prescription_ready(
        &self,
        patient_email: Option<&str>,
        patient_phone: Option<&str>,
        patient_name: &str,
        prescription_id: &str,
        medications: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Send email if available
        if let Some(email) = patient_email {
            let _ = self.email_service
                .send_prescription_ready(email, patient_name, prescription_id, medications)
                .await;
        }

        // Send SMS if available
        if let Some(phone) = patient_phone {
            let _ = self.sms_service
                .send_prescription_ready(phone, patient_name, prescription_id)
                .await;
        }

        Ok(())
    }

    pub async fn send_payment_confirmation(
        &self,
        patient_email: Option<&str>,
        patient_phone: Option<&str>,
        patient_name: &str,
        invoice_number: &str,
        amount: &str,
        payment_method: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Send email if available
        if let Some(email) = patient_email {
            let _ = self.email_service
                .send_invoice(email, patient_name, invoice_number, amount, payment_method)
                .await;
        }

        // Send SMS if available
        if let Some(phone) = patient_phone {
            let _ = self.sms_service
                .send_payment_confirmation(phone, patient_name, invoice_number, amount, payment_method)
                .await;
        }

        Ok(())
    }

    pub async fn send_queue_notification(
        &self,
        patient_phone: Option<&str>,
        patient_name: &str,
        queue_position: i32,
        estimated_wait_time: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Send SMS if available
        if let Some(phone) = patient_phone {
            let _ = self.sms_service
                .send_queue_notification(phone, patient_name, queue_position, estimated_wait_time)
                .await;
        }

        Ok(())
    }

    pub async fn send_low_stock_alert(
        &self,
        admin_emails: Vec<&str>,
        admin_phones: Vec<&str>,
        medicine_name: &str,
        current_stock: i32,
        min_stock: i32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Send email alerts
        for email in admin_emails {
            let _ = self.email_service
                .send_low_stock_alert(email, medicine_name, current_stock, min_stock)
                .await;
        }

        // Send SMS alerts
        for phone in admin_phones {
            let _ = self.sms_service
                .send_low_stock_alert(phone, medicine_name, current_stock)
                .await;
        }

        // Broadcast via WebSocket
        let alert = crate::models::StockAlert {
            medicine_id: Uuid::new_v4(), // This should be the actual medicine ID
            medicine_name: medicine_name.to_string(),
            current_stock,
            min_stock,
            alert_type: "low_stock".to_string(),
        };

        let _ = broadcast_stock_alert(self.websocket_server.clone(), alert).await;

        Ok(())
    }

    pub async fn send_expiry_alert(
        &self,
        admin_emails: Vec<&str>,
        admin_phones: Vec<&str>,
        medicine_name: &str,
        batch_number: &str,
        expiry_date: &str,
        days_until_expiry: i32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Send email alerts
        for email in admin_emails {
            let _ = self.email_service
                .send_expiry_alert(email, medicine_name, batch_number, expiry_date, days_until_expiry)
                .await;
        }

        // Send SMS alerts
        for phone in admin_phones {
            let _ = self.sms_service
                .send_expiry_alert(phone, medicine_name, batch_number, days_until_expiry)
                .await;
        }

        // Broadcast via WebSocket
        let alert = crate::models::ExpiryAlert {
            medicine_id: Uuid::new_v4(), // This should be the actual medicine ID
            medicine_name: medicine_name.to_string(),
            batch_number: batch_number.to_string(),
            expiry_date: chrono::NaiveDate::parse_from_str(expiry_date, "%Y-%m-%d").unwrap_or_default(),
            days_until_expiry,
        };

        let _ = broadcast_expiry_alert(self.websocket_server.clone(), alert).await;

        Ok(())
    }

    pub async fn send_queue_update(
        &self,
        queue_items: Vec<crate::models::QueueItem>,
        current_patient: Option<Uuid>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let _ = broadcast_queue_update(
            self.websocket_server.clone(),
            queue_items,
            current_patient,
        ).await;

        Ok(())
    }

    pub async fn send_notification_to_user(
        &self,
        user_id: Uuid,
        title: &str,
        message: &str,
        notification_type: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let notification = json!({
            "title": title,
            "message": message,
            "type": notification_type,
            "timestamp": chrono::Utc::now(),
        });

        let _ = send_notification_to_user(
            self.websocket_server.clone(),
            user_id,
            notification,
        ).await;

        Ok(())
    }
}
