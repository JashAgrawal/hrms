'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  DollarSign,
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Receipt,
  Plane
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface TravelExpense {
  id: string
  title: string
  amount: number
  expenseDate: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  category: {
    name: string
    code: string
  }
  attachments: Array<{
    id: string
    fileName: string
    fileUrl: string
  }>
}

interface TravelExpenseData {
  travelRequest: {
    id: string
    title: string
    estimatedCost: number
    actualCost?: number
    status: string
  }
  expenses: TravelExpense[]
  summary: {
    totalExpenses: number
    approvedExpenses: number
    pendingExpenses: number
    estimatedVsActual: {
      estimated: number
      actual: number
      variance: number
      variancePercentage: number
    }
  }
}

interface TravelExpenseTrackerProps {
  travelRequestId: string
  onAddExpense?: () => void
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
}

export function TravelExpenseTracker({ 
  travelRequestId, 
  onAddExpense 
}: TravelExpenseTrackerProps) {
  const [data, setData] = useState<TravelExpenseData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchExpenseData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/travel-requests/${travelRequestId}/expenses`)
      if (response.ok) {
        const expenseData = await response.json()
        setData(expenseData)
      }
    } catch (error) {
      console.error('Error fetching travel expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (travelRequestId) {
      fetchExpenseData()
    }
  }, [travelRequestId])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading expense data...</div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No expense data available
          </div>
        </CardContent>
      </Card>
    )
  }

  const { travelRequest, expenses, summary } = data
  const { estimatedVsActual } = summary

  const progressPercentage = estimatedVsActual.estimated > 0 
    ? Math.min((estimatedVsActual.actual / estimatedVsActual.estimated) * 100, 100)
    : 0

  const isOverBudget = estimatedVsActual.variance > 0
  const varianceColor = isOverBudget ? 'text-red-600' : 'text-green-600'
  const VarianceIcon = isOverBudget ? TrendingUp : TrendingDown

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5" />
                Travel Expenses
              </CardTitle>
              <CardDescription>{travelRequest.title}</CardDescription>
            </div>
            {onAddExpense && (
              <Button onClick={onAddExpense}>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{estimatedVsActual.estimated.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Original budget
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actual Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{estimatedVsActual.actual.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total claimed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance</CardTitle>
            <VarianceIcon className={cn("h-4 w-4", varianceColor)} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", varianceColor)}>
              {isOverBudget ? '+' : ''}₹{Math.abs(estimatedVsActual.variance).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.abs(estimatedVsActual.variancePercentage).toFixed(1)}% 
              {isOverBudget ? ' over' : ' under'} budget
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Budget Utilization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Expenses vs Budget</span>
              <span>{progressPercentage.toFixed(1)}%</span>
            </div>
            <Progress 
              value={progressPercentage} 
              className={cn(
                "h-2",
                isOverBudget && "bg-red-100"
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Approved: ₹{summary.approvedExpenses.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Pending: ₹{summary.pendingExpenses.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <span>Remaining: ₹{Math.max(0, estimatedVsActual.estimated - estimatedVsActual.actual).toLocaleString()}</span>
            </div>
          </div>

          {isOverBudget && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">
                Expenses exceed estimated budget by ₹{estimatedVsActual.variance.toLocaleString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Expense Claims</CardTitle>
          <CardDescription>
            All expense claims related to this travel request
          </CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No expense claims submitted yet</p>
              {onAddExpense && (
                <Button variant="outline" className="mt-4" onClick={onAddExpense}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Expense
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expense</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attachments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <div className="font-medium">{expense.title}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {expense.category.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(expense.expenseDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          ₹{expense.amount.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border", statusColors[expense.status])}>
                          <div className="flex items-center gap-1">
                            {expense.status === 'APPROVED' ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : expense.status === 'REJECTED' ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            {expense.status.charAt(0) + expense.status.slice(1).toLowerCase()}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {expense.attachments.length} file{expense.attachments.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}