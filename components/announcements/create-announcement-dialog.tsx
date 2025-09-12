"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { X, Upload, File } from "lucide-react"
import { useDropzone } from "react-dropzone"

const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  type: z.enum(["GENERAL", "POLICY", "EVENT", "HOLIDAY", "SYSTEM", "URGENT", "CELEBRATION"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]),
  expiresAt: z.string().optional(),
  isGlobal: z.boolean(),
  publishNow: z.boolean()
})

type CreateAnnouncementForm = z.infer<typeof createAnnouncementSchema>

interface CreateAnnouncementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateAnnouncementDialog({ open, onOpenChange }: CreateAnnouncementDialogProps) {
  const [loading, setLoading] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])

  const form = useForm<CreateAnnouncementForm>({
    resolver: zodResolver(createAnnouncementSchema),
    defaultValues: {
      title: "",
      content: "",
      type: "GENERAL",
      priority: "NORMAL",
      expiresAt: "",
      isGlobal: true,
      publishNow: false
    }
  })

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setAttachments(prev => [...prev, ...acceptedFiles])
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/*': ['.txt']
    }
  })

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const uploadAttachments = async (): Promise<any[]> => {
    if (attachments.length === 0) return []

    // In a real app, you would upload files to a storage service
    // For now, we'll simulate the upload and return mock URLs
    return attachments.map(file => ({
      name: file.name,
      url: `/uploads/${file.name}`, // Mock URL
      size: file.size,
      type: file.type
    }))
  }

  const onSubmit = async (data: CreateAnnouncementForm) => {
    try {
      setLoading(true)

      // Upload attachments first
      const uploadedAttachments = await uploadAttachments()

      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          attachments: uploadedAttachments,
          expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : undefined
        })
      })

      if (response.ok) {
        form.reset()
        setAttachments([])
        onOpenChange(false)
        // Refresh the page or emit an event to refresh the list
        window.location.reload()
      } else {
        const error = await response.json()
        console.error("Error creating announcement:", error)
      }
    } catch (error) {
      console.error("Error creating announcement:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Announcement</DialogTitle>
          <DialogDescription>
            Create a new announcement to share with your team
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter announcement title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="GENERAL">General</SelectItem>
                        <SelectItem value="POLICY">Policy</SelectItem>
                        <SelectItem value="EVENT">Event</SelectItem>
                        <SelectItem value="HOLIDAY">Holiday</SelectItem>
                        <SelectItem value="SYSTEM">System</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                        <SelectItem value="CELEBRATION">Celebration</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter announcement content"
                      className="min-h-[120px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expiresAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry Date (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="datetime-local" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Leave empty if the announcement doesn't expire
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Upload */}
            <div className="space-y-4">
              <FormLabel>Attachments (Optional)</FormLabel>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive
                    ? "Drop files here..."
                    : "Drag & drop files here, or click to select"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Max file size: 10MB. Supported: Images, PDF, DOC, TXT
                </p>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  <FormLabel>Selected Files</FormLabel>
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4" />
                        <span className="text-sm">{file.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {(file.size / 1024).toFixed(1)} KB
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="isGlobal"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Global Announcement</FormLabel>
                      <FormDescription>
                        Make this announcement visible to all employees
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publishNow"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Publish Immediately</FormLabel>
                      <FormDescription>
                        Publish this announcement now, or save as draft
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : form.watch("publishNow") ? "Publish" : "Save Draft"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}