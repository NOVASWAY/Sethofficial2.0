import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const url = process.env.DATABASE_URL || ""
    const secret = process.env.NEXTAUTH_SECRET || ""
    const urlHost = url ? new URL(url).hostname : "EMPTY"

    const userCount = await prisma.user.count()
    const users = await prisma.user.findMany({
      select: { username: true, role: true, isActive: true },
      take: 10,
    })

    return NextResponse.json({
      status: "ok",
      dbUrlHost: urlHost,
      secretSet: secret.length > 0,
      secretLen: secret.length,
      userCount,
      users,
    })
  } catch (e: any) {
    return NextResponse.json({
      status: "error",
      message: e.message,
      code: e.code,
      dbUrl: process.env.DATABASE_URL ? "set" : "missing",
      secret: process.env.NEXTAUTH_SECRET ? "set" : "missing",
    }, { status: 500 })
  }
}
