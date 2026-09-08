import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling } from "@/lib/api-handler"

export const GET = withErrorHandling(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get("unreadOnly") === "true" || searchParams.get("unread_only") === "true"
  const limit = parseInt(searchParams.get("limit") || "20")

  const where: Record<string, unknown> = {
    recipientId: session.user.id,
  }
  if (unreadOnly) where.isRead = false

  const notifications = await prisma.notification.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
  })

  const unreadCount = await prisma.notification.count({
    where: { recipientId: session.user.id, isRead: false },
  })

  return NextResponse.json({ success: true, data: notifications, unreadCount })
})

export const POST = withErrorHandling(async (req, _ctx, session) => {
  const body = await req.json()

  const notification = await prisma.notification.create({
    data: {
      recipientId: body.recipientId,
      notificationType: body.notificationType || "in_app",
      template: body.template || "custom",
      subject: body.subject,
      content: body.content,
      priority: body.priority || "normal",
      actionUrl: body.actionUrl,
      actionLabel: body.actionLabel,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: notification }, { status: 201 })
})
