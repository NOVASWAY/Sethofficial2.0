use std::path::Path;
use std::fs;
use uuid::Uuid;
use mime_guess::from_path;

pub struct FileService {
    upload_dir: String,
    max_file_size: u64,
}

impl FileService {
    pub fn new(upload_dir: String, max_file_size: u64) -> Self {
        // Create upload directory if it doesn't exist
        if !Path::new(&upload_dir).exists() {
            let _ = fs::create_dir_all(&upload_dir);
        }

        Self {
            upload_dir,
            max_file_size,
        }
    }

    pub async fn save_file(
        &self,
        file_data: &[u8],
        original_filename: &str,
        file_type: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        // Validate file size
        if file_data.len() as u64 > self.max_file_size {
            return Err("File too large".into());
        }

        // Generate unique filename
        let file_extension = Path::new(original_filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("bin");
        
        let unique_filename = format!("{}_{}.{}", file_type, Uuid::new_v4(), file_extension);
        let file_path = Path::new(&self.upload_dir).join(&unique_filename);

        // Save file
        fs::write(&file_path, file_data)?;

        // Return relative path
        Ok(format!("/uploads/{}", unique_filename))
    }

    pub async fn save_avatar(
        &self,
        file_data: &[u8],
        original_filename: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        // Validate file type
        let mime_type = from_path(original_filename).first_or_octet_stream();
        if !mime_type.type_().as_str().starts_with("image/") {
            return Err("Invalid file type. Only images are allowed.".into());
        }

        self.save_file(file_data, original_filename, "avatar").await
    }

    pub async fn save_document(
        &self,
        file_data: &[u8],
        original_filename: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        // Validate file type
        let mime_type = from_path(original_filename).first_or_octet_stream();
        let allowed_types = ["application/pdf", "image/jpeg", "image/png", "text/plain"];
        
        if !allowed_types.contains(&mime_type.as_ref()) {
            return Err("Invalid file type. Only PDF, JPEG, PNG, and TXT files are allowed.".into());
        }

        self.save_file(file_data, original_filename, "document").await
    }

    pub fn delete_file(&self, file_path: &str) -> Result<(), Box<dyn std::error::Error>> {
        let full_path = Path::new(&self.upload_dir).join(
            Path::new(file_path).file_name().unwrap()
        );
        
        if full_path.exists() {
            fs::remove_file(full_path)?;
        }
        
        Ok(())
    }

    pub fn get_file_path(&self, file_path: &str) -> String {
        format!("{}/{}", self.upload_dir, file_path)
    }
}
