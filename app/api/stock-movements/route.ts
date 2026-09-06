import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()

    const medication = await prisma.medicine.findUnique({
      where: { id: body.medicineId || body.medication_id },
      select: { currentStock: true, name: true },
    })

    if (!medication) {
      return NextResponse.json({ error: "Medication not found" }, { status: 404 })
    }

    const qty = Math.abs(body.quantity)
    const movementType = body.movementType || body.movement_type
    const previousQty = medication.currentStock
    const newQty = movementType === "dispensed" || movementType === "expired" || movementType === "returned"
      ? previousQty - qty
      : previousQty + qty

    const movement = await prisma.stockMovement.create({
      data: {
        medicationId: body.medicineId || body.medication_id,
        movementType,
        quantity: qty,
        previousQuantity: previousQty,
        newQuantity: newQty,
        unitCost: body.unitCost || body.unit_cost || null,
        totalCost: body.totalCost || body.total_cost || null,
        notes: body.notes || body.reason || null,
        referenceId: body.referenceId || body.reference_id || null,
        referenceType: body.referenceType || body.reference_type || null,
      },
    })

    await prisma.medicine.update({
      where: { id: body.medicineId || body.medication_id },
      data: { currentStock: newQty },
    })

    return NextResponse.json({ success: true, data: movement }, { status: 201 })
  } catch (error) {
    console.error("Error creating stock movement:", error)
    return NextResponse.json({ error: "Failed to create stock movement" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const medicineId = searchParams.get("medicine_id") || searchParams.get("medicineId")

  try {
    const where = medicineId ? { medicationId: medicineId } : {}
    const movements = await prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        medication: { select: { name: true, strength: true } },
      },
    })

    const mapped = movements.map((m: any) => ({
      id: m.id,
      medicineId: m.medicationId,
      medicineName: `${m.medication?.name || ""} ${m.medication?.strength || ""}`.trim(),
      movementType: m.movementType,
      quantity: m.quantity,
      previousQuantity: m.previousQuantity,
      newQuantity: m.newQuantity,
      unitCost: m.unitCost,
      totalCost: m.totalCost,
      notes: m.notes,
      performedBy: m.createdById || "System",
      timestamp: m.createdAt,
      referenceId: m.referenceId,
      referenceType: m.referenceType,
    }))

    return NextResponse.json({ success: true, data: mapped })
  } catch (error) {
    console.error("Error fetching stock movements:", error)
    return NextResponse.json({ error: "Failed to fetch stock movements" }, { status: 500 })
  }
}
