import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const patient = await prisma.patient.findUnique({
      where: { id: params.id },
      select: { allergies: true },
    })

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const existing = (patient.allergies as any[]) || []
    const newAllergy = {
      id: `ALG-${Date.now()}`,
      ...body,
    }

    await prisma.patient.update({
      where: { id: params.id },
      data: { allergies: [...existing, newAllergy] },
    })

    return NextResponse.json(newAllergy, { status: 201 })
  } catch (error) {
    console.error("Error adding allergy:", error)
    return NextResponse.json({ error: "Failed to add allergy" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const url = new URL(req.url)
    const allergyId = url.pathname.split("/allergies/")[1]

    const patient = await prisma.patient.findUnique({
      where: { id: params.id },
      select: { allergies: true },
    })

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const existing = (patient.allergies as any[]) || []
    const filtered = existing.filter((a: any) => a.id !== allergyId)

    await prisma.patient.update({
      where: { id: params.id },
      data: { allergies: filtered },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing allergy:", error)
    return NextResponse.json({ error: "Failed to remove allergy" }, { status: 500 })
  }
}
