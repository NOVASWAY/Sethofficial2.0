import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, phone: true } },
      createdBy: { select: { id: true, name: true } },
      invoiceItems: true,
      paymentAllocations: true,
      mpesaTransactions: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  return NextResponse.json(invoice)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      paymentStatus: body.paymentStatus,
      paymentMethod: body.paymentMethod,
      items: body.items,
      subtotal: body.subtotal,
      taxAmount: body.taxAmount,
      totalAmount: body.totalAmount,
    },
    include: { invoiceItems: true },
  })

  return NextResponse.json(invoice)
}
