import { validators, validateForm, validationSchemas } from '@/lib/validation'

describe('Validators', () => {
  describe('required', () => {
    test('returns error for empty string', () => {
      expect(validators.required('', 'name')).toEqual({ field: 'name', message: 'name is required' })
    })

    test('returns error for null', () => {
      expect(validators.required(null, 'name')).toEqual({ field: 'name', message: 'name is required' })
    })

    test('returns error for undefined', () => {
      expect(validators.required(undefined, 'name')).toEqual({ field: 'name', message: 'name is required' })
    })

    test('returns error for whitespace-only string', () => {
      expect(validators.required('   ', 'name')).toEqual({ field: 'name', message: 'name is required' })
    })

    test('returns null for valid string', () => {
      expect(validators.required('John', 'name')).toBeNull()
    })

    test('returns null for number 0', () => {
      expect(validators.required(0, 'count')).toEqual({ field: 'count', message: 'count is required' })
    })
  })

  describe('email', () => {
    test('accepts valid email', () => {
      expect(validators.email('test@example.com', 'email')).toBeNull()
    })

    test('rejects invalid email', () => {
      expect(validators.email('not-an-email', 'email')).toEqual({
        field: 'email',
        message: 'Please enter a valid email address',
      })
    })

    test('returns null for empty value (not required)', () => {
      expect(validators.email('', 'email')).toBeNull()
    })
  })

  describe('phone', () => {
    test('accepts +254 format', () => {
      expect(validators.phone('+254712345678', 'phone')).toBeNull()
    })

    test('accepts 0 format', () => {
      expect(validators.phone('0712345678', 'phone')).toBeNull()
    })

    test('rejects too short', () => {
      expect(validators.phone('0712345', 'phone')).not.toBeNull()
    })

    test('accepts all 07x prefixes', () => {
      expect(validators.phone('0791234567', 'phone')).toBeNull()
    })

    test('returns null for empty value', () => {
      expect(validators.phone('', 'phone')).toBeNull()
    })
  })

  describe('minLength', () => {
    test('accepts string meeting minimum', () => {
      expect(validators.minLength('abc', 3, 'field')).toBeNull()
    })

    test('rejects string below minimum', () => {
      expect(validators.minLength('ab', 3, 'field')).toEqual({
        field: 'field',
        message: 'field must be at least 3 characters long',
      })
    })
  })

  describe('maxLength', () => {
    test('accepts string within limit', () => {
      expect(validators.maxLength('abc', 5, 'field')).toBeNull()
    })

    test('rejects string exceeding limit', () => {
      expect(validators.maxLength('abcdef', 5, 'field')).toEqual({
        field: 'field',
        message: 'field must not exceed 5 characters',
      })
    })
  })

  describe('number', () => {
    test('accepts valid number', () => {
      expect(validators.number(42, 'amount')).toBeNull()
    })

    test('accepts numeric string', () => {
      expect(validators.number('100', 'amount')).toBeNull()
    })

    test('rejects negative', () => {
      expect(validators.number(-1, 'amount')).not.toBeNull()
    })

    test('rejects NaN', () => {
      expect(validators.number('abc', 'amount')).not.toBeNull()
    })
  })

  describe('date', () => {
    test('accepts valid date string', () => {
      expect(validators.date('2024-01-15', 'date')).toBeNull()
    })

    test('rejects invalid date', () => {
      expect(validators.date('not-a-date', 'date')).toEqual({
        field: 'date',
        message: 'Please enter a valid date',
      })
    })
  })

  describe('futureDate', () => {
    test('accepts future date', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(validators.futureDate(tomorrow.toISOString().split('T')[0], 'date')).toBeNull()
    })

    test('rejects past date', () => {
      expect(validators.futureDate('2020-01-01', 'date')).not.toBeNull()
    })
  })

  describe('pastDate', () => {
    test('accepts past date', () => {
      expect(validators.pastDate('2020-01-01', 'date')).toBeNull()
    })

    test('rejects future date', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(validators.pastDate(tomorrow.toISOString().split('T')[0], 'date')).not.toBeNull()
    })
  })
})

describe('validateForm', () => {
  test('returns no errors for valid data', () => {
    const result = validateForm(
      { name: 'John', age: '30' },
      {
        name: [validators.required],
        age: [validators.required, validators.number],
      }
    )
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('collects multiple errors', () => {
    const result = validateForm(
      { name: '', email: 'invalid' },
      {
        name: [validators.required],
        email: [validators.required, validators.email],
      }
    )
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  test('skips validators for empty optional fields', () => {
    const result = validateForm(
      { name: '', email: '' },
      {
        name: [validators.required],
        email: [validators.email],
      }
    )
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].field).toBe('name')
  })
})

describe('Validation Schemas', () => {
  test('patient schema validates required fields', () => {
    const result = validateForm(
      {
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
        phone: '',
      },
      validationSchemas.patient
    )
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(5)
  })

  test('patient schema accepts valid data', () => {
    const result = validateForm(
      {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-15',
        gender: 'male',
        phone: '+254712345678',
        emergencyContact: 'Jane Doe',
        emergencyPhone: '+254712345679',
      },
      validationSchemas.patient
    )
    expect(result.isValid).toBe(true)
  })
})
