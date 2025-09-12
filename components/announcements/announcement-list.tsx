"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  Eye, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Archive, 
  Send,
  Calendar,
  Paperclip,
  Users
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { AnnouncementCard } from "./announcement-card"
import { EditAnnouncementDialog } from "./edit-announcement-dialog"

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

interface AnnouncementListProps {
  status?: string
  canManage: boolean
}

export function AnnouncementList({ status, canManage }: AnnouncementListProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchAnnouncements()
  }, [status])

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (status) params.append("status", status)
      
      const response = await fetch(`/api/announcements?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAnnouncements(data.announcements)
      }
    } catch (error) {
      console.error("Error fetching announcements:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
    setEditDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    setAnnouncementToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!announcementToDelete) return

    try {
      const response = await fetch(`/api/announcements/${announcementToDelete}`, {
        method: "DELETE"
      })

      if (response.ok) {
        setAnnouncements(prev => prev.filter(a => a.id !== announcementToDelete))
        setDeleteDialogOpen(false)
        setAnnouncementToDelete(null)
      }
    } catch (error) {
      console.error("Error deleting announcement:", error)
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        fetchAnnouncements()
      }
    } catch (error) {
      console.error("Error updating announcement status:", error)
    }
  }

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

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
            </CardHeader>
            <CardContent>
              <div className="h-16 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (announcements.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">No announcements found</h3>
            <p className="text-muted-foreground">
              {status === "DRAFT" 
                ? "No draft announcements yet" 
                : status === "ARCHIVED"
                ? "No archived announcements"
                : "No announcements available"}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {announcements.map((announcement) => (
          <AnnouncementCard
            key={announcement.id}
            announcement={announcement}
            canManage={canManage}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      <EditAnnouncementDialog
        announcement={selectedAnnouncement}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchAnnouncements}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this announcement? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}