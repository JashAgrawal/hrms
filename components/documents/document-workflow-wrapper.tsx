'use client'

import { DocumentWorkflowManager } from './document-workflow-manager'
import { useRouter } from 'next/navigation'

interface DocumentWorkflowWrapperProps {
  documents: any[]
}

export function DocumentWorkflowWrapper({ documents }: DocumentWorkflowWrapperProps) {
  const router = useRouter()

  const handleDocumentUpdate = () => {
    // Refresh the page to get updated data
    router.refresh()
  }

  return (
    <DocumentWorkflowManager 
      documents={documents}
      onDocumentUpdate={handleDocumentUpdate}
    />
  )
}
