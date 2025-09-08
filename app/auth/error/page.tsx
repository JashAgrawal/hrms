import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

function ErrorContent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Authentication Error</CardTitle>
          <CardDescription>
            There was a problem signing you in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-gray-600">
            <p>This could be due to:</p>
            <ul className="mt-2 space-y-1 text-left">
              <li>• Your account has been deactivated</li>
              <li>• Invalid credentials</li>
              <li>• OAuth provider configuration issue</li>
              <li>• Network connectivity problems</li>
            </ul>
          </div>
          <div className="flex flex-col space-y-2">
            <Button asChild>
              <Link href="/auth/signin">
                Try Again
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">
                Go Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}