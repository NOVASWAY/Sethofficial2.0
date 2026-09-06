import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || searchParams.get("limit") || "50")
  const status = searchParams.get("status") || ""
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}
  if (status && status !== "all") where.status = status

  const [claims, total] = await Promise.all([
    prisma.shaClaim.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.shaClaim.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      data: claims,
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

  try {
    const body = await req.json()

    // Generate claim number
    const lastClaim = await prisma.shaClaim.findFirst({
      orderBy: { createdAt: "desc" },
      select: { claimNumber: true },
    })
    const nextNumber = lastClaim
      ? parseInt(lastClaim.claimNumber.replace("SHA/CLM/", "").replace(/\//g, "")) + 1
      : 1
    const claimNumber = body.claimNumber || `SHA/CLM/${new Date().getFullYear()}/${String(nextNumber).padStart(4, "0")}`

    const claim = await prisma.shaClaim.create({
      data: {
        claimNumber,
        invoiceId: body.invoiceId,
        patientId: body.patientId,
        patientName: body.patientName,
        patientShaNumber: body.patientShaNumber || "",
        claimDate: new Date(body.claimDate || new Date()),
        serviceDate: new Date(body.serviceDate || new Date()),
        totalAmount: body.totalAmount || 0,
        approvedAmount: body.approvedAmount,
        status: body.status || "pending",
        submissionDate: body.submissionDate ? new Date(body.submissionDate) : null,
        notes: body.notes,
        createdById: session.user.id,
      },
      include: {
        patient: { select: { firstName: true, lastName: true, patientNumber: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    })

    return NextResponse.json({ success: true, data: claim }, { status: 201 })
  } catch (error) {
    console.error("Error creating SHA claim:", error)
    return NextResponse.json({ error: "Failed to create SHA claim" }, { status: 500 })
  }
}
