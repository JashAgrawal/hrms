'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Plus, 
  Calendar, 
  Users, 
  Settings, 
  FileText, 
  BarChart3,
  Clock,
  CheckCircle
} from 'lucide-react'
import { LeaveRequestForm } from '../leave-request-form'
import { usePermissions } from '@/hooks/use-permissions'

export function QuickActionsCard() {
  const [showRequestForm, setShowRequestForm] = useState(false)
  const { hasRole } = usePermissions()

  const isEmployee = hasRole('EMPLOYEE')
  const isManager = hasRole(['MANAGER', 'HR', 'ADMIN'])
  const isHR = hasRole(['HR', 'ADMIN'])

  const employeeActions = [
    {
      title: 'Submit Leave Request',
      description: 'Request time off',
      icon: Plus,
      action: () => setShowRequestForm(true),
      variant: 'default' as const,
    },
    {
      title: 'View My Requests',
      description: 'Check request status',
      icon: FileText,
      href: '/dashboard/leave/requests?my=true',
      variant: 'outline' as const,
    },
    {
      title: 'Leave Calendar',
      description: 'View team calendar',
      icon: Calendar,
      href: '/dashboard/leave/calendar',
      variant: 'outline' as const,
    },
  ]

  const managerActions = [
    {
      title: 'Pending Approvals',
      description: 'Review team requests',
      icon: Clock,
      href: '/dashboard/leave/requests?status=PENDING',
      variant: 'default' as const,
    },
    {
      title: 'Team Calendar',
      description: 'View team schedule',
      icon: Calendar,
      href: '/dashboard/leave/calendar',
      variant: 'outline' as const,
    },
    {
      title: 'Team Availability',
      description: 'Check availability',
      icon: Users,
      href: '/dashboard/leave/availability',
      variant: 'outline' as const,
    },
  ]

  const hrActions = [
    {
      title: 'All Requests',
      description: 'Manage all requests',
      icon: FileText,
      href: '/dashboard/leave/requests',
      variant: 'default' as const,
    },
    {
      title: 'Leave Policies',
      description: 'Configure policies',
      icon: Settings,
      href: '/dashboard/leave/policies',
      variant: 'outline' as const,
    },
    {
      title: 'Leave Balances',
      description: 'Manage balances',
      icon: BarChart3,
      href: '/dashboard/leave/balances',
      variant: 'outline' as const,
    },
    {
      title: 'Reports',
      description: 'View analytics',
      icon: BarChart3,
      href: '/dashboard/leave/reports',
      variant: 'outline' as const,
    },
  ]

  const getActions = () => {
    if (isHR) return hrActions
    if (isManager) return managerActions
    return employeeActions
  }

  const actions = getActions()

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            <CardTitle>Quick Actions</CardTitle>
          </div>
          <CardDescription>
            {isEmployee && "Common leave management tasks"}
            {isManager && !isHR && "Team management shortcuts"}
            {isHR && "Administrative shortcuts"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {actions.map((action, index) => {
            const Icon = action.icon
            
            if ('action' in action) {
              return (
                <Button
                  key={index}
                  variant={action.variant}
                  className="w-full justify-start h-auto p-4"
                  onClick={action.action}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{action.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {action.description}
                      </div>
                    </div>
                  </div>
                </Button>
              )
            }

            return (
              <Link key={index} href={action.href || '#'}>
                <Button
                  variant={action.variant}
                  className="w-full justify-start h-auto p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{action.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {action.description}
                      </div>
                    </div>
                  </div>
                </Button>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      {/* Leave Request Form Dialog */}
      <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Leave Request</DialogTitle>
          </DialogHeader>
          <LeaveRequestForm
            onSuccess={() => setShowRequestForm(false)}
            onCancel={() => setShowRequestForm(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
