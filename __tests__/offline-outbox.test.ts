import { isQueueable, enqueueOffline, getPendingCount, processOutbox } from '@/lib/offline-outbox'

beforeEach(() => {
  localStorage.clear()
  jest.restoreAllMocks()
})

describe('offline outbox', () => {
  test('queues patient, appointment, invoice, allergy POSTs', () => {
    expect(isQueueable('/patients', 'POST')).toBe('Patient registration')
    expect(isQueueable('/appointments', 'POST')).toBe('Appointment')
    expect(isQueueable('/invoices', 'POST')).toBe('Cash bill')
    expect(isQueueable('/patients/abc/allergies', 'POST')).toBe('Allergy note')
  })

  test('refuses M-Pesa, auth, and GET endpoints', () => {
    expect(isQueueable('/mpesa/stk-push', 'POST')).toBeNull()
    expect(isQueueable('/auth/password-reset', 'POST')).toBeNull()
    expect(isQueueable('/patients', 'GET')).toBeNull()
    expect(isQueueable('/invoices/1/pay', 'POST')).toBeNull()
  })

  test('enqueue + process syncs and clears queue', async () => {
    enqueueOffline('/patients', 'POST', JSON.stringify({ firstName: 'A' }), 'Patient registration')
    expect(getPendingCount()).toBe(1)

    global.fetch = jest.fn().mockResolvedValue({ ok: true })
    const result = await processOutbox()
    expect(result.synced).toBe(1)
    expect(result.remaining).toBe(0)
    expect(getPendingCount()).toBe(0)
  })

  test('failed sync keeps entry with bumped attempts', async () => {
    enqueueOffline('/patients', 'POST', JSON.stringify({ firstName: 'A' }), 'Patient registration')
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })
    const result = await processOutbox()
    expect(result.synced).toBe(0)
    expect(result.remaining).toBe(1)
    expect(getPendingCount()).toBe(1)
  })
})
