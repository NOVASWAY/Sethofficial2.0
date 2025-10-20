'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { userAPI } from '../lib/api-client'

export interface SystemUser {
  id: string
  name: string
  phone?: string
  role: 'receptionist' | 'nurse' | 'clinician' | 'pharmacist' | 'admin'
  department?: string
  status: 'active' | 'inactive' | 'suspended'
  permissions: string[]
  avatar?: string
  licenseNumber?: string
  createdAt: string
  updatedAt: string
  lastLogin?: string
  createdBy?: string
  username?: string  // Add username for login
  password?: string  // Add password for authentication (will be hashed in production)
}

interface UserManagementContextType {
  users: SystemUser[]
  addUser: (user: Omit<SystemUser, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SystemUser>
  updateUser: (id: string, updates: Partial<SystemUser>) => void
  deleteUser: (id: string) => void
  getUserById: (id: string) => SystemUser | undefined
  getUserByUsername: (username: string) => SystemUser | undefined
  getUsersByRole: (role: SystemUser['role']) => SystemUser[]
  getActiveUsers: () => SystemUser[]
  updateUserPermissions: (id: string, permissions: string[]) => void
  suspendUser: (id: string, reason?: string) => void
  activateUser: (id: string) => void
  changeUserPassword: (id: string, newPassword: string) => void
  updateUserAvatar: (id: string, avatar: string | null) => void
}

const UserManagementContext = createContext<UserManagementContextType | undefined>(undefined)

// Removed localStorage key - now using API calls

export function UserManagementProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<SystemUser[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Load from API on mount
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await userAPI.getAll()
        setUsers(usersData || [])
      } catch (error) {
        console.error('Error loading users from API:', error)
        setUsers([])
      } finally {
        setIsInitialized(true)
      }
    }

    loadUsers()
  }, [])

  // Removed localStorage save effect - data is now persisted via API calls

  const addUser = async (userData: Omit<SystemUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<SystemUser> => {
    try {
      const newUser = await userAPI.create(userData)
      setUsers(prev => [...prev, newUser])
      return newUser
    } catch (error) {
      console.error('Error creating user:', error)
      throw error
    }
  }

  const updateUser = (id: string, updates: Partial<SystemUser>) => {
    setUsers(prev =>
      prev.map(user =>
        user.id === id
          ? { ...user, ...updates, updatedAt: new Date().toISOString() }
          : user
      )
    )
  }

  const deleteUser = (id: string) => {
    // Prevent deleting the last admin
    const user = users.find(u => u.id === id)
    if (user?.role === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin' && u.status === 'active').length
      if (adminCount <= 1) {
        throw new Error('Cannot delete the last active admin user')
      }
    }

    setUsers(prev => prev.filter(user => user.id !== id))
  }

  const getUserById = (id: string): SystemUser | undefined => {
    return users.find(user => user.id === id)
  }

  const getUserByUsername = (username: string): SystemUser | undefined => {
    return users.find(user => user.username === username)
  }

  const getUsersByRole = (role: SystemUser['role']): SystemUser[] => {
    return users.filter(user => user.role === role)
  }

  const getActiveUsers = (): SystemUser[] => {
    return users.filter(user => user.status === 'active')
  }

  const updateUserPermissions = (id: string, permissions: string[]) => {
    updateUser(id, { permissions })
  }

  const suspendUser = (id: string, reason?: string) => {
    // Prevent suspending the last admin
    const user = users.find(u => u.id === id)
    if (user?.role === 'admin') {
      const activeAdminCount = users.filter(u => u.role === 'admin' && u.status === 'active').length
      if (activeAdminCount <= 1) {
        throw new Error('Cannot suspend the last active admin user')
      }
    }

    updateUser(id, { status: 'suspended' })
  }

  const activateUser = (id: string) => {
    updateUser(id, { status: 'active' })
  }

  const changeUserPassword = (id: string, newPassword: string) => {
    // In a real system, this would hash the password
    // For now, we store it as plain text (NOT recommended for production!)
    updateUser(id, { 
      password: newPassword,
      updatedAt: new Date().toISOString() 
    })
    console.log(`Password changed for user ${id}`)
  }

  const updateUserAvatar = (id: string, avatar: string | null) => {
    updateUser(id, { avatar: avatar || undefined })
  }

  const value: UserManagementContextType = {
    users,
    addUser,
    updateUser,
    deleteUser,
    getUserById,
    getUserByUsername,
    getUsersByRole,
    getActiveUsers,
    updateUserPermissions,
    suspendUser,
    activateUser,
    changeUserPassword,
    updateUserAvatar,
  }

  return (
    <UserManagementContext.Provider value={value}>
      {children}
    </UserManagementContext.Provider>
  )
}

export function useUserManagement() {
  const context = useContext(UserManagementContext)
  if (context === undefined) {
    throw new Error('useUserManagement must be used within a UserManagementProvider')
  }
  return context
}

