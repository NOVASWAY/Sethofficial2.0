// Authentication utilities and types
import { authAPI, apiClient } from './api-client'

// Function to get users from user management system (localStorage)
function getUsersFromUserManagement(): any[] {
  if (typeof window === 'undefined') return []
  
  try {
    const usersData = localStorage.getItem('clinic_users_data')
    if (usersData) {
      return JSON.parse(usersData)
    }
  } catch (error) {
    console.error('Error loading users from user management:', error)
  }
  
  return []
}

export interface User {
  id: string
  username: string
  email?: string  // Optional - not required
  role: 'receptionist' | 'nurse' | 'clinician' | 'pharmacist' | 'admin'
  name: string
  department?: string
  permissions?: string[]  // Optional - backend doesn't return this yet
  avatar?: string
  is_active: boolean  // Backend returns snake_case
  lastLogin?: string
  created_at: string  // Backend returns snake_case
  updated_at: string  // Backend returns snake_case
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface LoginCredentials {
  username: string
  password: string
  role: string
}

// No mock data - all authentication is handled via API

// Real authentication function using API
export async function authenticateUser(credentials: LoginCredentials): Promise<{ user: User; token: string } | null> {
  try {
    const response = await authAPI.login(credentials.username, credentials.password)
    
    // Validate response structure
    if (!response || !response.user) {
      throw new Error('Invalid response from server. Please try again.')
    }
    
    // Validate user is active
    if (!response.user.is_active) {
      throw new Error('Account is deactivated. Please contact administrator.')
    }
    
    // Store tokens securely
    apiClient.setToken(response.token)
    localStorage.setItem('auth_token', response.token)
    localStorage.setItem('refresh_token', response.refresh_token)
    localStorage.setItem('user_data', JSON.stringify(response.user))
    
    // Log successful login
    console.log(`User ${response.user.username} logged in successfully`)
    
    return { user: response.user, token: response.token }
  } catch (error) {
    // No fallback - all authentication must go through the API
    console.error('Authentication failed:', error)
    throw error
  }
}

// Token validation with enhanced security
export function validateToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token))
    
    // Check if token is expired (using seconds for consistency)
    const currentTime = Math.floor(Date.now() / 1000)
    if (payload.exp < currentTime) {
      console.warn('Token has expired')
      return null
    }
    
    // Validate token structure
    if (!payload.userId || !payload.role || !payload.username) {
      console.warn('Invalid token structure')
      return null
    }
    
    // For now, we'll trust the JWT token from the backend
    // In a production system, you might want to validate against the database
    const user: User = {
      id: payload.userId,
      username: payload.username,
      email: payload.email || '',
      role: payload.role,
      name: payload.name || payload.username,
      department: payload.department || '',
      permissions: payload.permissions || [],
      avatar: payload.avatar || '',
      is_active: true, // Assume active if token is valid
      lastLogin: payload.lastLogin || new Date().toISOString(),
      created_at: payload.created_at || new Date().toISOString(),
      updated_at: payload.updated_at || new Date().toISOString()
    }
    
    return user
  } catch (error) {
    console.error('Token validation error:', error)
    return null
  }
}

// Helper function to compare arrays
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((val, index) => val === sortedB[index])
}

// Check if user has permission
export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false
  if (!user.permissions) return false
  if (user.permissions.includes('all')) return true
  return user.permissions.includes(permission)
}

// Check if user has any of the specified permissions
export function hasAnyPermission(user: User | null, permissions: string[]): boolean {
  if (!user) return false
  if (!user.permissions) return false
  if (user.permissions.includes('all')) return true
  return permissions.some(permission => user.permissions?.includes(permission))
}

// Check if user has all of the specified permissions
export function hasAllPermissions(user: User | null, permissions: string[]): boolean {
  if (!user) return false
  if (!user.permissions) return false
  if (user.permissions.includes('all')) return true
  return permissions.every(permission => user.permissions?.includes(permission))
}

// Check if user can access a specific role-based resource
export function canAccessRole(user: User | null, requiredRole: string): boolean {
  if (!user) return false
  
  const roleHierarchy = {
    'admin': 5,
    'clinician': 4,
    'nurse': 3,
    'pharmacist': 2,
    'receptionist': 1
  }
  
  const userLevel = roleHierarchy[user.role as keyof typeof roleHierarchy] || 0
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0
  
  return userLevel >= requiredLevel
}

// Get user from localStorage with enhanced validation
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  
  try {
    // Try to get user from stored data first
    const userData = localStorage.getItem('user_data')
    if (userData) {
      const user = JSON.parse(userData)
      
      // Validate token if available
      const token = localStorage.getItem('auth_token')
      if (token) {
        const validatedUser = validateToken(token)
        if (validatedUser && validatedUser.id === user.id) {
          return validatedUser
        } else {
          // Token is invalid, clear stored data
          clearAuthData()
          return null
        }
      }
      
      return user
    }
    
    // Fallback to token validation
    const token = localStorage.getItem('auth_token')
    if (!token) return null
    
    return validateToken(token)
  } catch (error) {
    console.error('Error getting stored user:', error)
    clearAuthData()
    return null
  }
}

// Store user token with additional security
export function storeAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  
  try {
    // Validate token before storing
    const user = validateToken(token)
    if (!user) {
      console.warn('Invalid token provided, not storing')
      return
    }
    
    localStorage.setItem('auth_token', token)
    localStorage.setItem('token_timestamp', Date.now().toString())
  } catch (error) {
    console.error('Error storing auth token:', error)
  }
}

// Remove user token and clear all auth data
export function removeAuthToken(): void {
  if (typeof window === 'undefined') return
  clearAuthData()
}

// Clear all authentication data
export function clearAuthData(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_data')
    localStorage.removeItem('token_timestamp')
    
    // Clear API client token
    apiClient.clearToken()
    
    console.log('Authentication data cleared')
  } catch (error) {
    console.error('Error clearing auth data:', error)
  }
}

// Check if token is about to expire (within 5 minutes)
export function isTokenExpiringSoon(): boolean {
  if (typeof window === 'undefined') return false
  
  const token = localStorage.getItem('auth_token')
  if (!token) return false
  
  try {
    const payload = JSON.parse(atob(token))
    const currentTime = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = payload.exp - currentTime
    
    // Return true if token expires within 5 minutes
    return timeUntilExpiry < 300
  } catch {
    return true // If we can't parse the token, consider it expired
  }
}

// Get token expiry time in minutes
export function getTokenExpiryMinutes(): number {
  if (typeof window === 'undefined') return 0
  
  const token = localStorage.getItem('auth_token')
  if (!token) return 0
  
  try {
    const payload = JSON.parse(atob(token))
    const currentTime = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = payload.exp - currentTime
    
    return Math.max(0, Math.floor(timeUntilExpiry / 60))
  } catch {
    return 0
  }
}

// Refresh authentication token
export async function refreshAuthToken(): Promise<{ user: User; token: string } | null> {
  try {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await authAPI.refreshToken()
    
    // Update stored tokens
    apiClient.setToken(response.token)
    localStorage.setItem('auth_token', response.token)
    localStorage.setItem('token_timestamp', Date.now().toString())
    
    // Get user data from localStorage
    const userData = localStorage.getItem('user_data')
    const user = userData ? JSON.parse(userData) : null
    
    console.log('Token refreshed successfully')
    return { user, token: response.token }
  } catch (error) {
    console.error('Token refresh failed:', error)
    // Clear auth data on refresh failure
    clearAuthData()
    return null
  }
}

// Auto-refresh token if it's expiring soon
export async function autoRefreshTokenIfNeeded(): Promise<boolean> {
  if (isTokenExpiringSoon()) {
    console.log('Token expiring soon, attempting refresh...')
    const result = await refreshAuthToken()
    return result !== null
  }
  return true
}

// Get user session info
export function getSessionInfo(): { 
  user: User | null; 
  isAuthenticated: boolean; 
  tokenExpiryMinutes: number; 
  needsRefresh: boolean 
} {
  const user = getStoredUser()
  const tokenExpiryMinutes = getTokenExpiryMinutes()
  const needsRefresh = isTokenExpiringSoon()
  
  return {
    user,
    isAuthenticated: !!user,
    tokenExpiryMinutes,
    needsRefresh
  }
}
