use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use sqlx::PgPool;
use tracing::{info, error, warn};

use crate::mpesa::{
    MpesaService, StkPushRequestPayload, MpesaTransactionUpdate, 
    create_mpesa_transaction, update_mpesa_transaction, 
    get_mpesa_transaction_by_checkout_id, get_mpesa_transactions_by_invoice
};

#[derive(Debug, Deserialize)]
pub struct InitiateStkPushRequest {
    pub phone_number: String,
    pub amount: u32,
    pub account_reference: String,
    pub transaction_desc: String,
    pub invoice_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct InitiateStkPushResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<StkPushResponseData>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StkPushResponseData {
    pub merchant_request_id: String,
    pub checkout_request_id: String,
    pub response_code: String,
    pub response_description: String,
    pub customer_message: String,
}

#[derive(Debug, Serialize)]
pub struct MpesaTransactionResponse {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub merchant_request_id: String,
    pub checkout_request_id: String,
    pub phone_number: String,
    pub amount: u32,
    pub account_reference: String,
    pub transaction_desc: String,
    pub status: String,
    pub result_code: Option<u32>,
    pub result_desc: Option<String>,
    pub mpesa_receipt_number: Option<String>,
    pub transaction_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct MpesaCallbackRequest {
    pub body: MpesaCallbackBody,
}

#[derive(Debug, Deserialize)]
pub struct MpesaCallbackBody {
    #[serde(rename = "stkCallback")]
    pub stk_callback: MpesaCallbackData,
}

#[derive(Debug, Deserialize)]
pub struct MpesaCallbackData {
    #[serde(rename = "MerchantRequestID")]
    pub merchant_request_id: String,
    #[serde(rename = "CheckoutRequestID")]
    pub checkout_request_id: String,
    #[serde(rename = "ResultCode")]
    pub result_code: u32,
    #[serde(rename = "ResultDesc")]
    pub result_desc: String,
    #[serde(rename = "CallbackMetadata")]
    pub callback_metadata: Option<MpesaCallbackMetadata>,
}

#[derive(Debug, Deserialize)]
pub struct MpesaCallbackMetadata {
    pub item: Vec<MpesaCallbackItem>,
}

#[derive(Debug, Deserialize)]
pub struct MpesaCallbackItem {
    pub name: String,
    pub value: serde_json::Value,
}

pub async fn initiate_stk_push(
    req: web::Json<InitiateStkPushRequest>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse> {
    info!("Initiating STK push for invoice: {}", req.invoice_id);

    // Validate phone number format (Kenyan format)
    let phone_number = validate_phone_number(&req.phone_number)?;
    
    // Validate amount (minimum 1 KES)
    if req.amount < 1 {
        return Ok(HttpResponse::BadRequest().json(InitiateStkPushResponse {
            success: false,
            message: "Amount must be at least 1 KES".to_string(),
            data: None,
            error: Some("Invalid amount".to_string()),
        }));
    }

    // Create M-Pesa service
    let mpesa_service = MpesaService::new();

    // Generate password and timestamp
    let password = mpesa_service.generate_password()
        .map_err(|e| {
            error!("Failed to generate M-Pesa password: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to generate payment credentials")
        })?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Create payload
    let payload = StkPushRequestPayload {
        business_short_code: mpesa_service.business_short_code.clone(),
        password: password.clone(),
        timestamp: timestamp.to_string(),
        transaction_type: "CustomerPayBillOnline".to_string(),
        amount: req.amount as i32,
        party_a: phone_number.clone(),
        party_b: mpesa_service.business_short_code.clone(),
        phone_number: phone_number.clone(),
        call_back_url: mpesa_service.callback_url.clone(),
        account_reference: req.account_reference.clone(),
        transaction_desc: req.transaction_desc.clone(),
        invoice_id: Some(req.invoice_id),
    };

    // Initiate STK push
    let stk_response = mpesa_service.initiate_stk_push(payload).await
        .map_err(|e| {
            error!("STK push initiation failed: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to initiate payment")
        })?;

    // Store transaction in database
    let mpesa_transaction = create_mpesa_transaction(
        &pool,
        req.invoice_id,
        stk_response.merchant_request_id.clone(),
        stk_response.checkout_request_id.clone(),
        phone_number,
        req.amount as i32,
        req.account_reference.clone(),
        req.transaction_desc.clone(),
    ).await.map_err(|e| {
        error!("Failed to store M-Pesa transaction: {}", e);
        actix_web::error::ErrorInternalServerError("Failed to store transaction")
    })?;

    info!("M-Pesa transaction stored with ID: {}", mpesa_transaction.id);

    let response_data = StkPushResponseData {
        merchant_request_id: stk_response.merchant_request_id,
        checkout_request_id: stk_response.checkout_request_id,
        response_code: stk_response.response_code,
        response_description: stk_response.response_description,
        customer_message: stk_response.customer_message,
    };

    Ok(HttpResponse::Ok().json(InitiateStkPushResponse {
        success: true,
        message: "STK push initiated successfully".to_string(),
        data: Some(response_data),
        error: None,
    }))
}

pub async fn mpesa_callback(
    req: web::Json<MpesaCallbackRequest>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse> {
    info!("Received M-Pesa callback for checkout: {}", req.body.stk_callback.checkout_request_id);

    // Log the callback for debugging (commented out due to serialization issues)
    // let callback_log = sqlx::query(
    //     r#"
    //     INSERT INTO mpesa_callback_logs (checkout_request_id, callback_data, processing_status)
    //     VALUES ($1, $2, $3)
    //     "#
    // )
    // .bind(&req.body.stk_callback.checkout_request_id)
    // .bind(serde_json::to_value(&req.body).unwrap_or(serde_json::Value::Null))
    // .bind("Received")
    // .execute(&**pool)
    // .await;

    // if let Err(e) = callback_log {
    //     warn!("Failed to log M-Pesa callback: {}", e);
    // }

    // Create M-Pesa service to parse callback
    let mpesa_service = MpesaService::new();

    // Parse callback data
    let callback_data = crate::mpesa::StkPushCallback {
        body: crate::mpesa::StkPushCallbackBody {
            stk_callback: crate::mpesa::StkPushCallbackData {
                merchant_request_id: req.body.stk_callback.merchant_request_id.clone(),
                checkout_request_id: req.body.stk_callback.checkout_request_id.clone(),
                result_code: req.body.stk_callback.result_code as i32,
                result_desc: req.body.stk_callback.result_desc.clone(),
                callback_metadata: req.body.stk_callback.callback_metadata.as_ref().map(|meta| {
                    crate::mpesa::StkPushCallbackMetadata {
                        item: meta.item.iter().map(|item| {
                            crate::mpesa::StkPushCallbackItem {
                                name: item.name.clone(),
                                value: item.value.clone(),
                            }
                        }).collect(),
                    }
                }),
            },
        },
    };

    // let transaction_update = mpesa_service.parse_callback(&callback_data)
    //     .map_err(|e| {
    //         error!("Failed to parse M-Pesa callback: {}", e);
    //         actix_web::error::ErrorInternalServerError("Failed to parse callback")
    //     })?;

    // Parse callback metadata to extract transaction details
    let mut mpesa_receipt_number = None;
    let mut transaction_date = None;
    
    if let Some(metadata) = &req.body.stk_callback.callback_metadata {
        for item in &metadata.item {
            match item.name.as_str() {
                "MpesaReceiptNumber" => {
                    if let Some(receipt) = item.value.as_str() {
                        mpesa_receipt_number = Some(receipt.to_string());
                    }
                }
                "TransactionDate" => {
                    if let Some(date) = item.value.as_str() {
                        transaction_date = Some(date.to_string());
                    }
                }
                _ => {}
            }
        }
    }

    // Determine transaction status based on result code
    let status = match req.body.stk_callback.result_code {
        0 => "Completed",
        _ => "Failed",
    };

    // Update transaction in database
    let updated_transaction = update_mpesa_transaction(
        &pool,
        req.body.stk_callback.checkout_request_id.clone(),
        status.to_string(),
        Some(req.body.stk_callback.result_code as i32),
        Some(req.body.stk_callback.result_desc.clone()),
        mpesa_receipt_number,
        transaction_date,
    ).await.map_err(|e| {
        error!("Failed to update M-Pesa transaction: {}", e);
        actix_web::error::ErrorInternalServerError("Failed to update transaction")
    })?;

    info!("M-Pesa transaction updated: {} - Status: {}", 
          updated_transaction.checkout_request_id, updated_transaction.status);

    // Update callback log status
    let _ = sqlx::query(
        r#"
        UPDATE mpesa_callback_logs 
        SET processing_status = 'Processed', processed_at = NOW()
        WHERE checkout_request_id = $1
        "#
    )
    .bind(&req.body.stk_callback.checkout_request_id)
    .execute(&**pool)
    .await;

    // Return success response to Safaricom
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "ResultCode": 0,
        "ResultDesc": "Success"
    })))
}

pub async fn get_mpesa_transaction_status(
    path: web::Path<String>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse> {
    let checkout_request_id = path.into_inner();
    
    info!("Getting M-Pesa transaction status for: {}", checkout_request_id);

    let transaction = get_mpesa_transaction_by_checkout_id(&pool, checkout_request_id.clone())
        .await
        .map_err(|e| {
            error!("Failed to get M-Pesa transaction: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to get transaction")
        })?;

    match transaction {
        Some(txn) => {
            let response = MpesaTransactionResponse {
                id: txn.id,
                invoice_id: txn.invoice_id,
                merchant_request_id: txn.merchant_request_id,
                checkout_request_id: txn.checkout_request_id,
                phone_number: txn.phone_number,
                amount: txn.amount as u32,
                account_reference: txn.account_reference,
                transaction_desc: txn.transaction_desc,
                status: txn.status.to_string(),
                result_code: txn.result_code.map(|v| v as u32),
                result_desc: txn.result_desc,
                mpesa_receipt_number: txn.mpesa_receipt_number,
                transaction_date: txn.transaction_date,
                created_at: txn.created_at.to_rfc3339(),
                updated_at: txn.updated_at.to_rfc3339(),
            };

            Ok(HttpResponse::Ok().json(response))
        }
        None => {
            Ok(HttpResponse::NotFound().json(serde_json::json!({
                "success": false,
                "message": "Transaction not found",
                "error": "Transaction not found"
            })))
        }
    }
}

pub async fn get_invoice_mpesa_transactions(
    path: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();
    
    info!("Getting M-Pesa transactions for invoice: {}", invoice_id);

    let transactions = get_mpesa_transactions_by_invoice(&pool, invoice_id)
        .await
        .map_err(|e| {
            error!("Failed to get M-Pesa transactions: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to get transactions")
        })?;

    let responses: Vec<MpesaTransactionResponse> = transactions.into_iter().map(|txn| {
        MpesaTransactionResponse {
            id: txn.id,
            invoice_id: txn.invoice_id,
            merchant_request_id: txn.merchant_request_id,
            checkout_request_id: txn.checkout_request_id,
            phone_number: txn.phone_number,
            amount: txn.amount as u32,
            account_reference: txn.account_reference,
            transaction_desc: txn.transaction_desc,
            status: txn.status.to_string(),
            result_code: txn.result_code.map(|v| v as u32),
            result_desc: txn.result_desc,
            mpesa_receipt_number: txn.mpesa_receipt_number,
            transaction_date: txn.transaction_date,
            created_at: txn.created_at.to_rfc3339(),
            updated_at: txn.updated_at.to_rfc3339(),
        }
    }).collect();

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": responses,
        "count": responses.len()
    })))
}

fn validate_phone_number(phone: &str) -> Result<String, actix_web::Error> {
    // Remove any spaces, dashes, or parentheses
    let cleaned = phone.replace(&[' ', '-', '(', ')'], "");
    
    // Check if it starts with +254
    if cleaned.starts_with("+254") && cleaned.len() == 13 {
        return Ok(cleaned);
    }
    
    // Check if it starts with 254
    if cleaned.starts_with("254") && cleaned.len() == 12 {
        return Ok(format!("+{}", cleaned));
    }
    
    // Check if it starts with 0
    if cleaned.starts_with("0") && cleaned.len() == 10 {
        return Ok(format!("+254{}", &cleaned[1..]));
    }
    
    // Check if it's 9 digits (assume it's missing country code)
    if cleaned.len() == 9 && cleaned.chars().all(|c| c.is_ascii_digit()) {
        return Ok(format!("+254{}", cleaned));
    }
    
    Err(actix_web::error::ErrorBadRequest("Invalid phone number format. Use format: +254XXXXXXXXX"))
}
