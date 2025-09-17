import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import { Home, ArrowLeft, Search, FileQuestion } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <Logo size="lg" href="/" className="justify-center mb-4" />
          <div className="w-24 h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 mx-auto rounded-full"></div>
        </div>

        {/* Main 404 Card */}
        <Card className="shadow-strong border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-6 relative">
              {/* 404 Number with decorative elements */}
              <div className="text-8xl font-bold text-primary/20 select-none">
                404
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FileQuestion className="h-16 w-16 text-primary/60" />
              </div>
            </div>
            
            <CardTitle className="text-3xl font-bold text-foreground mb-2">
              Page Not Found
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground max-w-md mx-auto">
              The page you&apos;re looking for doesn&apos;t exist or has been moved to a different location.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Helpful suggestions */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                What you can do:
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Check the URL for any typos or errors
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Use the navigation menu to find what you&apos;re looking for
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Go back to the previous page and try again
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Contact your system administrator if you believe this is an error
                </li>
              </ul>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button asChild className="flex-1">
                <Link href="/dashboard" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Go to Dashboard
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="flex-1">
                <Link href="javascript:history.back()" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Link>
              </Button>
            </div>

            {/* Quick links */}
            <div className="pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground mb-3 text-center">
                Quick access to common areas:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button variant="ghost" size="sm" asChild className="h-auto p-3 flex-col gap-1">
                  <Link href="/dashboard/employees">
                    <div className="h-8 w-8 rounded-full bg-hr-attendance-light flex items-center justify-center">
                      <span className="text-xs font-semibold text-hr-attendance">👥</span>
                    </div>
                    <span className="text-xs">Employees</span>
                  </Link>
                </Button>
                
                <Button variant="ghost" size="sm" asChild className="h-auto p-3 flex-col gap-1">
                  <Link href="/dashboard/attendance">
                    <div className="h-8 w-8 rounded-full bg-hr-leave-light flex items-center justify-center">
                      <span className="text-xs font-semibold text-hr-leave">📅</span>
                    </div>
                    <span className="text-xs">Attendance</span>
                  </Link>
                </Button>
                
                <Button variant="ghost" size="sm" asChild className="h-auto p-3 flex-col gap-1">
                  <Link href="/dashboard/payroll">
                    <div className="h-8 w-8 rounded-full bg-hr-payroll-light flex items-center justify-center">
                      <span className="text-xs font-semibold text-hr-payroll">💰</span>
                    </div>
                    <span className="text-xs">Payroll</span>
                  </Link>
                </Button>
                
                <Button variant="ghost" size="sm" asChild className="h-auto p-3 flex-col gap-1">
                  <Link href="/dashboard/leave">
                    <div className="h-8 w-8 rounded-full bg-hr-expense-light flex items-center justify-center">
                      <span className="text-xs font-semibold text-hr-expense">🏖️</span>
                    </div>
                    <span className="text-xs">Leave</span>
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>
            Need help? Contact your system administrator or{" "}
            <Link href="/dashboard" className="text-primary hover:underline">
              return to dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
