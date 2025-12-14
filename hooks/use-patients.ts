'use client'

import { usePatient } from '@/contexts/patient-context'
import { usePatients as useAppStatePatients } from '@/contexts/app-state-context'

/**
 * Wrapper hook to provide patient data in tests and UI.
 * Uses the patient context when available, otherwise falls back
 * to the lightweight app-state selector.
 */
export function usePatients() {
  try {
    const { patientsData } = usePatient()
    return { patients: Array.from(patientsData.values()), loading: false, error: null, searchPatients: async () => [] }
  } catch {
    return { patients: useAppStatePatients(), loading: false, error: null, searchPatients: async () => [] }
  }
}

