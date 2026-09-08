import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateBody } from "@/lib/api-handler"
import { dispenseSchema } from "@/lib/validation"
import { apiCache } from "@/lib/cache"
import { writeAudit } from "@/lib/audit"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const body = await validateBody(req, dispenseSchema)

    const prescription = await prisma.prescription.findUnique({
      where: { id: params.id },
      include: { items: true },
    })

    if (!prescription) {
      return NextResponse.json({ success: false, error: "Prescription not found" }, { status: 404 })
    }

    if (prescription.status === "dispensed") {
      return NextResponse.json({ success: false, error: "Already dispensed" }, { status: 400 })
    }

    await prisma.prescription.update({
      where: { id: params.id },
      data: {
        status: "dispensed",
        dispensedById: session.user.id,
        dispensedAt: new Date(),
      },
    })

    if (body.items && body.items.length > 0) {
      for (const item of body.items) {
        const medicine = await prisma.medicine.findUnique({ where: { id: item.medicineId } })
        const prevStock = medicine?.currentStock || 0

        await prisma.medicine.update({
          where: { id: item.medicineId },
          data: { currentStock: { decrement: item.quantity } },
        })

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

    apiCache.invalidate("^dashboard:metrics")
    apiCache.invalidate("^lab:pending")

    writeAudit({
      userId: session.user.id,
      action: "prescription.dispensed",
      resource: "prescription",
      resourceId: params.id,
      result: "success",
      details: { prescriptionNumber: prescription.prescriptionNumber, items: body.items?.length || 0 },
      req,
    }).catch(() => {})

    return NextResponse.json({ success: true, data: { message: "Prescription dispensed successfully" } })
  } catch (error) {
    console.error("[Dispense Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
