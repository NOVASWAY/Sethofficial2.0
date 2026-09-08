import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { userSchema } from "@/lib/validation"
import { hash } from "bcryptjs"
import { generateVerificationToken, hashToken, sendEmail, EMAIL_TEMPLATES } from "@/lib/email"
import { apiCache } from "@/lib/cache"
import { writeAudit } from "@/lib/audit"
import { requireMfaForSensitiveAction } from "@/lib/mfa-gate"

export const GET = withErrorHandling(async (req, _ctx, session) => {
  if (session.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const role = searchParams.get("role")
  const active = searchParams.get("active")

  const where: Record<string, unknown> = {}
  if (role) where.role = role
  if (active !== null) where.isActive = active === "true"

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      name: true,
      department: true,
      isActive: true,
      mfaEnabled: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ success: true, data: users })
})

export const POST = withErrorHandling(async (req, _ctx, session) => {
  if (session.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await validateBody(req, userSchema)

  const mfa = await requireMfaForSensitiveAction(session.user.id)
  if (!mfa.ok) {
    return NextResponse.json({ success: false, error: mfa.error }, { status: 403 })
  }

  const passwordHash = await hash(body.password, 12)

  const user = await prisma.user.create({
    data: {
      username: body.username,
      email: body.email,
      passwordHash,
      role: body.role,
      name: body.name,
      department: body.department || "",
      permissions: body.permissions || [],
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      name: true,
      department: true,
      isActive: true,
      createdAt: true,
    },
  })

  if (body.email) {
    const token = generateVerificationToken()
    const hashedToken = hashToken(token)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.verificationToken.create({
      data: { identifier: user.id, token: hashedToken, expires: expiresAt },
    })

    const baseUrl = process.env.NEXTAUTH_URL || "https://sethofficial2-0.vercel.app"
    const template = EMAIL_TEMPLATES.verification(token, baseUrl)

    sendEmail({
      to: body.email,
      subject: template.subject,
      html: template.html,
    }).catch(() => {})
  }

  apiCache.invalidate("^dashboard:metrics")

  writeAudit({
    userId: session.user.id,
    action: "user.created",
    resource: "user",
    resourceId: user.id,
    result: "success",
    details: { username: user.username, role: user.role },
    req,
  }).catch(() => {})

  return NextResponse.json({ success: true, data: user }, { status: 201 })
})
