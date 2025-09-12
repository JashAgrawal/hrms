'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  FileText, 
  Upload, 
  Download, 
  Share2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  History,
  Users,
  Calendar,
  Eye,
  Edit,
  Trash2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface Document {
  id: string
  title: string
  description?: string
  category: string
  fileName: string
  originalName?: string
  fileUrl: string
  fileSize?: number
  mimeType?: string
  version: number
  status: string
  isRequired: boolean
  expiryDate?: string
  tags?: string[]
  uploadedBy: string
  approvalStatus: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  employee?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  versions?: DocumentVersion[]
  approvals?: DocumentApproval[]
  shares?: DocumentShare[]
  reminders?: DocumentReminder[]
}

interface DocumentVersion {
  id: string
  version: number
  fileName: string
  fileUrl: string
  fileSize?: number
  mimeType?: string
  changeLog?: string
  uploadedBy: string
  createdAt: string
}

interface DocumentApproval {
  id: string
  approverId: string
  approverName?: string
  approverEmail?: string
  level: number
  status: string
  approvedAt?: string
  rejectedAt?: string
  comments?: string
  digitalSignature?: any
}

interface DocumentShare {
  id: string
  sharedWith: string
  sharedBy: string
  permissions: string
  expiresAt?: string
  accessCount: number
  lastAccessedAt?: string
  isActive: boolean
  createdAt: string
}

interface DocumentReminder {
  id: string
  reminderType: string
  reminderDate: string
  message?: string
  isSent: boolean
  sentAt?: string
}

interface DocumentWorkflowManagerProps {
  employeeId?: string
  documents?: Document[]
  onDocumentUpdate?: () => void
}

export function DocumentWorkflowManager({ 
  employeeId, 
  documents: initialDocuments = [],
  onDocumentUpdate 
}: DocumentWorkflowManagerProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(false)
  const [approvalDialog, setApprovalDialog] = useState(false)
  const [shareDialog, setShareDialog] = useState(false)
  const [versionDialog, setVersionDialog] = useState(false)
  const [reminderDialog, setReminderDialog] = useState(false)
  const { toast } = useToast()

  // Approval form state
  const [approvalAction, setApprovalAction] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [approvalComments, setApprovalComments] = useState('')

  // Share form state
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermissions, setSharePermissions] = useState('READ')
  const [shareExpiry, setShareExpiry] = useState('')

  // Version form state
  const [versionFile, setVersionFile] = useState<File | null>(null)
  const [versionChangeLog, setVersionChangeLog] = useState('')

  // Reminder form state
  const [reminderType, setReminderType] = useState('EXPIRY_WARNING')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderMessage, setReminderMessage] = useState('')

  const fetchDocuments = async () => {
    if (!employeeId) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/employees/${employeeId}`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.employee.documents || [])
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (employeeId && !initialDocuments.length) {
      fetchDocuments()
    }
  }, [employeeId])

  const handleApproval = async () => {
    if (!selectedDocument) return

    try {
      setLoading(true)
      const response = await fetch(`/api/documents/${selectedDocument.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: approvalAction,
          comments: approvalComments
        })
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Document ${approvalAction.toLowerCase()}d successfully`
        })
        setApprovalDialog(false)
        setApprovalComments('')
        fetchDocuments()
        onDocumentUpdate?.()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      console.error('Error processing approval:', error)
      toast({
        title: 'Error',
        description: 'Failed to process approval',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    if (!selectedDocument || !shareEmail) return

    try {
      setLoading(true)
      const response = await fetch(`/api/documents/${selectedDocument.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharedWith: shareEmail,
          permissions: sharePermissions,
          expiresAt: shareExpiry || undefined
        })
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Document shared successfully'
        })
        setShareDialog(false)
        setShareEmail('')
        setSharePermissions('read')
        setShareExpiry('')
        fetchDocuments()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      console.error('Error sharing document:', error)
      toast({
        title: 'Error',
        description: 'Failed to share document',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVersionUpload = async () => {
    if (!selectedDocument || !versionFile) return

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('file', versionFile)
      formData.append('changeLog', versionChangeLog)

      const response = await fetch(`/api/documents/${selectedDocument.id}/versions`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'New version uploaded successfully'
        })
        setVersionDialog(false)
        setVersionFile(null)
        setVersionChangeLog('')
        fetchDocuments()
        onDocumentUpdate?.()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      console.error('Error uploading version:', error)
      toast({
        title: 'Error',
        description: 'Failed to upload new version',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateReminder = async () => {
    if (!selectedDocument || !reminderDate) return

    try {
      setLoading(true)
      const response = await fetch('/api/documents/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          employeeId: selectedDocument.employee?.id || employeeId,
          reminderType,
          reminderDate,
          message: reminderMessage
        })
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Reminder created successfully'
        })
        setReminderDialog(false)
        setReminderDate('')
        setReminderMessage('')
        fetchDocuments()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      console.error('Error creating reminder:', error)
      toast({
        title: 'Error',
        description: 'Failed to create reminder',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PENDING: 'outline',
      APPROVED: 'default',
      REJECTED: 'destructive',
      ACTIVE: 'default',
      EXPIRED: 'destructive',
      ARCHIVED: 'secondary'
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Workflow Manager
          </CardTitle>
          <CardDescription>
            Manage document approvals, versions, sharing, and reminders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No documents found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{document.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatFileSize(document.fileSize)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{document.category}</Badge>
                      </TableCell>
                      <TableCell>v{document.version}</TableCell>
                      <TableCell>{getStatusBadge(document.status)}</TableCell>
                      <TableCell>{getStatusBadge(document.approvalStatus)}</TableCell>
                      <TableCell>
                        {document.expiryDate ? (
                          <div className="flex items-center gap-1">
                            {new Date(document.expiryDate) < new Date() ? (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Calendar className="h-4 w-4 text-blue-500" />
                            )}
                            {format(new Date(document.expiryDate), 'MMM dd, yyyy')}
                          </div>
                        ) : (
                          'No expiry'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedDocument(document)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {document.approvalStatus === 'PENDING' && (
                            <Dialog open={approvalDialog} onOpenChange={setApprovalDialog}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedDocument(document)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Document Approval</DialogTitle>
                                  <DialogDescription>
                                    Review and approve or reject this document
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Action</Label>
                                    <Select value={approvalAction} onValueChange={(value: 'APPROVE' | 'REJECT') => setApprovalAction(value)}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="APPROVE">Approve</SelectItem>
                                        <SelectItem value="REJECT">Reject</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label htmlFor="comments">Comments</Label>
                                    <Textarea
                                      id="comments"
                                      value={approvalComments}
                                      onChange={(e) => setApprovalComments(e.target.value)}
                                      placeholder="Add comments (optional)"
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setApprovalDialog(false)}>
                                      Cancel
                                    </Button>
                                    <Button onClick={handleApproval} disabled={loading}>
                                      {loading ? 'Processing...' : 'Submit'}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}

                          <Dialog open={shareDialog} onOpenChange={setShareDialog}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedDocument(document)}
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Share Document</DialogTitle>
                                <DialogDescription>
                                  Share this document with other users
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="shareEmail">Email Address</Label>
                                  <Input
                                    id="shareEmail"
                                    type="email"
                                    value={shareEmail}
                                    onChange={(e) => setShareEmail(e.target.value)}
                                    placeholder="Enter email address"
                                  />
                                </div>
                                <div>
                                  <Label>Permissions</Label>
                                  <Select value={sharePermissions} onValueChange={setSharePermissions}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="read">Read Only</SelectItem>
                                      <SelectItem value="write">Read & Write</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="shareExpiry">Expiry Date (Optional)</Label>
                                  <Input
                                    id="shareExpiry"
                                    type="datetime-local"
                                    value={shareExpiry}
                                    onChange={(e) => setShareExpiry(e.target.value)}
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setShareDialog(false)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={handleShare} disabled={loading || !shareEmail}>
                                    {loading ? 'Sharing...' : 'Share'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={versionDialog} onOpenChange={setVersionDialog}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedDocument(document)}
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Upload New Version</DialogTitle>
                                <DialogDescription>
                                  Upload a new version of this document
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="versionFile">File</Label>
                                  <Input
                                    id="versionFile"
                                    type="file"
                                    onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="changeLog">Change Log</Label>
                                  <Textarea
                                    id="changeLog"
                                    value={versionChangeLog}
                                    onChange={(e) => setVersionChangeLog(e.target.value)}
                                    placeholder="Describe what changed in this version"
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setVersionDialog(false)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={handleVersionUpload} disabled={loading || !versionFile}>
                                    {loading ? 'Uploading...' : 'Upload'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={reminderDialog} onOpenChange={setReminderDialog}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedDocument(document)}
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Create Reminder</DialogTitle>
                                <DialogDescription>
                                  Set up a reminder for this document
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Reminder Type</Label>
                                  <Select value={reminderType} onValueChange={setReminderType}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="EXPIRY_WARNING">Expiry Warning</SelectItem>
                                      <SelectItem value="RENEWAL_DUE">Renewal Due</SelectItem>
                                      <SelectItem value="APPROVAL_PENDING">Approval Pending</SelectItem>
                                      <SelectItem value="COMPLIANCE_CHECK">Compliance Check</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="reminderDate">Reminder Date</Label>
                                  <Input
                                    id="reminderDate"
                                    type="datetime-local"
                                    value={reminderDate}
                                    onChange={(e) => setReminderDate(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="reminderMessage">Message (Optional)</Label>
                                  <Textarea
                                    id="reminderMessage"
                                    value={reminderMessage}
                                    onChange={(e) => setReminderMessage(e.target.value)}
                                    placeholder="Custom reminder message"
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setReminderDialog(false)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={handleCreateReminder} disabled={loading || !reminderDate}>
                                    {loading ? 'Creating...' : 'Create Reminder'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}