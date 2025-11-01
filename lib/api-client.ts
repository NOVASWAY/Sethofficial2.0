// Comprehensive API Client for Clinic Management System
// This file provides a centralized location for all backend API calls

import { getStoredUser } from './auth'

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

// Get authorization header
function getAuthorizationHeader(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
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
      throw new APIError(
        error.message || `HTTP ${response.status}: ${response.statusText}`,
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
    const response = await apiCall<{ success: boolean; data: { token: string; user: any; refresh_token: string }; message: string; error: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
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
}

// ========================================
// PATIENT APIs
// ========================================

export const patientAPI = {
  /**
   * Get all patients
   * GET /patients
   */
  getAll: async () => {
    const response = await apiCall<{ success: boolean; data: any[]; message: string; error: any }>('/patients')
    return response.data || []
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
   * POST /patients/bulk-import
   */
  bulkImport: async (patients: any[]) => {
    const response = await apiCall<{ success: boolean; data: { imported: number; errors: any[] }; message: string; error: any }>('/patients/bulk-import', {
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
  receiveStock: async (id: string, stockData: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/medicines/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(stockData),
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
   * POST /sha-claims
   */
  create: async (claimData: any) => {
    return apiCall<any>('/sha-claims', {
      method: 'POST',
      body: JSON.stringify(claimData),
    })
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
    return response.data?.services || []
  },

  /**
   * Update service prices (admin only)
   * PUT /admin/services/:serviceId
   */
  updatePrices: async (serviceId: string, cashPrice: number, nhifPrice?: number, shaPrice?: number) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/admin/services/${serviceId}`, {
      method: 'PUT',
      body: JSON.stringify({
        cash_price: cashPrice,
        nhif_price: nhifPrice || cashPrice,
        sha_price: shaPrice || cashPrice,
      }),
    })
    return response.data
  },

  /**
   * Create new service (admin only)
   * POST /admin/services
   */
  create: async (serviceData: {
    service_id: string
    name: string
    category: string
    description?: string
    cash_price: number
    nhif_price?: number
    sha_price?: number
    requires_prescription?: boolean
  }) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/admin/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    })
    return response.data
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
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/dashboard/user/${userId}/metrics`)
    return response.data
  },

  /**
   * Get role-based dashboard metrics
   * GET /dashboard/role/:role/metrics
   */
  getRoleMetrics: async (role: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/dashboard/role/${role}/metrics`)
    return response.data
  },

  /**
   * Get department-based dashboard metrics
   * GET /dashboard/department/:department/metrics
   */
  getDepartmentMetrics: async (department: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/dashboard/department/${department}/metrics`)
    return response.data
  },

  /**
   * Get system health metrics
   * GET /dashboard/system/health
   */
  getSystemHealth: async () => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>('/dashboard/system/health')
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
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/user/${userId}/preferences`)
    return response.data
  },

  /**
   * Update user preferences
   * PUT /user/:userId/preferences
   */
  update: async (userId: string, preferences: any) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/user/${userId}/preferences`, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    })
    return response.data
  },

  /**
   * Reset user preferences to default
   * POST /user/:userId/preferences/reset
   */
  reset: async (userId: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/user/${userId}/preferences/reset`, {
      method: 'POST',
    })
    return response.data
  },

  /**
   * Get role preference template
   * GET /user/:role/preferences/template
   */
  getTemplate: async (role: string) => {
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/user/${role}/preferences/template`)
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
   * GET /activity/stats
   */
  getStats: async (params?: { days?: number }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
    const response = await apiCall<{ success: boolean; data: any; message: string; error: any }>(`/activity/stats${query}`)
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
}

// Export all APIs
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
}

// Export error class
export { APIError }

