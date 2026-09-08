import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import LoginPage from '@/app/page'
import { signIn, useSession } from 'next-auth/react'

jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  useSession: jest.fn(),
}))

describe('Login Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })
  })

  test('renders login form with username and password fields', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  test('displays Seth Medical Clinic branding', () => {
    render(<LoginPage />)
    expect(screen.getByText('Seth Medical Clinic')).toBeInTheDocument()
    expect(screen.getByText('Management System')).toBeInTheDocument()
  })

  test('disables sign in button when fields are empty', () => {
    render(<LoginPage />)
    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button).toBeDisabled()
  })

  test('enables sign in button when fields are filled', () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'admin123' } })
    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button).not.toBeDisabled()
  })

  test('calls signIn with credentials on form submit', async () => {
    ;(signIn as jest.Mock).mockResolvedValue({ error: null })
    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'admin123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('credentials', {
        username: 'admin',
        password: 'admin123',
        redirect: false,
      })
    })
  })

  test('shows error message on failed login', async () => {
    ;(signIn as jest.Mock).mockResolvedValue({ error: 'CredentialsSignin' })
    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })

  test('shows loading state while signing in', async () => {
    ;(signIn as jest.Mock).mockImplementation(() => new Promise(() => {}))
    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'admin123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument()
    })
  })

  test('redirects authenticated users', () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: { user: { role: 'admin' } },
      status: 'authenticated',
    })
    const { container } = render(<LoginPage />)
    expect(container.innerHTML).toBe('')
  })
})
