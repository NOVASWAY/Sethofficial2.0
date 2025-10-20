# M-Pesa STK Push Integration Setup

This document explains how to set up M-Pesa STK Push integration for the clinic management system.

## Environment Variables

Create a `.env` file in the backend directory with the following M-Pesa configuration:

```bash
# M-Pesa Configuration
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=your_mpesa_consumer_key_here
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret_here
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY=your_mpesa_passkey_here
MPESA_CALLBACK_URL=https://your-domain.com/api/v1/mpesa/callback
```

## M-Pesa Daraja API Setup

### 1. Register for M-Pesa Daraja API

1. Visit [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
2. Create an account and register your application
3. Get your Consumer Key and Consumer Secret
4. Get your Business Short Code and Passkey

### 2. Sandbox Testing

For testing, use the sandbox environment:
- **Environment**: `sandbox`
- **Base URL**: `https://sandbox.safaricom.co.ke`
- **Business Short Code**: `174379` (for testing)
- **Test Phone Numbers**: Use any valid Kenyan phone number format

### 3. Production Setup

For production:
- **Environment**: `production`
- **Base URL**: `https://api.safaricom.co.ke`
- **Business Short Code**: Your actual business short code
- **Callback URL**: Must be HTTPS and publicly accessible

## API Endpoints

### Initiate STK Push

**POST** `/api/v1/mpesa/stk-push`

```json
{
  "phone_number": "+254712345678",
  "amount": 1000,
  "account_reference": "INV-001",
  "transaction_desc": "Payment for consultation",
  "invoice_id": "uuid-here"
}
```

### M-Pesa Callback

**POST** `/api/v1/mpesa/callback`

This endpoint receives callbacks from Safaricom when payment status changes.

### Get Transaction Status

**GET** `/api/v1/mpesa/transaction/{checkout_request_id}`

### Get Invoice Transactions

**GET** `/api/v1/mpesa/invoice/{invoice_id}/transactions`

## Database Schema

The system uses the following tables for M-Pesa integration:

### mpesa_transactions
- Stores all STK Push transaction details
- Tracks payment status and results
- Links to invoices

### mpesa_callback_logs
- Logs all callback requests for debugging
- Stores raw callback data

### mpesa_config
- Stores M-Pesa configuration settings
- Supports multiple environments

## Testing

### 1. Test Phone Numbers

For sandbox testing, you can use any valid Kenyan phone number:
- `+254712345678`
- `254712345678`
- `0712345678`

### 2. Test Amounts

- Minimum: 1 KES
- Maximum: 70,000 KES (for sandbox)

### 3. Test Flow

1. Create an invoice
2. Initiate STK Push with test phone number
3. Check transaction status
4. Verify callback handling

## Security Considerations

1. **HTTPS Required**: Callback URLs must use HTTPS in production
2. **IP Whitelisting**: Safaricom callbacks come from specific IP ranges
3. **Signature Validation**: Implement callback signature validation
4. **Environment Variables**: Keep credentials secure
5. **Rate Limiting**: Implement rate limiting for API endpoints

## Error Handling

The system handles various M-Pesa errors:

- **Invalid Phone Number**: Returns validation error
- **Insufficient Funds**: Handled via callback
- **Network Errors**: Retry mechanism
- **Invalid Credentials**: Authentication errors

## Monitoring

Monitor the following:

1. **Transaction Success Rate**: Track successful payments
2. **Callback Processing**: Monitor callback handling
3. **Error Rates**: Track and alert on errors
4. **Response Times**: Monitor API performance

## Troubleshooting

### Common Issues

1. **Invalid Phone Number Format**
   - Ensure phone numbers are in correct Kenyan format
   - Use validation function provided

2. **Callback Not Received**
   - Check callback URL is accessible
   - Verify HTTPS configuration
   - Check firewall settings

3. **Authentication Errors**
   - Verify Consumer Key and Secret
   - Check environment configuration
   - Ensure proper base64 encoding

4. **Database Errors**
   - Check database connection
   - Verify table schema
   - Check foreign key constraints

### Debug Mode

Enable debug logging by setting:
```bash
RUST_LOG=debug
```

This will provide detailed logs of M-Pesa API interactions.
