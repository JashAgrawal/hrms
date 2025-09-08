import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  DollarSign,
  Calculator,
  FileText,
  TrendingUp,
  Settings,
  Plus,
  Eye,
} from 'lucide-react'
import Link from 'next/link'

async function PayrollDashboard() {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Check if user has access to payroll module
  if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
          <p className="text-gray-600">
            Manage salary structures, process payroll, and handle employee compensation
          </p>
        </div>
        <div className="flex space-x-2">
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/dashboard/payroll/runs/new">
              <Plus className="mr-2 h-4 w-4" />
              New Payroll Run
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-gray-600">
              +12 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹45.2L</div>
            <p className="text-xs text-gray-600">
              Current month estimate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salary Structures</CardTitle>
            <Calculator className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-gray-600">
              Active structures
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <FileText className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-gray-600">
              Salary revisions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payroll Runs */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Recent Payroll Runs</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/payroll/runs">
                  <Eye className="mr-2 h-4 w-4" />
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  period: '2024-01',
                  status: 'COMPLETED',
                  employees: 1234,
                  amount: '₹45.2L',
                  date: '2024-01-31',
                },
                {
                  period: '2023-12',
                  status: 'COMPLETED',
                  employees: 1220,
                  amount: '₹43.8L',
                  date: '2023-12-31',
                },
                {
                  period: '2023-11',
                  status: 'COMPLETED',
                  employees: 1215,
                  amount: '₹42.9L',
                  date: '2023-11-30',
                },
              ].map((run) => (
                <div key={run.period} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{run.period}</div>
                    <div className="text-sm text-gray-600">
                      {run.employees} employees • {run.date}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{run.amount}</div>
                    <Badge variant={run.status === 'COMPLETED' ? 'default' : 'secondary'}>
                      {run.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Salary Revisions</div>
                  <div className="text-sm text-gray-600">8 pending approvals</div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/payroll/revisions">Review</Link>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">February Payroll</div>
                  <div className="text-sm text-gray-600">Ready to process</div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/payroll/runs/new">Process</Link>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Compliance Reports</div>
                  <div className="text-sm text-gray-600">January reports due</div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/payroll/reports">Generate</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link href="/dashboard/payroll/calculate">
                <Calculator className="h-6 w-6 mb-2" />
                Calculate Payroll
              </Link>
            </Button>

            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link href="/dashboard/payroll/runs">
                <FileText className="h-6 w-6 mb-2" />
                Payroll Runs
              </Link>
            </Button>

            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link href="/dashboard/payroll/salary-grades">
                <TrendingUp className="h-6 w-6 mb-2" />
                Salary Grades
              </Link>
            </Button>

            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link href="/dashboard/payroll/salary-structures">
                <Settings className="h-6 w-6 mb-2" />
                Salary Structures
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PayrollPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PayrollDashboard />
    </Suspense>
  )
}