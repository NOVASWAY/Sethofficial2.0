import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { z } from "zod"
import { apiCache } from "@/lib/cache"
import { writeAudit } from "@/lib/audit"

const autoBillSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID").optional(),
  patient_id: z.string().uuid().optional(),
  services: z.array(z.string()).min(1, "At least one service is required"),
  insuranceType: z.string().optional(),
  insurance_type: z.string().optional(),
  patientType: z.string().optional(),
  patient_type: z.string().optional(),
  consultationId: z.string().uuid().optional(),
  consultation_id: z.string().uuid().optional(),
}).refine((d) => d.patientId || d.patient_id, { message: "Patient is required", path: ["patientId"] })

function priceFor(service: { unitPrice: unknown; cashPrice: unknown; nhifPrice: unknown; shaPrice: unknown }, insurance: string) {
  const num = (v: unknown) => Number(v || 0)
  const ins = insurance.toUpperCase()
  if (ins === "SHA") return { price: num(service.shaPrice) || num(service.cashPrice), shaCovered: true }
  if (ins === "NHIF") return { price: num(service.nhifPrice) || num(service.cashPrice), shaCovered: false }
  if (ins === "PRIVATE") return { price: num(service.cashPrice) * 0.9, shaCovered: false }
  if (ins === "MIXED") return { price: (num(service.shaPrice) || num(service.cashPrice)) * 0.7, shaCovered: true }
  return { price: num(service.cashPrice) || num(service.unitPrice), shaCovered: false }
}

export const POST = withErrorHandling(async (req, _ctx, session) => {
  if (session.user.role !== "admin" && session.user.role !== "receptionist") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await validateBody(req, autoBillSchema)
  const patientId = body.patientId || body.patient_id!
  const insurance = body.insuranceType || body.insurance_type || "Cash"
  const consultationId = body.consultationId || body.consultation_id || undefined

  const patient = await prisma.patient.findUnique({ where: { id: patientId } })
  if (!patient) {
    return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 })
  }

  const services = await prisma.service.findMany({ where: { id: { in: body.services } } })
  if (services.length === 0) {
    return NextResponse.json({ success: false, error: "No valid services found" }, { status: 400 })
  }

  const lastInvoice = await prisma.invoice.findFirst({
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true },
  })
  const nextNumber = lastInvoice
    ? parseInt(lastInvoice.invoiceNumber.replace("INV-", "")) + 1
    : 1
  const invoiceNumber = `INV-${String(Number.isNaN(nextNumber) ? Date.now() % 100000 : nextNumber).padStart(5, "0")}`

  let subtotal = 0
  const items = services.map((s) => {
    const { price, shaCovered } = priceFor(s, insurance)
    subtotal += price
    return {
      itemType: "service",
      itemId: s.id,
      description: s.serviceName,
      quantity: 1,
      unitPrice: price,
      totalPrice: price,
      shaCovered,
      shaAmount: shaCovered ? price : 0,
      patientAmount: shaCovered ? 0 : price,
    }
  })

  const invoice = await prisma.invoice.create({
    data: {
      patientId,
      invoiceNumber,
      date: new Date(),
      consultationId,
      createdById: session.user.id,
      subtotal,
      taxAmount: 0,
      totalAmount: subtotal,
      paymentStatus: "pending",
      invoiceItems: { create: items },
    },
    include: { invoiceItems: true },
  })

  apiCache.invalidate("^dashboard:metrics")

  writeAudit({
    userId: session.user.id,
    action: "invoice.auto_created",
    resource: "invoice",
    resourceId: invoice.id,
    result: "success",
    details: { invoiceNumber, consultationId, services: services.length, total: subtotal },
    req,
  }).catch(() => {})

  return NextResponse.json(
    {
      success: true,
      data: {
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        consultation_id: consultationId,
        totals: { subtotal, patient_payment: subtotal },
        invoice,
      },
    },
    { status: 201 }
  )
})
