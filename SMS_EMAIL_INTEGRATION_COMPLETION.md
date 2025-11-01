# 📧 SMS & Email Integration - Completion Summary

**Date**: January 2025  
**Status**: ✅ Complete | Ready for Configuration

---

## Overview

SMS and Email notification services have been fully integrated into the backend API. Both services support direct sending and template-based notifications for clinic workflows.

---

## SMS Integration

### Implementation

**Service Provider**: Africa's Talking (configured)

**Routes Added:**
- `POST /api/sms/send` - Send direct SMS
- `POST /api/sms/send-template` - Send template SMS
- `GET /api/sms/balance` - Get SMS account balance

### API Endpoints

#### 1. Send SMS
**POST** `/api/sms/send`

**Request Body:**
```json
{
  "phone_number": "+254712345678",
  "message": "Your appointment is tomorrow at 10:00 AM"
}
```

**Response:**
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "data": {
    "message_id": "ATXid_1234567890",
    "status": "Queued",
    "cost": "KES 1.00",
    "number": "+254712345678"
  }
}
```

#### 2. Send Template SMS
**POST** `/api/sms/send-template`

**Request Body:**
```json
{
  "phone_number": "+254712345678",
  "template_name": "appointment_reminder",
  "variables": {
    "patient_name": "John Doe",
    "appointment_date": "2025-01-20",
    "appointment_time": "10:00 AM",
    "clinician_name": "Dr. Smith"
  }
}
```

**Available Templates:**
- `appointment_reminder` - Appointment reminders
- `prescription_ready` - Prescription ready notifications
- `payment_confirmation` - Payment confirmations
- `queue_notification` - Queue position updates
- `low_stock_alert` - Low stock alerts
- `expiry_alert` - Medicine expiry alerts

#### 3. Get SMS Balance
**GET** `/api/sms/balance`

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 1500.50,
    "currency": "KES"
  }
}
```

### Environment Variables

```bash
# SMS Configuration (Africa's Talking)
SMS_API_KEY=your_africastalking_api_key
SMS_USERNAME=your_africastalking_username
SMS_SENDER_ID=SETHMED  # Optional, defaults to "SETHMED"
SMS_BASE_URL=https://api.africastalking.com/version1  # Optional
```

---

## Email Integration

### Implementation

**Service Provider**: SMTP (Gmail, SendGrid, or custom)

**Routes Added:**
- `POST /api/email/send` - Send direct email
- `POST /api/email/send-template` - Send template email

### API Endpoints

#### 1. Send Email
**POST** `/api/email/send`

**Request Body:**
```json
{
  "to": "patient@example.com",
  "subject": "Appointment Confirmation",
  "html_body": "<h1>Your appointment is confirmed</h1><p>Details...</p>",
  "text_body": "Your appointment is confirmed. Details..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

#### 2. Send Template Email
**POST** `/api/email/send-template`

**Request Body:**
```json
{
  "to": "patient@example.com",
  "template_name": "appointment_reminder",
  "variables": {
    "patient_name": "John Doe",
    "appointment_date": "2025-01-20",
    "appointment_time": "10:00 AM",
    "clinician_name": "Dr. Smith"
  }
}
```

**Available Templates:**
- `appointment_reminder` - HTML appointment reminders
- `prescription_ready` - Prescription ready notifications
- `invoice` - Invoice emails
- `low_stock_alert` - Low stock alerts
- `expiry_alert` - Medicine expiry alerts

### Environment Variables

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com  # or smtp.sendgrid.net, etc.
SMTP_PORT=587  # 587 for TLS, 465 for SSL
SMTP_USERNAME=your_smtp_username
SMTP_PASSWORD=your_smtp_password
SMTP_FROM_EMAIL=noreply@sethmedicalclinic.com  # Optional
SMTP_FROM_NAME=Seth Medical Clinic  # Optional
```

### SMTP Provider Examples

#### Gmail
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Use App Password, not regular password
```

#### SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your_sendgrid_api_key
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

#### Custom SMTP
```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USERNAME=your-username
SMTP_PASSWORD=your-password
```

---

## Template System

Both SMS and Email services support template-based messaging with variable substitution.

### Template Format

Templates use `{{variable_name}}` placeholders that are replaced with actual values.

**Example:**
```
Hi {{patient_name}}, you have an appointment on {{appointment_date}} at {{appointment_time}}.
```

**Variables:**
```json
{
  "patient_name": "John Doe",
  "appointment_date": "2025-01-20",
  "appointment_time": "10:00 AM"
}
```

**Result:**
```
Hi John Doe, you have an appointment on 2025-01-20 at 10:00 AM.
```

---

## Use Cases

### 1. Appointment Reminders

**SMS:**
```typescript
await smsAPI.sendTemplateSMS({
  phone_number: patient.phone,
  template_name: "appointment_reminder",
  variables: {
    patient_name: patient.name,
    appointment_date: appointment.date,
    appointment_time: appointment.time,
    clinician_name: appointment.clinician.name
  }
})
```

**Email:**
```typescript
await emailAPI.sendTemplateEmail({
  to: patient.email,
  template_name: "appointment_reminder",
  variables: {
    patient_name: patient.name,
    appointment_date: appointment.date,
    appointment_time: appointment.time,
    clinician_name: appointment.clinician.name
  }
})
```

### 2. Payment Confirmations

**SMS:**
```typescript
await smsAPI.sendTemplateSMS({
  phone_number: patient.phone,
  template_name: "payment_confirmation",
  variables: {
    patient_name: patient.name,
    invoice_number: invoice.number,
    amount: invoice.total.toString(),
    payment_method: "M-Pesa"
  }
})
```

### 3. Low Stock Alerts

**Email (to admin):**
```typescript
await emailAPI.sendTemplateEmail({
  to: admin.email,
  template_name: "low_stock_alert",
  variables: {
    medicine_name: medicine.name,
    current_stock: medicine.stock.toString(),
    min_stock: medicine.min_stock.toString()
  }
})
```

---

## Frontend Integration

### API Client Functions

Add to `lib/api-client.ts`:

```typescript
// SMS APIs
export const smsAPI = {
  sendSMS: async (data: { phone_number: string; message: string }) => {
    const response = await apiCall('/sms/send', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.data
  },

  sendTemplateSMS: async (data: {
    phone_number: string
    template_name: string
    variables: Record<string, string>
  }) => {
    const response = await apiCall('/sms/send-template', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.data
  },

  getBalance: async () => {
    const response = await apiCall('/sms/balance')
    return response.data
  },
}

// Email APIs
export const emailAPI = {
  sendEmail: async (data: {
    to: string
    subject: string
    html_body: string
    text_body?: string
  }) => {
    const response = await apiCall('/email/send', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.data
  },

  sendTemplateEmail: async (data: {
    to: string
    template_name: string
    variables: Record<string, string>
  }) => {
    const response = await apiCall('/email/send-template', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.data
  },
}
```

---

## Testing

### SMS Testing

1. **Set Environment Variables:**
   ```bash
   SMS_API_KEY=your_test_key
   SMS_USERNAME=your_test_username
   ```

2. **Test Send SMS:**
   ```bash
   curl -X POST http://localhost:8080/api/sms/send \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "phone_number": "+254712345678",
       "message": "Test SMS from clinic system"
     }'
   ```

3. **Test Template SMS:**
   ```bash
   curl -X POST http://localhost:8080/api/sms/send-template \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "phone_number": "+254712345678",
       "template_name": "appointment_reminder",
       "variables": {
         "patient_name": "Test Patient",
         "appointment_date": "2025-01-20",
         "appointment_time": "10:00 AM",
         "clinician_name": "Dr. Test"
       }
     }'
   ```

### Email Testing

1. **Set Environment Variables:**
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   ```

2. **Test Send Email:**
   ```bash
   curl -X POST http://localhost:8080/api/email/send \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "to": "test@example.com",
       "subject": "Test Email",
       "html_body": "<h1>Test</h1><p>This is a test email.</p>",
       "text_body": "Test: This is a test email."
     }'
   ```

---

## Security Considerations

1. ✅ **Authentication**: All endpoints require JWT authentication
2. ✅ **Rate Limiting**: Protected by security middleware
3. ⏳ **Phone Validation**: Phone numbers validated for Kenyan format
4. ⏳ **Email Validation**: Email addresses validated
5. ⏳ **Template Validation**: Template names validated against allowed list

---

## Error Handling

### Common Errors

**SMS Errors:**
- `SMS service not configured` - Missing environment variables
- `Invalid phone number format` - Phone validation failed
- `Template not found` - Invalid template name
- `SMS API Error` - Provider API error

**Email Errors:**
- `Email service not configured` - Missing SMTP credentials
- `Failed to send email` - SMTP connection or send error
- `Template not found` - Invalid template name

---

## Files Modified/Created

1. ✅ `backend/src/simple_handlers.rs` - Added SMS and Email handlers
2. ✅ `backend/src/main.rs` - Added SMS and Email routes
3. ✅ `backend/src/services/sms_service.rs` - Already existed
4. ✅ `backend/src/services/email_service.rs` - Already existed

---

## Next Steps

1. **Configure Credentials:**
   - Get Africa's Talking API credentials for SMS
   - Set up SMTP account (Gmail, SendGrid, or custom)
   - Add environment variables

2. **Test Integration:**
   - Test SMS sending with test phone number
   - Test email sending with test email
   - Test template messaging

3. **Frontend Integration:**
   - Add API client functions (shown above)
   - Integrate with appointment reminders
   - Add notification preferences

4. **Production Setup:**
   - Use production SMS provider credentials
   - Configure production SMTP
   - Monitor sending success rates
   - Set up delivery tracking

---

## Notes

- **SMS Costs**: SMS sending incurs costs per message. Monitor balance regularly.
- **Email Limits**: SMTP providers have daily sending limits. Monitor usage.
- **Template Variables**: Ensure all required variables are provided for templates.
- **Phone Format**: Phone numbers are automatically normalized to +254XXXXXXXXX format.
- **Async Operations**: SMS and Email sending are async and may take time.

---

**Status**: ✅ **SMS and Email integration complete!** Ready for configuration and testing.
