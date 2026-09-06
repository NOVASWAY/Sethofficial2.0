import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      name: true,
      department: true,
      permissions: true,
      isActive: true,
      mfaEnabled: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json(user)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const updateData: Record<string, unknown> = {}

  if (body.name !== undefined) updateData.name = body.name
  if (body.email !== undefined) updateData.email = body.email
  if (body.role !== undefined) updateData.role = body.role
  if (body.department !== undefined) updateData.department = body.department
  if (body.permissions !== undefined) updateData.permissions = body.permissions
  if (body.isActive !== undefined) updateData.isActive = body.isActive
  if (body.username !== undefined) updateData.username = body.username

  if (body.password) {
    updateData.passwordHash = await hash(body.password, 12)
  }

  // Prevent deactivating the last admin
  if (body.isActive === false || body.role !== undefined) {
    const currentUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { role: true, isActive: true },
    })

    if (currentUser?.role === "admin" && currentUser?.isActive) {
      const activeAdminCount = await prisma.user.count({
        where: { role: "admin", isActive: true },
      })

      if (activeAdminCount <= 1) {
        if (body.isActive === false) {
          return NextResponse.json(
            { error: "Cannot deactivate the last active admin user" },
            { status: 400 }
          )
        }
        if (body.role && body.role !== "admin") {
          return NextResponse.json(
            { error: "Cannot change the role of the last active admin user" },
            { status: 400 }
          )
        }
      }
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        name: true,
        department: true,
        permissions: true,
        isActive: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Prevent deleting the last admin
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { role: true, isActive: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (user.role === "admin" && user.isActive) {
    const activeAdminCount = await prisma.user.count({
      where: { role: "admin", isActive: true },
    })

    if (activeAdminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last active admin user" },
        { status: 400 }
      )
    }
  }

  try {
    await prisma.user.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "User deleted successfully" })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}
