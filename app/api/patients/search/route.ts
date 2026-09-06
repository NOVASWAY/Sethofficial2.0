import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") || ""

  if (!q) {
    return NextResponse.json({ data: [] })
  }

  try {
    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { patientNumber: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { insuranceNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    return NextResponse.json({ data: patients })
  } catch (error) {
    console.error("Error searching patients:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
