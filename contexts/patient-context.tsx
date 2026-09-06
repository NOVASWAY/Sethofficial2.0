'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { patientAPI, consultationAPI } from '../lib/api-client'

export interface Allergy {
  id: string
  allergen: string
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening'
  reaction: string
  recordedDate: string
}

export interface Consultation {
  id: string
  consultationNumber: string
  patientId: string
  clinicianName: string
  date: string
  chiefComplaint: string
  diagnosis: string
  icdCode?: string
  prescriptions: Prescription[]
  services: ConsultationService[]
  notes: string
  vitalSigns?: VitalSigns
}

export interface Prescription {
  id: string
  medicationName: string
  dosage: string
  frequency: string
  duration: string
  quantity: number
  instructions: string
  status: 'pending' | 'dispensed' | 'cancelled'
}

export interface ConsultationService {
  id: string
  serviceName: string
  amount: number
}

export interface VitalSigns {
  temperature?: string
  bloodPressure?: string
  heartRate?: string
  respiratoryRate?: string
  oxygenSaturation?: string
  weight?: string
  height?: string
}

export interface PatientMedicalInfo {
  patientId: string
  patientName: string
  allergies: Allergy[]
  consultations: Consultation[]
  chronicConditions: string[]
  bloodType?: string
}

interface PatientContextType {
  patientsData: Map<string, PatientMedicalInfo>
  getPatientData: (patientId: string) => PatientMedicalInfo | undefined
  addAllergy: (patientId: string, allergy: Omit<Allergy, 'id'>) => Promise<void>
  removeAllergy: (patientId: string, allergyId: string) => Promise<void>
  addConsultation: (patientId: string, consultation: Consultation) => Promise<void>
  getPatientAllergies: (patientId: string) => Allergy[]
  getPatientConsultations: (patientId: string) => Consultation[]
  checkMedicationAllergy: (patientId: string, medicationName: string) => Allergy | null
  initializePatient: (patientId: string, patientName: string) => void
  loadPatientData: (patientId: string) => Promise<void>
}

const PatientContext = createContext<PatientContextType | undefined>(undefined)

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patientsData, setPatientsData] = useState<Map<string, PatientMedicalInfo>>(
    new Map() // Start with empty map - no mock data
  )

  const getPatientData = (patientId: string): PatientMedicalInfo | undefined => {
    return patientsData.get(patientId)
  }

  const initializePatient = (patientId: string, patientName: string) => {
    if (!patientsData.has(patientId)) {
      setPatientsData(prev => {
        const newMap = new Map(prev)
        newMap.set(patientId, {
          patientId,
          patientName,
          allergies: [],
          consultations: [],
          chronicConditions: [],
        })
        return newMap
      })
    }
  }

  const addAllergy = async (patientId: string, allergy: Omit<Allergy, 'id'>) => {
    try {
      const newAllergy: Allergy = {
        ...allergy,
        id: `ALG-${Date.now()}`,
      }
      
      setPatientsData(prev => {
        const newMap = new Map(prev)
        const patientData = newMap.get(patientId)
        
        if (patientData) {
          patientData.allergies.push(newAllergy)
          newMap.set(patientId, patientData)
        }
        
        return newMap
      })

      // Persist to backend
      fetch(`/api/patients/${patientId}/allergies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allergy),
      }).catch(err => console.error('Failed to persist allergy:', err))
    } catch (error) {
      console.error('Error adding allergy:', error)
      throw error
    }
  }

  const removeAllergy = async (patientId: string, allergyId: string) => {
    try {
      setPatientsData(prev => {
        const newMap = new Map(prev)
        const patientData = newMap.get(patientId)
        
        if (patientData) {
          patientData.allergies = patientData.allergies.filter(a => a.id !== allergyId)
          newMap.set(patientId, patientData)
        }
        
        return newMap
      })

      // Persist to backend
      fetch(`/api/patients/${patientId}/allergies/${allergyId}`, {
        method: 'DELETE',
      }).catch(err => console.error('Failed to delete allergy:', err))
    } catch (error) {
      console.error('Error removing allergy:', error)
      throw error
    }
  }

  const addConsultation = async (patientId: string, consultation: Consultation) => {
    try {
      // Save consultation to backend
      const savedConsultation = await consultationAPI.create({
        patient_id: patientId,
        clinician_name: consultation.clinicianName,
        date: consultation.date,
        chief_complaint: consultation.chiefComplaint,
        diagnosis: consultation.diagnosis,
        icd_code: consultation.icdCode,
        notes: consultation.notes,
        vital_signs: consultation.vitalSigns,
        prescriptions: consultation.prescriptions,
        services: consultation.services,
      })
      
      // Update local state
      setPatientsData(prev => {
        const newMap = new Map(prev)
        const patientData = newMap.get(patientId)
        
        if (patientData) {
          patientData.consultations.unshift(savedConsultation) // Add to beginning
          newMap.set(patientId, patientData)
        }
        
        return newMap
      })
    } catch (error) {
      console.error('Error adding consultation:', error)
      throw error
    }
  }

  const getPatientAllergies = (patientId: string): Allergy[] => {
    return patientsData.get(patientId)?.allergies || []
  }

  const getPatientConsultations = (patientId: string): Consultation[] => {
    return patientsData.get(patientId)?.consultations || []
  }

  const checkMedicationAllergy = (patientId: string, medicationName: string): Allergy | null => {
    const allergies = getPatientAllergies(patientId)
    const medicationLower = medicationName.toLowerCase()
    
    // Check for direct match or common medication families
    for (const allergy of allergies) {
      const allergenLower = allergy.allergen.toLowerCase()
      
      // Direct match
      if (medicationLower.includes(allergenLower) || allergenLower.includes(medicationLower)) {
        return allergy
      }
      
      // Penicillin family check
      if (allergenLower.includes('penicillin') && (
        medicationLower.includes('amoxicillin') ||
        medicationLower.includes('ampicillin') ||
        medicationLower.includes('penicillin')
      )) {
        return allergy
      }
      
      // Sulfa drugs check
      if (allergenLower.includes('sulfa') && (
        medicationLower.includes('sulfamethoxazole') ||
        medicationLower.includes('sulfa')
      )) {
        return allergy
      }
    }
    
    return null
  }

  const loadPatientData = async (patientId: string) => {
    try {
      // Load patient basic info
      const patient = await patientAPI.getById(patientId)
      
      // Load patient consultations
      const consultationsData = await consultationAPI.getByPatientId(patientId)
      
      // Initialize patient data if not exists
      if (!patientsData.has(patientId)) {
        initializePatient(patientId, patient.name || 'Unknown Patient')
      }
      
      // Update with loaded data
      setPatientsData(prev => {
        const newMap = new Map(prev)
        const patientData = newMap.get(patientId)
        
        if (patientData) {
          patientData.consultations = consultationsData.data || []
          newMap.set(patientId, patientData)
        }
        
        return newMap
      })
    } catch (error) {
      console.error('Error loading patient data:', error)
      throw error
    }
  }

  const value: PatientContextType = {
    patientsData,
    getPatientData,
    addAllergy,
    removeAllergy,
    addConsultation,
    getPatientAllergies,
    getPatientConsultations,
    checkMedicationAllergy,
    initializePatient,
    loadPatientData,
  }

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  )
}

export function usePatient() {
  const context = useContext(PatientContext)
  if (context === undefined) {
    throw new Error('usePatient must be used within a PatientProvider')
  }
  return context
}

