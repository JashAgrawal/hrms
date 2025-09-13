"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Megaphone, Pin, Calendar, ExternalLink, Bell } from "lucide-react"
import { useEffect, useState } from "react"
import { format, parseISO, isToday, isTomorrow, isThisWeek } from "date-fns"
import moment from 'moment'
import { Announcement } from "@prisma/client"
import Image from "next/image"

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
          
          setAnnouncements([])
          setUnreadCount(0)
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
            {announcements.map((announcement) => {
              const currAttachments: { name: string; url: string; size: number; type: string }[] = typeof announcement?.attachments === "string"
  ? JSON.parse(announcement.attachments)
  : announcement?.attachments;
              return(
              <div 
                key={announcement.id} 
                className={`
                  p-3 rounded-lg border transition-colors hover:bg-gray-50
                  
                `}
              >
                <div className="flex items-start gap-3">
                  
                  
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
                        <span>{moment(announcement.publishedAt || new Date()).fromNow()}</span>
                        <span>•</span>
                        <span>{announcement.publishedBy}</span>
                      </div>
                      
                      {currAttachments && currAttachments.length > 0 && (
                       
                        <Button onClick={() => {
                          window.open(`/dashboard/announcements`, '_blank')
                        }} variant="ghost" size="sm" className="h-6 px-2">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )})}
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
          <div className="grid grid-cols-2 gap-4 text-center">
            {/* <div>
              <p className="text-sm font-semibold">
                {announcements.filter(a => a.isPinned).length}
              </p>
              <p className="text-xs text-muted-foreground">Pinned</p>
            </div> */}
            <div>
              <p className="text-sm font-semibold">
                {announcements.filter(a => a.priority === 'HIGH' || a.priority === "CRITICAL").length}
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