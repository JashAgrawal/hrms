'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { 
  Upload, 
  File, 
  Check, 
  AlertCircle, 
  FileText, 
  Image, 
  FileSpreadsheet,
  Eye,
  Download,
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocumentFile {
  id?: string
  file?: File
  name: string
  size: number
  type: string
  category: string
  status: 'uploading' | 'uploaded' | 'verified' | 'rejected'
  url?: string
  uploadProgress?: number
  rejectionReason?: string
  uploadedAt?: Date
}

interface DocumentUploadProps {
  employeeId: string
  existingDocuments?: DocumentFile[]
  onDocumentsChange?: (documents: DocumentFile[]) => void
  categories?: { value: string; label: string; required?: boolean }[]
  maxFileSize?: number // in MB
  allowedTypes?: string[]
}

const defaultCategories = [
  { value: 'PERSONAL', label: 'Personal Documents', required: true },
  { value: 'PROFESSIONAL', label: 'Professional Documents', required: true },
  { value: 'COMPLIANCE', label: 'Compliance Documents', required: true },
  { value: 'PAYROLL', label: 'Payroll Documents', required: false },
]

const defaultAllowedTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

export function DocumentUpload({
  employeeId,
  existingDocuments = [],
  onDocumentsChange,
  categories = defaultCategories,
  maxFileSize = 10, // 10MB default
  allowedTypes = defaultAllowedTypes
}: DocumentUploadProps) {
  const [documents, setDocuments] = useState<DocumentFile[]>(existingDocuments)
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!selectedCategory) {
      toast.error('Please select a document category first')
      return
    }

    const newDocuments: DocumentFile[] = acceptedFiles.map(file => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      category: selectedCategory,
      status: 'uploading',
      uploadProgress: 0
    }))

    setDocuments(prev => [...prev, ...newDocuments])
    onDocumentsChange?.([...documents, ...newDocuments])

    // Simulate upload for each file
    newDocuments.forEach((doc, index) => {
      uploadDocument(doc, documents.length + index)
    })
  }, [selectedCategory, documents, onDocumentsChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: allowedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: maxFileSize * 1024 * 1024,
    onDropRejected: (rejectedFiles) => {
      rejectedFiles.forEach(({ file, errors }) => {
        errors.forEach(error => {
          if (error.code === 'file-too-large') {
            toast.error(`File ${file.name} is too large. Maximum size is ${maxFileSize}MB`)
          } else if (error.code === 'file-invalid-type') {
            toast.error(`File ${file.name} has an invalid type`)
          }
        })
      })
    }
  })

  const uploadDocument = async (document: DocumentFile, index: number) => {
    try {
      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100))
        setDocuments(prev => prev.map((doc, i) => 
          i === index ? { ...doc, uploadProgress: progress } : doc
        ))
      }

      // Create FormData for actual upload
      const formData = new FormData()
      if (document.file) {
        formData.append('file', document.file)
        formData.append('category', document.category)
        formData.append('employeeId', employeeId)
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()

      setDocuments(prev => prev.map((doc, i) => 
        i === index ? { 
          ...doc, 
          id: result.document.id,
          status: 'uploaded',
          url: result.document.fileUrl,
          uploadedAt: new Date(result.document.createdAt)
        } : doc
      ))

      toast.success(`${document.name} uploaded successfully`)
    } catch (error) {
      console.error('Upload error:', error)
      setDocuments(prev => prev.map((doc, i) => 
        i === index ? { ...doc, status: 'rejected', rejectionReason: 'Upload failed' } : doc
      ))
      toast.error(`Failed to upload ${document.name}`)
    }
  }

  const removeDocument = async (index: number) => {
    const document = documents[index]
    
    if (document.id) {
      try {
        const response = await fetch(`/api/documents/${document.id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error('Failed to delete document')
        }
      } catch (error) {
        console.error('Delete error:', error)
        toast.error('Failed to delete document')
        return
      }
    }

    const newDocuments = documents.filter((_, i) => i !== index)
    setDocuments(newDocuments)
    onDocumentsChange?.(newDocuments)
    toast.success('Document removed')
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />
    if (type.includes('pdf')) return <FileText className="h-4 w-4" />
    if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploaded':
      case 'verified':
        return <Check className="h-4 w-4 text-green-600" />
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploaded':
        return 'bg-green-100 text-green-800'
      case 'verified':
        return 'bg-blue-100 text-blue-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'uploading':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getDocumentsByCategory = () => {
    return categories.map(category => ({
      ...category,
      documents: documents.filter(doc => doc.category === category.value)
    }))
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Document Upload
          </CardTitle>
          <CardDescription>
            Upload required documents for onboarding. Maximum file size: {maxFileSize}MB
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Document Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select document category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label} {category.required && '*'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
              !selectedCategory && "opacity-50 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} disabled={!selectedCategory} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-sm text-muted-foreground">
                  Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents by Category */}
      {getDocumentsByCategory().map((category) => (
        <Card key={category.value}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {category.label}
                  {category.required && <Badge variant="destructive">Required</Badge>}
                </CardTitle>
                <CardDescription>
                  {category.documents.length} document{category.documents.length !== 1 ? 's' : ''} uploaded
                </CardDescription>
              </div>
              {category.required && category.documents.length === 0 && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  Missing
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {category.documents.length > 0 ? (
              <div className="space-y-3">
                {category.documents.map((document, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getFileIcon(document.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{document.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatFileSize(document.size)}</span>
                          <Badge className={getStatusColor(document.status)}>
                            {document.status.replace('_', ' ')}
                          </Badge>
                          {document.uploadedAt && (
                            <span>
                              Uploaded {new Date(document.uploadedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {document.status === 'uploading' && document.uploadProgress !== undefined && (
                          <Progress value={document.uploadProgress} className="mt-2 h-1" />
                        )}
                        {document.rejectionReason && (
                          <p className="text-sm text-red-600 mt-1">
                            {document.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getStatusIcon(document.status)}
                      {document.url && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(document.url, '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const link = window.document.createElement('a')
                              link.href = document.url!
                              link.download = document.name
                              link.click()
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDocument(documents.indexOf(document))}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No documents uploaded for this category</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}