import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const passwordHash = await hash(body.password, 12)

  const user = await prisma.user.create({
    data: {
      username: body.username,
      email: body.email,
      passwordHash,
      role: body.role,
      name: body.name,
      department: body.department,
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

  return NextResponse.json(user, { status: 201 })
}
