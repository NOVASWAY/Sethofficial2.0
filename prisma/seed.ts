import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create default users
  const users = [
    {
      username: "admin",
      email: "admin@sethmedical.com",
      password: "admin123",
      role: "admin",
      name: "System Administrator",
      department: "Administration",
    },
    {
      username: "receptionist",
      email: "receptionist@sethmedical.com",
      password: "receptionist123",
      role: "receptionist",
      name: "Jane Receptionist",
      department: "Front Desk",
    },
    {
      username: "nurse",
      email: "nurse@sethmedical.com",
      password: "nurse123",
      role: "nurse",
      name: "Nurse Joy",
      department: "Nursing",
    },
    {
      username: "clinician",
      email: "clinician@sethmedical.com",
      password: "clinician123",
      role: "clinician",
      name: "Dr. Smith",
      department: "General Practice",
    },
    {
      username: "pharmacist",
      email: "pharmacist@sethmedical.com",
      password: "pharmacist123",
      role: "pharmacist",
      name: "Pharmacist Lee",
      department: "Pharmacy",
    },
    {
      username: "labtech",
      email: "labtech@sethmedical.com",
      password: "labtech123",
      role: "lab_technician",
      name: "Lab Tech Paul",
      department: "Laboratory",
    },
  ]

  for (const userData of users) {
    const passwordHash = await hash(userData.password, 12)
    await prisma.user.upsert({
      where: { username: userData.username },
      update: {},
      create: {
        username: userData.username,
        email: userData.email,
        passwordHash,
        role: userData.role,
        name: userData.name,
        department: userData.department,
        permissions: userData.role === "admin" ? ["all"] : [],
      },
    })
    console.log(`  Created user: ${userData.username} (${userData.role})`)
  }

  // Create default services
  const services = [
    { serviceCode: "CONSULT-001", serviceName: "General Consultation", category: "consultation", unitPrice: 500, cashPrice: 500, shaPrice: 450, shaApproved: true },
    { serviceCode: "CONSULT-002", serviceName: "Specialist Consultation", category: "consultation", unitPrice: 1000, cashPrice: 1000, shaPrice: 900, shaApproved: true },
    { serviceCode: "CONSULT-003", serviceName: "Follow-up Visit", category: "consultation", unitPrice: 300, cashPrice: 300, shaPrice: 250, shaApproved: true },
    { serviceCode: "LAB-001", serviceName: "Complete Blood Count", category: "laboratory", unitPrice: 800, cashPrice: 800, shaPrice: 700, shaApproved: true },
    { serviceCode: "LAB-002", serviceName: "Urinalysis", category: "laboratory", unitPrice: 400, cashPrice: 400, shaPrice: 350, shaApproved: true },
    { serviceCode: "LAB-003", serviceName: "Blood Sugar (Random)", category: "laboratory", unitPrice: 200, cashPrice: 200, shaPrice: 180, shaApproved: true },
    { serviceCode: "PROC-001", serviceName: "Wound Dressing", category: "procedure", unitPrice: 500, cashPrice: 500, shaPrice: 400, shaApproved: true },
    { serviceCode: "PROC-002", serviceName: "Injection (IM/IV)", category: "procedure", unitPrice: 200, cashPrice: 200, shaPrice: 150, shaApproved: true },
    { serviceCode: "IMG-001", serviceName: "X-Ray (Single View)", category: "imaging", unitPrice: 1500, cashPrice: 1500, shaPrice: 1200, shaApproved: true },
  ]

  for (const service of services) {
    await prisma.service.upsert({
      where: { serviceCode: service.serviceCode },
      update: {},
      create: service,
    })
  }
  console.log(`  Created ${services.length} services`)

  // Create default system settings
  const settings = [
    { key: "clinic_name", value: "Seth Medical Clinic", description: "Name of the medical clinic", category: "general" },
    { key: "clinic_address", value: "123 Medical Street, Nairobi, Kenya", description: "Physical address of the clinic", category: "general" },
    { key: "clinic_phone", value: "+254 20 123 4567", description: "Main phone number of the clinic", category: "general" },
    { key: "clinic_email", value: "info@sethmedical.com", description: "Main email address of the clinic", category: "general" },
    { key: "business_hours_start", value: "08:00", description: "Business hours start time", category: "schedule" },
    { key: "business_hours_end", value: "18:00", description: "Business hours end time", category: "schedule" },
    { key: "tax_rate", value: "16", description: "VAT rate percentage", category: "billing" },
    { key: "currency", value: "KES", description: "Default currency code", category: "billing" },
  ]

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
  }
  console.log(`  Created ${settings.length} system settings`)

  console.log("Database seeded successfully!")
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
