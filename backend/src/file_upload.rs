use actix_multipart::Multipart;
use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tracing::{info, warn, error};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct FileUploadRequest {
    #[validate(length(min = 1, max = 100))]
    pub patient_id: String,
    #[validate(length(min = 1, max = 50))]
    pub file_type: String, // "medical_image", "document", "lab_result", etc.
    #[validate(length(min = 1, max = 200))]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadedFile {
    pub id: String,
    pub patient_id: String,
    pub file_type: String,
    pub original_filename: String,
    pub stored_filename: String,
    pub file_size: u64,
    pub mime_type: String,
    pub sha256_hash: String,
    pub description: String,
    pub uploaded_by: String,
    pub uploaded_at: String,
    pub is_encrypted: bool,
    pub virus_scan_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileScanResult {
    pub is_safe: bool,
    pub scan_status: String,
    pub threats_found: Vec<String>,
    pub scan_timestamp: String,
}

pub struct FileUploadService {
    upload_dir: PathBuf,
    max_file_size: u64,
    allowed_mime_types: HashMap<String, Vec<String>>,
    files: Arc<Mutex<HashMap<String, UploadedFile>>>,
}

impl FileUploadService {
    pub fn new() -> Self {
        let upload_dir = PathBuf::from("/home/njau-wangari/Downloads/backend/uploads");
        
        // Create upload directory if it doesn't exist
        if !upload_dir.exists() {
            if let Err(e) = fs::create_dir_all(&upload_dir) {
                error!("Failed to create upload directory: {}", e);
            }
        }

        // Define allowed MIME types for different file categories
        let mut allowed_mime_types = HashMap::new();
        
        // Medical images
        allowed_mime_types.insert("medical_image".to_string(), vec![
            "image/jpeg".to_string(),
            "image/png".to_string(),
            "image/dicom".to_string(),
            "image/tiff".to_string(),
        ]);
        
        // Documents
        allowed_mime_types.insert("document".to_string(), vec![
            "application/pdf".to_string(),
            "application/msword".to_string(),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string(),
            "text/plain".to_string(),
        ]);
        
        // Lab results
        allowed_mime_types.insert("lab_result".to_string(), vec![
            "application/pdf".to_string(),
            "text/csv".to_string(),
            "application/vnd.ms-excel".to_string(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".to_string(),
        ]);
        
        // Prescriptions
        allowed_mime_types.insert("prescription".to_string(), vec![
            "application/pdf".to_string(),
            "image/jpeg".to_string(),
            "image/png".to_string(),
        ]);

        FileUploadService {
            upload_dir,
            max_file_size: 50 * 1024 * 1024, // 50MB
            allowed_mime_types,
            files: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn upload_file(
        &self,
        mut payload: Multipart,
        request: FileUploadRequest,
        uploaded_by: String,
    ) -> Result<UploadedFile, String> {
        info!("Starting file upload for patient: {}", request.patient_id);

        let mut file_data = Vec::new();
        let mut original_filename = String::new();
        let mut mime_type = String::new();

        // Process multipart data
        while let Some(mut field) = payload.try_next().await.map_err(|e| {
            error!("Error processing multipart field: {}", e);
            "Failed to process file upload".to_string()
        })? {
            if field.name() == "file" {
                original_filename = field.content_disposition()
                    .get_filename()
                    .unwrap_or("unknown")
                    .to_string();

                // Get MIME type
                if let Some(content_type) = field.content_type() {
                    mime_type = content_type.to_string();
                }

                // Read file data
                while let Some(chunk) = field.try_next().await.map_err(|e| {
                    error!("Error reading file chunk: {}", e);
                    "Failed to read file data".to_string()
                })? {
                    file_data.extend_from_slice(&chunk);
                }
            }
        }

        if file_data.is_empty() {
            return Err("No file data received".to_string());
        }

        // Validate file size
        if file_data.len() as u64 > self.max_file_size {
            return Err(format!("File too large. Maximum size: {} bytes", self.max_file_size));
        }

        // Validate MIME type
        if let Some(allowed_types) = self.allowed_mime_types.get(&request.file_type) {
            if !allowed_types.contains(&mime_type) {
                return Err(format!("File type not allowed for category '{}'. Allowed types: {:?}", 
                    request.file_type, allowed_types));
            }
        } else {
            return Err(format!("Invalid file type category: {}", request.file_type));
        }

        // Generate file hash for integrity checking
        let mut hasher = Sha256::new();
        hasher.update(&file_data);
        let file_hash = hex::encode(hasher.finalize());

        // Check for duplicate files
        if self.is_duplicate_file(&file_hash).await {
            warn!("Duplicate file detected: {}", file_hash);
            return Err("File already exists in the system".to_string());
        }

        // Perform virus scan simulation
        let scan_result = self.perform_virus_scan(&file_data, &original_filename).await;
        if !scan_result.is_safe {
            error!("Virus detected in file: {}", original_filename);
            return Err(format!("File rejected due to security threats: {:?}", scan_result.threats_found));
        }

        // Generate unique filename
        let file_extension = Path::new(&original_filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");
        
        let stored_filename = format!("{}_{}.{}", 
            Uuid::new_v4(), 
            file_hash[..8].to_string(), 
            file_extension
        );

        // Save file to disk
        let file_path = self.upload_dir.join(&stored_filename);
        if let Err(e) = fs::write(&file_path, &file_data) {
            error!("Failed to save file: {}", e);
            return Err("Failed to save uploaded file".to_string());
        }

        // Create file record
        let uploaded_file = UploadedFile {
            id: Uuid::new_v4().to_string(),
            patient_id: request.patient_id,
            file_type: request.file_type,
            original_filename: original_filename.clone(),
            stored_filename: stored_filename.clone(),
            file_size: file_data.len() as u64,
            mime_type: mime_type.clone(),
            sha256_hash: file_hash,
            description: request.description,
            uploaded_by,
            uploaded_at: chrono::Utc::now().to_rfc3339(),
            is_encrypted: false, // Files are stored unencrypted for now
            virus_scan_status: scan_result.scan_status,
        };

        // Store file record
        {
            let mut files = self.files.lock().unwrap();
            files.insert(uploaded_file.id.clone(), uploaded_file.clone());
        }

        info!("File uploaded successfully: {} ({} bytes)", original_filename, file_data.len());
        Ok(uploaded_file)
    }

    pub async fn get_file_by_id(&self, file_id: &str) -> Option<UploadedFile> {
        let files = self.files.lock().unwrap();
        files.get(file_id).cloned()
    }

    pub async fn get_files_by_patient(&self, patient_id: &str) -> Vec<UploadedFile> {
        let files = self.files.lock().unwrap();
        files.values()
            .filter(|file| file.patient_id == patient_id)
            .cloned()
            .collect()
    }

    pub async fn delete_file(&self, file_id: &str) -> Result<(), String> {
        let file_to_delete = {
            let mut files = self.files.lock().unwrap();
            files.remove(file_id)
        };

        if let Some(file) = file_to_delete {
            // Delete physical file
            let file_path = self.upload_dir.join(&file.stored_filename);
            if let Err(e) = fs::remove_file(&file_path) {
                warn!("Failed to delete physical file {}: {}", file.stored_filename, e);
            }

            info!("File deleted: {}", file.original_filename);
            Ok(())
        } else {
            Err("File not found".to_string())
        }
    }

    pub async fn rescan_file(&self, file_id: &str) -> Result<FileScanResult, String> {
        let file = {
            let files = self.files.lock().unwrap();
            files.get(file_id).cloned()
        };

        if let Some(file) = file {
            let file_path = self.upload_dir.join(&file.stored_filename);
            let file_data = fs::read(&file_path)
                .map_err(|e| format!("Failed to read file for rescan: {}", e))?;

            let scan_result = self.perform_virus_scan(&file_data, &file.original_filename).await;
            
            // Update file record with new scan result
            {
                let mut files = self.files.lock().unwrap();
                if let Some(file_record) = files.get_mut(file_id) {
                    file_record.virus_scan_status = scan_result.scan_status.clone();
                }
            }

            info!("File rescanned: {} - Status: {}", file.original_filename, scan_result.scan_status);
            Ok(scan_result)
        } else {
            Err("File not found".to_string())
        }
    }

    async fn is_duplicate_file(&self, file_hash: &str) -> bool {
        let files = self.files.lock().unwrap();
        files.values().any(|file| file.sha256_hash == file_hash)
    }

    async fn perform_virus_scan(&self, file_data: &[u8], filename: &str) -> FileScanResult {
        info!("Performing virus scan on file: {}", filename);

        // Simulate virus scanning (in production, integrate with ClamAV or similar)
        let mut threats_found = Vec::new();
        let mut is_safe = true;

        // Check for suspicious file patterns
        let suspicious_patterns: &[&[u8]] = &[
            b"<script>",
            b"javascript:",
            b"eval(",
            b"exec(",
            b"cmd.exe",
            b"powershell",
        ];

        for pattern in suspicious_patterns {
            if file_data.windows(pattern.len()).any(|window| window == *pattern) {
                threats_found.push(format!("Suspicious pattern detected: {:?}", pattern));
                is_safe = false;
            }
        }

        // Check file size for potential buffer overflow attacks
        if file_data.len() > 100 * 1024 * 1024 { // 100MB
            threats_found.push("File size exceeds safe limits".to_string());
            is_safe = false;
        }

        // Check for executable file signatures
        let executable_signatures: &[&[u8]] = &[
            b"\x4D\x5A", // PE executable
            b"\x7F\x45\x4C\x46", // ELF executable
        ];

        for signature in executable_signatures {
            if file_data.starts_with(signature) {
                threats_found.push("Executable file detected".to_string());
                is_safe = false;
            }
        }

        let scan_status = if is_safe {
            "clean".to_string()
        } else {
            "threats_detected".to_string()
        };

        FileScanResult {
            is_safe,
            scan_status,
            threats_found,
            scan_timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn get_allowed_file_types(&self) -> HashMap<String, Vec<String>> {
        self.allowed_mime_types.clone()
    }

    pub fn get_upload_stats(&self) -> HashMap<String, u64> {
        let files = self.files.lock().unwrap();
        let mut stats = HashMap::new();
        
        stats.insert("total_files".to_string(), files.len() as u64);
        stats.insert("total_size".to_string(), files.values().map(|f| f.file_size).sum());
        
        let mut type_counts = HashMap::new();
        for file in files.values() {
            *type_counts.entry(file.file_type.clone()).or_insert(0) += 1;
        }
        
        for (file_type, count) in type_counts {
            stats.insert(format!("{}_count", file_type), count);
        }
        
        stats
    }
}

impl Default for FileUploadService {
    fn default() -> Self {
        Self::new()
    }
}
