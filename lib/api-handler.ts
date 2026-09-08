import { NextRequest, NextResponse } from "next/server"
import { getServerSession, Session } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ZodSchema, ZodError } from "zod"
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit"

type RouteHandler = (
  req: NextRequest,
  context: { params: Record<string, string> },
  session: Session
) => Promise<NextResponse>

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["all"],
  receptionist: ["patients", "appointments", "invoices", "visits"],
  nurse: ["patients", "appointments", "visits", "reports", "prescriptions"],
  clinician: ["patients", "appointments", "visits", "reports", "prescriptions", "invoices"],
  doctor: ["patients", "appointments", "visits", "reports", "prescriptions", "invoices"],
  pharmacist: ["pharmacy", "inventory", "reports", "invoices", "patients", "prescriptions"],
  lab_technician: ["lab", "lab_orders", "lab_results", "patients"],
}

export function requireRole(...allowedRoles: string[]) {
  return (session: Session): boolean => {
    return allowedRoles.includes(session.user.role)
  }
}

export function requirePermission(permission: string) {
  return (session: Session): boolean => {
    if (session.user.role === "admin") return true
    const perms = ROLE_PERMISSIONS[session.user.role] || []
    return perms.includes("all") || perms.includes(permission)
  }
}

export async function validateBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  const body = await req.json()
  return schema.parse(body)
}

function handleZodError(error: ZodError): NextResponse {
  const errors = error.errors.map(e => ({
    field: e.path.join("."),
    message: e.message,
  }))
  return NextResponse.json(
    { success: false, error: "Validation failed", details: errors },
    { status: 400 }
  )
}

function getClientIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown"
}

export function withErrorHandling(handler: RouteHandler) {
  return async (req: NextRequest, context: { params: Record<string, string> } = { params: {} }) => {
    const startTime = Date.now()
    const ip = getClientIP(req)

    try {
      const rateKey = `api:${ip}`
      const { allowed, remaining, resetAt } = apiLimiter.check(rateKey)
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: "Too many requests. Please try again later." },
          { status: 429, headers: rateLimitResponse(remaining, resetAt) }
        )
      }

      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
      }

      const response = await handler(req, context, session)

      const duration = Date.now() - startTime
      const logLevel = duration > 3000 ? "SLOW" : duration > 1000 ? "WARN" : "INFO"
      console.log(`[API] ${logLevel} ${req.method} ${req.nextUrl.pathname} ${response.status} ${duration}ms user=${session.user.id}`)

      return NextResponse.json(await response.json(), {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          ...rateLimitResponse(remaining, resetAt),
          "X-Response-Time": `${duration}ms`,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[API] ERROR ${req.method} ${req.nextUrl.pathname} ${duration}ms ip=${ip}`, error)

      if (error instanceof ZodError) {
        return handleZodError(error)
      }

      if (error instanceof Error) {
        if (error.message.includes("Unique constraint")) {
          return NextResponse.json(
            { success: false, error: "A record with this value already exists" },
            { status: 409 }
          )
        }
        if (error.message.includes("Foreign key constraint")) {
          return NextResponse.json(
            { success: false, error: "Referenced record not found" },
            { status: 400 }
          )
        }
        if (error.message.includes("Record to update not found") || error.message.includes("Record to delete not found")) {
          return NextResponse.json(
            { success: false, error: "Record not found" },
            { status: 404 }
          )
        }
      }

      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      )
    }
  }
}
