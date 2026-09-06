import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { quantity, batchNumber, expiryDate, unitCost } = body

  if (!quantity || quantity <= 0) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 })
  }

  const medicine = await prisma.medicine.findUnique({ where: { id: params.id } })
  if (!medicine) return NextResponse.json({ error: "Medicine not found" }, { status: 404 })

  const previousStock = medicine.currentStock
  const newStock = previousStock + quantity

  const updated = await prisma.medicine.update({
    where: { id: params.id },
    data: {
      currentStock: newStock,
      ...(batchNumber && { batchNumber }),
      ...(expiryDate && { expiryDate: new Date(expiryDate) }),
      ...(unitCost !== undefined && { unitPrice: unitCost }),
    },
  })

  await prisma.stockMovement.create({
    data: {
      medicationId: params.id,
      movementType: "receipt",
      quantity,
      previousQuantity: previousStock,
      newQuantity: newStock,
      referenceType: "stock_receive",
      notes: `Received ${quantity} units`,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
