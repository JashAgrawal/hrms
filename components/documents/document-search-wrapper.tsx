'use client'

import { DocumentSearchManager } from './document-search-manager'

interface DocumentSearchWrapperProps {
  documents: any[]
  showEmployeeFilter?: boolean
}

export function DocumentSearchWrapper({ documents, showEmployeeFilter = true }: DocumentSearchWrapperProps) {
  return (
    <DocumentSearchManager 
      documents={documents}
      showEmployeeFilter={showEmployeeFilter}
    />
  )
}
