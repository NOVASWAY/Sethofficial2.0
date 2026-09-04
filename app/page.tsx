"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Heart, AlertCircle } from "lucide-react"

const isDev = process.env.NODE_ENV === "development"

const DEMO_CREDENTIALS = isDev
  ? [
      { username: "admin", password: "admin123", role: "admin", name: "Admin" },
      { username: "receptionist", password: "receptionist123", role: "receptionist", name: "Receptionist" },
      { username: "nurse", password: "nurse123", role: "nurse", name: "Nurse" },
      { username: "clinician", password: "clinician123", role: "clinician", name: "Clinician" },
      { username: "pharmacist", password: "pharmacist123", role: "pharmacist", name: "Pharmacist" },
      { username: "labtech", password: "labtech123", role: "lab_technician", name: "Lab Tech" },
    ]
  : []

export default function LoginPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [mounted, setMounted] = useState(false)
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (mounted && status === "authenticated" && session) {
      const role = (session.user as { role?: string })?.role || "receptionist"
      router.push(`/dashboard/${role}`)
    }
  }, [mounted, status, session, router])

  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === "authenticated") return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credentials.username || !credentials.password) {
      setError("Please enter your username and password")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        username: credentials.username,
        password: credentials.password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid credentials. Please try again.")
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDemoLogin = (cred: (typeof DEMO_CREDENTIALS)[number]) => {
    setCredentials({ username: cred.username, password: cred.password })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Heart className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Seth Medical Clinic</h1>
          </div>
          <p className="text-muted-foreground">Management System</p>
        </div>

        {/* Login Card */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
                  autoComplete="username"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                  autoComplete="current-password"
                />
              </div>

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={!credentials.username || !credentials.password || isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Credentials Card - Development Only */}
        {isDev && DEMO_CREDENTIALS.length > 0 && (
          <Card className="border-border/50 shadow-lg bg-muted/50">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-lg text-center">Demo Credentials</CardTitle>
              <CardDescription className="text-center text-xs">
                Click a role to populate, then sign in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {DEMO_CREDENTIALS.map((cred) => (
                  <Button
                    key={cred.username}
                    variant="outline"
                    size="sm"
                    onClick={() => handleDemoLogin(cred)}
                    disabled={isSubmitting}
                    className="text-xs"
                  >
                    {cred.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
