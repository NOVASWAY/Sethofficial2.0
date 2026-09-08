import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { userSchema } from "@/lib/validation"
import { hash } from "bcryptjs"

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

  return NextResponse.json({ success: true, data: user }, { status: 201 })
})
