import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const resourceType = searchParams.get("resource_type")
  const resourceId = searchParams.get("resource_id")

  const where: Record<string, unknown> = { userId: session.user.id }
  if (resourceType) where.resourceType = resourceType
  if (resourceId) where.resourceId = resourceId

  const notes = await prisma.note.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ success: true, data: notes })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const note = await prisma.note.create({
    data: {
      userId: session.user.id,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      content: body.content,
      isPrivate: body.isPrivate ?? true,
    },
  })

  return NextResponse.json({ success: true, data: note }, { status: 201 })
}
