import { Medicine, MedicineBatch } from '@/components/medicine-catalog'

export interface ExpiryAlert {
  medicineId: string
  medicineName: string
  batchNumber: string
  expiryDate: string
  daysUntilExpiry: number
  quantity: number
  severity: 'expired' | 'critical' | 'warning' | 'ok'
}

/**
 * Calculate days until expiry
 */
export function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date()
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Get expiry severity level
 */
export function getExpirySeverity(daysUntilExpiry: number): ExpiryAlert['severity'] {
  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= 30) return 'critical'
  if (daysUntilExpiry <= 90) return 'warning'
  return 'ok'
}

/**
 * Get expiry status for a given expiry date
 */
export function getExpiryStatus(expiryDate: string): 'expired' | 'critical' | 'warning' | 'normal' {
  const days = getDaysUntilExpiry(expiryDate)
  if (days < 0) return 'expired'
  if (days <= 30) return 'critical'
  if (days <= 90) return 'warning'
  return 'normal'
}

/**
 * Check if medicine is expired
 */
export function isExpired(expiryDate: string): boolean {
  return getDaysUntilExpiry(expiryDate) < 0
}

/**
 * Check if medicine is expiring soon (within threshold days)
 */
export function isExpiringSoon(expiryDate: string, thresholdDays: number = 90): boolean {
  const days = getDaysUntilExpiry(expiryDate)
  return days >= 0 && days <= thresholdDays
}

/**
 * Get all expiry alerts for a medicine's batches
 */
export function getMedicineExpiryAlerts(medicine: Medicine): ExpiryAlert[] {
  if (!medicine.batches || medicine.batches.length === 0) return []

  const alerts: ExpiryAlert[] = []

  for (const batch of medicine.batches) {
    const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate)
    const severity = getExpirySeverity(daysUntilExpiry)

    // Only include if expired, critical, or warning
    if (severity !== 'ok') {
      alerts.push({
        medicineId: medicine.id,
        medicineName: `${medicine.name} ${medicine.strength}`,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        daysUntilExpiry,
        quantity: batch.quantity,
        severity,
      })
    }
  }

  return alerts
}

/**
 * Get all expiry alerts across all medicines
 */
export function getAllExpiryAlerts(medicines: Medicine[]): ExpiryAlert[] {
  const allAlerts: ExpiryAlert[] = []

  for (const medicine of medicines) {
    const alerts = getMedicineExpiryAlerts(medicine)
    allAlerts.push(...alerts)
  }

  // Sort by days until expiry (most urgent first)
  return allAlerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
}

/**
 * Get nearest expiry date from batches
 */
export function getNearestExpiryDate(batches: MedicineBatch[]): string | undefined {
  if (!batches || batches.length === 0) return undefined

  let nearestDate = batches[0].expiryDate
  let nearestDays = getDaysUntilExpiry(nearestDate)

  for (const batch of batches) {
    const days = getDaysUntilExpiry(batch.expiryDate)
    if (days < nearestDays) {
      nearestDate = batch.expiryDate
      nearestDays = days
    }
  }

  return nearestDate
}

/**
 * Format expiry status for display
 */
export function formatExpiryStatus(expiryDate: string): {
  text: string
  color: string
  bgColor: string
} {
  const days = getDaysUntilExpiry(expiryDate)
  const severity = getExpirySeverity(days)

  switch (severity) {
    case 'expired':
      return {
        text: `Expired ${Math.abs(days)} days ago`,
        color: 'text-red-700',
        bgColor: 'bg-red-100 border-red-300',
      }
    case 'critical':
      return {
        text: `Expires in ${days} days`,
        color: 'text-orange-700',
        bgColor: 'bg-orange-100 border-orange-300',
      }
    case 'warning':
      return {
        text: `Expires in ${days} days`,
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100 border-yellow-300',
      }
    default:
      return {
        text: `Expires in ${days} days`,
        color: 'text-green-700',
        bgColor: 'bg-green-100 border-green-300',
      }
  }
}

