'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ImportResult {
  processed: number
  created: number
  updated: number
  errors: string[]
  warnings: string[]
}

export function EmployeeImportDialog({ onImportComplete }: { onImportComplete?: () => void }) {
  const [open, setOpen] = useState(false)
  const [csvData, setCsvData] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'text/csv') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        setCsvData(text)
      }
      reader.readAsText(file)
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please select a valid CSV file',
        variant: 'destructive'
      })
    }
  }

  const handleImport = async () => {
    if (!csvData.trim()) {
      toast({
        title: 'No data',
        description: 'Please provide CSV data or upload a file',
        variant: 'destructive'
      })
      return
    }

    setIsImporting(true)
    setImportResult(null)

    try {
      const response = await fetch('/api/employees/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          csvData,
          skipFirstRow: true
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Import failed')
      }

      setImportResult(result.results)
      toast({
        title: 'Import completed',
        description: result.message
      })

      if (onImportComplete) {
        onImportComplete()
      }
    } catch (error) {
      console.error('Import error:', error)
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      })
    } finally {
      setIsImporting(false)
    }
  }

  const downloadTemplate = () => {
    const template = `employeeCode,firstName,lastName,email,phone,designation,departmentName,employmentType,joiningDate,basicSalary
EMP001,John,Doe,john.doe@company.com,+1234567890,Software Engineer,Engineering,FULL_TIME,2024-01-01,50000
EMP002,Jane,Smith,jane.smith@company.com,+1234567891,HR Manager,Human Resources,FULL_TIME,2024-01-15,60000`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employee-import-template.csv'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const resetDialog = () => {
    setCsvData('')
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen)
      if (!newOpen) {
        resetDialog()
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import Employees
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Employees</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Upload a CSV file or paste CSV data. The file should contain columns: employeeCode, firstName, lastName, email, phone, designation, departmentName, employmentType, joiningDate, basicSalary
            </AlertDescription>
          </Alert>

          {/* Template Download */}
          <div className="flex items-center justify-between p-3 border rounded">
            <span className="text-sm">Need a template?</span>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
          </div>

          {/* File Upload */}
          <div>
            <label className="text-sm font-medium">Upload CSV File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* CSV Data Input */}
          <div>
            <label className="text-sm font-medium">Or Paste CSV Data</label>
            <Textarea
              placeholder="Paste your CSV data here..."
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              rows={8}
              className="mt-1"
            />
          </div>

          {/* Import Result */}
          {importResult && (
            <Alert className={importResult.errors.length > 0 ? 'border-yellow-200' : 'border-green-200'}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div>Processed: {importResult.processed} records</div>
                  <div>Created: {importResult.created} new employees</div>
                  <div>Updated: {importResult.updated} existing employees</div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium text-red-600">Errors:</div>
                      <div className="text-sm max-h-32 overflow-y-auto">
                        {importResult.errors.map((error, index) => (
                          <div key={index} className="text-red-600">{error}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || !csvData.trim()}
            >
              {isImporting ? 'Importing...' : 'Import Employees'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
