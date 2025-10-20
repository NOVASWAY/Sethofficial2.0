## M-Pesa (Daraja) Configuration

Required environment variables:

- MPESA_SHORT_CODE
- MPESA_PASSKEY
- MPESA_CONSUMER_KEY
- MPESA_CONSUMER_SECRET
- MPESA_ENV (sandbox|production)
- MPESA_STK_CALLBACK_URL
- MPESA_C2B_VALIDATION_URL
- MPESA_C2B_CONFIRMATION_URL
- NEXT_PUBLIC_ADMIN_TOKEN (temporary admin header for UI/API)

Admin UI: `dashboard/admin/settings/mpesa`

API routes:

- GET `/api/admin/settings/mpesa` (header `x-admin-token` required)
- PUT `/api/admin/settings/mpesa` (header `x-admin-token` required)

Notes:

- Secrets are masked in the UI by default. Toggle "Reveal secrets" to edit.
- Backend persistence can migrate to DB (`mpesa_settings` table). Current Next.js route caches in-memory with env fallback.


