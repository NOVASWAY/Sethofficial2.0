'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface Prescription {
  medication_id: string
  medication_name: string
  dosage: string
  frequency: string
  duration_days: number
  quantity: number
  instructions: string
}

interface ServiceItem {
  id: string
  service_code: string
  service_name: string
  unit_price: number
  category: string
}

interface ConsultationData {
  consultation_id: string
  consultation_number: string
  patient_id: string
  patient_name: string
  clinician_name: string
  date: string
  chief_complaint: string
  diagnosis: string
  icd_code?: string
  prescriptions: Prescription[]
  services: ServiceItem[]
  notes: string
  insurance_type?: 'cash' | 'sha' | 'mixed'
}

interface WorkflowContextType {
  pendingConsultation: ConsultationData | null
  setPendingConsultation: (data: ConsultationData | null) => void
  pendingPrescriptions: Prescription[]
  addPrescriptionToQueue: (patientId: string, patientName: string, prescription: Prescription) => void
  clearPrescriptionQueue: () => void
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined)

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [pendingConsultation, setPendingConsultation] = useState<ConsultationData | null>(null)
  const [pendingPrescriptions, setPendingPrescriptions] = useState<Prescription[]>([])

  const addPrescriptionToQueue = (patientId: string, patientName: string, prescription: Prescription) => {
    setPendingPrescriptions(prev => [...prev, prescription])
  }

  const clearPrescriptionQueue = () => {
    setPendingPrescriptions([])
  }

  const value: WorkflowContextType = {
    pendingConsultation,
    setPendingConsultation,
    pendingPrescriptions,
    addPrescriptionToQueue,
    clearPrescriptionQueue,
  }

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  )
}

export function useWorkflow() {
  const context = useContext(WorkflowContext)
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider')
  }
  return context
}

