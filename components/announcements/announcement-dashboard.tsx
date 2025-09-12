"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Plus, Megaphone, Eye, Calendar, Users } from "lucide-react"
import { AnnouncementList } from "./announcement-list"
import { CreateAnnouncementDialog } from "./create-announcement-dialog"
import { AnnouncementStats } from "./announcement-stats"

interface AnnouncementDashboardProps {
  userRole: string
}

export function AnnouncementDashboard({ userRole }: AnnouncementDashboardProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  
  const canManageAnnouncements = ["ADMIN", "HR"].includes(userRole.toUpperCase())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground">
            Stay updated with company news and important information
          </p>
        </div>
        {canManageAnnouncements && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Announcement
          </Button>
        )}
      </div>

      {canManageAnnouncements && <AnnouncementStats />}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Announcements</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          {canManageAnnouncements && (
            <>
              <TabsTrigger value="draft">Drafts</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <AnnouncementList 
            status={undefined} 
            canManage={canManageAnnouncements}
          />
        </TabsContent>

        <TabsContent value="published" className="space-y-4">
          <AnnouncementList 
            status="PUBLISHED" 
            canManage={canManageAnnouncements}
          />
        </TabsContent>

        {canManageAnnouncements && (
          <>
            <TabsContent value="draft" className="space-y-4">
              <AnnouncementList 
                status="DRAFT" 
                canManage={canManageAnnouncements}
              />
            </TabsContent>

            <TabsContent value="archived" className="space-y-4">
              <AnnouncementList 
                status="ARCHIVED" 
                canManage={canManageAnnouncements}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <CreateAnnouncementDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  )
}