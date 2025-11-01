import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AppointmentBooking } from '@/components/appointment-booking'
import { useAppointments } from '@/hooks/use-appointments'
import { usePatients } from '@/hooks/use-patients'
import { useToast } from '@/hooks/use-toast'

// Mock the hooks
jest.mock('@/hooks/use-appointments')
jest.mock('@/hooks/use-patients')
jest.mock('@/hooks/use-toast')
jest.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { id: '123', role: 'receptionist', username: 'testuser' },
    token: 'test-token',
    isAuthenticated: true
  })
}))

describe('Appointment Booking Form', () => {
  const mockCreateAppointment = jest.fn()
  const mockToast = jest.fn()

  const mockPatients = [
    { id: '1', first_name: 'John', last_name: 'Doe', phone: '+254712345678' },
    { id: '2', first_name: 'Jane', last_name: 'Smith', phone: '+254712345679' }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    ;(useAppointments as jest.Mock).mockReturnValue({
      appointments: [],
      loading: false,
      error: null,
      createAppointment: mockCreateAppointment,
      updateAppointment: jest.fn(),
      deleteAppointment: jest.fn(),
      getAppointmentsByDate: jest.fn(),
      refreshAppointments: jest.fn()
    })

    ;(usePatients as jest.Mock).mockReturnValue({
      patients: mockPatients,
      loading: false,
      error: null,
      searchPatients: jest.fn()
    })

    ;(useToast as jest.Mock).mockReturnValue({
      toast: mockToast
    })
  })

  test('renders appointment booking form', () => {
    render(<AppointmentBooking />)
    
    expect(screen.getByText(/appointment|booking|schedule/i)).toBeInTheDocument()
  })

  test('validates required fields', async () => {
    render(<AppointmentBooking />)
    
    const submitButton = screen.getByRole('button', { name: /book|schedule|create|submit/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/required|please select|please enter/i)).toBeInTheDocument()
    })
  })

  test('allows selecting patient from dropdown', async () => {
    render(<AppointmentBooking />)
    
    const patientSelect = screen.getByLabelText(/patient|select patient/i)
    fireEvent.click(patientSelect)
    
    await waitFor(() => {
      expect(screen.getByText(/John Doe/i)).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText(/John Doe/i))
    
    await waitFor(() => {
      expect(patientSelect).toHaveValue('1')
    })
  })

  test('validates date is not in the past', async () => {
    render(<AppointmentBooking />)
    
    const dateInput = screen.getByLabelText(/date|appointment date/i)
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    const pastDateString = pastDate.toISOString().split('T')[0]
    
    fireEvent.change(dateInput, { target: { value: pastDateString } })
    
    const submitButton = screen.getByRole('button', { name: /book|schedule|create|submit/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/past|future|invalid date/i)).toBeInTheDocument()
    })
  })

  test('submits appointment with valid data', async () => {
    mockCreateAppointment.mockResolvedValue({
      success: true,
      data: { id: '123' }
    })

    render(<AppointmentBooking />)
    
    // Select patient
    const patientSelect = screen.getByLabelText(/patient|select patient/i)
    fireEvent.click(patientSelect)
    await waitFor(() => {
      fireEvent.click(screen.getByText(/John Doe/i))
    })
    
    // Set date (future date)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    const dateInput = screen.getByLabelText(/date|appointment date/i)
    fireEvent.change(dateInput, { target: { value: futureDate.toISOString().split('T')[0] } })
    
    // Set time
    const timeInput = screen.getByLabelText(/time|appointment time/i)
    fireEvent.change(timeInput, { target: { value: '10:00' } })
    
    const submitButton = screen.getByRole('button', { name: /book|schedule|create|submit/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockCreateAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_id: '1',
          date: expect.any(String),
          time: expect.any(String)
        })
      )
    })
  })

  test('handles appointment creation errors', async () => {
    mockCreateAppointment.mockRejectedValue({
      message: 'Failed to create appointment'
    })

    render(<AppointmentBooking />)
    
    const patientSelect = screen.getByLabelText(/patient|select patient/i)
    fireEvent.click(patientSelect)
    await waitFor(() => {
      fireEvent.click(screen.getByText(/John Doe/i))
    })
    
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    const dateInput = screen.getByLabelText(/date|appointment date/i)
    fireEvent.change(dateInput, { target: { value: futureDate.toISOString().split('T')[0] } })
    
    const submitButton = screen.getByRole('button', { name: /book|schedule|create|submit/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/error|failed/i),
          variant: 'destructive'
        })
      )
    })
  })

  test('checks for appointment conflicts', async () => {
    mockCreateAppointment.mockRejectedValue({
      message: 'Appointment conflict',
      code: 'CONFLICT'
    })

    render(<AppointmentBooking />)
    
    const patientSelect = screen.getByLabelText(/patient|select patient/i)
    fireEvent.click(patientSelect)
    await waitFor(() => {
      fireEvent.click(screen.getByText(/John Doe/i))
    })
    
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    const dateInput = screen.getByLabelText(/date|appointment date/i)
    fireEvent.change(dateInput, { target: { value: futureDate.toISOString().split('T')[0] } })
    
    const timeInput = screen.getByLabelText(/time|appointment time/i)
    fireEvent.change(timeInput, { target: { value: '10:00' } })
    
    const submitButton = screen.getByRole('button', { name: /book|schedule|create|submit/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/conflict|already booked|unavailable/i)).toBeInTheDocument()
    })
  })

  test('displays available time slots', () => {
    render(<AppointmentBooking />)
    
    // Should show available times or time picker
    const timeInput = screen.getByLabelText(/time|appointment time/i)
    expect(timeInput).toBeInTheDocument()
  })
})

