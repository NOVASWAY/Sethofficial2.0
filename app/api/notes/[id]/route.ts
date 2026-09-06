import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const note = await prisma.note.update({
    where: { id: params.id, userId: session.user.id },
    data: {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.isPrivate !== undefined && { isPrivate: body.isPrivate }),
    },
  })

  return NextResponse.json({ success: true, data: note })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.note.delete({
    where: { id: params.id, userId: session.user.id },
  })

  return NextResponse.json({ success: true, data: { deleted: true } })
}
