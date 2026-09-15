import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { labResultSchema } from "@/lib/validation"
import { writeAudit } from "@/lib/audit"

export const GET = withErrorHandling(async (req) => {
  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get("orderId")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || searchParams.get("limit") || "50")
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}
  if (orderId) where.orderId = orderId
  if (status) where.status = status

  const [results, total] = await Promise.all([
    prisma.labTestResult.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
          },
        },
        verifiedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.labTestResult.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      data: results,
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  })
})

export const POST = withErrorHandling(async (req, _ctx, session) => {
  const allowed = ["lab_technician", "clinician", "doctor", "admin"]
  if (!allowed.includes(session.user.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await validateBody(req, labResultSchema)

  const order = await prisma.labTestOrder.findUnique({ where: { id: body.orderId } })
  if (!order) {
    return NextResponse.json({ success: false, error: "Lab order not found" }, { status: 404 })
  }

  const lastResult = await prisma.labTestResult.findFirst({
    orderBy: { createdAt: "desc" },
    select: { resultNumber: true },
  })
  const nextNumber = lastResult
    ? parseInt(lastResult.resultNumber.replace("RES-", "")) + 1
    : 1
  const resultNumber = `RES-${String(Number.isNaN(nextNumber) ? Date.now() % 100000 : nextNumber).padStart(5, "0")}`

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.labTestResult.create({
      data: {
        orderId: body.orderId,
        resultNumber,
        testType: body.testType,
        testName: body.testName,
        testValues: (body.testValues || {}) as any,
        referenceRanges: body.referenceRanges as any,
        abnormalFlags: body.abnormalFlags as any,
        notes: body.notes,
        createdById: session.user.id,
      },
    })
    await tx.labTestOrder.update({
      where: { id: body.orderId },
      data: { status: "completed" },
    })
    return created
  })

  writeAudit({
    userId: session.user.id,
    action: "lab.result_entered",
    resource: "lab_result",
    resourceId: result.id,
    result: "success",
    details: { resultNumber, orderId: body.orderId, testName: body.testName },
    req,
  }).catch(() => {})

  return NextResponse.json({ success: true, data: result }, { status: 201 })
})
