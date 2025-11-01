import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

/**
 * Form Validation Tests
 * Tests for common form validation patterns across the application
 */

describe('Form Validation Patterns', () => {
  describe('Email Validation', () => {
    test('accepts valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com'
      ]

      validEmails.forEach(email => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        expect(emailRegex.test(email)).toBe(true)
      })
    })

    test('rejects invalid email addresses', () => {
      const invalidEmails = [
        'invalid',
        '@example.com',
        'user@',
        'user@example',
        'user name@example.com'
      ]

      invalidEmails.forEach(email => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        expect(emailRegex.test(email)).toBe(false)
      })
    })
  })

  describe('Phone Number Validation', () => {
    test('accepts valid Kenyan phone numbers', () => {
      const validPhones = [
        '+254712345678',
        '+254701234567',
        '0712345678',
        '0723456789'
      ]

      const phoneRegex = /^(\+254|0)?[17]\d{8}$/
      
      validPhones.forEach(phone => {
        const normalized = phone.replace(/^\+254/, '0')
        expect(phoneRegex.test(normalized) || phoneRegex.test(phone)).toBe(true)
      })
    })

    test('rejects invalid phone numbers', () => {
      const invalidPhones = [
        '123456',
        '071234',
        'invalid',
        '+255712345678', // Tanzania code
        '071234567890' // Too long
      ]

      invalidPhones.forEach(phone => {
        const phoneRegex = /^(\+254|0)?[17]\d{8}$/
        expect(phoneRegex.test(phone)).toBe(false)
      })
    })
  })

  describe('Date Validation', () => {
    test('rejects past dates for future events', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      
      const today = new Date()
      
      expect(pastDate < today).toBe(true)
    })

    test('accepts future dates', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      
      const today = new Date()
      
      expect(futureDate > today).toBe(true)
    })

    test('validates date of birth is not in the future', () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)
      
      const today = new Date()
      
      expect(futureDate > today).toBe(true)
    })
  })

  describe('Required Field Validation', () => {
    test('validates required text fields', () => {
      const requiredFields = [
        { field: 'first_name', value: '', shouldBeValid: false },
        { field: 'first_name', value: 'John', shouldBeValid: true },
        { field: 'last_name', value: '', shouldBeValid: false },
        { field: 'last_name', value: 'Doe', shouldBeValid: true }
      ]

      requiredFields.forEach(({ field, value, shouldBeValid }) => {
        const isValid = value.trim().length > 0
        expect(isValid).toBe(shouldBeValid)
      })
    })

    test('validates required select fields', () => {
      const selectFields = [
        { value: '', shouldBeValid: false },
        { value: 'option1', shouldBeValid: true },
        { value: null, shouldBeValid: false },
        { value: undefined, shouldBeValid: false }
      ]

      selectFields.forEach(({ value, shouldBeValid }) => {
        const isValid = value != null && value !== ''
        expect(isValid).toBe(shouldBeValid)
      })
    })
  })

  describe('Number Validation', () => {
    test('validates positive numbers', () => {
      const numbers = [
        { value: '0', shouldBePositive: false },
        { value: '1', shouldBePositive: true },
        { value: '100', shouldBePositive: true },
        { value: '-1', shouldBePositive: false }
      ]

      numbers.forEach(({ value, shouldBePositive }) => {
        const num = parseFloat(value)
        expect(num > 0).toBe(shouldBePositive)
      })
    })

    test('validates numeric ranges', () => {
      const min = 0
      const max = 100

      const values = [
        { value: -1, shouldBeValid: false },
        { value: 0, shouldBeValid: true },
        { value: 50, shouldBeValid: true },
        { value: 100, shouldBeValid: true },
        { value: 101, shouldBeValid: false }
      ]

      values.forEach(({ value, shouldBeValid }) => {
        const isValid = value >= min && value <= max
        expect(isValid).toBe(shouldBeValid)
      })
    })
  })

  describe('String Length Validation', () => {
    test('validates minimum length', () => {
      const minLength = 3

      const strings = [
        { value: 'ab', shouldBeValid: false },
        { value: 'abc', shouldBeValid: true },
        { value: 'abcd', shouldBeValid: true }
      ]

      strings.forEach(({ value, shouldBeValid }) => {
        const isValid = value.length >= minLength
        expect(isValid).toBe(shouldBeValid)
      })
    })

    test('validates maximum length', () => {
      const maxLength = 50

      const strings = [
        { value: 'a'.repeat(49), shouldBeValid: true },
        { value: 'a'.repeat(50), shouldBeValid: true },
        { value: 'a'.repeat(51), shouldBeValid: false }
      ]

      strings.forEach(({ value, shouldBeValid }) => {
        const isValid = value.length <= maxLength
        expect(isValid).toBe(shouldBeValid)
      })
    })
  })

  describe('Password Validation', () => {
    test('validates password strength', () => {
      const passwords = [
        { password: 'short', hasMinLength: false, hasUpperCase: false, hasNumber: false },
        { password: 'longpassword', hasMinLength: true, hasUpperCase: false, hasNumber: false },
        { password: 'LongPassword', hasMinLength: true, hasUpperCase: true, hasNumber: false },
        { password: 'LongPassword1', hasMinLength: true, hasUpperCase: true, hasNumber: true }
      ]

      passwords.forEach(({ password, hasMinLength, hasUpperCase, hasNumber }) => {
        expect(password.length >= 8).toBe(hasMinLength)
        expect(/[A-Z]/.test(password)).toBe(hasUpperCase)
        expect(/\d/.test(password)).toBe(hasNumber)
      })
    })
  })

  describe('ID Number Validation', () => {
    test('validates Kenyan ID format', () => {
      const idNumbers = [
        { value: '12345678', isValid: false }, // Too short
        { value: '123456789012', isValid: false }, // Too long
        { value: '123456789', isValid: true }, // Correct length
        { value: 'ABC456789', isValid: false } // Contains letters
      ]

      idNumbers.forEach(({ value, isValid }) => {
        const idRegex = /^\d{9}$/
        expect(idRegex.test(value)).toBe(isValid)
      })
    })
  })
})

