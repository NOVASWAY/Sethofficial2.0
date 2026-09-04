import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    // Public routes that don't require auth
    if (pathname === "/" || pathname.startsWith("/api/auth")) {
      return NextResponse.next()
    }

    // Redirect unauthenticated users to login
    if (!token) {
      const loginUrl = new URL("/", req.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Admin can access everything
    if (token.role === "admin") {
      return NextResponse.next()
    }

    // Role-based route protection
    const roleRoutes: Record<string, string[]> = {
      receptionist: ["/dashboard/receptionist"],
      nurse: ["/dashboard/nurse"],
      clinician: ["/dashboard/clinician"],
      pharmacist: ["/dashboard/pharmacist"],
      lab_technician: ["/dashboard/lab_technician"],
    }

    const allowedRoutes = roleRoutes[token.role] || []
    const hasAccess = allowedRoutes.some((route) => pathname.startsWith(route))

    if (!hasAccess && pathname.startsWith("/dashboard")) {
      // Redirect to own role dashboard
      return NextResponse.redirect(new URL(`/dashboard/${token.role}`, req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ["/dashboard/:path*", "/api/((?!auth).*)"],
}
