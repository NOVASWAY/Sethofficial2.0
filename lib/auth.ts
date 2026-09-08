import NextAuth, { type NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      role: string
      name: string
      department: string
      email: string
      permissions: string[]
    }
  }

  interface User {
    id: string
    username: string
    role: string
    name: string
    department: string
    permissions: string[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string
    role: string
    name: string
    department: string
    permissions: string[]
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Username and password required")
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        })

        if (!user || !user.isActive) {
          throw new Error("Invalid credentials")
        }

        const isValid = await compare(credentials.password, user.passwordHash)
        if (!isValid) {
          throw new Error("Invalid credentials")
        }

        const ROLE_PERMISSIONS: Record<string, string[]> = {
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
          : ROLE_PERMISSIONS[user.role] || []

        return {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
          department: user.department,
          email: user.email,
          permissions,
          mfaEnabled: user.mfaEnabled,
        } as any
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = user.username
        token.role = user.role
        token.name = user.name
        token.department = user.department
        token.permissions = (user as any).permissions || []
        token.mfaEnabled = (user as any).mfaEnabled || false
      }
      return token
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        username: token.username,
        role: token.role,
        name: token.name,
        department: token.department,
        email: session.user.email,
        permissions: token.permissions || [],
        mfaEnabled: (token as any).mfaEnabled || false,
      } as any
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
}

export default NextAuth(authOptions)
