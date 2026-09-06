import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const prescription = await prisma.prescription.findUnique({
    where: { id: params.id },
    include: { items: true },
  })

  if (!prescription) {
    return NextResponse.json({ error: "Prescription not found" }, { status: 404 })
  }

  if (prescription.status === "dispensed") {
    return NextResponse.json({ error: "Already dispensed" }, { status: 400 })
  }

  // Update prescription status
  await prisma.prescription.update({
    where: { id: params.id },
    data: {
      status: "dispensed",
      dispensedById: session.user.id,
      dispensedAt: new Date(),
    },
  })

  // Create stock movements for each item
  if (body.items && Array.isArray(body.items)) {
    for (const item of body.items) {
      if (item.medicineId && item.quantity) {
        // Get current stock
        const medicine = await prisma.medicine.findUnique({ where: { id: item.medicineId } })
        const prevStock = medicine?.currentStock || 0

        // Reduce stock
        await prisma.medicine.update({
          where: { id: item.medicineId },
          data: { currentStock: { decrement: item.quantity } },
        })

        // Log stock movement
        await prisma.stockMovement.create({
          data: {
            medicationId: item.medicineId,
            movementType: "dispensed",
            quantity: item.quantity,
            previousQuantity: prevStock,
            newQuantity: prevStock - item.quantity,
            referenceType: "prescription",
            referenceId: params.id,
            notes: `Dispensed for prescription ${prescription.prescriptionNumber}`,
            createdById: session.user.id,
          },
        })
      }
    }
  }

  return NextResponse.json({ success: true, data: { message: "Prescription dispensed successfully" } })
}
