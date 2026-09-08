import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { noteSchema } from "@/lib/validation"

export const GET = withErrorHandling(async (req, _ctx, session) => {
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
})

export const POST = withErrorHandling(async (req, _ctx, session) => {
  const body = await validateBody(req, noteSchema)

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
})
