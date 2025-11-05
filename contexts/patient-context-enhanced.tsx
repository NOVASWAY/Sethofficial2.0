"use client"

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react'
import { patientAPI } from '@/lib/api-client'

// Enhanced Patient Interface - Aligned with backend
export interface Patient {
  id: string
  patient_number: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  phone: string
  location?: string
  emergency_contact?: string
  emergency_phone?: string
  blood_type?: string
  allergies?: string[]
  medical_history?: string
  insurance_type?: string
  insurance_number?: string
  created_at: string
  updated_at: string
}

interface PatientContextType {
  patients: Patient[]
  loading: boolean
  error: string | null
  
  // CRUD Operations
  addPatient: (patient: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) => Promise<Patient>
  updatePatient: (id: string, updates: Partial<Patient>) => Promise<Patient>
  deletePatient: (id: string) => Promise<void>
  
  // Search & Query
  searchPatients: (query: string) => Promise<Patient[]>
  getPatientById: (id: string) => Patient | undefined
  getPatientByNumber: (number: string) => Patient | undefined
  
  // Bulk Operations
  importPatients: (patients: Omit<Patient, 'id' | 'created_at' | 'updated_at'>[]) => Promise<Patient[]>
  exportPatients: () => string
  
  // Persistence
  loadPatients: () => Promise<void>
  
  // Statistics
  getTotalPatients: () => number
  getActivePatients: () => number
}

const PatientContextEnhanced = createContext<PatientContextType | undefined>(undefined)

export function PatientProviderEnhanced({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load patients from API on mount
  useEffect(() => {
    loadPatients()
  }, [loadPatients])

  // Load patients from backend API
  const loadPatients = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await patientAPI.getAll()
      setPatients(response)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load patients'
      setError(errorMessage)
      console.error('Failed to load patients:', err)
    } finally {
      setLoading(false)
    }
  }

  // Add Patient (memoized)
  const addPatient = useCallback(async (patientData: Omit<Patient, 'id' | 'created_at' | 'updated_at'>): Promise<Patient> => {
    try {
      setError(null)
      const response = await patientAPI.create(patientData)
      
      // Reload patients to get the updated list
      await loadPatients()
      
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add patient'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [loadPatients])

  // Update Patient (memoized)
  const updatePatient = useCallback(async (id: string, updates: Partial<Patient>): Promise<Patient> => {
    try {
      setError(null)
      const response = await patientAPI.update(id, updates)
      
      // Reload patients to get the updated list
      await loadPatients()
      
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update patient'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [loadPatients])

  // Delete Patient (memoized)
  const deletePatient = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null)
      await patientAPI.delete(id)
      
      // Reload patients to get the updated list
      await loadPatients()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete patient'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [loadPatients])

  // Search Patients (memoized)
  const searchPatients = useCallback(async (query: string): Promise<Patient[]> => {
    if (!query.trim()) return patients

    try {
      setError(null)
      const response = await patientAPI.search(query)
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search patients'
      setError(errorMessage)
      console.error('Search failed:', err)
      return []
    }
  }, [patients])

  // Get Patient by ID (memoized)
  const getPatientById = useCallback((id: string): Patient | undefined => {
    return patients.find(p => p.id === id)
  }, [patients])

  // Get Patient by Number (memoized)
  const getPatientByNumber = useCallback((number: string): Patient | undefined => {
    return patients.find(p => p.patient_number === number)
  }, [patients])

  // Import Patients (Bulk) (memoized)
  const importPatients = useCallback(async (
    patientsData: Omit<Patient, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<Patient[]> => {
    try {
      setError(null)
      // bulkImport now returns response.data, which contains { imported, failed, errors }
      const importResult = await patientAPI.bulkImport(patientsData)
      
      if (!importResult) {
        throw new Error('Import failed - no response from server')
      }
      
      // Log import results
      if (importResult.errors && importResult.errors.length > 0) {
        console.warn('Some patients failed to import:', importResult.errors)
      }
      
      // Reload patients from backend to get the updated list with actual IDs
      await loadPatients()
      
      // Return the imported patients from the reloaded list
      // Match by patient_number since we just imported them
      const importedNumbers = patientsData.map(p => p.patient_number)
      const imported = patients.filter(p => importedNumbers.includes(p.patient_number))
      
      return imported
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import patients'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [loadPatients, patients])

  // Export Patients (CSV) (memoized)
  const exportPatients = useCallback((): string => {
    const headers = [
      'Patient Number',
      'First Name',
      'Last Name',
      'Date of Birth',
      'Gender',
      'Phone',
      'Location',
      'Emergency Contact',
      'Emergency Phone',
      'Blood Type',
      'Allergies',
      'Insurance Provider',
      'Insurance Number',
      'Status',
      'Created At',
    ]

    const rows = patients.map(p => [
      p.patient_number,
      p.first_name,
      p.last_name,
      p.date_of_birth,
      p.gender,
      p.phone,
      p.location,
      p.emergency_contact,
      p.emergency_phone,
      p.blood_type || '',
      (p.allergies || []).join('; '),
      p.insurance_provider || '',
      p.insurance_number || '',
      p.status,
      new Date(p.created_at).toLocaleDateString(),
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    return csv
  }, [patients])

  // Statistics (memoized)
  const getTotalPatients = useCallback((): number => {
    return patients.length
  }, [patients])

  const getActivePatients = useCallback((): number => {
    return patients.length // All patients are active in the backend
  }, [patients])

  // Memoize context value to prevent unnecessary re-renders
  const value: PatientContextType = useMemo(() => ({
    patients,
    loading,
    error,
    addPatient,
    updatePatient,
    deletePatient,
    searchPatients,
    getPatientById,
    getPatientByNumber,
    importPatients,
    exportPatients,
    loadPatients,
    getTotalPatients,
    getActivePatients,
  }), [
    patients,
    loading,
    error,
    addPatient,
    updatePatient,
    deletePatient,
    searchPatients,
    getPatientById,
    getPatientByNumber,
    importPatients,
    exportPatients,
    loadPatients,
    getTotalPatients,
    getActivePatients,
  ])

  return (
    <PatientContextEnhanced.Provider value={value}>
      {children}
    </PatientContextEnhanced.Provider>
  )
}

// Custom hook
export function usePatientEnhanced() {
  const context = useContext(PatientContextEnhanced)
  if (context === undefined) {
    throw new Error('usePatientEnhanced must be used within a PatientProviderEnhanced')
  }
  return context
}

