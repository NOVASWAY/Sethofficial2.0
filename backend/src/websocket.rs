use actix::prelude::*;
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use std::collections::HashMap;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use std::sync::Arc;
use tokio::sync::RwLock;
use serde_json;

// WebSocket message types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub message_type: String,
    pub data: serde_json::Value,
    pub timestamp: u64,
}

impl WebSocketMessage {
    pub fn new(message_type: String, data: serde_json::Value) -> Self {
        Self {
            message_type,
            data,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }
}

// Messages for WebSocketManager
#[derive(Message)]
#[rtype(result = "()")]
pub struct Connect {
    pub session_id: Uuid,
    pub addr: Addr<WebSocketSession>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub session_id: Uuid,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct ClientMessage {
    pub session_id: Uuid,
    pub message: WebSocketMessage,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct BroadcastMessage {
    pub message: WebSocketMessage,
    pub exclude_session: Option<Uuid>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct DirectMessage {
    pub session_id: Uuid,
    pub message: WebSocketMessage,
}

// Message for sending text to a session
#[derive(Message)]
#[rtype(result = "()")]
pub struct SendText {
    pub text: String,
}

// WebSocket Manager Actor
pub struct WebSocketManager {
    sessions: HashMap<Uuid, Addr<WebSocketSession>>,
}

impl WebSocketManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }
}

impl Actor for WebSocketManager {
    type Context = Context<Self>;
}

impl Handler<Connect> for WebSocketManager {
    type Result = ();

    fn handle(&mut self, msg: Connect, _: &mut Self::Context) {
        self.sessions.insert(msg.session_id, msg.addr);
        println!("WebSocket session connected: {}", msg.session_id);
    }
}

impl Handler<Disconnect> for WebSocketManager {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Self::Context) {
        if let Some(_session_id) = self.sessions.remove(&msg.session_id) {
            println!("WebSocket session disconnected: {}", msg.session_id);
        }
    }
}

impl Handler<ClientMessage> for WebSocketManager {
    type Result = ();

    fn handle(&mut self, msg: ClientMessage, _: &mut Self::Context) {
        // Handle client messages here
        println!("Received message from session {}: {:?}", msg.session_id, msg.message);
    }
}

impl Handler<BroadcastMessage> for WebSocketManager {
    type Result = ();

    fn handle(&mut self, msg: BroadcastMessage, _: &mut Self::Context) {
        let message_json = match serde_json::to_string(&msg.message) {
            Ok(json) => json,
            Err(e) => {
                eprintln!("Failed to serialize broadcast message: {}", e);
                return;
            }
        };

        for (session_id, session_addr) in &self.sessions {
            if let Some(exclude_id) = msg.exclude_session {
                if *session_id == exclude_id {
                    continue;
                }
            }
            
            session_addr.do_send(SendText {
                text: message_json.clone(),
            });
        }
    }
}

impl Handler<DirectMessage> for WebSocketManager {
    type Result = ();

    fn handle(&mut self, msg: DirectMessage, _: &mut Self::Context) {
        if let Some(session_addr) = self.sessions.get(&msg.session_id) {
            let message_json = match serde_json::to_string(&msg.message) {
                Ok(json) => json,
                Err(e) => {
                    eprintln!("Failed to serialize direct message: {}", e);
                    return;
                }
            };
            
            session_addr.do_send(SendText {
                text: message_json,
            });
        }
    }
}

// WebSocket Session Actor
pub struct WebSocketSession {
    pub session_id: Uuid,
    pub manager: Addr<WebSocketManager>,
}

impl WebSocketSession {
    pub fn new(manager: Addr<WebSocketManager>) -> Self {
        Self {
            session_id: Uuid::new_v4(),
            manager,
        }
    }
}

impl Actor for WebSocketSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // Send connect message to manager
        self.manager.do_send(Connect {
            session_id: self.session_id,
            addr: ctx.address(),
        });
    }

    fn stopping(&mut self, _: &mut Self::Context) -> Running {
        // Send disconnect message to manager
        self.manager.do_send(Disconnect {
            session_id: self.session_id,
        });
        Running::Stop
    }
}

impl Handler<SendText> for WebSocketSession {
    type Result = ();

    fn handle(&mut self, msg: SendText, ctx: &mut Self::Context) {
        ctx.text(msg.text);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WebSocketSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                // Parse incoming message
                if let Ok(ws_msg) = serde_json::from_str::<WebSocketMessage>(&text) {
                    // Send to manager for processing
                    self.manager.do_send(ClientMessage {
                        session_id: self.session_id,
                        message: ws_msg,
                    });
                }
            }
            Ok(ws::Message::Binary(_)) => {
                // Handle binary messages if needed
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
            }
            _ => ctx.stop(),
        }
    }
}

// WebSocket handler function with JWT authentication
pub async fn websocket_handler(
    req: HttpRequest,
    stream: web::Payload,
    manager: web::Data<Addr<WebSocketManager>>,
    auth_service: web::Data<crate::auth::AuthService>,
) -> Result<HttpResponse, Error> {
    // Extract token from query string or headers
    let token = req
        .uri()
        .query()
        .and_then(|q| {
            q.split('&')
                .find_map(|param| {
                    if param.starts_with("token=") {
                        Some(param[6..].to_string())
                    } else {
                        None
                    }
                })
        })
        .or_else(|| {
            req.headers()
                .get("Authorization")
                .and_then(|h| h.to_str().ok())
                .and_then(|s| {
                    if s.starts_with("Bearer ") {
                        Some(s[7..].to_string())
                    } else {
                        None
                    }
                })
        });

    // Verify JWT token
    if let Some(token) = token {
        if auth_service.verify_access_token(&token).is_ok() {
            let resp = ws::start(WebSocketSession::new(manager.get_ref().clone()), &req, stream)?;
            return Ok(resp);
        }
    }

    // Return 401 if authentication fails
    Ok(HttpResponse::Unauthorized().json(serde_json::json!({
        "error": "Unauthorized - Valid JWT token required"
    })))
}

// Helper functions for sending messages
pub async fn broadcast_message(
    manager: web::Data<Addr<WebSocketManager>>,
    message_type: String,
    data: serde_json::Value,
    exclude_session: Option<Uuid>,
) {
    let message = WebSocketMessage::new(message_type, data);
    manager.do_send(BroadcastMessage {
        message,
        exclude_session,
    });
}

pub async fn send_direct_message(
    manager: web::Data<Addr<WebSocketManager>>,
    session_id: Uuid,
    message_type: String,
    data: serde_json::Value,
) {
    let message = WebSocketMessage::new(message_type, data);
    manager.do_send(DirectMessage {
        session_id,
        message,
    });
}

// Helper function to get connected sessions count
pub async fn get_connected_sessions_count(manager: web::Data<Addr<WebSocketManager>>) -> usize {
    // This would need to be implemented with a message to the manager
    // For now, return 0 as a placeholder
    0
}

// WebSocket integration functions for real-time updates

/// Broadcast queue updates to all connected clients
pub async fn broadcast_queue_update(
    manager: Addr<WebSocketManager>,
    queue_items: Vec<crate::models::QueueItem>,
    current_patient: Option<Uuid>,
) -> Result<(), Box<dyn std::error::Error>> {
    let data = serde_json::json!({
        "queue_items": queue_items,
        "current_patient": current_patient,
        "timestamp": chrono::Utc::now()
    });
    
    let message = WebSocketMessage::new("queue_update".to_string(), data);
    manager.do_send(BroadcastMessage {
        message,
        exclude_session: None,
    });
    
    Ok(())
}

/// Broadcast stock alerts to all connected clients
pub async fn broadcast_stock_alert(
    manager: Addr<WebSocketManager>,
    alert: crate::models::StockAlert,
) -> Result<(), Box<dyn std::error::Error>> {
    let data = serde_json::json!({
        "alert": alert,
        "timestamp": chrono::Utc::now()
    });
    
    let message = WebSocketMessage::new("stock_alert".to_string(), data);
    manager.do_send(BroadcastMessage {
        message,
        exclude_session: None,
    });
    
    Ok(())
}

/// Broadcast expiry alerts to all connected clients
pub async fn broadcast_expiry_alert(
    manager: Addr<WebSocketManager>,
    alert: crate::models::ExpiryAlert,
) -> Result<(), Box<dyn std::error::Error>> {
    let data = serde_json::json!({
        "alert": alert,
        "timestamp": chrono::Utc::now()
    });
    
    let message = WebSocketMessage::new("expiry_alert".to_string(), data);
    manager.do_send(BroadcastMessage {
        message,
        exclude_session: None,
    });
    
    Ok(())
}

/// Send notification to a specific user
pub async fn send_notification_to_user(
    manager: Addr<WebSocketManager>,
    user_id: Uuid,
    notification: serde_json::Value,
) -> Result<(), Box<dyn std::error::Error>> {
    let message = WebSocketMessage::new("user_notification".to_string(), notification);
    manager.do_send(DirectMessage {
        session_id: user_id,
        message,
    });
    
    Ok(())
}

/// Broadcast appointment updates to all connected clients
pub async fn broadcast_appointment_update(
    manager: Addr<WebSocketManager>,
    appointment: crate::models::Appointment,
    update_type: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let data = serde_json::json!({
        "appointment": appointment,
        "update_type": update_type,
        "timestamp": chrono::Utc::now()
    });
    
    let message = WebSocketMessage::new("appointment_update".to_string(), data);
    manager.do_send(BroadcastMessage {
        message,
        exclude_session: None,
    });
    
    Ok(())
}

/// Broadcast appointment updates using JSON (for when we have JSON data directly)
pub async fn broadcast_appointment_update_json(
    manager: Addr<WebSocketManager>,
    appointment: serde_json::Value,
    update_type: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let data = serde_json::json!({
        "appointment": appointment,
        "update_type": update_type,
        "timestamp": chrono::Utc::now()
    });
    
    let message = WebSocketMessage::new("appointment_update".to_string(), data);
    manager.do_send(BroadcastMessage {
        message,
        exclude_session: None,
    });
    
    Ok(())
}

/// Broadcast inventory updates to all connected clients
pub async fn broadcast_inventory_update(
    manager: Addr<WebSocketManager>,
    medicine_id: uuid::Uuid,
    medicine_name: &str,
    update_type: &str,
    stock_change: Option<i32>,
) -> Result<(), Box<dyn std::error::Error>> {
    let data = serde_json::json!({
        "medicine_id": medicine_id,
        "medicine_name": medicine_name,
        "update_type": update_type,
        "stock_change": stock_change,
        "timestamp": chrono::Utc::now()
    });
    
    let message = WebSocketMessage::new("inventory_update".to_string(), data);
    manager.do_send(BroadcastMessage {
        message,
        exclude_session: None,
    });
    
    Ok(())
}

/// Broadcast patient updates to all connected clients
pub async fn broadcast_patient_update(
    manager: Addr<WebSocketManager>,
    patient: crate::models::Patient,
    update_type: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let data = serde_json::json!({
        "patient": patient,
        "update_type": update_type,
        "timestamp": chrono::Utc::now()
    });
    
    let message = WebSocketMessage::new("patient_update".to_string(), data);
    manager.do_send(BroadcastMessage {
        message,
        exclude_session: None,
    });
    
    Ok(())
}

/// Broadcast system notifications to all connected clients
pub async fn broadcast_system_notification(
    manager: Addr<WebSocketManager>,
    title: &str,
    message: &str,
    notification_type: &str,
    priority: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let data = serde_json::json!({
        "title": title,
        "message": message,
        "type": notification_type,
        "priority": priority,
        "timestamp": chrono::Utc::now()
    });
    
    let ws_message = WebSocketMessage::new("system_notification".to_string(), data);
    manager.do_send(BroadcastMessage {
        message: ws_message,
        exclude_session: None,
    });
    
    Ok(())
}

/// Broadcast billing updates to all connected clients
pub async fn broadcast_billing_update(
    manager: Addr<WebSocketManager>,
    invoice: crate::models::Invoice,
    update_type: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let data = serde_json::json!({
        "invoice": invoice,
        "update_type": update_type,
        "timestamp": chrono::Utc::now()
    });
    
    let message = WebSocketMessage::new("billing_update".to_string(), data);
    manager.do_send(BroadcastMessage {
        message,
        exclude_session: None,
    });
    
    Ok(())
}

/// Broadcast prescription updates to all connected clients
pub async fn broadcast_prescription_update(
    manager: Addr<WebSocketManager>,
    prescription: crate::models::Prescription,
    update_type: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let data = serde_json::json!({
        "prescription": prescription,
        "update_type": update_type,
        "timestamp": chrono::Utc::now()
    });
    
    let message = WebSocketMessage::new("prescription_update".to_string(), data);
    manager.do_send(BroadcastMessage {
        message,
        exclude_session: None,
    });
    
    Ok(())
}