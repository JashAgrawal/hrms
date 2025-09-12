'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Star, 
  TrendingUp, 
  Users, 
  MessageSquare,
  BarChart3,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FeedbackSummary {
  totalFeedbacks: number
  averageRating: number
  ratingDistribution: Record<number, number>
  feedbackByType: Record<string, {
    count: number
    averageRating: number
    feedbacks: any[]
  }>
  commonStrengths: string[]
  commonImprovements: string[]
  detailedFeedbacks: any[]
}

interface FeedbackReportDialogProps {
  employeeId?: string
  reviewId?: string
  onClose: () => void
}

export function FeedbackReportDialog({ 
  employeeId, 
  reviewId, 
  onClose 
}: FeedbackReportDialogProps) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<FeedbackSummary | null>(null)

  useEffect(() => {
    fetchFeedbackSummary()
  }, [employeeId, reviewId])

  const fetchFeedbackSummary = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (employeeId) params.append('employeeId', employeeId)
      if (reviewId) params.append('reviewId', reviewId)
      
      const response = await fetch(`/api/performance/feedback?${params}`)
      if (response.ok) {
        const data = await response.json()
        processFeedbackData(data.feedbacks)
      }
    } catch (error) {
      console.error('Error fetching feedback summary:', error)
    } finally {
      setLoading(false)
    }
  }

  const processFeedbackData = (feedbacks: any[]) => {
    const submittedFeedbacks = feedbacks.filter(f => f.status === 'SUBMITTED' && f.overallRating)
    
    if (submittedFeedbacks.length === 0) {
      setSummary({
        totalFeedbacks: 0,
        averageRating: 0,
        ratingDistribution: {},
        feedbackByType: {},
        commonStrengths: [],
        commonImprovements: [],
        detailedFeedbacks: []
      })
      return
    }

    // Calculate average rating
    const totalRating = submittedFeedbacks.reduce((sum, f) => sum + f.overallRating, 0)
    const averageRating = totalRating / submittedFeedbacks.length

    // Rating distribution
    const ratingDistribution = submittedFeedbacks.reduce((acc, f) => {
      acc[f.overallRating] = (acc[f.overallRating] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    // Feedback by reviewer type
    const feedbackByType = submittedFeedbacks.reduce((acc, f) => {
      if (!acc[f.reviewerType]) {
        acc[f.reviewerType] = { count: 0, averageRating: 0, feedbacks: [] }
      }
      acc[f.reviewerType].count++
      acc[f.reviewerType].feedbacks.push(f)
      return acc
    }, {} as Record<string, any>)

    // Calculate average rating by type
    Object.keys(feedbackByType).forEach(type => {
      const typeData = feedbackByType[type]
      const typeTotal = typeData.feedbacks.reduce((sum: number, f: any) => sum + f.overallRating, 0)
      typeData.averageRating = typeTotal / typeData.count
    })

    // Extract common themes (simplified - in real app, you'd use NLP)
    const allStrengths = submittedFeedbacks
      .map(f => f.strengths)
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const allImprovements = submittedFeedbacks
      .map(f => f.improvements)
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    // Simple keyword extraction (in real app, use proper text analysis)
    const commonStrengths = extractKeywords(allStrengths)
    const commonImprovements = extractKeywords(allImprovements)

    setSummary({
      totalFeedbacks: submittedFeedbacks.length,
      averageRating,
      ratingDistribution,
      feedbackByType,
      commonStrengths,
      commonImprovements,
      detailedFeedbacks: submittedFeedbacks
    })
  }

  const extractKeywords = (text: string): string[] => {
    // Simple keyword extraction - in real app, use proper NLP
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall', 'a', 'an', 'this', 'that', 'these', 'those']
    
    const words = text
      .split(/\W+/)
      .filter(word => word.length > 3 && !commonWords.includes(word))
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    return Object.entries(words)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word)
  }

  const StarRating = ({ rating }: { rating: number }) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
        <span className="ml-2 text-sm font-medium">{rating.toFixed(1)}</span>
      </div>
    )
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

  if (loading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!summary || summary.totalFeedbacks === 0) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Feedback Report</DialogTitle>
            <DialogDescription>
              360-degree feedback summary and insights
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback available</h3>
            <p className="text-gray-600">
              No submitted feedback found for the selected criteria
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>360° Feedback Report</DialogTitle>
              <DialogDescription>
                Comprehensive feedback analysis and insights
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="by-type">By Type</TabsTrigger>
            <TabsTrigger value="themes">Themes</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.totalFeedbacks}</div>
                  <p className="text-xs text-gray-600">responses received</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                  <Star className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.averageRating.toFixed(1)}/5</div>
                  <StarRating rating={summary.averageRating} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                  <BarChart3 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round((summary.totalFeedbacks / (summary.totalFeedbacks + 2)) * 100)}%
                  </div>
                  <p className="text-xs text-gray-600">completion rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Rating Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Rating Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = summary.ratingDistribution[rating] || 0
                    const percentage = (count / summary.totalFeedbacks) * 100
                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 w-16">
                          <span className="text-sm font-medium">{rating}</span>
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        </div>
                        <div className="flex-1">
                          <Progress value={percentage} className="h-2" />
                        </div>
                        <div className="text-sm text-gray-600 w-12 text-right">
                          {count}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-type" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(summary.feedbackByType).map(([type, data]) => (
                <Card key={type}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {type.replace('_', ' ')}
                      </CardTitle>
                      <Badge className={getReviewerTypeColor(type)}>
                        {data.count} feedback{data.count !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Average Rating</div>
                        <StarRating rating={data.averageRating} />
                      </div>
                      <div className="text-sm text-gray-600">
                        {data.count} out of {summary.totalFeedbacks} total responses
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="themes" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-700">Key Strengths</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.commonStrengths.length > 0 ? (
                    <div className="space-y-2">
                      {summary.commonStrengths.map((strength, index) => (
                        <Badge key={index} variant="outline" className="mr-2 mb-2">
                          {strength}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm">No common themes identified</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-orange-700">Development Areas</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.commonImprovements.length > 0 ? (
                    <div className="space-y-2">
                      {summary.commonImprovements.map((improvement, index) => (
                        <Badge key={index} variant="outline" className="mr-2 mb-2">
                          {improvement}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm">No common themes identified</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="detailed" className="space-y-4">
            {summary.detailedFeedbacks.map((feedback, index) => (
              <Card key={feedback.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
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
                    <StarRating rating={feedback.overallRating} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {feedback.strengths && (
                    <div>
                      <h4 className="font-medium text-green-700 mb-2">Strengths</h4>
                      <p className="text-sm text-gray-700">{feedback.strengths}</p>
                    </div>
                  )}
                  {feedback.improvements && (
                    <div>
                      <h4 className="font-medium text-orange-700 mb-2">Areas for Improvement</h4>
                      <p className="text-sm text-gray-700">{feedback.improvements}</p>
                    </div>
                  )}
                  {feedback.comments && (
                    <div>
                      <h4 className="font-medium text-blue-700 mb-2">Additional Comments</h4>
                      <p className="text-sm text-gray-700">{feedback.comments}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}