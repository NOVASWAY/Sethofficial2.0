import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const lowStock = searchParams.get("lowStock") === "true"
  const expiring = searchParams.get("expiring") === "true"
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || searchParams.get("limit") || "50")
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { genericName: { contains: search, mode: "insensitive" } },
      { batchNumber: { contains: search } },
    ]
  }
  if (lowStock) {
    // Fetch all and filter in JS since we can't do raw Prisma field comparison easily
    // Alternatively, use a fixed threshold
    where.currentStock = { lte: 10 }
  }
  if (expiring) {
    const threeMonthsFromNow = new Date()
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)
    where.expiryDate = { lte: threeMonthsFromNow }
  }

  const [medicines, total] = await Promise.all([
    prisma.medicine.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { name: "asc" },
    }),
    prisma.medicine.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      data: medicines,
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

  const medicine = await prisma.medicine.create({
    data: {
      name: body.name,
      genericName: body.genericName,
      category: body.category,
      dosageForm: body.dosageForm,
      strength: body.strength,
      manufacturer: body.manufacturer,
      batchNumber: body.batchNumber,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      currentStock: body.currentStock || 0,
      minimumStock: body.minimumStock || 0,
      reorderLevel: body.reorderLevel || 10,
      unitPrice: body.unitPrice || 0,
      location: body.location,
      description: body.description,
      sideEffects: body.sideEffects,
    },
  })

  return NextResponse.json({ success: true, data: medicine }, { status: 201 })
}
