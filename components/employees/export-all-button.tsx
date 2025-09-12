'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export function ExportAllButton() {
  const handleExportAll = async () => {
    try {
      const response = await fetch('/api/employees/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `all-employees-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  return (
    <Button variant="outline" onClick={handleExportAll}>
      <Download className="mr-2 h-4 w-4" />
      Export All
    </Button>
  )
}