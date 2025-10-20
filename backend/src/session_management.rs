use actix_web::HttpRequest;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing::{info, warn, debug};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub session_id: String,
    pub user_id: String,
    pub username: String,
    pub role: String,
    pub created_at: u64,
    pub last_activity: u64,
    pub expires_at: u64,
    pub ip_address: String,
    pub user_agent: String,
    pub is_active: bool,
    pub concurrent_sessions: u32,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct SessionConfig {
    #[validate(range(min = 300, max = 86400))] // 5 minutes to 24 hours
    pub session_timeout_seconds: u64,
    #[validate(range(min = 1, max = 10))]
    pub max_concurrent_sessions: u32,
    #[validate(range(min = 60, max = 3600))] // 1 minute to 1 hour
    pub cleanup_interval_seconds: u64,
    pub enable_session_rotation: bool,
    pub enable_ip_validation: bool,
    pub enable_user_agent_validation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStats {
    pub total_sessions: u32,
    pub active_sessions: u32,
    pub expired_sessions: u32,
    pub concurrent_limit_exceeded: u32,
    pub last_cleanup: u64,
    pub sessions_by_user: HashMap<String, u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogoutRequest {
    pub session_id: Option<String>,
    pub logout_all_sessions: bool,
}

pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
    user_sessions: Arc<Mutex<HashMap<String, Vec<String>>>>, // user_id -> session_ids
    config: SessionConfig,
    stats: Arc<Mutex<SessionStats>>,
}

impl SessionManager {
    pub fn new() -> Self {
        let config = SessionConfig {
            session_timeout_seconds: 3600, // 1 hour default
            max_concurrent_sessions: 3,    // 3 concurrent sessions per user
            cleanup_interval_seconds: 300, // 5 minutes cleanup interval
            enable_session_rotation: true,
            enable_ip_validation: true,
            enable_user_agent_validation: true,
        };

        let stats = SessionStats {
            total_sessions: 0,
            active_sessions: 0,
            expired_sessions: 0,
            concurrent_limit_exceeded: 0,
            last_cleanup: current_timestamp(),
            sessions_by_user: HashMap::new(),
        };

        let manager = Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            user_sessions: Arc::new(Mutex::new(HashMap::new())),
            config,
            stats: Arc::new(Mutex::new(stats)),
        };

        // Start cleanup task
        manager.start_cleanup_task();

        manager
    }

    pub fn create_session(
        &self,
        user_id: String,
        username: String,
        role: String,
        ip_address: String,
        user_agent: String,
    ) -> Result<Session, String> {
        info!("Creating new session for user: {}", username);

        // Check concurrent session limits
        if !self.check_concurrent_session_limit(&user_id) {
            warn!("Concurrent session limit exceeded for user: {}", username);
            self.increment_concurrent_limit_exceeded();
            return Err("Maximum concurrent sessions exceeded".to_string());
        }

        let session_id = Uuid::new_v4().to_string();
        let now = current_timestamp();
        let expires_at = now + (self.config.session_timeout_seconds * 1000);

        let session = Session {
            session_id: session_id.clone(),
            user_id: user_id.clone(),
            username: username.clone(),
            role: role.clone(),
            created_at: now,
            last_activity: now,
            expires_at,
            ip_address: ip_address.clone(),
            user_agent: user_agent.clone(),
            is_active: true,
            concurrent_sessions: 0,
        };

        // Store session
        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(session_id.clone(), session.clone());
        }

        // Update user sessions mapping
        {
            let mut user_sessions = self.user_sessions.lock().unwrap();
            user_sessions.entry(user_id.clone()).or_insert_with(Vec::new).push(session_id.clone());
        }

        // Update statistics
        self.update_session_stats();

        info!("Session created successfully: {} for user: {}", session_id, username);
        Ok(session)
    }

    pub fn validate_session(&self, session_id: &str, ip_address: &str, user_agent: &str) -> Result<Session, String> {
        debug!("Validating session: {}", session_id);

        let session = {
            let sessions = self.sessions.lock().unwrap();
            sessions.get(session_id).cloned()
        };

        if let Some(mut session) = session {
            // Check if session is active
            if !session.is_active {
                warn!("Session is inactive: {}", session_id);
                return Err("Session is inactive".to_string());
            }

            // Check if session has expired
            let now = current_timestamp();
            if now > session.expires_at {
                warn!("Session has expired: {}", session_id);
                self.expire_session(session_id);
                return Err("Session has expired".to_string());
            }

            // Validate IP address if enabled
            if self.config.enable_ip_validation && session.ip_address != ip_address {
                warn!("IP address mismatch for session: {}", session_id);
                self.invalidate_session(session_id);
                return Err("IP address validation failed".to_string());
            }

            // Validate user agent if enabled
            if self.config.enable_user_agent_validation && session.user_agent != user_agent {
                warn!("User agent mismatch for session: {}", session_id);
                self.invalidate_session(session_id);
                return Err("User agent validation failed".to_string());
            }

            // Update last activity
            session.last_activity = now;

            // Rotate session if enabled and near expiry
            if self.config.enable_session_rotation {
                let time_until_expiry = session.expires_at - now;
                let rotation_threshold = self.config.session_timeout_seconds * 1000 / 4; // 25% of timeout

                if time_until_expiry < rotation_threshold {
                    info!("Rotating session: {}", session_id);
                    session.expires_at = now + (self.config.session_timeout_seconds * 1000);
                }
            }

            // Update session in storage
            {
                let mut sessions = self.sessions.lock().unwrap();
                sessions.insert(session_id.to_string(), session.clone());
            }

            debug!("Session validated successfully: {}", session_id);
            Ok(session)
        } else {
            warn!("Session not found: {}", session_id);
            Err("Session not found".to_string())
        }
    }

    pub fn logout_session(&self, session_id: &str) -> Result<(), String> {
        info!("Logging out session: {}", session_id);

        if let Some(session) = self.get_session(session_id) {
            self.invalidate_session(session_id);
            info!("Session logged out successfully: {} for user: {}", session_id, session.username);
            Ok(())
        } else {
            warn!("Session not found for logout: {}", session_id);
            Err("Session not found".to_string())
        }
    }

    pub fn logout_all_user_sessions(&self, user_id: &str) -> Result<u32, String> {
        info!("Logging out all sessions for user: {}", user_id);

        let session_ids = {
            let user_sessions = self.user_sessions.lock().unwrap();
            user_sessions.get(user_id).cloned().unwrap_or_default()
        };

        let mut logged_out_count = 0;
        for session_id in session_ids {
            if self.logout_session(&session_id).is_ok() {
                logged_out_count += 1;
            }
        }

        info!("Logged out {} sessions for user: {}", logged_out_count, user_id);
        Ok(logged_out_count)
    }

    pub fn get_user_sessions(&self, user_id: &str) -> Vec<Session> {
        let session_ids = {
            let user_sessions = self.user_sessions.lock().unwrap();
            user_sessions.get(user_id).cloned().unwrap_or_default()
        };

        let sessions = self.sessions.lock().unwrap();
        session_ids
            .into_iter()
            .filter_map(|id| sessions.get(&id).cloned())
            .collect()
    }

    pub fn get_session(&self, session_id: &str) -> Option<Session> {
        let sessions = self.sessions.lock().unwrap();
        sessions.get(session_id).cloned()
    }

    pub fn get_session_stats(&self) -> SessionStats {
        let stats = self.stats.lock().unwrap();
        stats.clone()
    }

    pub fn update_config(&self, new_config: SessionConfig) -> Result<(), String> {
        if let Err(validation_errors) = new_config.validate() {
            return Err(format!("Invalid session configuration: {}", validation_errors));
        }

        info!("Updating session configuration");
        // Note: In a real implementation, you'd want to make config mutable or use Arc<Mutex<SessionConfig>>
        Ok(())
    }

    fn check_concurrent_session_limit(&self, user_id: &str) -> bool {
        let user_sessions = self.user_sessions.lock().unwrap();
        let active_sessions = user_sessions
            .get(user_id)
            .map(|sessions| {
                sessions.iter().filter(|&session_id| {
                    self.sessions.lock().unwrap()
                        .get(session_id)
                        .map(|s| s.is_active && current_timestamp() <= s.expires_at)
                        .unwrap_or(false)
                }).count()
            })
            .unwrap_or(0);

        active_sessions < self.config.max_concurrent_sessions as usize
    }

    fn invalidate_session(&self, session_id: &str) {
        if let Some(session) = self.get_session(session_id) {
            // Mark session as inactive
            {
                let mut sessions = self.sessions.lock().unwrap();
                if let Some(s) = sessions.get_mut(session_id) {
                    s.is_active = false;
                }
            }

            // Remove from user sessions mapping
            {
                let mut user_sessions = self.user_sessions.lock().unwrap();
                if let Some(sessions) = user_sessions.get_mut(&session.user_id) {
                    sessions.retain(|id| id != session_id);
                    if sessions.is_empty() {
                        user_sessions.remove(&session.user_id);
                    }
                }
            }

            self.update_session_stats();
            info!("Session invalidated: {}", session_id);
        }
    }

    fn expire_session(&self, session_id: &str) {
        self.invalidate_session(session_id);
        {
            let mut stats = self.stats.lock().unwrap();
            stats.expired_sessions += 1;
        }
    }

    fn increment_concurrent_limit_exceeded(&self) {
        let mut stats = self.stats.lock().unwrap();
        stats.concurrent_limit_exceeded += 1;
    }

    fn update_session_stats(&self) {
        let sessions = self.sessions.lock().unwrap();
        let user_sessions = self.user_sessions.lock().unwrap();
        let now = current_timestamp();

        let mut stats = self.stats.lock().unwrap();
        stats.total_sessions = sessions.len() as u32;
        stats.active_sessions = sessions.values()
            .filter(|s| s.is_active && now <= s.expires_at)
            .count() as u32;
        stats.sessions_by_user = user_sessions.iter()
            .map(|(user_id, session_ids)| {
                let active_count = session_ids.iter()
                    .filter(|&id| {
                        sessions.get(id)
                            .map(|s| s.is_active && now <= s.expires_at)
                            .unwrap_or(false)
                    })
                    .count() as u32;
                (user_id.clone(), active_count)
            })
            .collect();
    }

    fn start_cleanup_task(&self) {
        let sessions = Arc::clone(&self.sessions);
        let user_sessions = Arc::clone(&self.user_sessions);
        let stats = Arc::clone(&self.stats);
        let cleanup_interval = self.config.cleanup_interval_seconds;

        actix_web::rt::spawn(async move {
            let mut interval = actix_web::rt::time::interval(Duration::from_secs(cleanup_interval));
            loop {
                interval.tick().await;
                
                let now = current_timestamp();
                let mut expired_sessions = Vec::new();

                // Find expired sessions
                {
                    let sessions_guard = sessions.lock().unwrap();
                    for (session_id, session) in sessions_guard.iter() {
                        if !session.is_active || now > session.expires_at {
                            expired_sessions.push(session_id.clone());
                        }
                    }
                }

                // Remove expired sessions
                if !expired_sessions.is_empty() {
                    info!("Cleaning up {} expired sessions", expired_sessions.len());
                    
                    {
                        let mut sessions_guard = sessions.lock().unwrap();
                        for session_id in &expired_sessions {
                            if let Some(session) = sessions_guard.remove(session_id) {
                                // Remove from user sessions mapping
                                let mut user_sessions_guard = user_sessions.lock().unwrap();
                                if let Some(user_session_list) = user_sessions_guard.get_mut(&session.user_id) {
                                    user_session_list.retain(|id| id != session_id);
                                    if user_session_list.is_empty() {
                                        user_sessions_guard.remove(&session.user_id);
                                    }
                                }
                            }
                        }
                    }

                    // Update stats
                    {
                        let mut stats_guard = stats.lock().unwrap();
                        stats_guard.expired_sessions += expired_sessions.len() as u32;
                        stats_guard.last_cleanup = now;
                    }
                }
            }
        });
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

// Session middleware for Actix Web
pub struct SessionMiddleware {
    session_manager: Arc<SessionManager>,
}

impl SessionMiddleware {
    pub fn new(session_manager: Arc<SessionManager>) -> Self {
        Self { session_manager }
    }

    pub fn extract_session(&self, req: &HttpRequest) -> Option<Session> {
        // Extract session ID from Authorization header or cookie
        if let Some(auth_header) = req.headers().get("Authorization") {
            if let Ok(auth_str) = auth_header.to_str() {
                if auth_str.starts_with("Bearer ") {
                    let token = &auth_str[7..];
                    // In a real implementation, you'd decode the JWT and extract session info
                    // For now, we'll use the token as session ID
                    if let Ok(session) = self.session_manager.validate_session(
                        token,
                        req.connection_info().peer_addr().unwrap_or("unknown"),
                        req.headers().get("User-Agent")
                            .and_then(|h| h.to_str().ok())
                            .unwrap_or("unknown")
                    ) {
                        return Some(session);
                    }
                }
            }
        }
        None
    }
}
