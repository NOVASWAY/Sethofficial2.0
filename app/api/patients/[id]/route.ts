import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateBody } from "@/lib/api-handler"
import { patientUpdateSchema } from "@/lib/validation"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

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

    if (!patient) return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: patient })
  } catch (error) {
    console.error("[Patient GET Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const body = await validateBody(req, patientUpdateSchema)

    const patient = await prisma.patient.update({
      where: { id: params.id },
      data: {
        ...(body.firstName && { firstName: body.firstName }),
        ...(body.lastName && { lastName: body.lastName }),
        ...(body.dateOfBirth && { dateOfBirth: new Date(body.dateOfBirth) }),
        ...(body.gender && { gender: body.gender }),
        ...(body.phone && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.emergencyContact !== undefined && { emergencyContact: body.emergencyContact }),
        ...(body.emergencyPhone !== undefined && { emergencyPhone: body.emergencyPhone }),
        ...(body.bloodType !== undefined && { bloodType: body.bloodType }),
        ...(body.allergies && { allergies: body.allergies }),
        ...(body.medicalHistory !== undefined && { medicalHistory: body.medicalHistory }),
        ...(body.insuranceType !== undefined && { insuranceType: body.insuranceType }),
        ...(body.insuranceNumber !== undefined && { insuranceNumber: body.insuranceNumber }),
        ...(body.age !== undefined && { age: body.age }),
      },
    })

    return NextResponse.json({ success: true, data: patient })
  } catch (error) {
    console.error("[Patient PUT Error]", error)
    if (error instanceof Error && error.message.includes("Record to update not found")) {
      return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "admin") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })

    await prisma.patient.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error("[Patient DELETE Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
