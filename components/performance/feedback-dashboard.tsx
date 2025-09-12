'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Users, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Send
} from 'lucide-react'
import { FeedbackRequestForm } from './feedback-request-form'
import { FeedbackForm } from './feedback-form'
import { FeedbackReportDialog } from './feedback-report-dialog'

interface Feedback {
  id: string
  reviewerType: string
  relationship?: string
  isAnonymous: boolean
  status: string
  overallRating?: number
  strengths?: string
  improvements?: string
  comments?: string
  submittedAt?: string
  dueDate?: string
  employee: {
    firstName: string
    lastName: string
    employeeCode: string
    designation: string
  }
  reviewer: {
    firstName: string
    lastName: string
    employeeCode: string
    designation: string
  }
  review?: {
    period: string
    type: string
  }
}

interface FeedbackDashboardProps {
  employeeId?: string
  reviewId?: string
}

export function FeedbackDashboard({ employeeId, reviewId }: FeedbackDashboardProps) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [activeTab, setActiveTab] = useState('received')

  useEffect(() => {
    fetchFeedbacks()
  }, [employeeId, reviewId])

  const fetchFeedbacks = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (employeeId) params.append('employeeId', employeeId)
      if (reviewId) params.append('reviewId', reviewId)
      
      const response = await fetch(`/api/performance/feedback?${params}`)
      if (response.ok) {
        const data = await response.json()
        setFeedbacks(data.feedbacks)
      }
    } catch (error) {
      console.error('Error fetching feedback:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFeedbackCreated = () => {
    setShowRequestForm(false)
    fetchFeedbacks()
  }

  const handleFeedbackSubmitted = () => {
    setShowFeedbackForm(false)
    setSelectedFeedback(null)
    fetchFeedbacks()
  }

  // Separate feedback into received and given
  const receivedFeedbacks = feedbacks.filter(f => 
    activeTab === 'received' ? true : false
  )
  
  const givenFeedbacks = feedbacks.filter(f => 
    activeTab === 'given' ? true : false
  )

  // Calculate statistics
  const stats = {
    total: feedbacks.length,
    pending: feedbacks.filter(f => f.status === 'PENDING').length,
    submitted: feedbacks.filter(f => f.status === 'SUBMITTED').length,
    overdue: feedbacks.filter(f => 
      f.status === 'PENDING' && f.dueDate && new Date(f.dueDate) < new Date()
    ).length,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-green-100 text-green-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'OVERDUE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getReviewerTypeColor = (type: string) => {
    switch (type) {
      case 'MANAGER':
        return 'bg-purple-100 text-purple-800'
      case 'PEER':
        return 'bg-blue-100 text-blue-800'
      case 'SUBORDINATE':
        return 'bg-green-100 text-green-800'
      case 'SELF':
        return 'bg-orange-100 text-orange-800'
      case 'EXTERNAL':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const isOverdue = (feedback: Feedback) => {
    return feedback.status === 'PENDING' && 
           feedback.dueDate && 
           new Date(feedback.dueDate) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">360° Feedback</h2>
          <p className="text-gray-600">Collect and manage multi-source feedback</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowReport(true)}>
            <Eye className="h-4 w-4 mr-2" />
            View Report
          </Button>
          <Button onClick={() => setShowRequestForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Request Feedback
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-600">feedback requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-gray-600">awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.submitted}</div>
            <p className="text-xs text-gray-600">feedback received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <p className="text-xs text-gray-600">past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Lists */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback Requests</CardTitle>
          <CardDescription>
            Manage feedback requests and responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="received">Received ({receivedFeedbacks.length})</TabsTrigger>
              <TabsTrigger value="given">Given ({givenFeedbacks.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="received" className="mt-6">
              {receivedFeedbacks.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback received</h3>
                  <p className="text-gray-600 mb-4">
                    Request feedback from your colleagues to get started
                  </p>
                  <Button onClick={() => setShowRequestForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Request Feedback
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {receivedFeedbacks.map((feedback) => (
                    <div 
                      key={feedback.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {feedback.isAnonymous 
                                ? 'Anonymous Feedback' 
                                : `${feedback.reviewer.firstName} ${feedback.reviewer.lastName}`
                              }
                            </span>
                            <Badge className={getReviewerTypeColor(feedback.reviewerType)}>
                              {feedback.reviewerType.replace('_', ' ')}
                            </Badge>
                          </div>
                          <Badge className={getStatusColor(isOverdue(feedback) ? 'OVERDUE' : feedback.status)}>
                            {isOverdue(feedback) ? 'OVERDUE' : feedback.status}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          {feedback.relationship && (
                            <span className="mr-4">Relationship: {feedback.relationship}</span>
                          )}
                          {feedback.dueDate && (
                            <span>Due: {formatDate(feedback.dueDate)}</span>
                          )}
                        </div>
                        
                        {feedback.submittedAt && (
                          <div className="text-sm text-gray-600 mt-1">
                            Submitted: {formatDate(feedback.submittedAt)}
                            {feedback.overallRating && (
                              <span className="ml-4">Rating: {feedback.overallRating}/5</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {feedback.status === 'SUBMITTED' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedFeedback(feedback)
                              setShowFeedbackForm(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="given" className="mt-6">
              {givenFeedbacks.length === 0 ? (
                <div className="text-center py-8">
                  <Send className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback given</h3>
                  <p className="text-gray-600">
                    You haven't provided any feedback yet
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {givenFeedbacks.map((feedback) => (
                    <div 
                      key={feedback.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium">
                            Feedback for {feedback.employee.firstName} {feedback.employee.lastName}
                          </span>
                          <Badge className={getReviewerTypeColor(feedback.reviewerType)}>
                            {feedback.reviewerType.replace('_', ' ')}
                          </Badge>
                          <Badge className={getStatusColor(isOverdue(feedback) ? 'OVERDUE' : feedback.status)}>
                            {isOverdue(feedback) ? 'OVERDUE' : feedback.status}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          {feedback.employee.designation} • {feedback.employee.employeeCode}
                          {feedback.dueDate && (
                            <span className="ml-4">Due: {formatDate(feedback.dueDate)}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {feedback.status === 'PENDING' && (
                          <Button 
                            size="sm"
                            onClick={() => {
                              setSelectedFeedback(feedback)
                              setShowFeedbackForm(true)
                            }}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Provide Feedback
                          </Button>
                        )}
                        {feedback.status === 'SUBMITTED' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedFeedback(feedback)
                              setShowFeedbackForm(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Feedback Request Form Modal */}
      {showRequestForm && (
        <FeedbackRequestForm
          employeeId={employeeId}
          reviewId={reviewId}
          onSuccess={handleFeedbackCreated}
          onCancel={() => setShowRequestForm(false)}
        />
      )}

      {/* Feedback Form Modal */}
      {showFeedbackForm && selectedFeedback && (
        <FeedbackForm
          feedback={selectedFeedback}
          onSuccess={handleFeedbackSubmitted}
          onCancel={() => {
            setShowFeedbackForm(false)
            setSelectedFeedback(null)
          }}
        />
      )}

      {/* Feedback Report Dialog */}
      {showReport && (
        <FeedbackReportDialog
          employeeId={employeeId}
          reviewId={reviewId}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}