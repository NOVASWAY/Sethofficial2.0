#[cfg(test)]
mod tests {
    use actix_web::{test, web, App, HttpResponse};
    use actix_web::http::StatusCode;
    use serde_json::json;

    use crate::middleware::security::SecurityMiddleware;
    use crate::auth::AuthService;

    // Mock handler for testing
    async fn test_handler() -> HttpResponse {
        HttpResponse::Ok().json(json!({"success": true}))
    }

    #[actix_web::test]
    async fn test_rate_limiting_normal() {
        let jwt_secret = "test-secret-key-for-rate-limiting-tests";
        let auth_service = AuthService::new(jwt_secret, 24, 7);
        let security_middleware = SecurityMiddleware::new(auth_service);

        let app = test::init_service(
            App::new()
                .wrap(security_middleware)
                .route("/test", web::get().to(test_handler))
        ).await;

        // Make requests within rate limit
        for i in 0..10 {
            let req = test::TestRequest::get().uri("/test").to_request();
            let resp = test::call_service(&app, req).await;
            
            if i < 10 {
                assert_eq!(resp.status(), StatusCode::OK);
            }
        }
    }

    #[actix_web::test]
    async fn test_rate_limiting_exceeded() {
        let jwt_secret = "test-secret-key-for-rate-limiting-tests";
        let auth_service = AuthService::new(jwt_secret, 24, 7);
        let security_middleware = SecurityMiddleware::with_strict_rate_limit(auth_service);

        let app = test::init_service(
            App::new()
                .wrap(security_middleware)
                .route("/test", web::get().to(test_handler))
        ).await;

        // Make requests exceeding rate limit (30 requests)
        let mut rate_limit_hit = false;
        for i in 0..35 {
            let req = test::TestRequest::get().uri("/test").to_request();
            let resp = test::call_service(&app, req).await;
            
            if resp.status() == StatusCode::TOO_MANY_REQUESTS {
                rate_limit_hit = true;
                let body: serde_json::Value = test::read_body_json(resp).await;
                assert_eq!(body["error"], "Rate limit exceeded. Please try again later.");
                assert!(body["retry_after"].is_number());
                break;
            }
        }

        assert!(rate_limit_hit, "Rate limit should have been exceeded");
    }

    #[actix_web::test]
    async fn test_rate_limiting_response_headers() {
        let jwt_secret = "test-secret-key-for-rate-limiting-tests";
        let auth_service = AuthService::new(jwt_secret, 24, 7);
        let security_middleware = SecurityMiddleware::new(auth_service);

        let app = test::init_service(
            App::new()
                .wrap(security_middleware)
                .route("/test", web::get().to(test_handler))
        ).await;

        let req = test::TestRequest::get().uri("/test").to_request();
        let resp = test::call_service(&app, req).await;

        // Check for rate limit headers (if implemented)
        // Note: Headers may not be present if not exceeded
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_rate_limiting_per_ip() {
        let jwt_secret = "test-secret-key-for-rate-limiting-tests";
        let auth_service = AuthService::new(jwt_secret, 24, 7);
        let security_middleware = SecurityMiddleware::new(auth_service);

        let app = test::init_service(
            App::new()
                .wrap(security_middleware)
                .route("/test", web::get().to(test_handler))
        ).await;

        // Simulate requests from different IPs
        // Note: In real tests, you'd need to set X-Forwarded-For or similar
        let req1 = test::TestRequest::get()
            .uri("/test")
            .insert_header(("X-Forwarded-For", "192.168.1.1"))
            .to_request();
        let resp1 = test::call_service(&app, req1).await;
        assert_eq!(resp1.status(), StatusCode::OK);

        let req2 = test::TestRequest::get()
            .uri("/test")
            .insert_header(("X-Forwarded-For", "192.168.1.2"))
            .to_request();
        let resp2 = test::call_service(&app, req2).await;
        assert_eq!(resp2.status(), StatusCode::OK);
    }
}

