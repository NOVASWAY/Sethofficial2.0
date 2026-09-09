import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling } from "@/lib/api-handler"

/**
 * Tasks visible to a role: assigned to users of that role + unassigned.
 * The frontend workflow board calls this on every role dashboard.
 */
export const GET = withErrorHandling(async (req, ctx) => {
  const role = ctx.params.role

  const usersInRole = await prisma.user.findMany({
    where: { role, isActive: true },
    select: { id: true },
  })
  const userIds = usersInRole.map((u) => u.id)

  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["completed", "cancelled"] },
      OR: [{ assignedToId: { in: userIds } }, { assignedToId: null }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
    },
  })

  return NextResponse.json({ success: true, data: { role, tasks } })
})
