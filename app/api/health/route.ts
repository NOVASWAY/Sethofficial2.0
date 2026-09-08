import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number }> = {}
  const startTime = Date.now()

  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart }
  } catch {
    checks.database = { status: "error" }
  }

  try {
    const userCount = await prisma.user.count()
    checks.users = { status: "ok", latencyMs: userCount }
  } catch {
    checks.users = { status: "error" }
  }

  const allHealthy = Object.values(checks).every(c => c.status === "ok")

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      version: process.env.npm_package_version || "2.0.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
      totalLatencyMs: Date.now() - startTime,
    },
    { status: allHealthy ? 200 : 503 }
  )
}
