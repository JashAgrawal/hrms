'use client'

import { DocumentUpload } from './document-upload'
import { useRouter } from 'next/navigation'

interface DocumentUploadWrapperProps {
  employeeId?: string | null
}

export function DocumentUploadWrapper({ employeeId }: DocumentUploadWrapperProps) {
  const router = useRouter()

  const handleDocumentsChange = () => {
    // Refresh the page to get updated data
    router.refresh()
  }

  return (
    <DocumentUpload
      employeeId={employeeId || undefined}
      onDocumentsChange={handleDocumentsChange}
    />
  )
}
