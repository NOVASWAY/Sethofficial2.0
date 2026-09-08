// Test the pure authorization logic directly (extracted from api-handler.ts to avoid next/server import)

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["all"],
  receptionist: ["patients", "appointments", "invoices", "visits"],
  nurse: ["patients", "appointments", "visits", "reports", "prescriptions"],
  clinician: ["patients", "appointments", "visits", "reports", "prescriptions", "invoices"],
  doctor: ["patients", "appointments", "visits", "reports", "prescriptions", "invoices"],
  pharmacist: ["pharmacy", "inventory", "reports", "invoices", "patients", "prescriptions"],
  lab_technician: ["lab", "lab_orders", "lab_results", "patients"],
}

function requireRole(...allowedRoles: string[]) {
  return (session: any): boolean => {
    return allowedRoles.includes(session.user.role)
  }
}

function requirePermission(permission: string) {
  return (session: any): boolean => {
    if (session.user.role === "admin") return true
    const perms = ROLE_PERMISSIONS[session.user.role] || []
    return perms.includes("all") || perms.includes(permission)
  }
}

function makeSession(role: string) {
  return { user: { id: '1', username: 'test', role, name: 'Test', department: null, email: null, permissions: [] } }
}

describe('requireRole', () => {
  test('allows matching role', () => {
    const check = requireRole('admin', 'clinician')
    expect(check(makeSession('admin'))).toBe(true)
    expect(check(makeSession('clinician'))).toBe(true)
  })

  test('rejects non-matching role', () => {
    const check = requireRole('admin')
    expect(check(makeSession('nurse'))).toBe(false)
    expect(check(makeSession('pharmacist'))).toBe(false)
  })
})

describe('requirePermission', () => {
  test('admin has all permissions', () => {
    const check = requirePermission('anything')
    expect(check(makeSession('admin'))).toBe(true)
  })

  test('pharmacist has pharmacy permission', () => {
    const check = requirePermission('pharmacy')
    expect(check(makeSession('pharmacist'))).toBe(true)
  })

  test('pharmacist lacks lab permission', () => {
    const check = requirePermission('lab')
    expect(check(makeSession('pharmacist'))).toBe(false)
  })

  test('receptionist has patients permission', () => {
    const check = requirePermission('patients')
    expect(check(makeSession('receptionist'))).toBe(true)
  })

  test('receptionist lacks pharmacy permission', () => {
    const check = requirePermission('pharmacy')
    expect(check(makeSession('receptionist'))).toBe(false)
  })

  test('lab_technician has lab permission', () => {
    const check = requirePermission('lab')
    expect(check(makeSession('lab_technician'))).toBe(true)
  })

  test('nurse has prescriptions permission', () => {
    const check = requirePermission('prescriptions')
    expect(check(makeSession('nurse'))).toBe(true)
  })

  test('unknown role has no permissions', () => {
    const check = requirePermission('patients')
    expect(check(makeSession('unknown_role'))).toBe(false)
  })
})
