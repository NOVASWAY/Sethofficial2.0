import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const role = searchParams.get("role") || session.user.role
  const status = searchParams.get("status")

  const where: Record<string, unknown> = {}
  if (status) where.status = status

  // Get tasks assigned to the user's role
  const tasks = await prisma.task.findMany({
    where: {
      ...where,
      OR: [
        { assignedToId: session.user.id },
        { assignedToId: null }, // Unassigned tasks
      ],
    },
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
      assignedTo: { select: { id: true, name: true, role: true } },
      assignedBy: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const task = await prisma.task.create({
    data: {
      taskType: body.taskType || "general",
      title: body.title,
      description: body.description,
      assignedToId: body.assignedToId,
      assignedById: session.user.id,
      patientId: body.patientId,
      priority: body.priority || "normal",
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
    include: {
      assignedTo: { select: { name: true } },
    },
  })

  return NextResponse.json(task, { status: 201 })
}
