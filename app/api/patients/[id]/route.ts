import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    include: {
      consultations: { orderBy: { visitDate: "desc" }, take: 10 },
      appointments: { orderBy: { date: "desc" }, take: 10 },
      prescriptions: { orderBy: { createdAt: "desc" }, take: 10 },
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
      labOrders: { orderBy: { orderedAt: "desc" }, take: 10 },
    },
  })

  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })
  return NextResponse.json(patient)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const patient = await prisma.patient.update({
    where: { id: params.id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      gender: body.gender,
      phone: body.phone,
      email: body.email,
      address: body.address,
      emergencyContact: body.emergencyContact,
      emergencyPhone: body.emergencyPhone,
      bloodType: body.bloodType,
      allergies: body.allergies,
      medicalHistory: body.medicalHistory,
      insuranceType: body.insuranceType,
      insuranceNumber: body.insuranceNumber,
      age: body.age,
    },
  })

  return NextResponse.json(patient)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.patient.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
