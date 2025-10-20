const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081/api/v1';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8081/ws';

// API Client class
class APIClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.loadToken();
  }

  private loadToken() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.baseURL}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async uploadFile<T>(endpoint: string, file: File, fieldName: string = 'file'): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers: HeadersInit = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }
}

// Create API client instance
export const apiClient = new APIClient(API_BASE_URL);

// WebSocket client
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Function[]> = new Map();

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.emit(message.message_type, message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.reconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Create WebSocket client instance
export const wsClient = new WebSocketClient(WS_URL);

// API Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Auth API
export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    apiClient.post<{ user: any; token: string; refresh_token: string }>('/auth/login', credentials),
  
  refresh: (refreshToken: string) =>
    apiClient.post<{ token: string; user: any }>('/auth/refresh', { refresh_token: refreshToken }),
  
  logout: () =>
    apiClient.post('/auth/logout'),
  
  getCurrentUser: () =>
    apiClient.get<any>('/auth/me'),
};

// Patients API
export const patientsAPI = {
  getPatients: (params?: { page?: number; per_page?: number; search?: string }) =>
    apiClient.get<PaginatedResponse<any>>('/patients', params),
  
  getPatient: (id: string) =>
    apiClient.get<any>(`/patients/${id}`),
  
  createPatient: (data: any) =>
    apiClient.post<{ id: string; patient_number: string }>('/patients', data),
  
  updatePatient: (id: string, data: any) =>
    apiClient.put(`/patients/${id}`, data),
  
  deletePatient: (id: string) =>
    apiClient.delete(`/patients/${id}`),
  
  importPatients: (data: any[]) =>
    apiClient.post<{ imported_count: number; total_count: number; errors: string[] }>('/patients/import', data),
  
  searchPatients: (query: string) =>
    apiClient.get<any[]>('/patients/search', { q: query }),
};

// Consultations API
export const consultationsAPI = {
  getConsultations: (params?: { page?: number; per_page?: number; patient_id?: string }) =>
    apiClient.get<PaginatedResponse<any>>('/consultations', params),
  
  getConsultation: (id: string) =>
    apiClient.get<any>(`/consultations/${id}`),
  
  createConsultation: (data: any) =>
    apiClient.post<{ id: string; consultation_number: string }>('/consultations', data),
  
  updateConsultation: (id: string, data: any) =>
    apiClient.put(`/consultations/${id}`, data),
  
  addPrescription: (consultationId: string, data: any) =>
    apiClient.post<{ id: string }>(`/consultations/${consultationId}/prescriptions`, data),
};

// Invoices API
export const invoicesAPI = {
  getInvoices: (params?: { page?: number; per_page?: number }) =>
    apiClient.get<PaginatedResponse<any>>('/invoices', params),
  
  getInvoice: (id: string) =>
    apiClient.get<any>(`/invoices/${id}`),
  
  createInvoice: (data: any) =>
    apiClient.post<{ id: string }>('/invoices', data),
  
  updateInvoice: (id: string, data: any) =>
    apiClient.put(`/invoices/${id}`, data),
  
  processPayment: (id: string, data: any) =>
    apiClient.post(`/invoices/${id}/pay`, data),
  
  printInvoice: (id: string) =>
    apiClient.get(`/invoices/${id}/print`),
};

// Pharmacy API
export const pharmacyAPI = {
  getPrescriptions: (params?: { page?: number; per_page?: number }) =>
    apiClient.get<PaginatedResponse<any>>('/pharmacy/prescriptions', params),
  
  dispensePrescription: (id: string) =>
    apiClient.post(`/pharmacy/prescriptions/${id}/dispense`),
  
  getMedicines: (params?: { page?: number; per_page?: number }) =>
    apiClient.get<PaginatedResponse<any>>('/pharmacy/medicines', params),
  
  addMedicine: (data: any) =>
    apiClient.post<{ id: string }>('/pharmacy/medicines', data),
  
  updateMedicine: (id: string, data: any) =>
    apiClient.put(`/pharmacy/medicines/${id}`, data),
  
  getStock: (params?: { page?: number; per_page?: number }) =>
    apiClient.get<PaginatedResponse<any>>('/pharmacy/stock', params),
  
  receiveStock: (data: any) =>
    apiClient.post('/pharmacy/stock/receive', data),
};

// Inventory API
export const inventoryAPI = {
  getInventory: (params?: { page?: number; per_page?: number }) =>
    apiClient.get<PaginatedResponse<any>>('/inventory', params),
  
  addItem: (data: any) =>
    apiClient.post<{ id: string }>('/inventory/items', data),
  
  updateItem: (id: string, data: any) =>
    apiClient.put(`/inventory/items/${id}`, data),
  
  deleteItem: (id: string) =>
    apiClient.delete(`/inventory/items/${id}`),
  
  getLowStock: () =>
    apiClient.get<any[]>('/inventory/low-stock'),
  
  getExpiringItems: () =>
    apiClient.get<any[]>('/inventory/expiring'),
  
  getMovements: (params?: { page?: number; per_page?: number }) =>
    apiClient.get<PaginatedResponse<any>>('/inventory/movements', params),
};

// Appointments API
export const appointmentsAPI = {
  getAppointments: (params?: { page?: number; per_page?: number }) =>
    apiClient.get<PaginatedResponse<any>>('/appointments', params),
  
  createAppointment: (data: any) =>
    apiClient.post<{ id: string }>('/appointments', data),
  
  updateAppointment: (id: string, data: any) =>
    apiClient.put(`/appointments/${id}`, data),
  
  cancelAppointment: (id: string) =>
    apiClient.delete(`/appointments/${id}`),
  
  getQueue: () =>
    apiClient.get<any[]>('/appointments/queue'),
  
  checkinPatient: (data: any) =>
    apiClient.post<{ id: string }>('/appointments/queue/checkin', data),
  
  callNextPatient: () =>
    apiClient.post('/appointments/queue/next'),
};

// Reports API
export const reportsAPI = {
  getFinancialReport: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get<any>('/reports/financial', params),
  
  getPatientReport: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get<any>('/reports/patients', params),
  
  getInventoryReport: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get<any>('/reports/inventory', params),
  
  getAuditLogs: (params?: { page?: number; per_page?: number }) =>
    apiClient.get<PaginatedResponse<any>>('/reports/audit', params),
};

// Users API
export const usersAPI = {
  getUsers: (params?: { page?: number; per_page?: number }) =>
    apiClient.get<PaginatedResponse<any>>('/users', params),
  
  createUser: (data: any) =>
    apiClient.post<{ id: string }>('/users', data),
  
  updateUser: (id: string, data: any) =>
    apiClient.put(`/users/${id}`, data),
  
  deleteUser: (id: string) =>
    apiClient.delete(`/users/${id}`),
  
  uploadAvatar: (id: string, file: File) =>
    apiClient.uploadFile<{ file_url: string }>(`/users/${id}/avatar`, file),
};

// Settings API
export const settingsAPI = {
  getSettings: () =>
    apiClient.get<any>('/settings'),
  
  updateSettings: (data: any) =>
    apiClient.put('/settings', data),
  
  createBackup: () =>
    apiClient.post<{ backup_id: string }>('/settings/backup'),
  
  restoreBackup: (data: any) =>
    apiClient.post('/settings/restore', data),
};

// Upload API
export const uploadAPI = {
  uploadAvatar: (file: File) =>
    apiClient.uploadFile<{ file_url: string }>('/upload/avatar', file),
  
  uploadDocument: (file: File) =>
    apiClient.uploadFile<{ file_url: string }>('/upload/document', file),
};

export { API_BASE_URL, WS_URL };