import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || searchParams.get("limit") || "50")
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}
  if (patientId) where.patientId = patientId
  if (status) where.paymentStatus = status

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
        invoiceItems: true,
        paymentAllocations: true,
      },
    }),
    prisma.invoice.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      data: invoices,
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

  // Generate invoice number
  const lastInvoice = await prisma.invoice.findFirst({
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true },
  })
  const nextNumber = lastInvoice
    ? parseInt(lastInvoice.invoiceNumber.replace("INV-", "")) + 1
    : 1
  const invoiceNumber = `INV-${String(nextNumber).padStart(5, "0")}`

  const invoice = await prisma.invoice.create({
    data: {
      patientId: body.patientId,
      invoiceNumber,
      date: new Date(body.date || new Date()),
      consultationId: body.consultationId,
      createdById: session.user.id,
      subtotal: body.subtotal || 0,
      taxAmount: body.taxAmount || 0,
      totalAmount: body.totalAmount || 0,
      paymentStatus: body.paymentStatus || "pending",
      paymentMethod: body.paymentMethod,
      invoiceItems: body.items
        ? {
            create: body.items.map((item: Record<string, unknown>) => ({
              itemType: item.itemType,
              itemId: item.itemId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              shaCovered: item.shaCovered || false,
              shaAmount: item.shaAmount || 0,
              patientAmount: item.patientAmount,
            })),
          }
        : undefined,
    },
    include: { invoiceItems: true },
  })

  return NextResponse.json({ success: true, data: invoice }, { status: 201 })
}
