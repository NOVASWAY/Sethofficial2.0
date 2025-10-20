# 📱 M-Pesa Daraja API Setup Guide

## 🎯 **Getting Real M-Pesa Credentials**

### **Step 1: Register with Safaricom Developer Portal**

1. **Visit**: https://developer.safaricom.co.ke/
2. **Sign Up**: Create a new account
3. **Verify Email**: Check your email and verify your account
4. **Complete Profile**: Fill in your business details

### **Step 2: Create a New App**

1. **Login** to the developer portal
2. **Click** "Create App"
3. **Fill in**:
   - App Name: `Seth Medical Clinic Management`
   - Description: `Clinic management system with M-Pesa integration`
   - Callback URL: `http://your-domain.com/api/v1/mpesa/callback`
4. **Submit** for approval

### **Step 3: Get Your Credentials**

After approval, you'll receive:
- **Consumer Key**: Your app's public key
- **Consumer Secret**: Your app's private key
- **Business Short Code**: Your M-Pesa business number
- **Passkey**: Your app's passkey

### **Step 4: Update Your Configuration**

Update your `.env` file in the backend:

```bash
# M-Pesa Configuration (Production)
MPESA_ENVIRONMENT=production
MPESA_CONSUMER_KEY=your_actual_consumer_key_here
MPESA_CONSUMER_SECRET=your_actual_consumer_secret_here
MPESA_BUSINESS_SHORT_CODE=your_business_short_code
MPESA_PASSKEY=your_actual_passkey_here
MPESA_CALLBACK_URL=https://your-domain.com/api/v1/mpesa/callback
```

---

## 🧪 **Testing with Sandbox (Current Setup)**

Your system is currently configured with **sandbox credentials** for testing:

```bash
# Current Sandbox Configuration
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY=your_passkey_here
MPESA_CALLBACK_URL=http://localhost:8080/api/v1/mpesa/callback
```

### **Sandbox Testing:**
- **Phone Numbers**: Use test numbers (e.g., 254708374149)
- **Amounts**: Use small amounts for testing
- **Transactions**: All transactions are simulated

---

## 🔧 **M-Pesa Integration Features**

### **✅ Implemented Features:**
1. **STK Push**: Initiate payments from your system
2. **Payment Confirmation**: Receive payment confirmations
3. **Transaction Status**: Check payment status
4. **Webhook Handling**: Process payment callbacks
5. **Invoice Integration**: Link payments to invoices

### **🔄 Payment Flow:**
1. **Patient** enters phone number in billing system
2. **System** initiates STK Push to patient's phone
3. **Patient** enters M-Pesa PIN on their phone
4. **M-Pesa** sends confirmation to your system
5. **System** updates invoice status to "Paid"

---

## 📋 **Required Information for Registration**

### **Business Details:**
- **Business Name**: Seth Medical Clinic
- **Business Type**: Healthcare/Medical Services
- **Registration Number**: [Your business registration]
- **Physical Address**: [Your clinic address]
- **Contact Person**: [Your name]
- **Phone Number**: [Your contact number]
- **Email**: [Your business email]

### **Technical Requirements:**
- **Callback URL**: Must be HTTPS in production
- **Server IP**: Your server's public IP address
- **Domain**: Your production domain name

---

## ⏱️ **Timeline for Approval**

- **Registration**: Immediate
- **App Creation**: 1-2 business days
- **Credential Generation**: 1-2 business days
- **Testing**: 1-2 business days
- **Production Approval**: 3-5 business days

**Total Time**: 1-2 weeks

---

## 💰 **M-Pesa Pricing**

### **Transaction Fees:**
- **STK Push**: KES 0.50 per transaction
- **API Calls**: Free (within limits)
- **Monthly Subscription**: KES 0 (for basic usage)

### **Volume Discounts:**
- **High Volume**: Negotiable rates
- **Enterprise**: Custom pricing

---

## 🚀 **Next Steps After Getting Credentials**

1. **Update Configuration**: Replace sandbox credentials
2. **Test Integration**: Verify payments work
3. **Deploy to Production**: Update callback URLs
4. **Monitor Transactions**: Set up logging
5. **Train Staff**: Show how to use M-Pesa payments

---

## 📞 **Support Contacts**

- **Safaricom Developer Support**: developer@safaricom.co.ke
- **M-Pesa Business Support**: +254 722 000 000
- **Technical Documentation**: https://developer.safaricom.co.ke/docs

---

## ⚠️ **Important Notes**

1. **Keep Credentials Secure**: Never commit to version control
2. **Use HTTPS**: Required for production callbacks
3. **Test Thoroughly**: Always test with sandbox first
4. **Monitor Logs**: Keep track of all transactions
5. **Backup Data**: Regular backups of payment records

---

## 🎉 **Your System is Ready!**

Your clinic management system already has:
- ✅ **M-Pesa Integration Code**: Fully implemented
- ✅ **STK Push Functionality**: Ready to use
- ✅ **Payment Processing**: Complete workflow
- ✅ **Invoice Integration**: Automatic payment linking
- ✅ **Transaction Tracking**: Full audit trail

**Just add your real credentials and you're ready to accept M-Pesa payments!** 📱💳
