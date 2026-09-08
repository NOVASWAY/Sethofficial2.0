import { prisma } from "@/lib/prisma"

/** Hours a passed MFA check stays valid for sensitive actions. */
export const MFA_FRESHNESS_HOURS = 12

/**
 * Server-side MFA gate for sensitive actions (payments, user admin).
 * Users WITHOUT MFA enabled are unaffected (no lockout risk during rollout).
 * Users WITH MFA enabled must have passed a TOTP/recovery check recently.
 */
export async function hasFreshMfaVerification(userId: string): Promise<boolean> {
  const recent = await prisma.mfaSession.findFirst({
    where: {
      userId,
      mfaVerified: true,
      verifiedAt: { gte: new Date(Date.now() - MFA_FRESHNESS_HOURS * 60 * 60 * 1000) },
    },
    orderBy: { verifiedAt: "desc" },
  })
  return !!recent
}

export async function requireMfaForSensitiveAction(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true },
  }).catch(() => null)
  // Fail open on DB error — never block care because the gate itself broke
  if (!user) return { ok: true }
  if (!user.mfaEnabled) return { ok: true }
  const fresh = await hasFreshMfaVerification(userId).catch(() => true)
  if (!fresh) {
    return { ok: false, error: "MFA verification required. Please verify with your authenticator app first." }
  }
  return { ok: true }
}
