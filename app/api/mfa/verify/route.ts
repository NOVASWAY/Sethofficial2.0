import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as OTPAuth from "otpauth"
import crypto from "crypto"
import { mfaLimiter, throttle } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  try {
    const t = throttle(req.headers, mfaLimiter, "mfa-verify")
    if (!t.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many attempts. Try again in ${t.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(t.retryAfterSec) } }
      )
    }
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
      return NextResponse.json({ success: false, error: "Invalid or expired session" }, { status: 401 })
    }

    if (new Date(mfaSession.expiresAt) < new Date()) {
      return NextResponse.json({ success: false, error: "MFA session expired" }, { status: 401 })
    }

    if (mfaSession.mfaVerified) {
      return NextResponse.json({ success: false, error: "MFA already verified" }, { status: 400 })
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
          await prisma.mfaRecoveryCode.update({
            where: { id: rc.id },
            data: { used: true, usedAt: new Date() },
          })
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
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
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

    if (!user.mfaEnabled) {
      const plaintextCodes: string[] = []
      const hashedCodes = Array.from({ length: 10 }, () => {
        const plain = crypto.randomBytes(5).toString("hex").toUpperCase()
        plaintextCodes.push(plain)
        return {
          userId: user.id,
          codeHash: crypto.createHash("sha256").update(plain).digest("hex"),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        }
      })

      await prisma.mfaRecoveryCode.createMany({ data: hashedCodes })

      await prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: true, mfaMethod: "totp" },
      })

      return NextResponse.json({
        success: true,
        data: {
          verified: true,
          mfaJustEnabled: true,
          recoveryCodes: plaintextCodes,
          message: "MFA enabled successfully. Save your recovery codes.",
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: { verified: true },
    })
  } catch (error) {
    console.error("[MFA Verify Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
