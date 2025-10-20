use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::env;
use reqwest::Client;
use base64;
use sha2::{Sha256, Digest};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize)]
pub struct StkPushCallback {
    pub body: StkPushCallbackBody,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StkPushCallbackBody {
    pub stk_callback: StkPushCallbackData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StkPushCallbackData {
    pub merchant_request_id: String,
    pub checkout_request_id: String,
    pub result_code: i32,
    pub result_desc: String,
    pub callback_metadata: Option<StkPushCallbackMetadata>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StkPushCallbackMetadata {
    pub item: Vec<StkPushCallbackItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StkPushCallbackItem {
    pub name: String,
    pub value: serde_json::Value,
}

#[derive(Debug)]
pub struct MpesaService {
    pub consumer_key: String,
    pub consumer_secret: String,
    pub business_short_code: String,
    pub passkey: String,
    pub environment: String,
    pub base_url: String,
    pub callback_url: String,
    pub client: Client,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MpesaAccessToken {
    pub access_token: String,
    pub expires_in: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StkPushResponse {
    #[serde(rename = "MerchantRequestID")]
    pub merchant_request_id: String,
    #[serde(rename = "CheckoutRequestID")]
    pub checkout_request_id: String,
    #[serde(rename = "ResponseCode")]
    pub response_code: String,
    #[serde(rename = "ResponseDescription")]
    pub response_description: String,
    #[serde(rename = "CustomerMessage")]
    pub customer_message: String,
}

impl MpesaService {
    pub fn new() -> Self {
        let environment = env::var("MPESA_ENVIRONMENT").unwrap_or_else(|_| "sandbox".to_string());
        let base_url = match environment.as_str() {
            "production" => "https://api.safaricom.co.ke".to_string(),
            _ => "https://sandbox.safaricom.co.ke".to_string(),
        };

        MpesaService {
            consumer_key: env::var("MPESA_CONSUMER_KEY").unwrap_or_else(|_| "".to_string()),
            consumer_secret: env::var("MPESA_CONSUMER_SECRET").unwrap_or_else(|_| "".to_string()),
            business_short_code: env::var("MPESA_BUSINESS_SHORT_CODE").unwrap_or_else(|_| "174379".to_string()),
            passkey: env::var("MPESA_PASSKEY").unwrap_or_else(|_| "".to_string()),
            environment,
            base_url,
            callback_url: env::var("MPESA_CALLBACK_URL").unwrap_or_else(|_| "https://your-domain.com/api/v1/mpesa/callback".to_string()),
            client: Client::new(),
        }
    }

    pub async fn get_access_token(&self) -> Result<MpesaAccessToken, String> {
        let url = format!("{}/oauth/v1/generate?grant_type=client_credentials", self.base_url);
        
        let auth_string = format!("{}:{}", self.consumer_key, self.consumer_secret);
        let encoded_auth = base64::encode(auth_string);
        
        let response = self.client
            .get(&url)
            .header("Authorization", format!("Basic {}", encoded_auth))
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Failed to get access token: {}", response.status()));
        }

        let token: MpesaAccessToken = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse token response: {}", e))?;

        Ok(token)
    }

    pub fn generate_password(&self) -> Result<String, String> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {}", e))?
            .as_secs();

        let password_string = format!("{}{}{}", self.business_short_code, self.passkey, timestamp);
        let mut hasher = Sha256::new();
        hasher.update(password_string.as_bytes());
        let hash = hasher.finalize();
        let password = base64::encode(hash);

        Ok(format!("{}{}", password, timestamp))
    }

    pub async fn initiate_stk_push(&self, payload: StkPushRequestPayload) -> Result<StkPushResponse, String> {
        let access_token = self.get_access_token().await?;
        
        let url = format!("{}/mpesa/stkpush/v1/processrequest", self.base_url);
        
        let stk_push_request = serde_json::json!({
            "BusinessShortCode": payload.business_short_code,
            "Password": payload.password,
            "Timestamp": payload.timestamp,
            "TransactionType": payload.transaction_type,
            "Amount": payload.amount,
            "PartyA": payload.party_a,
            "PartyB": payload.party_b,
            "PhoneNumber": payload.phone_number,
            "CallBackURL": payload.call_back_url,
            "AccountReference": payload.account_reference,
            "TransactionDesc": payload.transaction_desc
        });

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", access_token.access_token))
            .header("Content-Type", "application/json")
            .json(&stk_push_request)
            .send()
            .await
            .map_err(|e| format!("Failed to send STK push request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("STK push failed: {} - {}", status, error_text));
        }

        let stk_response: StkPushResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse STK push response: {}", e))?;

        Ok(stk_response)
    }

    pub async fn query_stk_push_status(&self, checkout_request_id: &str) -> Result<serde_json::Value, String> {
        let access_token = self.get_access_token().await?;
        
        let url = format!("{}/mpesa/stkpushquery/v1/query", self.base_url);
        
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {}", e))?
            .as_secs();

        let password = self.generate_password()?;
        
        let query_request = serde_json::json!({
            "BusinessShortCode": self.business_short_code,
            "Password": password,
            "Timestamp": timestamp,
            "CheckoutRequestID": checkout_request_id
        });

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", access_token.access_token))
            .header("Content-Type", "application/json")
            .json(&query_request)
            .send()
            .await
            .map_err(|e| format!("Failed to send query request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Query failed: {} - {}", status, error_text));
        }

        let query_response: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse query response: {}", e))?;

        Ok(query_response)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StkPushRequestPayload {
    pub business_short_code: String,
    pub password: String,
    pub timestamp: String,
    pub transaction_type: String,
    pub amount: i32,
    pub party_a: String,
    pub party_b: String,
    pub phone_number: String,
    pub call_back_url: String,
    pub account_reference: String,
    pub transaction_desc: String,
    pub invoice_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct MpesaTransactionUpdate {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub merchant_request_id: String,
    pub checkout_request_id: String,
    pub phone_number: String,
    pub amount: i32,
    pub account_reference: String,
    pub transaction_desc: String,
    pub status: String, // This will be converted from the enum
    pub result_code: Option<i32>,
    pub result_desc: Option<String>,
    pub mpesa_receipt_number: Option<String>,
    pub transaction_date: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Real database functions for M-Pesa operations
pub async fn create_mpesa_transaction(
    pool: &sqlx::PgPool,
    invoice_id: Uuid,
    merchant_request_id: String,
    checkout_request_id: String,
    phone_number: String,
    amount: i32,
    account_reference: String,
    transaction_desc: String,
) -> Result<MpesaTransactionUpdate, String> {
    let result = sqlx::query_as::<_, MpesaTransactionUpdate>(
        r#"
        INSERT INTO mpesa_transactions (
            invoice_id, merchant_request_id, checkout_request_id, 
            phone_number, amount, account_reference, transaction_desc, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
        RETURNING id, invoice_id, merchant_request_id, checkout_request_id, 
                  phone_number, amount, account_reference, transaction_desc, 
                  status::text, result_code, result_desc, mpesa_receipt_number, 
                  transaction_date, created_at, updated_at
        "#
    )
    .bind(invoice_id)
    .bind(merchant_request_id)
    .bind(checkout_request_id)
    .bind(phone_number)
    .bind(amount)
    .bind(account_reference)
    .bind(transaction_desc)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to create M-Pesa transaction: {}", e))?;

    Ok(result)
}

pub async fn update_mpesa_transaction(
    pool: &sqlx::PgPool,
    checkout_request_id: String,
    status: String,
    result_code: Option<i32>,
    result_desc: Option<String>,
    mpesa_receipt_number: Option<String>,
    transaction_date: Option<String>,
) -> Result<MpesaTransactionUpdate, String> {
    let result = sqlx::query_as::<_, MpesaTransactionUpdate>(
        r#"
        UPDATE mpesa_transactions 
        SET status = $2::mpesa_transaction_status,
            result_code = $3,
            result_desc = $4,
            mpesa_receipt_number = $5,
            transaction_date = $6,
            updated_at = NOW()
        WHERE checkout_request_id = $1
        RETURNING id, invoice_id, merchant_request_id, checkout_request_id, 
                  phone_number, amount, account_reference, transaction_desc, 
                  status::text, result_code, result_desc, mpesa_receipt_number, 
                  transaction_date, created_at, updated_at
        "#
    )
    .bind(checkout_request_id)
    .bind(status)
    .bind(result_code)
    .bind(result_desc)
    .bind(mpesa_receipt_number)
    .bind(transaction_date)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to update M-Pesa transaction: {}", e))?;

    Ok(result)
}

pub async fn get_mpesa_transaction_by_checkout_id(
    pool: &sqlx::PgPool,
    checkout_request_id: String,
) -> Result<Option<MpesaTransactionUpdate>, String> {
    let result = sqlx::query_as::<_, MpesaTransactionUpdate>(
        r#"
        SELECT id, invoice_id, merchant_request_id, checkout_request_id, 
               phone_number, amount, account_reference, transaction_desc, 
               status::text, result_code, result_desc, mpesa_receipt_number, 
               transaction_date, created_at, updated_at
        FROM mpesa_transactions 
        WHERE checkout_request_id = $1
        "#
    )
    .bind(checkout_request_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to get M-Pesa transaction: {}", e))?;

    Ok(result)
}

pub async fn get_mpesa_transactions_by_invoice(
    pool: &sqlx::PgPool,
    invoice_id: Uuid,
) -> Result<Vec<MpesaTransactionUpdate>, String> {
    let results = sqlx::query_as::<_, MpesaTransactionUpdate>(
        r#"
        SELECT id, invoice_id, merchant_request_id, checkout_request_id, 
               phone_number, amount, account_reference, transaction_desc, 
               status::text, result_code, result_desc, mpesa_receipt_number, 
               transaction_date, created_at, updated_at
        FROM mpesa_transactions 
        WHERE invoice_id = $1
        ORDER BY created_at DESC
        "#
    )
    .bind(invoice_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get M-Pesa transactions: {}", e))?;

    Ok(results)
}