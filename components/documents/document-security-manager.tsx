'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Shield, 
  Lock, 
  Key, 
  FileText, 
  Calendar, 
  Archive, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  Settings,
  Eye,
  EyeOff,
  Download,
  Upload,
  Clock,
  Users
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface DocumentRetentionPolicy {
  id: string
  name: string
  description?: string
  category?: string
  retentionPeriod: number
  action: 'ARCHIVE' | 'DELETE' | 'REVIEW'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface DocumentTemplate {
  id: string
  name: string
  description?: string
  category: string
  isRequired: boolean
  validityPeriod?: number
  approvalLevels: number
  approvers?: string[]
  reminderDays?: number[]
  template?: any
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface SecuritySettings {
  encryptionEnabled: boolean
  watermarkEnabled: boolean
  accessLoggingEnabled: boolean
  downloadRestrictions: boolean
  ipWhitelist: string[]
  maxFileSize: number
  allowedFileTypes: string[]
  passwordProtection: boolean
  expiryEnforcement: boolean
}

interface DocumentSecurityManagerProps {
  onSettingsUpdate?: () => void
}

export function DocumentSecurityManager({ onSettingsUpdate }: DocumentSecurityManagerProps) {
  const [retentionPolicies, setRetentionPolicies] = useState<DocumentRetentionPolicy[]>([])
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([])
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    encryptionEnabled: true,
    watermarkEnabled: false,
    accessLoggingEnabled: true,
    downloadRestrictions: false,
    ipWhitelist: [],
    maxFileSize: 10485760, // 10MB
    allowedFileTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'],
    passwordProtection: false,
    expiryEnforcement: true
  })
  const [loading, setLoading] = useState(false)
  const [policyDialog, setPolicyDialog] = useState(false)
  const [templateDialog, setTemplateDialog] = useState(false)
  const [settingsDialog, setSettingsDialog] = useState(false)
  const { toast } = useToast()

  // Policy form state
  const [policyForm, setPolicyForm] = useState({
    name: '',
    description: '',
    category: '',
    retentionPeriod: 365,
    action: 'ARCHIVE' as 'ARCHIVE' | 'DELETE' | 'REVIEW'
  })

  // Template form state
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    category: 'PERSONAL',
    isRequired: false,
    validityPeriod: 365,
    approvalLevels: 1,
    approvers: [] as string[],
    reminderDays: [30, 7] as number[]
  })

  const fetchRetentionPolicies = async () => {
    try {
      const response = await fetch('/api/documents/retention-policies')
      if (response.ok) {
        const data = await response.json()
        setRetentionPolicies(data.policies || [])
      }
    } catch (error) {
      console.error('Error fetching retention policies:', error)
    }
  }

  const fetchDocumentTemplates = async () => {
    try {
      const response = await fetch('/api/documents/templates')
      if (response.ok) {
        const data = await response.json()
        setDocumentTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error fetching document templates:', error)
    }
  }

  const fetchSecuritySettings = async () => {
    try {
      const response = await fetch('/api/documents/security-settings')
      if (response.ok) {
        const data = await response.json()
        setSecuritySettings(data.settings || securitySettings)
      }
    } catch (error) {
      console.error('Error fetching security settings:', error)
    }
  }

  useEffect(() => {
    fetchRetentionPolicies()
    fetchDocumentTemplates()
    fetchSecuritySettings()
  }, [])

  const handleCreatePolicy = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/documents/retention-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyForm)
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Retention policy created successfully'
        })
        setPolicyDialog(false)
        setPolicyForm({
          name: '',
          description: '',
          category: '',
          retentionPeriod: 365,
          action: 'ARCHIVE'
        })
        fetchRetentionPolicies()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      console.error('Error creating retention policy:', error)
      toast({
        title: 'Error',
        description: 'Failed to create retention policy',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/documents/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm)
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Document template created successfully'
        })
        setTemplateDialog(false)
        setTemplateForm({
          name: '',
          description: '',
          category: 'PERSONAL',
          isRequired: false,
          validityPeriod: 365,
          approvalLevels: 1,
          approvers: [],
          reminderDays: [30, 7]
        })
        fetchDocumentTemplates()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      console.error('Error creating document template:', error)
      toast({
        title: 'Error',
        description: 'Failed to create document template',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSecuritySettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/documents/security-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(securitySettings)
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Security settings updated successfully'
        })
        setSettingsDialog(false)
        onSettingsUpdate?.()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      console.error('Error updating security settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to update security settings',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePolicy = async (policyId: string) => {
    try {
      const response = await fetch(`/api/documents/retention-policies/${policyId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Retention policy deleted successfully'
        })
        fetchRetentionPolicies()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      console.error('Error deleting retention policy:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete retention policy',
        variant: 'destructive'
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Document Security & Compliance Manager
          </CardTitle>
          <CardDescription>
            Manage document security, retention policies, and compliance settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="security" className="space-y-4">
            <TabsList>
              <TabsTrigger value="security">Security Settings</TabsTrigger>
              <TabsTrigger value="retention">Retention Policies</TabsTrigger>
              <TabsTrigger value="templates">Document Templates</TabsTrigger>
              <TabsTrigger value="compliance">Compliance Reports</TabsTrigger>
            </TabsList>

            {/* Security Settings Tab */}
            <TabsContent value="security" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Access Control
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Document Encryption</Label>
                        <p className="text-sm text-muted-foreground">
                          Encrypt documents at rest and in transit
                        </p>
                      </div>
                      <Switch
                        checked={securitySettings.encryptionEnabled}
                        onCheckedChange={(checked) => 
                          setSecuritySettings(prev => ({ ...prev, encryptionEnabled: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Access Logging</Label>
                        <p className="text-sm text-muted-foreground">
                          Log all document access and actions
                        </p>
                      </div>
                      <Switch
                        checked={securitySettings.accessLoggingEnabled}
                        onCheckedChange={(checked) => 
                          setSecuritySettings(prev => ({ ...prev, accessLoggingEnabled: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Download Restrictions</Label>
                        <p className="text-sm text-muted-foreground">
                          Restrict document downloads based on permissions
                        </p>
                      </div>
                      <Switch
                        checked={securitySettings.downloadRestrictions}
                        onCheckedChange={(checked) => 
                          setSecuritySettings(prev => ({ ...prev, downloadRestrictions: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Password Protection</Label>
                        <p className="text-sm text-muted-foreground">
                          Require passwords for sensitive documents
                        </p>
                      </div>
                      <Switch
                        checked={securitySettings.passwordProtection}
                        onCheckedChange={(checked) => 
                          setSecuritySettings(prev => ({ ...prev, passwordProtection: checked }))
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Document Protection
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Watermarking</Label>
                        <p className="text-sm text-muted-foreground">
                          Add watermarks to document views and downloads
                        </p>
                      </div>
                      <Switch
                        checked={securitySettings.watermarkEnabled}
                        onCheckedChange={(checked) => 
                          setSecuritySettings(prev => ({ ...prev, watermarkEnabled: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Expiry Enforcement</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically restrict access to expired documents
                        </p>
                      </div>
                      <Switch
                        checked={securitySettings.expiryEnforcement}
                        onCheckedChange={(checked) => 
                          setSecuritySettings(prev => ({ ...prev, expiryEnforcement: checked }))
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="maxFileSize">Maximum File Size</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="maxFileSize"
                          type="number"
                          value={securitySettings.maxFileSize / 1024 / 1024}
                          onChange={(e) => 
                            setSecuritySettings(prev => ({ 
                              ...prev, 
                              maxFileSize: parseInt(e.target.value) * 1024 * 1024 
                            }))
                          }
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">MB</span>
                      </div>
                    </div>

                    <div>
                      <Label>Allowed File Types</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {securitySettings.allowedFileTypes.map(type => (
                          <Badge key={type} variant="outline">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleUpdateSecuritySettings} disabled={loading}>
                  {loading ? 'Updating...' : 'Update Security Settings'}
                </Button>
              </div>
            </TabsContent>

            {/* Retention Policies Tab */}
            <TabsContent value="retention" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Document Retention Policies</h3>
                  <p className="text-sm text-muted-foreground">
                    Define how long documents should be retained and what happens after expiry
                  </p>
                </div>
                <Dialog open={policyDialog} onOpenChange={setPolicyDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Archive className="h-4 w-4 mr-2" />
                      Create Policy
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Retention Policy</DialogTitle>
                      <DialogDescription>
                        Define a new document retention policy
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="policyName">Policy Name</Label>
                        <Input
                          id="policyName"
                          value={policyForm.name}
                          onChange={(e) => setPolicyForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter policy name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="policyDescription">Description</Label>
                        <Textarea
                          id="policyDescription"
                          value={policyForm.description}
                          onChange={(e) => setPolicyForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Describe the policy"
                        />
                      </div>
                      <div>
                        <Label>Document Category</Label>
                        <Select 
                          value={policyForm.category} 
                          onValueChange={(value) => setPolicyForm(prev => ({ ...prev, category: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All Categories</SelectItem>
                            <SelectItem value="PERSONAL">Personal</SelectItem>
                            <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                            <SelectItem value="COMPLIANCE">Compliance</SelectItem>
                            <SelectItem value="PAYROLL">Payroll</SelectItem>
                            <SelectItem value="PERFORMANCE">Performance</SelectItem>
                            <SelectItem value="LEGAL">Legal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="retentionPeriod">Retention Period (Days)</Label>
                        <Input
                          id="retentionPeriod"
                          type="number"
                          value={policyForm.retentionPeriod}
                          onChange={(e) => setPolicyForm(prev => ({ ...prev, retentionPeriod: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label>Action After Retention Period</Label>
                        <Select 
                          value={policyForm.action} 
                          onValueChange={(value: 'ARCHIVE' | 'DELETE' | 'REVIEW') => 
                            setPolicyForm(prev => ({ ...prev, action: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ARCHIVE">Archive</SelectItem>
                            <SelectItem value="DELETE">Delete</SelectItem>
                            <SelectItem value="REVIEW">Review</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setPolicyDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreatePolicy} disabled={loading || !policyForm.name}>
                          {loading ? 'Creating...' : 'Create Policy'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Retention Period</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retentionPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{policy.name}</div>
                          {policy.description && (
                            <div className="text-sm text-muted-foreground">
                              {policy.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {policy.category || 'All Categories'}
                        </Badge>
                      </TableCell>
                      <TableCell>{policy.retentionPeriod} days</TableCell>
                      <TableCell>
                        <Badge variant={
                          policy.action === 'DELETE' ? 'destructive' : 
                          policy.action === 'ARCHIVE' ? 'secondary' : 'outline'
                        }>
                          {policy.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={policy.isActive ? 'default' : 'secondary'}>
                          {policy.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(policy.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePolicy(policy.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {retentionPolicies.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No retention policies found
                </div>
              )}
            </TabsContent>

            {/* Document Templates Tab */}
            <TabsContent value="templates" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Document Templates</h3>
                  <p className="text-sm text-muted-foreground">
                    Define document templates with approval workflows and requirements
                  </p>
                </div>
                <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <FileText className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Document Template</DialogTitle>
                      <DialogDescription>
                        Define a new document template with approval workflow
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="templateName">Template Name</Label>
                          <Input
                            id="templateName"
                            value={templateForm.name}
                            onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter template name"
                          />
                        </div>
                        <div>
                          <Label>Category</Label>
                          <Select 
                            value={templateForm.category} 
                            onValueChange={(value) => setTemplateForm(prev => ({ ...prev, category: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PERSONAL">Personal</SelectItem>
                              <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                              <SelectItem value="COMPLIANCE">Compliance</SelectItem>
                              <SelectItem value="PAYROLL">Payroll</SelectItem>
                              <SelectItem value="PERFORMANCE">Performance</SelectItem>
                              <SelectItem value="LEGAL">Legal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="templateDescription">Description</Label>
                        <Textarea
                          id="templateDescription"
                          value={templateForm.description}
                          onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Describe the template"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="validityPeriod">Validity Period (Days)</Label>
                          <Input
                            id="validityPeriod"
                            type="number"
                            value={templateForm.validityPeriod}
                            onChange={(e) => setTemplateForm(prev => ({ ...prev, validityPeriod: parseInt(e.target.value) }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="approvalLevels">Approval Levels</Label>
                          <Input
                            id="approvalLevels"
                            type="number"
                            min="1"
                            max="5"
                            value={templateForm.approvalLevels}
                            onChange={(e) => setTemplateForm(prev => ({ ...prev, approvalLevels: parseInt(e.target.value) }))}
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="isRequired"
                          checked={templateForm.isRequired}
                          onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, isRequired: checked }))}
                        />
                        <Label htmlFor="isRequired">Required Document</Label>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setTemplateDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreateTemplate} disabled={loading || !templateForm.name}>
                          {loading ? 'Creating...' : 'Create Template'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Approval Levels</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          {template.description && (
                            <div className="text-sm text-muted-foreground">
                              {template.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {template.isRequired ? (
                          <Badge variant="destructive">Required</Badge>
                        ) : (
                          <Badge variant="outline">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {template.validityPeriod ? `${template.validityPeriod} days` : 'No expiry'}
                      </TableCell>
                      <TableCell>{template.approvalLevels}</TableCell>
                      <TableCell>
                        <Badge variant={template.isActive ? 'default' : 'secondary'}>
                          {template.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {documentTemplates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No document templates found
                </div>
              )}
            </TabsContent>

            {/* Compliance Reports Tab */}
            <TabsContent value="compliance" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Document Compliance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Documents</span>
                        <span className="font-semibold">1,234</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Compliant</span>
                        <span className="font-semibold text-green-600">1,156</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Non-Compliant</span>
                        <span className="font-semibold text-red-600">78</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Compliance Rate</span>
                        <span className="font-semibold">93.7%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Expiring Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Expiring in 7 days</span>
                        <span className="font-semibold text-red-600">12</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Expiring in 30 days</span>
                        <span className="font-semibold text-yellow-600">45</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Already Expired</span>
                        <span className="font-semibold text-red-600">8</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      Access Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Access Events</span>
                        <span className="font-semibold">5,678</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unique Users</span>
                        <span className="font-semibold">234</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Failed Access Attempts</span>
                        <span className="font-semibold text-red-600">23</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Compliance Alert</AlertTitle>
                <AlertDescription>
                  There are 12 documents expiring within the next 7 days that require immediate attention.
                  Please review and renew these documents to maintain compliance.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}