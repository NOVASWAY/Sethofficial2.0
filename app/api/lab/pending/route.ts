import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orders = await prisma.labTestOrder.findMany({
    where: { status: { in: ["pending", "collected", "in_progress"] } },
    orderBy: [{ priority: "asc" }, { orderedAt: "asc" }],
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
      orderingClinician: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(orders)
}
