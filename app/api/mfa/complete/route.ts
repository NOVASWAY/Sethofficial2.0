import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import * as OTPAuth from "otpauth"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionToken, code, method } = body

    if (!sessionToken || !code) {
      return NextResponse.json({ success: false, error: "Session token and code are required" }, { status: 400 })
    }

    const mfaSession = await prisma.mfaSession.findUnique({
      where: { sessionToken },
      include: { user: true },
    })

    if (!mfaSession) {
      return NextResponse.json({ success: false, error: "Invalid or expired MFA session" }, { status: 401 })
    }

    if (new Date(mfaSession.expiresAt) < new Date()) {
      return NextResponse.json({ success: false, error: "MFA session expired. Please log in again." }, { status: 401 })
    }

    if (mfaSession.mfaVerified) {
      return NextResponse.json({ success: false, error: "MFA session already used" }, { status: 400 })
    }

    const user = mfaSession.user
    let verified = false

    if (method === "recovery_code" || method === "recovery") {
      const recoveryCodes = await prisma.mfaRecoveryCode.findMany({
        where: { userId: user.id, used: false },
      })
      for (const rc of recoveryCodes) {
        const inputHash = crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex")
        if (rc.codeHash === inputHash) {
          verified = true
          await prisma.mfaRecoveryCode.update({ where: { id: rc.id }, data: { used: true, usedAt: new Date() } })
          break
        }
      }
    } else {
      if (!user.mfaSecret) {
        return NextResponse.json({ success: false, error: "MFA not configured" }, { status: 400 })
      }
      const totp = new OTPAuth.TOTP({
        issuer: "Seth Medical Clinic",
        label: user.username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.mfaSecret),
      })
      const delta = totp.validate({ token: code, window: 1 })
      verified = delta !== null
    }

    await prisma.mfaVerificationAttempt.create({
      data: {
        userId: user.id,
        sessionToken,
        attemptType: method || "totp",
        success: verified,
        ipAddress: req.headers.get("x-forwarded-for") || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    })

    if (!verified) {
      return NextResponse.json({ success: false, error: "Invalid verification code" }, { status: 401 })
    }

    await prisma.mfaSession.update({
      where: { id: mfaSession.id },
      data: { mfaVerified: true, verifiedAt: new Date() },
    })

    const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
      admin: ["all"],
      receptionist: ["patients", "appointments", "invoices", "visits"],
      nurse: ["patients", "appointments", "visits", "reports", "prescriptions"],
      clinician: ["patients", "appointments", "visits", "reports", "prescriptions", "invoices"],
      doctor: ["patients", "appointments", "visits", "reports", "prescriptions", "invoices"],
      pharmacist: ["pharmacy", "inventory", "reports", "invoices", "patients", "prescriptions"],
      lab_technician: ["lab", "lab_orders", "lab_results", "patients"],
    }

    const permissions = user.permissions && Array.isArray(user.permissions) && (user.permissions as string[]).length > 0
      ? user.permissions as string[]
      : ROLE_PERMISSIONS_MAP[user.role] || []

    return NextResponse.json({
      success: true,
      data: {
        verified: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
          department: user.department,
          email: user.email,
          permissions,
        },
      },
    })
  } catch (error) {
    console.error("[MFA Complete Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
