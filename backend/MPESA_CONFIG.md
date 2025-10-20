# M-Pesa Daraja API Configuration

## Environment Variables

Add these environment variables to your `.env` file:

```bash
# M-Pesa Daraja API Configuration
# Environment: "sandbox" for testing, "production" for live
MPESA_ENVIRONMENT=sandbox

# Sandbox Credentials (for testing)
MPESA_CONSUMER_KEY=your_sandbox_consumer_key_here
MPESA_CONSUMER_SECRET=your_sandbox_consumer_secret_here
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY=your_sandbox_passkey_here

# Production Credentials (for live system)
# MPESA_CONSUMER_KEY=your_production_consumer_key_here
# MPESA_CONSUMER_SECRET=your_production_consumer_secret_here
# MPESA_BUSINESS_SHORT_CODE=your_business_short_code_here
# MPESA_PASSKEY=your_production_passkey_here

# Callback URL (where Safaricom will send payment notifications)
MPESA_CALLBACK_URL=https://your-domain.com/api/v1/mpesa/callback
```

## Getting M-Pesa Credentials

### 1. Sandbox Testing
- Visit [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
- Create an account and register your app
- Use the provided sandbox credentials for testing

### 2. Production Setup
- Complete the app review process with Safaricom
- Get your production credentials
- Update environment variables with production values

## Testing the Integration

### 1. Start the Backend
```bash
cd /home/njau-wangari/Downloads/backend
DATABASE_URL=postgresql://clinic_user:clinic_password@localhost:5432/clinic_management \
MPESA_ENVIRONMENT=sandbox \
MPESA_CONSUMER_KEY=your_consumer_key \
MPESA_CONSUMER_SECRET=your_consumer_secret \
MPESA_BUSINESS_SHORT_CODE=174379 \
MPESA_PASSKEY=your_passkey \
MPESA_CALLBACK_URL=http://localhost:8080/api/v1/mpesa/callback \
cargo run
```

### 2. Test STK Push
```bash
curl -X POST http://localhost:8080/api/v1/mpesa/stk-push \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+254708374149",
    "amount": 100,
    "account_reference": "TEST001",
    "transaction_desc": "Test payment",
    "invoice_id": "INV-TEST-001"
  }'
```

### 3. Check Transaction Status
```bash
curl http://localhost:8080/api/v1/mpesa/transaction/{checkout_request_id}
```

## Frontend Testing

1. Start the frontend: `npm run dev`
2. Navigate to billing module
3. Select M-Pesa payment
4. Enter a test phone number (e.g., +254708374149)
5. Click "Send Payment Request"
6. Check your phone for the STK Push notification
7. Complete the payment on your phone
8. The system will automatically detect the payment completion

## Important Notes

- **Sandbox Testing**: Use the provided test phone numbers from Safaricom
- **Callback URL**: Must be publicly accessible for production
- **Security**: Never commit real credentials to version control
- **Rate Limits**: Be aware of Safaricom's API rate limits
- **Error Handling**: The system includes comprehensive error handling and logging

## Troubleshooting

### Common Issues

1. **"M-Pesa service unavailable"**
   - Check if all environment variables are set
   - Verify credentials are correct
   - Ensure network connectivity to Safaricom APIs

2. **"STK push failed"**
   - Check phone number format
   - Verify business short code
   - Check if phone number is registered with M-Pesa

3. **"Payment not detected"**
   - Check callback URL is accessible
   - Verify webhook endpoint is working
   - Check database for transaction records

### Debug Mode

Enable debug logging by setting:
```bash
RUST_LOG=debug
```

This will show detailed logs of all M-Pesa API interactions.
