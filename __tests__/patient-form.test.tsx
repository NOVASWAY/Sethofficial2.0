import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RegistrationModule } from '@/components/registration-module'
import { usePatients } from '@/hooks/use-patients'
import { useToast } from '@/hooks/use-toast'

// Mock the hooks
jest.mock('@/hooks/use-patients')
jest.mock('@/hooks/use-toast')
jest.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { id: '123', role: 'receptionist', username: 'testuser' },
    token: 'test-token',
    isAuthenticated: true
  })
}))

describe('Patient Registration Form', () => {
  const mockCreatePatient = jest.fn()
  const mockToast = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    
    ;(usePatients as jest.Mock).mockReturnValue({
      patients: [],
      loading: false,
      error: null,
      createPatient: mockCreatePatient,
      updatePatient: jest.fn(),
      deletePatient: jest.fn(),
      searchPatients: jest.fn(),
      refreshPatients: jest.fn()
    })

    ;(useToast as jest.Mock).mockReturnValue({
      toast: mockToast
    })
  })

  test('renders patient registration form', () => {
    render(<RegistrationModule />)
    
    expect(screen.getByText(/patient registration/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
  })

  test('validates required fields', async () => {
    render(<RegistrationModule />)
    
    const submitButton = screen.getByRole('button', { name: /register|submit|save/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      // Should show validation errors
      expect(screen.getByText(/required|please enter/i)).toBeInTheDocument()
    })
  })

  test('validates phone number format', async () => {
    render(<RegistrationModule />)
    
    const firstNameInput = screen.getByLabelText(/first name/i)
    const lastNameInput = screen.getByLabelText(/last name/i)
    const phoneInput = screen.getByLabelText(/phone number/i)
    
    fireEvent.change(firstNameInput, { target: { value: 'John' } })
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } })
    fireEvent.change(phoneInput, { target: { value: 'invalid-phone' } })
    
    const submitButton = screen.getByRole('button', { name: /register|submit|save/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/invalid|phone|format/i)).toBeInTheDocument()
    })
  })

  test('submits form with valid data', async () => {
    mockCreatePatient.mockResolvedValue({
      success: true,
      data: { id: '123', first_name: 'John', last_name: 'Doe' }
    })

    render(<RegistrationModule />)
    
    const firstNameInput = screen.getByLabelText(/first name/i)
    const lastNameInput = screen.getByLabelText(/last name/i)
    const phoneInput = screen.getByLabelText(/phone number/i)
    
    fireEvent.change(firstNameInput, { target: { value: 'John' } })
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } })
    fireEvent.change(phoneInput, { target: { value: '+254712345678' } })
    
    const submitButton = screen.getByRole('button', { name: /register|submit|save/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockCreatePatient).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'John',
          last_name: 'Doe',
          phone: '+254712345678'
        })
      )
    })
  })

  test('shows success message on successful registration', async () => {
    mockCreatePatient.mockResolvedValue({
      success: true,
      data: { id: '123' }
    })

    render(<RegistrationModule />)
    
    const firstNameInput = screen.getByLabelText(/first name/i)
    const lastNameInput = screen.getByLabelText(/last name/i)
    const phoneInput = screen.getByLabelText(/phone number/i)
    
    fireEvent.change(firstNameInput, { target: { value: 'John' } })
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } })
    fireEvent.change(phoneInput, { target: { value: '+254712345678' } })
    
    const submitButton = screen.getByRole('button', { name: /register|submit|save/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/success|registered|created/i),
          variant: 'default'
        })
      )
    })
  })

  test('handles form submission errors', async () => {
    mockCreatePatient.mockRejectedValue({
      message: 'Failed to create patient'
    })

    render(<RegistrationModule />)
    
    const firstNameInput = screen.getByLabelText(/first name/i)
    const lastNameInput = screen.getByLabelText(/last name/i)
    const phoneInput = screen.getByLabelText(/phone number/i)
    
    fireEvent.change(firstNameInput, { target: { value: 'John' } })
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } })
    fireEvent.change(phoneInput, { target: { value: '+254712345678' } })
    
    const submitButton = screen.getByRole('button', { name: /register|submit|save/i })
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

  test('disables submit button while loading', async () => {
    mockCreatePatient.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<RegistrationModule />)
    
    const firstNameInput = screen.getByLabelText(/first name/i)
    const lastNameInput = screen.getByLabelText(/last name/i)
    const phoneInput = screen.getByLabelText(/phone number/i)
    
    fireEvent.change(firstNameInput, { target: { value: 'John' } })
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } })
    fireEvent.change(phoneInput, { target: { value: '+254712345678' } })
    
    const submitButton = screen.getByRole('button', { name: /register|submit|save/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(submitButton).toBeDisabled()
    })
  })

  test('resets form after successful submission', async () => {
    mockCreatePatient.mockResolvedValue({
      success: true,
      data: { id: '123' }
    })

    render(<RegistrationModule />)
    
    const firstNameInput = screen.getByLabelText(/first name/i) as HTMLInputElement
    const lastNameInput = screen.getByLabelText(/last name/i) as HTMLInputElement
    
    fireEvent.change(firstNameInput, { target: { value: 'John' } })
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } })
    
    const submitButton = screen.getByRole('button', { name: /register|submit|save/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockCreatePatient).toHaveBeenCalled()
    })
    
    // Form should be reset
    await waitFor(() => {
      expect(firstNameInput.value).toBe('')
      expect(lastNameInput.value).toBe('')
    }, { timeout: 2000 })
  })
})

