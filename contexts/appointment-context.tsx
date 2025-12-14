'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { appointmentAPI } from '../lib/api-client'

export interface Appointment {
  id: string
  appointmentNumber: string
  patientId: string
  patientName: string
  patientPhone: string
  appointmentDate: string
  appointmentTime: string
  appointmentType: 'consultation' | 'follow-up' | 'procedure' | 'lab-test'
  clinicianId: string
  clinicianName: string
  status: 'scheduled' | 'checked-in' | 'in-progress' | 'completed' | 'cancelled' | 'no-show'
  notes?: string
  createdAt: string
  updatedAt: string
  cancelledReason?: string
}

export interface QueueItem {
  id: string
  patientId: string
  patientName: string
  patientNumber: string
  appointmentId?: string
  checkInTime: string
  queueNumber: number
  priority: 'normal' | 'urgent' | 'emergency'
  visitType: 'appointment' | 'walk-in'
  status: 'waiting' | 'called' | 'in-consultation' | 'completed'
  clinicianAssigned?: string
  notes?: string
}

interface AppointmentContextType {
  appointments: Appointment[]
  queue: QueueItem[]
  addAppointment: (appointment: Omit<Appointment, 'id' | 'appointmentNumber' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>
  cancelAppointment: (id: string, reason?: string) => Promise<void>
  checkInAppointment: (appointmentId: string) => void
  addToQueue: (queueItem: Omit<QueueItem, 'id' | 'queueNumber' | 'checkInTime' | 'status'>) => void
  callNextPatient: (clinicianId: string) => QueueItem | null
  updateQueueStatus: (queueId: string, status: QueueItem['status']) => void
  updateQueueNotes: (queueId: string, notes: string) => void
  removeFromQueue: (queueId: string) => void
  getAppointmentsByDate: (date: string) => Appointment[]
  getTodayQueue: () => QueueItem[]
}

const AppointmentContext = createContext<AppointmentContextType | undefined>(undefined)

// Removed localStorage keys and default data - now using API calls

export function AppointmentProvider({ children }: { children: ReactNode }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Load from API on mount
  useEffect(() => {
    const loadAppointments = async () => {
      try {
        const appointmentsData = await appointmentAPI.getAll()
        setAppointments(appointmentsData.data || [])

        // For now, we'll manage queue locally until backend queue API is implemented
        // TODO: Implement queue API endpoints in backend
        setQueue([])
      } catch (error) {
        console.error('Error loading appointments from API:', error)
        setAppointments([])
        setQueue([])
      } finally {
        setIsInitialized(true)
      }
    }

    loadAppointments()
  }, [])

  // Removed localStorage save effects - data is now persisted via API calls

  const addAppointment = async (appointmentData: Omit<Appointment, 'id' | 'appointmentNumber' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
      const newAppointment = await appointmentAPI.create(appointmentData)
      setAppointments(prev => [...prev, newAppointment])
      return newAppointment.id
    } catch (error) {
      console.error('Error creating appointment:', error)
      throw error
    }
  }

  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    try {
      const updatedAppointment = await appointmentAPI.update(id, updates)
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === id ? updatedAppointment : apt
        )
      )
    } catch (error) {
      console.error('Error updating appointment:', error)
      throw error
    }
  }

  const cancelAppointment = async (id: string, reason?: string) => {
    try {
      await appointmentAPI.cancel(id, reason || 'Cancelled by user')
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === id
            ? { ...apt, status: 'cancelled', notes: reason ? `Cancelled: ${reason}` : 'Cancelled' }
            : apt
        )
      )
    } catch (error) {
      console.error('Error cancelling appointment:', error)
      throw error
    }
  }

  const checkInAppointment = (appointmentId: string) => {
    const appointment = appointments.find(apt => apt.id === appointmentId)
    if (!appointment) return

    // Update appointment status
    updateAppointment(appointmentId, { status: 'checked-in' })

    // Add to queue
    const maxQueueNumber = queue.length > 0 ? Math.max(...queue.map(q => q.queueNumber)) : 0

    const queueItem: QueueItem = {
      id: crypto.randomUUID(),
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientNumber: appointment.patientId,
      appointmentId,
      checkInTime: new Date().toISOString(),
      queueNumber: maxQueueNumber + 1,
      priority: 'normal',
      visitType: 'appointment',
      status: 'waiting',
      clinicianAssigned: appointment.clinicianName,
    }

    setQueue(prev => [...prev, queueItem])
  }

  const addToQueue = (queueData: Omit<QueueItem, 'id' | 'queueNumber' | 'checkInTime' | 'status'>) => {
    const maxQueueNumber = queue.length > 0 ? Math.max(...queue.map(q => q.queueNumber)) : 0

    const queueItem: QueueItem = {
      ...queueData,
      id: crypto.randomUUID(),
      queueNumber: maxQueueNumber + 1,
      checkInTime: new Date().toISOString(),
      status: 'waiting',
    }

    setQueue(prev => [...prev, queueItem])
  }

  const callNextPatient = (clinicianId: string): QueueItem | null => {
    // Find next waiting patient (prioritize emergency, then urgent, then normal by queue number)
    const waitingPatients = queue.filter(q => q.status === 'waiting')

    if (waitingPatients.length === 0) return null

    // Sort by priority and queue number
    const priorityOrder = { emergency: 0, urgent: 1, normal: 2 }
    waitingPatients.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return a.queueNumber - b.queueNumber
    })

    const nextPatient = waitingPatients[0]
    updateQueueStatus(nextPatient.id, 'called')

    return nextPatient
  }

  const updateQueueStatus = (queueId: string, status: QueueItem['status']) => {
    setQueue(prev =>
      prev.map(q =>
        q.id === queueId ? { ...q, status } : q
      )
    )
  }

  const updateQueueNotes = (queueId: string, notes: string) => {
    setQueue(prev =>
      prev.map(q =>
        q.id === queueId ? { ...q, notes } : q
      )
    )
  }

  const removeFromQueue = (queueId: string) => {
    setQueue(prev => prev.filter(q => q.id !== queueId))
  }

  const getAppointmentsByDate = (date: string): Appointment[] => {
    return appointments.filter(apt => apt.appointmentDate === date)
  }

  const getTodayQueue = (): QueueItem[] => {
    const today = new Date().toISOString().split('T')[0]
    return queue.filter(q => q.checkInTime.startsWith(today))
  }

  const value: AppointmentContextType = {
    appointments,
    queue,
    addAppointment,
    updateAppointment,
    cancelAppointment,
    checkInAppointment,
    addToQueue,
    callNextPatient,
    updateQueueStatus,
    updateQueueNotes,
    removeFromQueue,
    getAppointmentsByDate,
    getTodayQueue,
  }

  return (
    <AppointmentContext.Provider value={value}>
      {children}
    </AppointmentContext.Provider>
  )
}

export function useAppointments() {
  const context = useContext(AppointmentContext)
  if (context === undefined) {
    throw new Error('useAppointments must be used within an AppointmentProvider')
  }
  return context
}

