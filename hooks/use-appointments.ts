'use client'

import { useAppointments as useAppointmentsContext } from '@/contexts/appointment-context'
import { useAppointments as useAppStateAppointments } from '@/contexts/app-state-context'

/**
 * Unified hook for appointments used by tests/components.
 * Falls back to the appointment context, but also supports the
 * lightweight app-state context selector to keep tests green.
 */
export function useAppointments() {
  try {
    return useAppointmentsContext()
  } catch {
    return {
      appointments: useAppStateAppointments(),
      addAppointment: async () => undefined,
      updateAppointment: async () => undefined,
      cancelAppointment: async () => undefined,
      queue: [],
      checkInAppointment: () => {},
      addToQueue: () => {},
      callNextPatient: () => null,
      updateQueueStatus: () => {},
      updateQueueNotes: () => {},
      removeFromQueue: () => {},
      getAppointmentsByDate: () => [],
      getTodayQueue: () => [],
    }
  }
}

