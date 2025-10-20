"use client"

import React, { createContext, useContext, useReducer, ReactNode } from 'react'

// Types
export interface Patient {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  phone: string
  email?: string
  address: string
  emergencyContact: string
  emergencyPhone: string
  bloodType?: string
  allergies?: string
  medicalHistory?: string
  createdAt: string
  updatedAt: string
}

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  date: string
  time: string
  type: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show'
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Medication {
  id: string
  name: string
  genericName: string
  category: string
  manufacturer: string
  batchNumber: string
  expiryDate: string
  quantity: number
  unitPrice: number
  reorderLevel: number
  location: string
  description?: string
  sideEffects?: string
  dosageForm: string
  strength: string
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expired'
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  patientId: string
  patientName: string
  date: string
  type: 'SHA' | 'Cash' | 'M-Pesa'
  services: Array<{
    description: string
    quantity: number
    unitPrice: number
  }>
  subtotal: number
  tax: number
  total: number
  status: 'pending' | 'paid' | 'cancelled'
  notes?: string
  shaDetails?: {
    memberNumber: string
    scheme: string
    authorizationCode: string
    preAuthorizationCode?: string
    icd11Code: string
    diagnosis: string
    serviceCode: string
    serviceDescription: string
    practitionerId: string
    practitionerName: string
    facilityCode: string
    claimStatus?: 'Pending' | 'Submitted' | 'Approved' | 'Rejected' | 'Paid'
    submissionDate?: string
    rejectionReason?: string
  }
  paymentDetails?: {
    method: string
    transactionId: string
    paidDate: string
    mpesaCode?: string
    phoneNumber?: string
  }
  createdAt: string
  updatedAt: string
}

// State interface
export interface AppState {
  patients: Patient[]
  appointments: Appointment[]
  medications: Medication[]
  invoices: Invoice[]
  isLoading: boolean
  error: string | null
  lastUpdated: string | null
}

// Action types
export type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PATIENTS'; payload: Patient[] }
  | { type: 'ADD_PATIENT'; payload: Patient }
  | { type: 'UPDATE_PATIENT'; payload: Patient }
  | { type: 'DELETE_PATIENT'; payload: string }
  | { type: 'SET_APPOINTMENTS'; payload: Appointment[] }
  | { type: 'ADD_APPOINTMENT'; payload: Appointment }
  | { type: 'UPDATE_APPOINTMENT'; payload: Appointment }
  | { type: 'DELETE_APPOINTMENT'; payload: string }
  | { type: 'SET_MEDICATIONS'; payload: Medication[] }
  | { type: 'ADD_MEDICATION'; payload: Medication }
  | { type: 'UPDATE_MEDICATION'; payload: Medication }
  | { type: 'DELETE_MEDICATION'; payload: string }
  | { type: 'SET_INVOICES'; payload: Invoice[] }
  | { type: 'ADD_INVOICE'; payload: Invoice }
  | { type: 'UPDATE_INVOICE'; payload: Invoice }
  | { type: 'DELETE_INVOICE'; payload: string }
  | { type: 'RESET_STATE' }

// Initial state
const initialState: AppState = {
  patients: [],
  appointments: [],
  medications: [],
  invoices: [],
  isLoading: false,
  error: null,
  lastUpdated: null
}

// Reducer
function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    
    case 'SET_PATIENTS':
      return { ...state, patients: action.payload, lastUpdated: new Date().toISOString() }
    
    case 'ADD_PATIENT':
      return { 
        ...state, 
        patients: [...state.patients, action.payload],
        lastUpdated: new Date().toISOString()
      }
    
    case 'UPDATE_PATIENT':
      return {
        ...state,
        patients: state.patients.map(p => p.id === action.payload.id ? action.payload : p),
        lastUpdated: new Date().toISOString()
      }
    
    case 'DELETE_PATIENT':
      return {
        ...state,
        patients: state.patients.filter(p => p.id !== action.payload),
        lastUpdated: new Date().toISOString()
      }
    
    case 'SET_APPOINTMENTS':
      return { ...state, appointments: action.payload, lastUpdated: new Date().toISOString() }
    
    case 'ADD_APPOINTMENT':
      return { 
        ...state, 
        appointments: [...state.appointments, action.payload],
        lastUpdated: new Date().toISOString()
      }
    
    case 'UPDATE_APPOINTMENT':
      return {
        ...state,
        appointments: state.appointments.map(a => a.id === action.payload.id ? action.payload : a),
        lastUpdated: new Date().toISOString()
      }
    
    case 'DELETE_APPOINTMENT':
      return {
        ...state,
        appointments: state.appointments.filter(a => a.id !== action.payload),
        lastUpdated: new Date().toISOString()
      }
    
    case 'SET_MEDICATIONS':
      return { ...state, medications: action.payload, lastUpdated: new Date().toISOString() }
    
    case 'ADD_MEDICATION':
      return { 
        ...state, 
        medications: [...state.medications, action.payload],
        lastUpdated: new Date().toISOString()
      }
    
    case 'UPDATE_MEDICATION':
      return {
        ...state,
        medications: state.medications.map(m => m.id === action.payload.id ? action.payload : m),
        lastUpdated: new Date().toISOString()
      }
    
    case 'DELETE_MEDICATION':
      return {
        ...state,
        medications: state.medications.filter(m => m.id !== action.payload),
        lastUpdated: new Date().toISOString()
      }
    
    case 'SET_INVOICES':
      return { ...state, invoices: action.payload, lastUpdated: new Date().toISOString() }
    
    case 'ADD_INVOICE':
      return { 
        ...state, 
        invoices: [...state.invoices, action.payload],
        lastUpdated: new Date().toISOString()
      }
    
    case 'UPDATE_INVOICE':
      return {
        ...state,
        invoices: state.invoices.map(i => i.id === action.payload.id ? action.payload : i),
        lastUpdated: new Date().toISOString()
      }
    
    case 'DELETE_INVOICE':
      return {
        ...state,
        invoices: state.invoices.filter(i => i.id !== action.payload),
        lastUpdated: new Date().toISOString()
      }
    
    case 'RESET_STATE':
      return initialState
    
    default:
      return state
  }
}

// Context
const AppStateContext = createContext<{
  state: AppState
  dispatch: React.Dispatch<AppAction>
} | undefined>(undefined)

// Provider
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appStateReducer, initialState)

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  )
}

// Hook
export function useAppState() {
  const context = useContext(AppStateContext)
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider')
  }
  return context
}

// Selector hooks for specific data
export function usePatients() {
  const { state } = useAppState()
  return state.patients
}

export function useAppointments() {
  const { state } = useAppState()
  return state.appointments
}

export function useMedications() {
  const { state } = useAppState()
  return state.medications
}

export function useInvoices() {
  const { state } = useAppState()
  return state.invoices
}

export function useLoading() {
  const { state } = useAppState()
  return state.isLoading
}

export function useError() {
  const { state } = useAppState()
  return state.error
}
