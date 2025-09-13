"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  Eye, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Archive, 
  Send,
  Calendar,
  Paperclip,
  Users,
  Globe
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

interface Announcement {
  id: string
  title: string
  content: string
  type: string
  priority: string
  status: string
  publishedAt: string | null
  expiresAt: string | null
  attachments: any[]
  targetAudience: any
  isGlobal: boolean
  viewCount: number
  createdAt: string
  updatedAt: string
  views: any[]
}

interface AnnouncementCardProps {
  announcement: Announcement
  canManage: boolean
  onEdit: (announcement: Announcement) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}

export function AnnouncementCard({ 
  announcement, 
  canManage, 
  onEdit, 
  onDelete, 
  onStatusChange 
}: AnnouncementCardProps) {
  const [expanded, setExpanded] = useState(false)

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "destructive"
      case "HIGH": return "destructive"
      case "NORMAL": return "secondary"
      case "LOW": return "outline"
      default: return "secondary"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PUBLISHED": return "default"
      case "DRAFT": return "secondary"
      case "ARCHIVED": return "outline"
      case "EXPIRED": return "destructive"
      default: return "secondary"
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "URGENT": return "destructive"
      case "POLICY": return "default"
      case "EVENT": return "default"
      case "CELEBRATION": return "default"
      default: return "secondary"
    }
  }

  const handleView = async () => {
    if (announcement.status === "PUBLISHED") {
      try {
        await fetch(`/api/announcements/${announcement.id}/view`, {
          method: "POST"
        })
      } catch (error) {
        console.error("Error recording view:", error)
      }
    }
    setExpanded(!expanded)
  }

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + "..."
  }

  return (
    <Card className={`transition-all duration-200 ${
      announcement.priority === "CRITICAL" ? "border-red-200 bg-red-50/50" :
      announcement.priority === "HIGH" ? "border-orange-200 bg-orange-50/50" :
      "hover:shadow-md"
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{announcement.title}</CardTitle>
              <Badge variant={getPriorityColor(announcement.priority)} className="text-xs">
                {announcement.priority}
              </Badge>
              <Badge variant={getTypeColor(announcement.type)} className="text-xs">
                {announcement.type}
              </Badge>
              <Badge variant={getStatusColor(announcement.status)} className="text-xs">
                {announcement.status}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {announcement.viewCount} views
              </div>
              
              {announcement.attachments && announcement.attachments.length > 0 && (
                <div className="flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {announcement.attachments.length} attachment{announcement.attachments.length > 1 ? 's' : ''}
                </div>
              )}
              
              <div className="flex items-center gap-1">
                {announcement.isGlobal ? (
                  <>
                    <Globe className="h-3 w-3" />
                    Global
                  </>
                ) : (
                  <>
                    <Users className="h-3 w-3" />
                    Targeted
                  </>
                )}
              </div>
              
              {announcement.publishedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDistanceToNow(new Date(announcement.publishedAt), { addSuffix: true })}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleView}
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(announcement)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  
                  {announcement.status === "DRAFT" && (
                    <DropdownMenuItem onClick={() => onStatusChange(announcement.id, "PUBLISHED")}>
                      <Send className="mr-2 h-4 w-4" />
                      Publish
                    </DropdownMenuItem>
                  )}
                  
                  {announcement.status === "PUBLISHED" && (
                    <DropdownMenuItem onClick={() => onStatusChange(announcement.id, "ARCHIVED")}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuItem 
                    onClick={() => onDelete(announcement.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          <div className="prose prose-sm max-w-none">
            {expanded ? (
              <div dangerouslySetInnerHTML={{ __html: announcement.content }} />
            ) : (
              <p>{truncateContent(announcement.content)}</p>
            )}
          </div>
          
          {announcement.content.length > 150 && (
            <Button 
              variant="link" 
              size="sm" 
              onClick={handleView}
              className="p-0 h-auto text-sm"
            >
              {expanded ? "Show less" : "Read more"}
            </Button>
          )}
          
          {expanded && announcement.attachments && announcement.attachments.length > 0 && (
            <div className="border-t pt-3">
              <h4 className="text-sm font-medium mb-2">Attachments</h4>
              <div className="space-y-2">
                {announcement.attachments.map((attachment: any, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Paperclip className="h-3 w-3" />
                    <a 
                      href={attachment.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {attachment.name}
                    </a>
                    <span className="text-muted-foreground">
                      ({(attachment.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {expanded && announcement.expiresAt && (
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Expires on {format(new Date(announcement.expiresAt), "PPP")}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}