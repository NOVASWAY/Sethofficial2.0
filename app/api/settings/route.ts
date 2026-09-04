import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const settings = await prisma.systemSetting.findMany()
  const settingsMap: Record<string, Record<string, string>> = {}

  for (const setting of settings) {
    const cat = setting.category || "general"
    if (!settingsMap[cat]) {
      settingsMap[cat] = {}
    }
    settingsMap[cat][setting.key] = setting.value
  }

  return NextResponse.json({ success: true, data: settingsMap })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { settings } = body

  // Flatten the settings object and upsert each key
  const updates: Array<{ key: string; value: string; category: string }> = []

  if (typeof settings === "object") {
    for (const [category, categorySettings] of Object.entries(settings)) {
      if (typeof categorySettings === "object" && categorySettings !== null) {
        for (const [key, value] of Object.entries(categorySettings as Record<string, string>)) {
          updates.push({
            key,
            value: String(value),
            category,
          })
        }
      }
    }
  }

  for (const update of updates) {
    await prisma.systemSetting.upsert({
      where: { key: update.key },
      update: { value: update.value },
      create: {
        key: update.key,
        value: update.value,
        category: update.category,
        description: "",
      },
    })
  }

  return NextResponse.json({ success: true })
}
