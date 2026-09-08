import crypto from "crypto"

const PREFIX_MAP: Record<string, string> = {
  patient: "PT",
  consultation: "CON",
  invoice: "INV",
  prescription: "RX",
  labOrder: "LAB",
  labResult: "RES",
  appointment: "APT",
  medicine: "MED",
  service: "SVC",
  claim: "CLM",
  transaction: "TXN",
  task: "TSK",
}

export function generateNumber(type: keyof typeof PREFIX_MAP): string {
  const prefix = PREFIX_MAP[type] || "REC"
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomBytes(3).toString("hex").toUpperCase()
  return `${prefix}-${timestamp}${random}`
}

export function generateSequentialNumber(type: keyof typeof PREFIX_MAP, lastNumber: string | null): string {
  const prefix = PREFIX_MAP[type] || "REC"
  if (!lastNumber) {
    return `${prefix}-00001`
  }
  const numPart = lastNumber.replace(`${prefix}-`, "")
  const nextNum = parseInt(numPart, 10) + 1
  return `${prefix}-${String(nextNum).padStart(5, "0")}`
}
