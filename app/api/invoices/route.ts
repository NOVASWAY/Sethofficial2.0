import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { invoiceSchema } from "@/lib/validation"

export const GET = withErrorHandling(async (req) => {
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
})

export const POST = withErrorHandling(async (req, _ctx, session) => {
  const body = await validateBody(req, invoiceSchema)

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
            create: body.items.map((item: any) => ({
              itemType: String(item.itemType),
              itemId: item.itemId || null,
              description: String(item.description),
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              totalPrice: Number(item.totalPrice),
              shaCovered: Boolean(item.shaCovered),
              shaAmount: Number(item.shaAmount || 0),
              patientAmount: Number(item.patientAmount || 0),
            })),
          }
        : undefined,
    },
    include: { invoiceItems: true },
  })

  return NextResponse.json({ success: true, data: invoice }, { status: 201 })
})
