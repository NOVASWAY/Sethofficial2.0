import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const medicine = await prisma.medicine.findUnique({ where: { id: params.id } })
  if (!medicine) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ success: true, data: medicine })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const medicine = await prisma.medicine.update({
    where: { id: params.id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.genericName !== undefined && { genericName: body.genericName }),
      ...(body.category && { category: body.category }),
      ...(body.dosageForm && { dosageForm: body.dosageForm }),
      ...(body.strength && { strength: body.strength }),
      ...(body.manufacturer !== undefined && { manufacturer: body.manufacturer }),
      ...(body.batchNumber !== undefined && { batchNumber: body.batchNumber }),
      ...(body.expiryDate && { expiryDate: new Date(body.expiryDate) }),
      ...(body.currentStock !== undefined && { currentStock: body.currentStock }),
      ...(body.minimumStock !== undefined && { minimumStock: body.minimumStock }),
      ...(body.reorderLevel !== undefined && { reorderLevel: body.reorderLevel }),
      ...(body.unitPrice !== undefined && { unitPrice: body.unitPrice }),
      ...(body.location !== undefined && { location: body.location }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.sideEffects !== undefined && { sideEffects: body.sideEffects }),
    },
  })

  return NextResponse.json({ success: true, data: medicine })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.medicine.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true, data: { deleted: true } })
}
