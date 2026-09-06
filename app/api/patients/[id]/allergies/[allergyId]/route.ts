import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; allergyId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: params.id },
      select: { allergies: true },
    })

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const existing = (patient.allergies as any[]) || []
    const filtered = existing.filter((a: any) => a.id !== params.allergyId)

    await prisma.patient.update({
      where: { id: params.id },
      data: { allergies: filtered },
    })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error("Error removing allergy:", error)
    return NextResponse.json({ error: "Failed to remove allergy" }, { status: 500 })
  }
}
