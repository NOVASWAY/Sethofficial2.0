// Comprehensive API Client for Clinic Management System
// This file provides a centralized location for all backend API calls

// Type declaration for process.env in client-side Next.js
declare const process: {
  env: {
    NEXT_PUBLIC_API_URL?: string
  }
}

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

// Get authorization header
function getAuthorizationHeader(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    const token = localStorage.getItem('auth_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch (error) {
    console.error('Error getting auth token:', error)
    return {}
  }
}

// Error handling
class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

// Generic API call wrapper
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  const headers = {
    'Content-Type': 'application/json',
    ...getAuthorizationHeader(),
    ...options.headers,
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      // Extract error message from ApiResponse structure or fallback
      const errorMessage = error.error || error.message || `HTTP ${response.status}: ${response.statusText}`
      throw new APIError(
        errorMessage,
        response.status,
        error.code
      )
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T
    }

    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      0
    )
  }
}

// ========================================
// AUTHENTICATION APIs
// ========================================

export const authAPI = {
  /**
   * Login user and get JWT token
   * POST /auth/login
   */
  login: async (username: string, password: string) => {
    const response = await apiCall<{
      success: boolean;
      data: {
        token?: string;
        user: any;
        refresh_token?: string;
        mfa_required?: boolean;
        mfa_session_token?: string;
      };
      message?: string;
      error?: string
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })

    // Check if response has success: false (shouldn't happen if response.ok, but just in case)
    if (!response.success || !response.data) {
      throw new APIError(
        response.error || 'Login failed',
        401,
        'LOGIN_FAILED'
      )
    }

    return response.data
  },

  /**
   * Refresh JWT token
   * POST /auth/refresh
   */
  refreshToken: async () => {
    return apiCall<{ token: string }>('/auth/refresh', {
      method: 'POST',
    })
  },

  /**
   * Logout user
   * POST /auth/logout
   */
  logout: async () => {
    return apiCall('/auth/logout', {
      method: 'POST',
    })
  },

  /**
   * Get current user info
   * GET /auth/me
   */
  getCurrentUser: async () => {
    return apiCall<any>('/auth/me')
  },

  /**
   * Request password reset
   * POST /auth/password-reset/request
   */
  requestPasswordReset: async (email: string) => {
    return apiCall<{ success: boolean; message: string }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  /**
   * Verify password reset token
   * GET /auth/password-reset/verify/{token}
   */
  verifyPasswordResetToken: async (token: string) => {
    return apiCall<{ valid: boolean; reason?: string }>(`/auth/password-reset/verify/${token}`)
  },

  /**
   * Reset password with token
   * POST /auth/password-reset
   */
  resetPassword: async (token: string, newPassword: string) => {
    return apiCall('/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    })
  },

  /**
   * Verify email address
   * GET /auth/verify-email/{token}
   */
  verifyEmail: async (token: string) => {
    return apiCall(`/auth/verify-email/${token}`)
  },

  /**
   * Resend email verification
   * POST /auth/resend-verification
   */
  resendVerification: async (email: string) => {
    return apiCall('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },
}

// ========================================
// MFA/2FA APIs
// ========================================

export const mfaAPI = {
  /**
   * Get user's MFA status
   * GET /mfa/status
   */
  getStatus: async () => {
    return apiCall<{
      success: boolean;
      data: {
        mfa_enabled: boolean;
        mfa_method: string | null;
        totp_secret_configured: boolean;
        phone_number: string | null;
        email_verified: boolean;
        recovery_codes_count: number;
      }
    }>('/mfa/status')
  },

  /**
   * Setup TOTP for user
   * POST /mfa/setup/totp
   */
  setupTotp: async () => {
    return apiCall<{
      success: boolean;
      data: {
        secret: string;
        qr_code_url: string;
        backup_codes: string[];
      };
      message?: string;
    }>('/mfa/setup/totp', {
      method: 'POST',
    })
  },

  /**
   * Verify MFA code and complete login
   * POST /mfa/verify
   */
  verify: async (sessionToken: string, code: string, method: string = 'totp') => {
    return apiCall<{
      success: boolean;
      data: {
        user: any;
        token: string;
        refresh_token: string;
      };
      message?: string;
    }>('/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({
        session_token: sessionToken,
        code,
        method,
      }),
    })
  },

  /**
   * Disable MFA for user
   * DELETE /mfa/disable
   */
  disable: async () => {
    return apiCall('/mfa/disable', {
      method: 'DELETE',
    })
  },

  /**
   * Get MFA session status
   * GET /mfa/session/{token}
   */
  getSession: async (sessionToken: string) => {
    return apiCall<{
      success: boolean;
      data: {
        session_token: string;
        mfa_verified: boolean;
        expires_at: string;
      }
    }>(`/mfa/session/${sessionToken}`)
  },
}

// ========================================
// PATIENT APIs
// ========================================

export const patientAPI = {
  /**
   * Get all patients
   * GET /patients
   */
  getAll: async (params?: { page?: number; per_page?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any[]; message: string; error: any; pagination?: any }>(`/patients${query}`)
    return response
  },

  /**
   * Get patient by ID
   * GET /patients/:id
   */
  getById: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/patients/${id}`)
    return response.data
  },

  /**
   * Search patients
   * GET /patients/search?q=query
   */
  search: async (query: string) => {
    const response = await apiCall<{ success: boolean; data: any[]; message: string; error: any }>(`/patients/search?q=${encodeURIComponent(query)}`)
    return response.data || []
  },

  /**
   * Create new patient
   * POST /patients
   */
  create: async (patientData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    })
    return response.data
  },

  /**
   * Update patient
   * PUT /patients/:id
   */
  update: async (id: string, updates: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return response.data
  },

  /**
   * Delete patient (soft delete)
   * DELETE /patients/:id
   */
  delete: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/patients/${id}`, {
      method: 'DELETE',
    })
    return response.data
  },

  /**
   * Bulk import patients
   * POST /api/patients/import
   */
  bulkImport: async (patients: any[]) => {
    const response = await apiCall<{
      success: boolean
      data: {
        imported: number
        failed: number
        errors: string[]
      }
      message: string
      error?: any
    }>('/patients/import', {
      method: 'POST',
      body: JSON.stringify({ patients }),
    })
    return response.data
  },

  /**
   * Batch import patients with progress tracking
   * POST /api/patients/import/batch
   */
  batchImport: async (patients: any[], batchSize: number = 100) => {
    const response = await apiCall<{
      success: boolean
      data: {
        total_records: number
        total_batches: number
        batch_size: number
        imported: number
        failed: number
        errors: any[]
        batch_results: Array<{
          batch_number: number
          total_batches: number
          start_index: number
          end_index: number
          imported: number
          failed: number
          errors: any[]
        }>
      }
      message?: string
      error?: string
    }>('/patients/import/batch', {
      method: 'POST',
      body: JSON.stringify({
        patients,
        batch_size: batchSize
      }),
    })
    return response.data
  },

  /**
   * Get import history
   * GET /api/patients/import/history
   */
  getImportHistory: async (page: number = 1, perPage: number = 20) => {
    const response = await apiCall<{
      success: boolean
      data: {
        sessions: any[]
        pagination: {
          page: number
          per_page: number
          total: number
          total_pages: number
        }
      }
    }>(`/patients/import/history?page=${page}&per_page=${perPage}`)
    return response.data
  },

  /**
   * Resume failed/interrupted import
   * POST /api/patients/import/resume/{session_id}
   */
  resumeImport: async (sessionId: string, patients: any[]) => {
    const response = await apiCall<{
      success: boolean
      data: {
        session_id: string
        total_records: number
        imported: number
        failed: number
        errors: any[]
        batch_results: any[]
      }
      message: string
    }>(`/patients/import/resume/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ patients }),
    })
    return response.data
  },

  /**
   * Export patients
   * GET /patients/export
   */
  export: async () => {
    return apiCall<Blob>('/patients/export')
  },
}

// ========================================
// CONSULTATION APIs
// ========================================

export const consultationAPI = {
  /**
   * Get all consultations
   * GET /consultations
   */
  getAll: async (params?: { page?: number; per_page?: number; patient_id?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: { data: any[]; page: number; per_page: number; total: number; total_pages: number }; message: string; error: any }>(`/consultations${query}`)
    return response.data
  },

  /**
   * Get consultation by ID
   * GET /consultations/:id
   */
  getById: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/consultations/${id}`)
    return response.data
  },

  /**
   * Get consultations by patient ID
   * GET /consultations?patient_id=:patientId
   */
  getByPatientId: async (patientId: string) => {
    const response = await apiCall<{ success: boolean; data: { data: any[]; page: number; per_page: number; total: number; total_pages: number }; message: string; error: any }>(`/consultations?patient_id=${patientId}`)
    return response.data
  },

  /**
   * Create new consultation
   * POST /consultations
   */
  create: async (consultationData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/consultations', {
      method: 'POST',
      body: JSON.stringify(consultationData),
    })
    return response.data
  },

  /**
   * Update consultation
   * PUT /consultations/:id
   */
  update: async (id: string, updates: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/consultations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return response.data
  },

  /**
   * Delete consultation
   * DELETE /consultations/:id
   */
  delete: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/consultations/${id}`, {
      method: 'DELETE',
    })
    return response.data
  },
}

// ========================================
// PRESCRIPTION APIs
// ========================================

export const prescriptionAPI = {
  /**
   * Get all prescriptions
   * GET /prescriptions
   */
  getAll: async (params?: { page?: number; per_page?: number; patient_id?: string; status?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: { data: any[]; page: number; per_page: number; total: number; total_pages: number }; message: string; error: any }>(`/prescriptions${query}`)
    return response.data
  },

  /**
   * Get prescription by ID
   * GET /prescriptions/:id
   */
  getById: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/prescriptions/${id}`)
    return response.data
  },

  /**
   * Get pending prescriptions
   * GET /prescriptions?status=active
   */
  getPending: async (params?: { page?: number; per_page?: number }) => {
    const queryParams = { status: 'active', ...params }
    const query = `?${new URLSearchParams(queryParams as any).toString()}`
    const response = await apiCall<{ success: boolean; data: { data: any[]; page: number; per_page: number; total: number; total_pages: number }; message: string; error: any }>(`/prescriptions${query}`)
    return response.data
  },

  /**
   * Create prescription
   * POST /prescriptions
   */
  create: async (prescriptionData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/prescriptions', {
      method: 'POST',
      body: JSON.stringify(prescriptionData),
    })
    return response.data
  },

  /**
   * Update prescription
   * PUT /prescriptions/:id
   */
  update: async (id: string, updates: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/prescriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return response.data
  },

  /**
   * Delete prescription
   * DELETE /prescriptions/:id
   */
  delete: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/prescriptions/${id}`, {
      method: 'DELETE',
    })
    return response.data
  },

  /**
   * Mark prescription as dispensed
   * POST /prescriptions/:id/dispense
   */
  markDispensed: async (id: string, dispensingData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/prescriptions/${id}/dispense`, {
      method: 'POST',
      body: JSON.stringify(dispensingData),
    })
    return response.data
  },
}

// ========================================
// PHARMACY/INVENTORY APIs
// ========================================

export const pharmacyAPI = {
  /**
   * Get all medicines
   * GET /medicines
   */
  getMedicines: async (params?: { page?: number; per_page?: number; search?: string; low_stock?: boolean; expiring?: boolean }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: { data: any[]; page: number; per_page: number; total: number; total_pages: number }; message: string; error: any }>(`/medicines${query}`)
    return response.data
  },

  /**
   * Get medicine by ID
   * GET /medicines/:id
   */
  getMedicine: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/medicines/${id}`)
    return response.data
  },

  /**
   * Add new medicine
   * POST /medicines
   */
  addMedicine: async (medicineData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/medicines', {
      method: 'POST',
      body: JSON.stringify(medicineData),
    })
    return response.data
  },

  /**
   * Update medicine
   * PUT /medicines/:id
   */
  updateMedicine: async (id: string, updates: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/medicines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return response.data
  },

  /**
   * Delete medicine
   * DELETE /medicines/:id
   */
  deleteMedicine: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/medicines/${id}`, {
      method: 'DELETE',
    })
    return response.data
  },

  /**
   * Receive new stock
   * POST /medicines/:id/receive
   */
  receiveStock: async (stockData: { medicine_id: string;[key: string]: any }) => {
    const { medicine_id, ...data } = stockData
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/medicines/${medicine_id}/receive`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.data
  },

  /**
   * Get low stock medicines
   * GET /inventory/low-stock
   */
  getLowStock: async (params?: { page?: number; per_page?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/inventory/low-stock${query}`)
    return response.data
  },

  /**
   * Get expiring medicines
   * GET /inventory/expiring
   */
  getExpiring: async (params?: { page?: number; per_page?: number; days?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/inventory/expiring${query}`)
    return response.data
  },

  /**
   * Get stock alerts
   * GET /inventory/alerts
   */
  getStockAlerts: async (params?: { days?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/inventory/alerts${query}`)
    return response.data
  },

  /**
   * Get stock movements
   * GET /inventory/movements
   */
  getStockMovements: async (medicineId: string, params?: { page?: number; per_page?: number }) => {
    const queryParams = { ...params, medicine_id: medicineId }
    const query = `?${new URLSearchParams(queryParams as any).toString()}`
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/inventory/movements${query}`)
    return response.data
  },
}

// Legacy alias for backward compatibility
export const inventoryAPI = pharmacyAPI

// ========================================
// INVOICE/BILLING APIs
// ========================================

export const invoiceAPI = {
  /**
   * Get all invoices
   * GET /invoices
   */
  getAll: async (params?: { page?: number; per_page?: number; patient_id?: string; payment_status?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: { data: any[]; page: number; per_page: number; total: number; total_pages: number }; message: string; error: any }>(`/invoices${query}`)
    return response.data
  },

  /**
   * Get invoice by ID
   * GET /invoices/:id
   */
  getById: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/invoices/${id}`)
    return response.data
  },

  /**
   * Create invoice
   * POST /invoices
   */
  create: async (invoiceData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData),
    })
    return response.data
  },

  /**
   * Update invoice
   * PUT /invoices/:id
   */
  update: async (id: string, updates: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return response.data
  },

  /**
   * Process payment for invoice
   * POST /invoices/:id/pay
   */
  processPayment: async (id: string, paymentData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/invoices/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    })
    return response.data
  },

  /**
   * Get invoice reports
   * GET /invoices/reports
   */
  getReports: async (params?: { date_from?: string; date_to?: string; type?: 'summary' | 'daily' }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/invoices/reports${query}`)
    return response.data
  },

  /**
   * Print invoice
   * GET /invoices/:id/print
   */
  printInvoice: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/invoices/${id}/print`)
    return response.data
  },

  /**
   * Get invoice PDF
   * GET /invoices/:id/pdf
   */
  getPDF: async (id: string) => {
    return apiCall<Blob>(`/invoices/${id}/pdf`)
  },
}

// ========================================
// M-PESA APIs
// ========================================

export const mpesaAPI = {
  /**
   * Initiate STK push
   * POST /mpesa/stk-push
   */
  initiateStkPush: async (stkData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/mpesa/stk-push', {
      method: 'POST',
      body: JSON.stringify(stkData),
    })
    return response.data
  },

  /**
   * Get M-Pesa transaction status
   * GET /mpesa/transaction/:checkoutRequestId
   */
  getTransactionStatus: async (checkoutRequestId: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/mpesa/transaction/${checkoutRequestId}`)
    return response.data
  },

  /**
   * Get invoice M-Pesa transactions
   * GET /mpesa/invoice/:invoiceId/transactions
   */
  getInvoiceTransactions: async (invoiceId: string) => {
    const response = await apiCall<{ success: boolean; data: any[]; message: string; error: any }>(`/mpesa/invoice/${invoiceId}/transactions`)
    return response.data || []
  },
}

// ========================================
// APPOINTMENT APIs
// ========================================

export const appointmentAPI = {
  /**
   * Get all appointments
   * GET /appointments
   */
  getAll: async (params?: { page?: number; per_page?: number; patient_id?: string; doctor_id?: string; date?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: { data: any[]; page: number; per_page: number; total: number; total_pages: number }; message: string; error: any }>(`/appointments${query}`)
    return response.data
  },

  /**
   * Get appointments by date
   * GET /appointments/date/:date
   */
  getByDate: async (date: string) => {
    const response = await apiCall<{ success: boolean; data: any[]; message: string; error: any }>(`/appointments/date/${date}`)
    return response.data || []
  },

  /**
   * Get appointment by ID
   * GET /appointments/:id
   */
  getById: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/appointments/${id}`)
    return response.data
  },

  /**
   * Create appointment
   * POST /appointments
   */
  create: async (appointmentData: any) => {
    return apiCall<any>('/appointments', {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    })
  },

  /**
   * Update appointment
   * PUT /appointments/:id
   */
  update: async (id: string, updates: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return response.data
  },

  /**
   * Cancel appointment
   * POST /appointments/:id/cancel
   */
  cancel: async (id: string, reason: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/appointments/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
    return response.data
  },

  /**
   * Delete appointment
   * DELETE /appointments/:id
   */
  delete: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/appointments/${id}`, {
      method: 'DELETE',
    })
    return response.data
  },
}

// ========================================
// SHA CLAIMS APIs
// ========================================

export const shaClaimAPI = {
  /**
   * Get all SHA claims
   * GET /sha-claims
   */
  getAll: async () => {
    return apiCall<any[]>('/sha-claims')
  },

  /**
   * Get claim by ID
   * GET /sha-claims/:id
   */
  getById: async (id: string) => {
    return apiCall<any>(`/sha-claims/${id}`)
  },

  /**
   * Record new claim
   * POST /api/sha-claims
   */
  create: async (claimData: any) => {
    const response = await apiCall<{
      success: boolean
      data: any
      message?: string
      error?: string
    }>('/sha-claims', {
      method: 'POST',
      body: JSON.stringify(claimData),
    })
    return response
  },

  /**
   * Update claim status
   * PUT /sha-claims/:id
   */
  update: async (id: string, updates: any) => {
    return apiCall<any>(`/sha-claims/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  },

  /**
   * Export claim report
   * GET /sha-claims/:id/export
   */
  export: async (id: string) => {
    return apiCall<Blob>(`/sha-claims/${id}/export`)
  },

  /**
   * Get monthly summary
   * GET /sha-claims/monthly/:year/:month
   */
  getMonthlySummary: async (year: number, month: number) => {
    return apiCall<any>(`/sha-claims/monthly/${year}/${month}`)
  },
}

// ========================================
// REPORTS APIs
// ========================================

export const reportsAPI = {
  /**
   * Get financial reports
   * GET /reports/financial
   */
  getFinancial: async (params?: { date_from?: string; date_to?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/reports/financial${query}`)
    return response.data
  },

  /**
   * Get SHA claims report
   * GET /reports/sha-claims
   */
  getShaClaims: async (params?: { page?: number; per_page?: number; status?: string; date_from?: string; date_to?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/reports/sha-claims${query}`)
    return response.data
  },

  /**
   * Get audit logs report
   * GET /reports/audit
   */
  getAudit: async (params?: { page?: number; per_page?: number; user_id?: string; action?: string; date_from?: string; date_to?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/reports/audit${query}`)
    return response.data
  },

  /**
   * Get dashboard report
   * GET /reports/dashboard
   */
  getDashboard: async () => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/reports/dashboard')
    return response.data
  },

  /**
   * Get inventory reports
   * GET /inventory/reconciliation
   */
  getInventory: async (params?: { date_from?: string; date_to?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/inventory/reconciliation${query}`)
    return response.data
  },

  /**
   * Export report (future enhancement)
   * GET /reports/export
   */
  export: async (reportType: string, params: any) => {
    const query = new URLSearchParams(params).toString()
    return apiCall<Blob>(`/reports/export/${reportType}?${query}`)
  },
}

// ========================================
// NOTES APIs (User Notes System)
// ========================================

export const notesAPI = {
  /**
   * Get all notes for a resource
   * GET /notes?resource_type=patient&resource_id=uuid
   */
  getNotes: async (resourceType: string, resourceId: string) => {
    const query = `?resource_type=${encodeURIComponent(resourceType)}&resource_id=${encodeURIComponent(resourceId)}`
    const response = await apiCall<{ success: boolean; data: any[]; message: string; error: any }>(`/notes${query}`)
    // Extract the data array from ApiResponse
    if (response && response.success && response.data) {
      return Array.isArray(response.data) ? response.data : []
    }
    return []
  },

  /**
   * Create a new note
   * POST /notes
   */
  create: async (noteData: {
    resource_type: string
    resource_id: string
    content: string
    is_important?: boolean
    is_urgent?: boolean
    is_private?: boolean
    tags?: string[]
    metadata?: any
  }) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/notes', {
      method: 'POST',
      body: JSON.stringify(noteData),
    })
    return response
  },

  /**
   * Update a note
   * PUT /notes/:id
   */
  update: async (id: string, updates: {
    content?: string
    is_important?: boolean
    is_urgent?: boolean
    is_private?: boolean
    tags?: string[]
    metadata?: any
  }) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return response
  },

  /**
   * Delete a note
   * DELETE /notes/:id
   */
  delete: async (id: string) => {
    const response = await apiCall<{ success: boolean; message: string; error: any }>(`/notes/${id}`, {
      method: 'DELETE',
    })
    return response
  },
}

// ========================================
// USER MANAGEMENT APIs (Admin only)
// ========================================

export const userAPI = {
  /**
   * Get all users
   * GET /users
   */
  getAll: async () => {
    return apiCall<any[]>('/users')
  },

  /**
   * Get user by ID
   * GET /users/:id
   */
  getById: async (id: string) => {
    return apiCall<any>(`/users/${id}`)
  },

  /**
   * Create user
   * POST /users
   */
  create: async (userData: any) => {
    return apiCall<any>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  },

  /**
   * Update user
   * PUT /users/:id
   */
  update: async (id: string, updates: any) => {
    return apiCall<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  },

  /**
   * Delete user
   * DELETE /users/:id
   */
  delete: async (id: string) => {
    return apiCall(`/users/${id}`, {
      method: 'DELETE',
    })
  },

  /**
   * Change password
   * POST /users/:id/password
   */
  changePassword: async (id: string, oldPassword: string, newPassword: string) => {
    return apiCall<any>(`/users/${id}/password`, {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    })
  },
}

// ========================================
// FINANCIAL REPORTING APIs
// ========================================

export const financialAPI = {
  /**
   * Get financial summary
   * GET /financial/summary
   */
  getSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    return apiCall<any>(`/financial/summary${query}`)
  },

  /**
   * Get profit and loss report
   * GET /financial/profit-loss
   */
  getProfitLoss: async (params?: { startDate?: string; endDate?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    return apiCall<any>(`/financial/profit-loss${query}`)
  },

  /**
   * Get revenue analytics
   * GET /financial/revenue-analytics
   */
  getRevenueAnalytics: async (params?: { startDate?: string; endDate?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    return apiCall<any>(`/financial/revenue-analytics${query}`)
  },

  /**
   * Get expense report
   * GET /financial/expense-report
   */
  getExpenseReport: async (params?: { startDate?: string; endDate?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    return apiCall<any>(`/financial/expense-report${query}`)
  },

  /**
   * Get financial KPIs
   * GET /financial/kpis
   */
  getKPIs: async () => {
    return apiCall<any>('/financial/kpis')
  },
}

// ========================================
// SERVICE CATALOG APIs
// ========================================

export const serviceCatalogAPI = {
  /**
   * Get all services
   * GET /services
   */
  getAll: async () => {
    const response = await apiCall<{ success: boolean; data: { services: any[] }; message: string; error: any }>('/services')
    return response.data?.services || []
  },

  /**
   * Get services by category
   * GET /services/category/:category
   */
  getByCategory: async (category: string) => {
    const response = await apiCall<{ success: boolean; data: { services: any[] }; message: string; error: any }>(`/services/category/${category}`)
    return response.data?.services || []
  },

  /**
   * Calculate pricing for a service
   * POST /services/pricing
   */
  calculatePricing: async (serviceId: string, insuranceType: string, patientType: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/services/pricing', {
      method: 'POST',
      body: JSON.stringify({
        service_id: serviceId,
        insurance_type: insuranceType,
        patient_type: patientType,
      }),
    })
    return response.data
  },

  /**
   * Get all services for admin management
   * GET /admin/services
   */
  getAllForAdmin: async () => {
    const response = await apiCall<{ success: boolean; data: { services: any[] }; message: string; error: any }>('/admin/services')
    // Backend returns { success: true, data: { services: [...] } }
    return response.data?.services || []
  },

  /**
   * Update service prices (admin only)
   * PUT /admin/services/:id/prices
   */
  updatePrices: async (serviceId: string, cashPrice: number, nhifPrice?: number, shaPrice?: number) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/admin/services/${serviceId}/prices`, {
      method: 'PUT',
      body: JSON.stringify({
        cash_price: cashPrice,
        nhif_price: nhifPrice,
        sha_price: shaPrice,
      }),
    })
    return response
  },

  /**
   * Create new service (admin only)
   * POST /admin/services
   */
  create: async (serviceData: {
    service_code: string
    service_name: string
    category: string
    description?: string
    unit_price: number
    cash_price?: number
    nhif_price?: number
    sha_price?: number
    sha_approved?: boolean
    requires_prescription?: boolean
  }) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/admin/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    })
    return response
  },
}

// ========================================
// WORKFLOW APIs
// ========================================

export const workflowAPI = {
  /**
   * Create new workflow
   * POST /workflow/create
   */
  create: async (patientId: string, workflowType: string, assignedTo: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/workflow/create', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: patientId,
        workflow_type: workflowType,
        assigned_to: assignedTo,
      }),
    })
    return response.data
  },

  /**
   * Get tasks for a specific role
   * GET /workflow/tasks/:role
   */
  getTasksForRole: async (role: string) => {
    const response = await apiCall<{ success: boolean; data: { role: string; tasks: any[] }; message: string; error: any }>(`/workflow/tasks/${role}`)
    return response.data
  },
}

// ========================================
// AUTOMATED BILLING APIs
// ========================================

export const billingAPI = {
  /**
   * Create automated bill
   * POST /billing/auto-create
   */
  createAutoBill: async (patientId: string, services: string[], insuranceType: string, patientType: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/billing/auto-create', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: patientId,
        services: services,
        insurance_type: insuranceType,
        patient_type: patientType,
      }),
    })
    return response.data
  },
}

// ========================================
// AUDIT LOG APIs
// ========================================

export const auditAPI = {
  /**
   * Get audit logs
   * GET /audit-logs
   */
  getAll: async (params?: { module?: string; userId?: string; startDate?: string; endDate?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    return apiCall<any[]>(`/audit-logs${query}`)
  },

  /**
   * Create audit log entry
   * POST /audit-logs
   */
  create: async (logData: any) => {
    return apiCall<any>('/audit-logs', {
      method: 'POST',
      body: JSON.stringify(logData),
    })
  },
}

// ========================================
// ENHANCED DASHBOARD APIs
// ========================================

export const dashboardAPI = {
  /**
   * Get user-specific dashboard metrics
   * GET /dashboard/user/:userId/metrics
   */
  getUserMetrics: async (userId: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/dashboard/metrics/user/${userId}`)
    return response.data
  },

  /**
   * Get role-based dashboard metrics
   * GET /dashboard/metrics/role/:role
   */
  getRoleMetrics: async (role: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/dashboard/metrics/role/${role}`)
    return response.data
  },

  /**
   * Get department-based dashboard metrics
   * GET /dashboard/metrics/department/:department
   */
  getDepartmentMetrics: async (department: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/dashboard/metrics/department/${department}`)
    return response.data
  },

  /**
   * Get system health metrics
   * GET /dashboard/health
   */
  getSystemHealth: async () => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/dashboard/health')
    return response.data
  },
}

// ========================================
// USER PREFERENCES APIs
// ========================================

export const userPreferencesAPI = {
  /**
   * Get user preferences
   * GET /user/:userId/preferences
   */
  get: async (userId: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/user-preferences/${userId}`)
    return response.data
  },

  /**
   * Update user preferences
   * PUT /user-preferences/:userId
   */
  update: async (userId: string, preferences: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/user-preferences/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    })
    return response.data
  },

  /**
   * Reset user preferences to default
   * POST /user-preferences/:userId/reset
   */
  reset: async (userId: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/user-preferences/${userId}/reset`, {
      method: 'POST',
    })
    return response.data
  },

  /**
   * Get role preference template
   * GET /user-preferences/role/:role/template
   */
  getTemplate: async (role: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/user-preferences/role/${role}/template`)
    return response.data
  },
}

// ========================================
// ACTIVITY LOG APIs
// ========================================

export const activityLogAPI = {
  /**
   * Log user activity
   * POST /activity/log
   */
  log: async (activityData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/activity/log', {
      method: 'POST',
      body: JSON.stringify(activityData),
    })
    return response.data
  },

  /**
   * Get user activity
   * GET /activity/user/:userId
   */
  getUserActivity: async (userId: string, params?: { page?: number; limit?: number; action?: string; module?: string; entity_type?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/activity/user/${userId}${query}`)
    return response.data
  },

  /**
   * Get recent activities
   * GET /activity/recent
   */
  getRecent: async (params?: { limit?: number; days?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/activity/recent${query}`)
    return response.data
  },

  /**
   * Get activity statistics
   * GET /activity/statistics
   */
  getStats: async (params?: { days?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/activity/statistics${query}`)
    return response.data
  },
}

// ========================================
// DATA ISOLATION APIs
// ========================================

export const dataIsolationAPI = {
  /**
   * Get filtered patients based on user permissions
   * GET /patients/filtered
   */
  getFilteredPatients: async (params?: { page?: number; limit?: number; search?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/patients/filtered${query}`)
    return response.data
  },

  /**
   * Get filtered consultations based on user permissions
   * GET /consultations/filtered
   */
  getFilteredConsultations: async (params?: { page?: number; limit?: number; patient_id?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/consultations/filtered${query}`)
    return response.data
  },

  /**
   * Get filtered prescriptions based on user permissions
   * GET /prescriptions/filtered
   */
  getFilteredPrescriptions: async (params?: { page?: number; limit?: number; patient_id?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/prescriptions/filtered${query}`)
    return response.data
  },

  /**
   * Get filtered invoices based on user permissions
   * GET /invoices/filtered
   */
  getFilteredInvoices: async (params?: { page?: number; limit?: number; patient_id?: string; payment_status?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/invoices/filtered${query}`)
    return response.data
  },

  /**
   * Validate data access permissions
   * POST /permissions/validate
   */
  validateAccess: async (accessData: { entity_type: string; entity_id: string; action: string }) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/permissions/validate', {
      method: 'POST',
      body: JSON.stringify(accessData),
    })
    return response.data
  },
}

// ========================================
// LAB TEST APIs
// ========================================

// Lab Test Order Types
export interface LabTestOrder {
  id: string
  order_number: string
  patient_id: string
  consultation_id?: string
  ordering_clinician_id: string
  test_type: string
  test_code?: string
  test_name: string
  priority: 'routine' | 'urgent' | 'stat'
  clinical_indication?: string
  sample_type?: string
  sample_collection_date?: string
  status: 'pending' | 'collected' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string
  ordered_at: string
  collected_at?: string
  completed_at?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateLabTestOrder {
  patient_id: string
  consultation_id?: string
  ordering_clinician_id: string
  test_type: string
  test_code?: string
  test_name: string
  priority?: 'routine' | 'urgent' | 'stat'
  clinical_indication?: string
  sample_type?: string
  notes?: string
}

export interface UpdateLabTestOrder {
  status?: string
  sample_collection_date?: string
  collected_at?: string
  completed_at?: string
  notes?: string
}

// Lab Test Result Types
export interface LabTestResult {
  id: string
  order_id: string
  patient_name?: string
  result_number: string
  test_type: string
  test_code?: string
  test_name: string
  test_values: Record<string, any>
  reference_ranges?: Record<string, any>
  abnormal_flags?: Record<string, any>
  result_date: string
  verified_by?: string
  verified_at?: string
  reviewed_by?: string
  reviewed_at?: string
  notes?: string
  attachments?: string[]
  status: 'pending' | 'verified' | 'reviewed' | 'cancelled'
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateLabTestResult {
  order_id: string
  test_type: string
  test_code?: string
  test_name: string
  test_values: Record<string, any>
  reference_ranges?: Record<string, any>
  abnormal_flags?: Record<string, any>
  notes?: string
  attachments?: string[]
}

export interface UpdateLabTestResult {
  test_values?: Record<string, any>
  reference_ranges?: Record<string, any>
  abnormal_flags?: Record<string, any>
  notes?: string
  attachments?: string[]
  status?: string
}

export const labAPI = {
  /**
   * Create lab test order
   * POST /lab/orders
   */
  createOrder: async (orderData: CreateLabTestOrder) => {
    const response = await apiCall<{ success: boolean; data: LabTestOrder; message?: string; error?: string }>('/lab/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    })
    return response.data
  },

  /**
   * Get all lab test orders
   * GET /lab/orders
   */
  getOrders: async (params?: { patient_id?: string; status?: string; test_type?: string; priority?: string; limit?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: LabTestOrder[]; message?: string; error?: string }>(`/lab/orders${query}`)
    return response.data
  },

  /**
   * Get specific lab test order
   * GET /lab/orders/:id
   */
  getOrder: async (orderId: string) => {
    const response = await apiCall<{ success: boolean; data: LabTestOrder; message?: string; error?: string }>(`/lab/orders/${orderId}`)
    return response.data
  },

  /**
   * Update lab test order
   * PUT /lab/orders/:id
   */
  updateOrder: async (orderId: string, updateData: UpdateLabTestOrder) => {
    const response = await apiCall<{ success: boolean; data: LabTestOrder; message?: string; error?: string }>(`/lab/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    })
    return response.data
  },

  /**
   * Get pending lab test orders (for lab technician queue)
   * GET /lab/orders/pending
   */
  getPendingOrders: async (params?: { priority?: string; test_type?: string; limit?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: LabTestOrder[]; message?: string; error?: string }>(`/lab/orders/pending${query}`)
    return response.data
  },

  /**
   * Cancel lab test order
   * DELETE /lab/orders/:id
   */
  cancelOrder: async (orderId: string) => {
    const response = await apiCall<{ success: boolean; data?: any; message?: string; error?: string }>(`/lab/orders/${orderId}`, {
      method: 'DELETE',
    })
    return response
  },

  /**
   * Create lab test result
   * POST /lab/results
   */
  createResult: async (resultData: CreateLabTestResult) => {
    const response = await apiCall<{ success: boolean; data: LabTestResult; message?: string; error?: string }>('/lab/results', {
      method: 'POST',
      body: JSON.stringify(resultData),
    })
    return response.data
  },

  /**
   * Get all lab test results
   * GET /lab/results
   */
  getResults: async (params?: { order_id?: string; patient_id?: string; status?: string; test_type?: string; limit?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: LabTestResult[]; message?: string; error?: string }>(`/lab/results${query}`)
    return response.data
  },

  /**
   * Get specific lab test result
   * GET /lab/results/:id
   */
  getResult: async (resultId: string) => {
    const response = await apiCall<{ success: boolean; data: LabTestResult; message?: string; error?: string }>(`/lab/results/${resultId}`)
    return response.data
  },

  /**
   * Update lab test result
   * PUT /lab/results/:id
   */
  updateResult: async (resultId: string, updateData: UpdateLabTestResult) => {
    const response = await apiCall<{ success: boolean; data: LabTestResult; message?: string; error?: string }>(`/lab/results/${resultId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    })
    return response.data
  },

  /**
   * Get patient's lab test results
   * GET /lab/results/patient/:patient_id
   */
  getPatientResults: async (patientId: string) => {
    const response = await apiCall<{ success: boolean; data: LabTestResult[]; message?: string; error?: string }>(`/lab/results/patient/${patientId}`)
    return response.data
  },

  /**
   * Get results for specific order
   * GET /lab/results/order/:order_id
   */
  getOrderResults: async (orderId: string) => {
    const response = await apiCall<{ success: boolean; data: LabTestResult[]; message?: string; error?: string }>(`/lab/results/order/${orderId}`)
    return response.data
  },

  /**
   * Verify lab test result (by lab technician)
   * POST /lab/results/:id/verify
   */
  verifyResult: async (resultId: string) => {
    const response = await apiCall<{ success: boolean; data: LabTestResult; message?: string; error?: string }>(`/lab/results/${resultId}/verify`, {
      method: 'POST',
    })
    return response.data
  },

  /**
   * Review lab test result (by clinician)
   * POST /lab/results/:id/review
   */
  reviewResult: async (resultId: string) => {
    const response = await apiCall<{ success: boolean; data: LabTestResult; message?: string; error?: string }>(`/lab/results/${resultId}/review`, {
      method: 'POST',
    })
    return response.data
  },
}

// ========================================
// ENHANCED VALIDATION APIs
// ========================================

export const validationAPI = {
  /**
   * Validate patient data
   * POST /validation/patient
   */
  validatePatient: async (patientData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/validation/patient', {
      method: 'POST',
      body: JSON.stringify(patientData),
    })
    return response.data
  },

  /**
   * Validate user data
   * POST /validation/user
   */
  validateUser: async (userData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/validation/user', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
    return response.data
  },

  /**
   * Check for duplicate patient
   * POST /validation/duplicate/patient
   */
  checkDuplicatePatient: async (patientData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/validation/duplicate/patient', {
      method: 'POST',
      body: JSON.stringify(patientData),
    })
    return response.data
  },

  /**
   * Check for duplicate user
   * POST /validation/duplicate/user
   */
  checkDuplicateUser: async (userData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/validation/duplicate/user', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
    return response.data
  },

  /**
   * Validate business rules
   * POST /validation/business-rules
   */
  validateBusinessRules: async (ruleData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/validation/business-rules', {
      method: 'POST',
      body: JSON.stringify(ruleData),
    })
    return response.data
  },
}

// ========================================
// FILE UPLOAD APIs
// ========================================

export const uploadAPI = {
  /**
   * Upload avatar image
   * POST /upload/avatar
   */
  uploadAvatar: async (file: File, userId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('user_id', userId)

    const response = await fetch(`${API_BASE_URL}/upload/avatar`, {
      method: 'POST',
      headers: getAuthorizationHeader(),
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new APIError(error.error || error.message || 'Upload failed', response.status)
    }

    return await response.json()
  },

  /**
   * Upload document
   * POST /upload/document
   */
  uploadDocument: async (file: File, metadata: { entity_type: string; entity_id: string; document_type?: string }) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('entity_type', metadata.entity_type)
    formData.append('entity_id', metadata.entity_id)
    if (metadata.document_type) {
      formData.append('document_type', metadata.document_type)
    }

    const response = await fetch(`${API_BASE_URL}/upload/document`, {
      method: 'POST',
      headers: getAuthorizationHeader(),
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new APIError(error.error || error.message || 'Upload failed', response.status)
    }

    return await response.json()
  },

  /**
   * Get file by ID
   * GET /upload/files/:file_id
   */
  getFile: async (fileId: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/upload/files/${fileId}`)
    return response.data
  },

  /**
   * Get files list
   * GET /upload/files
   */
  getFiles: async (params?: { entity_type?: string; entity_id?: string; limit?: number; offset?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/upload/files${query}`)
    return response.data
  },
}

// ========================================
// BACKUP APIs (Admin only)
// ========================================

export const backupAPI = {
  /**
   * Create backup
   * POST /admin/backup
   */
  create: async () => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/admin/backup', {
      method: 'POST',
    })
    return response.data
  },

  /**
   * List backups
   * GET /admin/backups
   */
  list: async () => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/admin/backups')
    return response.data
  },

  /**
   * Get backup statistics
   * GET /admin/backup/stats
   */
  getStats: async () => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/admin/backup/stats')
    return response.data
  },

  /**
   * Get backup details
   * GET /admin/backup/:backup_id
   */
  get: async (backupId: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/admin/backup/${backupId}`)
    return response.data
  },
}

// ========================================
// MONITORING APIs
// ========================================

export const monitoringAPI = {
  /**
   * Create log entry
   * POST /monitoring/log
   */
  createLog: async (logData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/monitoring/log', {
      method: 'POST',
      body: JSON.stringify(logData),
    })
    return response.data
  },

  /**
   * Get system health
   * GET /monitoring/health
   */
  getHealth: async () => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/monitoring/health')
    return response.data
  },

  /**
   * Get log statistics
   * GET /monitoring/logs/statistics
   */
  getLogStats: async (params?: { days?: number; level?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/monitoring/logs/statistics${query}`)
    return response.data
  },

  /**
   * Get recent alerts
   * GET /monitoring/alerts/recent
   */
  getRecentAlerts: async (params?: { limit?: number; severity?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/monitoring/alerts/recent${query}`)
    return response.data
  },
}

// Create API client instance
export const apiClient = {
  setToken: (token: string) => {
    localStorage.setItem('auth_token', token)
  },
  clearToken: () => {
    localStorage.removeItem('auth_token')
  },
  getToken: () => {
    return localStorage.getItem('auth_token')
  },
  get: <T>(endpoint: string, options?: RequestInit) => apiCall<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, data?: any, options?: RequestInit) => apiCall<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data?: any, options?: RequestInit) => apiCall<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string, options?: RequestInit) => apiCall<T>(endpoint, { ...options, method: 'DELETE' }),
}

// Export all APIs
// ========================================
// INTERNAL NOTIFICATIONS APIs
// ========================================

export interface InternalNotification {
  id: string
  recipient_id?: string
  template: string
  subject?: string
  content: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: string
  is_read: boolean
  read_at?: string
  action_url?: string
  action_label?: string
  metadata?: any
  created_at: string
  created_by?: string
}

export const notificationsAPI = {
  /**
   * Get all notifications for the current user
   * GET /notifications?unread_only=false&limit=50
   */
  getAll: async (options?: { unreadOnly?: boolean; limit?: number }) => {
    const params = new URLSearchParams()
    if (options?.unreadOnly) params.append('unread_only', 'true')
    if (options?.limit) params.append('limit', options.limit.toString())

    const queryString = params.toString()
    const endpoint = `/notifications${queryString ? `?${queryString}` : ''}`

    const response = await apiCall<{ success: boolean; data: InternalNotification[]; message?: string; error?: string }>(endpoint)
    return response.data || []
  },

  /**
   * Get unread notification count
   * GET /notifications/unread-count
   */
  getUnreadCount: async () => {
    const response = await apiCall<{ success: boolean; data: { count: number }; message?: string; error?: string }>('/notifications/unread-count')
    return response.data?.count || 0
  },

  /**
   * Mark a notification as read
   * POST /notifications/:id/read
   */
  markAsRead: async (notificationId: string) => {
    const response = await apiCall<{ success: boolean; data?: any; message?: string; error?: string }>(`/notifications/${notificationId}/read`, {
      method: 'POST',
    })
    return response
  },

  /**
   * Mark all notifications as read
   * POST /notifications/read-all
   */
  markAllAsRead: async () => {
    const response = await apiCall<{ success: boolean; data?: { updated_count: number }; message?: string; error?: string }>('/notifications/read-all', {
      method: 'POST',
    })
    return response
  },

  /**
   * Create a new internal notification
   * POST /notifications
   */
  create: async (notificationData: {
    recipient_id: string
    content: string
    template?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    subject?: string
    action_url?: string
    action_label?: string
    metadata?: any
  }) => {
    const response = await apiCall<{ success: boolean; data: InternalNotification; message?: string; error?: string }>('/notifications', {
      method: 'POST',
      body: JSON.stringify(notificationData),
    })
    return response
  },
}

// ========================================
// TASK ASSIGNMENT APIs
// ========================================

export interface Task {
  id: string
  task_type: 'patient_consultation' | 'lab_test_review' | 'prescription_dispense' | 'follow_up' | 'documentation' | 'billing' | 'appointment' | 'custom'
  title: string
  description?: string
  assigned_to?: string
  assigned_by?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  due_date?: string
  completed_at?: string
  cancelled_at?: string
  patient_id?: string
  consultation_id?: string
  prescription_id?: string
  lab_order_id?: string
  invoice_id?: string
  appointment_id?: string
  metadata?: any
  tags?: string[]
  created_at: string
  updated_at: string
  assignee_name?: string
  assignee_role?: string
  assigner_name?: string
  assigner_role?: string
}

export const tasksAPI = {
  /**
   * Get all tasks
   * GET /tasks?assigned_to_me=true&status=pending&priority=high&task_type=consultation&limit=50
   */
  getAll: async (options?: {
    assignedToMe?: boolean
    status?: string
    priority?: string
    taskType?: string
    limit?: number
  }) => {
    const params = new URLSearchParams()
    if (options?.assignedToMe !== undefined) params.append('assigned_to_me', options.assignedToMe.toString())
    if (options?.status) params.append('status', options.status)
    if (options?.priority) params.append('priority', options.priority)
    if (options?.taskType) params.append('task_type', options.taskType)
    if (options?.limit) params.append('limit', options.limit.toString())

    const queryString = params.toString()
    const endpoint = `/tasks${queryString ? `?${queryString}` : ''}`

    const response = await apiCall<{ success: boolean; data: Task[]; message?: string; error?: string }>(endpoint)
    return response.data || []
  },

  /**
   * Get a single task by ID
   * GET /tasks/:id
   */
  getById: async (id: string) => {
    const response = await apiCall<{ success: boolean; data: Task; message?: string; error?: string }>(`/tasks/${id}`)
    return response.data
  },

  /**
   * Create a new task
   * POST /tasks
   */
  create: async (taskData: {
    task_type: string
    title: string
    description?: string
    assigned_to: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    due_date?: string
    patient_id?: string
    consultation_id?: string
    prescription_id?: string
    lab_order_id?: string
    invoice_id?: string
    appointment_id?: string
    tags?: string[]
    metadata?: any
  }) => {
    const response = await apiCall<{ success: boolean; data: Task; message?: string; error?: string }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    })
    return response
  },

  /**
   * Update a task
   * PUT /tasks/:id
   */
  update: async (id: string, updates: {
    title?: string
    description?: string
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    due_date?: string
    assigned_to?: string
  }) => {
    const response = await apiCall<{ success: boolean; data: Task; message?: string; error?: string }>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return response
  },

  /**
   * Delete a task
   * DELETE /tasks/:id
   */
  delete: async (id: string) => {
    const response = await apiCall<{ success: boolean; message?: string; error?: string }>(`/tasks/${id}`, {
      method: 'DELETE',
    })
    return response
  },
}

// ========================================
// ANNOUNCEMENTS APIs
// ========================================

export interface Announcement {
  id: string
  title: string
  content: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'draft' | 'published' | 'archived' | 'cancelled'
  scope: 'system' | 'department' | 'role' | 'custom'
  target_departments?: string[]
  target_roles?: string[]
  target_user_ids?: string[]
  published_at?: string
  expires_at?: string
  is_pinned: boolean
  requires_acknowledgment: boolean
  allow_comments: boolean
  tags?: string[]
  metadata?: any
  created_by: string
  created_at: string
  updated_at: string
  creator_name?: string
  creator_role?: string
  is_acknowledged?: boolean
  acknowledged_at?: string
}

export const announcementsAPI = {
  /**
   * Get announcements visible to the current user
   * GET /announcements?include_acknowledged=false&limit=50
   */
  getAll: async (options?: { includeAcknowledged?: boolean; limit?: number }) => {
    const params = new URLSearchParams()
    if (options?.includeAcknowledged) params.append('include_acknowledged', 'true')
    if (options?.limit) params.append('limit', options.limit.toString())

    const queryString = params.toString()
    const endpoint = `/announcements${queryString ? `?${queryString}` : ''}`

    const response = await apiCall<{ success: boolean; data: Announcement[]; message?: string; error?: string }>(endpoint)
    return response.data || []
  },

  /**
   * Get unread announcements count
   * GET /announcements/unread-count
   */
  getUnreadCount: async () => {
    const response = await apiCall<{ success: boolean; data: { count: number }; message?: string; error?: string }>('/announcements/unread-count')
    return response.data?.count || 0
  },

  /**
   * Create a new announcement (admin/manager only)
   * POST /announcements
   */
  create: async (announcementData: {
    title: string
    content: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    status?: 'draft' | 'published' | 'archived' | 'cancelled'
    scope?: 'system' | 'department' | 'role' | 'custom'
    target_departments?: string[]
    target_roles?: string[]
    target_user_ids?: string[]
    published_at?: string
    expires_at?: string
    is_pinned?: boolean
    requires_acknowledgment?: boolean
    allow_comments?: boolean
    tags?: string[]
    metadata?: any
  }) => {
    const response = await apiCall<{ success: boolean; data: Announcement; message?: string; error?: string }>('/announcements', {
      method: 'POST',
      body: JSON.stringify(announcementData),
    })
    return response
  },

  /**
   * Acknowledge an announcement
   * POST /announcements/:id/acknowledge
   */
  acknowledge: async (announcementId: string) => {
    const response = await apiCall<{ success: boolean; data?: any; message?: string; error?: string }>(`/announcements/${announcementId}/acknowledge`, {
      method: 'POST',
    })
    return response
  },
}

export default {
  auth: authAPI,
  patient: patientAPI,
  consultation: consultationAPI,
  prescription: prescriptionAPI,
  pharmacy: pharmacyAPI,
  inventory: inventoryAPI, // Legacy alias
  invoice: invoiceAPI,
  mpesa: mpesaAPI,
  appointment: appointmentAPI,
  shaClaim: shaClaimAPI,
  notes: notesAPI,
  notifications: notificationsAPI,
  tasks: tasksAPI,
  announcements: announcementsAPI,
  reports: reportsAPI,
  user: userAPI,
  audit: auditAPI,
  financial: financialAPI,
  serviceCatalog: serviceCatalogAPI,
  workflow: workflowAPI,
  billing: billingAPI,
  dashboard: dashboardAPI,
  userPreferences: userPreferencesAPI,
  activityLog: activityLogAPI,
  dataIsolation: dataIsolationAPI,
  validation: validationAPI,
  lab: labAPI,
  upload: uploadAPI,
  backup: backupAPI,
  monitoring: monitoringAPI,
}

// Export error class
export { apiCall, APIError }

