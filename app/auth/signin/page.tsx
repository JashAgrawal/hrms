"use client"

import { useState, useEffect, Suspense } from "react"
import { signIn, getProviders } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Mail, Lock } from "lucide-react"

interface Provider {
  id: string
  name: string
  type: string
}

function SignInForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [providers, setProviders] = useState<Record<string, Provider>>({})
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const loadProviders = async () => {
      const res = await getProviders()
      if (res) {
        setProviders(res)
      }
    }
    loadProviders()

    // Handle error from URL params
    const errorParam = searchParams.get('error')
    if (errorParam) {
      switch (errorParam) {
        case 'CredentialsSignin':
          setError('Invalid email or password')
          break
        case 'AccountDeactivated':
          setError('Your account has been deactivated. Please contact your administrator.')
          break
        case 'OAuthAccountNotLinked':
          setError('This email is already registered with a different sign-in method.')
          break
        default:
          setError('An error occurred during sign-in')
      }
    }
  }, [searchParams])

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password")
      } else if (result?.ok) {
        router.push("/dashboard")
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (providerId: string) => {
    setOauthLoading(providerId)
    setError("")
    
    try {
      await signIn(providerId, { 
        callbackUrl: "/dashboard",
        redirect: true 
      })
    } catch {
      setError("OAuth sign-in failed. Please try again.")
      setOauthLoading(null)
    }
  }

  const oauthProviders = Object.values(providers).filter(
    provider => provider.type === 'oauth' && provider.id !== 'credentials'
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to Pekka HR</CardTitle>
          <CardDescription>
            Sign in to access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || oauthLoading !== null}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* OAuth Providers */}
          {oauthProviders.length > 0 && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="space-y-2">
                {oauthProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOAuthSignIn(provider.id)}
                    disabled={isLoading || oauthLoading !== null}
                  >
                    {oauthLoading === provider.id ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                        Connecting...
                      </div>
                    ) : (
                      `Continue with ${provider.name}`
                    )}
                  </Button>
                ))}
              </div>
            </>
          )}

          <div className="text-center text-sm text-gray-600">
            <p>Don&apos;t have an account? Contact your administrator.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
}