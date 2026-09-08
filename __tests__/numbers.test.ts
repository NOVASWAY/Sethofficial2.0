import { generateNumber, generateSequentialNumber } from '@/lib/numbers'

describe('generateNumber', () => {
  test('generates patient number with PT prefix', () => {
    const num = generateNumber('patient')
    expect(num).toMatch(/^PT-/)
  })

  test('generates consultation number with CON prefix', () => {
    const num = generateNumber('consultation')
    expect(num).toMatch(/^CON-/)
  })

  test('generates invoice number with INV prefix', () => {
    const num = generateNumber('invoice')
    expect(num).toMatch(/^INV-/)
  })

  test('generates prescription number with RX prefix', () => {
    const num = generateNumber('prescription')
    expect(num).toMatch(/^RX-/)
  })

  test('generates lab order number with LAB prefix', () => {
    const num = generateNumber('labOrder')
    expect(num).toMatch(/^LAB-/)
  })

  test('generates unique numbers', () => {
    const numbers = new Set<string>()
    for (let i = 0; i < 100; i++) {
      numbers.add(generateNumber('patient'))
    }
    expect(numbers.size).toBe(100)
  })
})

describe('generateSequentialNumber', () => {
  test('generates first number when no previous exists', () => {
    const num = generateSequentialNumber('patient', null)
    expect(num).toBe('PT-00001')
  })

  test('increments from last number', () => {
    const num = generateSequentialNumber('patient', 'PT-00005')
    expect(num).toBe('PT-00006')
  })

  test('handles large numbers', () => {
    const num = generateSequentialNumber('patient', 'PT-00999')
    expect(num).toBe('PT-01000')
  })

  test('works for all prefixes', () => {
    expect(generateSequentialNumber('invoice', null)).toBe('INV-00001')
    expect(generateSequentialNumber('prescription', null)).toBe('RX-00001')
    expect(generateSequentialNumber('labOrder', null)).toBe('LAB-00001')
    expect(generateSequentialNumber('consultation', null)).toBe('CON-00001')
  })
})
