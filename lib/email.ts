import crypto from "crypto"

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY || process.env.EMAIL_API_KEY
  const fromEmail = process.env.EMAIL_FROM || "noreply@sethmedical.co.ke"

  if (!apiKey) {
    console.warn("[Email] No email API key configured. Email not sent:", options.subject)
    console.log("[Email] Would send to:", options.to)
    console.log("[Email] Subject:", options.subject)
    return false
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: fromEmail, name: "Seth Medical Clinic" },
        subject: options.subject,
        content: [
          { type: "text/plain", value: options.text || options.html.replace(/<[^>]+>/g, "") },
          { type: "text/html", value: options.html },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("[Email] SendGrid error:", err)
      return false
    }

    return true
  } catch (error) {
    console.error("[Email] Send failed:", error)
    return false
  }
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export const EMAIL_TEMPLATES = {
  verification: (token: string, baseUrl: string) => ({
    subject: "Verify Your Email - Seth Medical Clinic",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">Seth Medical Clinic</h2>
        <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
        <a href="${baseUrl}/verify-email?token=${token}"
           style="display: inline-block; padding: 12px 24px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 12px;">This link expires in 24 hours. If you didn't create an account, please ignore this email.</p>
      </div>
    `,
  }),

  passwordReset: (token: string, baseUrl: string) => ({
    subject: "Reset Your Password - Seth Medical Clinic",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">Seth Medical Clinic</h2>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        <a href="${baseUrl}/reset-password?token=${token}"
           style="display: inline-block; padding: 12px 24px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 12px;">This link expires in 1 hour. If you didn't request a password reset, please ignore this email.</p>
      </div>
    `,
  }),

  mfaCode: (code: string) => ({
    subject: "Your MFA Verification Code - Seth Medical Clinic",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">Seth Medical Clinic</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f3f4f6; border-radius: 8px; margin: 16px 0;">
          ${code}
        </div>
        <p style="color: #666; font-size: 12px;">This code expires in 10 minutes. If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  }),
}
