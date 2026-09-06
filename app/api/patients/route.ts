import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || searchParams.get("limit") || "50")
  const search = searchParams.get("search") || ""
  const skip = (page - 1) * perPage

  const where = search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { patientNumber: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
    }),
    prisma.patient.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      data: patients,
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Generate patient number
  const lastPatient = await prisma.patient.findFirst({
    orderBy: { createdAt: "desc" },
    select: { patientNumber: true },
  })
  const nextNumber = lastPatient
    ? parseInt(lastPatient.patientNumber.replace("PT-", "")) + 1
    : 1
  const patientNumber = `PT-${String(nextNumber).padStart(5, "0")}`

  const patient = await prisma.patient.create({
    data: {
      patientNumber,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: new Date(body.dateOfBirth),
      gender: body.gender,
      phone: body.phone,
      email: body.email,
      address: body.address,
      emergencyContact: body.emergencyContact,
      emergencyPhone: body.emergencyPhone,
      bloodType: body.bloodType,
      allergies: body.allergies || [],
      medicalHistory: body.medicalHistory,
      insuranceType: body.insuranceType,
      insuranceNumber: body.insuranceNumber,
      age: body.age,
    },
  })

  return NextResponse.json({ success: true, data: patient }, { status: 201 })
}
