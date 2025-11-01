import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useRouter } from 'next/navigation'
import LoginPage from '@/app/page'
import { useAuth } from '@/contexts/auth-context'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn()
  })
}))

// Mock auth context
jest.mock('@/contexts/auth-context', () => ({
  useAuth: jest.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Mock API client
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    post: jest.fn()
  }
}))

describe('Authentication Flow', () => {
  const mockLogin = jest.fn()
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    
    ;(useAuth as jest.Mock).mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      login: mockLogin,
      logout: jest.fn(),
      isLoading: false
    })

    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn()
    })
  })

  test('renders login form', () => {
    render(<LoginPage />)
    
    expect(screen.getByLabelText(/username|email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login|sign in/i })).toBeInTheDocument()
  })

  test('validates required fields', async () => {
    render(<LoginPage />)
    
    const submitButton = screen.getByRole('button', { name: /login|sign in/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/required|please enter/i)).toBeInTheDocument()
    })
  })

  test('handles successful login', async () => {
    mockLogin.mockResolvedValue({
      success: true,
      data: {
        access_token: 'test-token',
        user: { id: '123', username: 'testuser', role: 'clinician' }
      }
    })

    render(<LoginPage />)
    
    const usernameInput = screen.getByLabelText(/username|email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    
    const submitButton = screen.getByRole('button', { name: /login|sign in/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123'
      })
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/dashboard/i))
    })
  })

  test('handles login errors', async () => {
    mockLogin.mockRejectedValue({
      message: 'Invalid credentials'
    })

    render(<LoginPage />)
    
    const usernameInput = screen.getByLabelText(/username|email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    
    const submitButton = screen.getByRole('button', { name: /login|sign in/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/invalid|credentials|error/i)).toBeInTheDocument()
    })
  })

  test('shows loading state during login', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<LoginPage />)
    
    const usernameInput = screen.getByLabelText(/username|email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    
    const submitButton = screen.getByRole('button', { name: /login|sign in/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(submitButton).toBeDisabled()
      expect(screen.getByText(/loading|logging in/i)).toBeInTheDocument()
    })
  })

  test('redirects authenticated users', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: '123', username: 'testuser' },
      token: 'test-token',
      isAuthenticated: true,
      login: mockLogin,
      logout: jest.fn(),
      isLoading: false
    })

    render(<LoginPage />)
    
    // Should redirect to dashboard
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/dashboard/i))
  })

  test('validates password length', async () => {
    render(<LoginPage />)
    
    const usernameInput = screen.getByLabelText(/username|email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'short' } })
    
    const submitButton = screen.getByRole('button', { name: /login|sign in/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/password|length|minimum/i)).toBeInTheDocument()
    })
  })

  test('handles network errors', async () => {
    mockLogin.mockRejectedValue({
      message: 'Network error',
      code: 'NETWORK_ERROR'
    })

    render(<LoginPage />)
    
    const usernameInput = screen.getByLabelText(/username|email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    
    const submitButton = screen.getByRole('button', { name: /login|sign in/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/network|connection|error/i)).toBeInTheDocument()
    })
  })
})

