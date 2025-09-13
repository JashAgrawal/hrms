'use client'

import { DocumentSecurityManager } from './document-security-manager'
import { useRouter } from 'next/navigation'

export function DocumentSecurityWrapper() {
  const router = useRouter()

  const handleSettingsUpdate = () => {
    // Refresh the page to get updated data
    router.refresh()
  }

  return (
    <DocumentSecurityManager 
      onSettingsUpdate={handleSettingsUpdate}
    />
  )
}
