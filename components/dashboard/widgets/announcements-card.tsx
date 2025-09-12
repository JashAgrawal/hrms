"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Megaphone, Pin, Calendar, ExternalLink, Bell } from "lucide-react"
import { useEffect, useState } from "react"
import { format, parseISO, isToday, isTomorrow, isThisWeek } from "date-fns"

interface Announcement {
  id: string
  title: string
  content: string
  type: 'GENERAL' | 'URGENT' | 'EVENT' | 'POLICY' | 'CELEBRATION'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  publishedDate: string
  expiryDate?: string
  isPinned: boolean
  author: {
    name: string
    department: string
  }
  readBy?: string[]
  attachments?: {
    name: string
    url: string
  }[]
}

export function AnnouncementsCard() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await fetch('/api/announcements?limit=5&active=true')
        
        if (response.ok) {
          const data = await response.json()
          setAnnouncements(data.announcements || [])
          setUnreadCount(data.unreadCount || 0)
        } else {
          // Mock data if API not available
          const mockAnnouncements: Announcement[] = [
            {
              id: '1',
              title: 'Quarterly Town Hall Meeting',
              content: 'Join us for our Q4 town hall meeting this Friday at 3 PM in the main conference room. We\'ll be discussing company updates, achievements, and upcoming initiatives.',
              type: 'EVENT',
              priority: 'HIGH',
              publishedDate: new Date().toISOString(),
              expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              isPinned: true,
              author: {
                name: 'Sarah Johnson',
                department: 'HR'
              }
            },
            {
              id: '2',
              title: 'New Health Insurance Policy',
              content: 'We\'re excited to announce enhanced health insurance benefits starting January 1st. Please review the updated policy document and submit your preferences by December 15th.',
              type: 'POLICY',
              priority: 'MEDIUM',
              publishedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              isPinned: false,
              author: {
                name: 'Mike Chen',
                department: 'Benefits'
              }
            },
            {
              id: '3',
              title: 'Holiday Party - December 20th',
              content: 'Save the date! Our annual holiday party will be held on December 20th at 6 PM. Food, drinks, and entertainment will be provided. RSVP required.',
              type: 'CELEBRATION',
              priority: 'MEDIUM',
              publishedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              isPinned: false,
              author: {
                name: 'Events Team',
                department: 'HR'
              }
            },
            {
              id: '4',
              title: 'System Maintenance - Weekend',
              content: 'Scheduled system maintenance this weekend from Saturday 10 PM to Sunday 6 AM. Some services may be temporarily unavailable.',
              type: 'GENERAL',
              priority: 'LOW',
              publishedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              isPinned: false,
              author: {
                name: 'IT Team',
                department: 'Technology'
              }
            }
          ]
          setAnnouncements(mockAnnouncements)
          setUnreadCount(2)
        }
      } catch (error) {
        console.error('Failed to fetch announcements:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnnouncements()
  }, [])

  const getAnnouncementTypeBadge = (type: string, priority: string) => {
    switch (type) {
      case 'URGENT':
        return <Badge variant="destructive">Urgent</Badge>
      case 'EVENT':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Event</Badge>
      case 'POLICY':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Policy</Badge>
      case 'CELEBRATION':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Celebration</Badge>
      case 'GENERAL':
      default:
        return priority === 'HIGH' || priority === 'URGENT' 
          ? <Badge variant="secondary" className="bg-orange-100 text-orange-800">Important</Badge>
          : <Badge variant="outline">General</Badge>
    }
  }

  const formatPublishDate = (dateString: string) => {
    const date = parseISO(dateString)
    
    if (isToday(date)) {
      return 'Today'
    } else if (isTomorrow(date)) {
      return 'Tomorrow'
    } else if (isThisWeek(date)) {
      return format(date, 'EEEE')
    } else {
      return format(date, 'MMM dd')
    }
  }

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-4 w-4" />
          Announcements
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {unreadCount} new
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {announcements.length === 0 ? (
          <div className="text-center py-6">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No announcements at this time
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Check back later for updates
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div 
                key={announcement.id} 
                className={`
                  p-3 rounded-lg border transition-colors hover:bg-gray-50
                  ${announcement.isPinned ? 'bg-blue-50 border-blue-200' : 'bg-white'}
                `}
              >
                <div className="flex items-start gap-3">
                  {announcement.isPinned && (
                    <Pin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium truncate pr-2">
                        {announcement.title}
                      </h4>
                      {getAnnouncementTypeBadge(announcement.type, announcement.priority)}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-2">
                      {truncateContent(announcement.content)}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatPublishDate(announcement.publishedDate)}</span>
                        <span>•</span>
                        <span>{announcement.author.name}</span>
                      </div>
                      
                      {announcement.attachments && announcement.attachments.length > 0 && (
                        <Button variant="ghost" size="sm" className="h-6 px-2">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {announcements.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="text-xs">
                View All Announcements
              </Button>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs">
                  Mark All Read
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="pt-3 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm font-semibold">
                {announcements.filter(a => a.isPinned).length}
              </p>
              <p className="text-xs text-muted-foreground">Pinned</p>
            </div>
            <div>
              <p className="text-sm font-semibold">
                {announcements.filter(a => a.priority === 'HIGH' || a.priority === 'URGENT').length}
              </p>
              <p className="text-xs text-muted-foreground">Important</p>
            </div>
            <div>
              <p className="text-sm font-semibold">
                {announcements.filter(a => a.type === 'EVENT').length}
              </p>
              <p className="text-xs text-muted-foreground">Events</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}