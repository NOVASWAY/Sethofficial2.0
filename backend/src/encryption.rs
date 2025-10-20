use aes_gcm::{Aes256Gcm, Key, Nonce, aead::{Aead, KeyInit}};
use base64;
use rand::{RngCore, rngs::OsRng};
use std::env;
use tracing::{info, error};

pub struct EncryptionService {
    cipher: Aes256Gcm,
}

impl EncryptionService {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let encryption_key = env::var("ENCRYPTION_KEY")
            .unwrap_or_else(|_| {
                // Use a fixed development key (32 bytes for AES-256)
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string()
            });

        // Convert hex string to bytes
        let key_bytes = if encryption_key.len() == 64 {
            // Hex string
            (0..encryption_key.len())
                .step_by(2)
                .map(|i| u8::from_str_radix(&encryption_key[i..i + 2], 16))
                .collect::<Result<Vec<u8>, _>>()?
        } else {
            // Try base64 decode
            base64::decode(&encryption_key)?
        };

        if key_bytes.len() != 32 {
            return Err("Encryption key must be 32 bytes (256 bits) for AES-256".into());
        }

        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);

        info!("🔐 Encryption service initialized with AES-256r clinic_postgres  Started
$ sleep 5 && cd /home/njau-wangari/Downloads/backend && DATABASE_URL=postgresql://clinic_user:clinic_password@localhost:5432/clinic_management RUST_LOG=info cargo run
-GCM");
        Ok(EncryptionService { cipher })
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<String, Box<dyn std::error::Error>> {
        // Generate a random nonce (12 bytes for GCM)
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Encrypt the data
        let ciphertext = self.cipher.encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| format!("Encryption failed: {}", e))?;

        // Combine nonce and ciphertext, then encode as base64
        let mut encrypted_data = nonce_bytes.to_vec();
        encrypted_data.extend_from_slice(&ciphertext);
        
        Ok(base64::encode(&encrypted_data))
    }

    pub fn decrypt(&self, encrypted_data: &str) -> Result<String, Box<dyn std::error::Error>> {
        // Decode from base64
        let data = base64::decode(encrypted_data)?;
        
        if data.len() < 12 {
            return Err("Invalid encrypted data: too short".into());
        }

        // Split nonce and ciphertext
        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Decrypt the data
        let plaintext = self.cipher.decrypt(nonce, ciphertext)
            .map_err(|e| format!("Decryption failed: {}", e))?;

        String::from_utf8(plaintext)
            .map_err(|e| format!("Invalid UTF-8 in decrypted data: {}", e).into())
    }

    pub fn hash_sensitive_data(&self, data: &str) -> String {
        use argon2::{Argon2, PasswordHasher};
        use argon2::password_hash::SaltString;
        
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        match argon2.hash_password(data.as_bytes(), &salt) {
            Ok(hash) => hash.to_string(),
            Err(_) => {
                error!("Failed to hash sensitive data");
                "hash_failed".to_string()
            }
        }
    }
}

impl Default for EncryptionService {
    fn default() -> Self {
        // Create a simple encryption service with a fixed key for development
        let key_bytes = [0u8; 32]; // Fixed key for development
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);
        EncryptionService { cipher }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption() {
        let service = EncryptionService::new().unwrap();
        let original_text = "This is sensitive patient data";

        let encrypted = service.encrypt(original_text).unwrap();
        let decrypted = service.decrypt(&encrypted).unwrap();

        assert_eq!(original_text, decrypted);
        assert_ne!(original_text, encrypted);
    }

    #[test]
    fn test_hash_sensitive_data() {
        let service = EncryptionService::new().unwrap();
        let data = "patient_ssn_123456789";

        let hash1 = service.hash_sensitive_data(data);
        let hash2 = service.hash_sensitive_data(data);

        // Hashes should be different due to random salt
        assert_ne!(hash1, hash2);
        assert!(hash1.len() > 50); // Argon2 hashes are long
        assert!(hash2.len() > 50);
    }
}