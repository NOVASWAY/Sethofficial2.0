# Rate Limiting Configuration

**Date**: January 2025  
**Status**: Complete

---

## Overview

This document describes the rate limiting implementation, configuration, and validation for the Clinic Management System API.

---

## Rate Limiting Strategy

### Implementation

Rate limiting is implemented using the `governor` crate with keyed rate limiters. Each client is identified by IP address or user ID.

### Configuration

- **Default Rate Limit**: 100 requests per minute per IP
- **Strict Rate Limit** (Auth endpoints): 30 requests per minute per IP
- **Window**: 60 seconds (rolling window)

### Endpoint-Specific Limits

| Endpoint | Rate Limit | Window | Notes |
|----------|------------|--------|-------|
| `/api/auth/login` | 5 requests/minute | 60s | Prevents brute force |
| `/api/auth/password-reset/request` | 3 requests/hour | 60s | Prevents abuse |
| `/api/auth/resend-verification` | 3 requests/hour | 60s | Prevents spam |
| `/api/mfa/verify` | 10 requests/minute | 60s | Prevents brute force |
| `/api/*` (General) | 100 requests/minute | 60s | Standard API limit |

---

## Error Responses

### Rate Limit Exceeded

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "message": "Rate limit exceeded. Please try again later.",
  "retry_after": 60
}
```

**HTTP Status**: `429 Too Many Requests`

**Headers**:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `Retry-After`: Seconds to wait before retry

---

## Monitoring

### Metrics

Rate limiting metrics are exposed via Prometheus:

- `rate_limit_requests_total`: Total requests
- `rate_limit_hits_total`: Rate limit hits
- `rate_limit_by_endpoint`: Rate limits by endpoint

### Alerts

- **High Rate Limit Hits**: More than 10% of requests hitting rate limits
- **Suspicious Activity**: Multiple IPs hitting rate limits simultaneously

---

## Testing

### Manual Testing

```bash
# Test rate limiting with curl
for i in {1..35}; do
  curl -X GET http://localhost:8080/api/test
  echo "Request $i"
done
```

### Automated Testing

```bash
# Run rate limiting tests
cd backend
cargo test rate_limiting_test
```

---

## Configuration

### Environment Variables

```bash
# Rate limiting configuration
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
RATE_LIMIT_STRICT_REQUESTS=30
```

### Code Configuration

```rust
// Default rate limit
const REQUESTS_PER_MINUTE: u32 = 100;

// Strict rate limit (auth endpoints)
const REQUESTS_PER_MINUTE_STRICT: u32 = 30;
```

---

## Best Practices

1. **Whitelist**: Add trusted IPs to whitelist if needed
2. **Monitoring**: Monitor rate limit hits regularly
3. **Adjustment**: Adjust limits based on usage patterns
4. **User Communication**: Inform users about rate limits in API documentation

---

## Troubleshooting

### Issue: Legitimate users hitting rate limits

**Solution**: 
- Increase rate limit threshold
- Implement per-user rate limits (requires authentication)
- Add IP whitelisting

### Issue: Rate limiting not working

**Solution**:
- Check middleware is applied
- Verify rate limiter initialization
- Check logs for errors

---

**Last Updated**: January 2025

