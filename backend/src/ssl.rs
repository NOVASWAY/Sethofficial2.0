use rustls::{Certificate, PrivateKey, ServerConfig};
use rustls_pemfile::{certs, pkcs8_private_keys};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use tracing::{info, error};

pub fn load_certificates(cert_path: &str, key_path: &str) -> Result<(Vec<Certificate>, PrivateKey), Box<dyn std::error::Error>> {
    info!("Loading SSL certificates from {} and {}", cert_path, key_path);
    
    // Load certificate
    let cert_file = File::open(cert_path)?;
    let mut cert_reader = BufReader::new(cert_file);
    let cert_chain = certs(&mut cert_reader)?
        .into_iter()
        .map(Certificate)
        .collect();
    
    // Load private key
    let key_file = File::open(key_path)?;
    let mut key_reader = BufReader::new(key_file);
    let mut keys = pkcs8_private_keys(&mut key_reader)?;
    
    if keys.is_empty() {
        return Err("No private keys found in the key file".into());
    }
    
    let private_key = PrivateKey(keys.remove(0));
    
    info!("✅ SSL certificates loaded successfully");
    Ok((cert_chain, private_key))
}

pub fn create_server_config(cert_path: &str, key_path: &str) -> Result<ServerConfig, Box<dyn std::error::Error>> {
    let (cert_chain, private_key) = load_certificates(cert_path, key_path)?;
    
    let config = ServerConfig::builder()
        .with_safe_defaults()
        .with_no_client_auth()
        .with_single_cert(cert_chain, private_key)?;
    
    info!("✅ SSL server configuration created successfully");
    Ok(config)
}

pub fn get_ssl_config() -> Result<Option<ServerConfig>, Box<dyn std::error::Error>> {
    let cert_path = std::env::var("SSL_CERT_PATH").unwrap_or_else(|_| "certs/cert.pem".to_string());
    let key_path = std::env::var("SSL_KEY_PATH").unwrap_or_else(|_| "certs/key.pem".to_string());
    
    // Check if SSL is enabled
    let ssl_enabled = std::env::var("SSL_ENABLED")
        .unwrap_or_else(|_| "false".to_string())
        .parse::<bool>()
        .unwrap_or(false);
    
    if !ssl_enabled {
        info!("🔓 SSL disabled - running in HTTP mode");
        return Ok(None);
    }
    
    // Check if certificate files exist
    if !Path::new(&cert_path).exists() || !Path::new(&key_path).exists() {
        error!("❌ SSL certificate files not found at {} and {}", cert_path, key_path);
        error!("💡 Set SSL_ENABLED=false to run without SSL, or provide valid certificate files");
        return Err("SSL certificate files not found".into());
    }
    
    let config = create_server_config(&cert_path, &key_path)?;
    info!("🔒 SSL enabled - running in HTTPS mode");
    Ok(Some(config))
}
