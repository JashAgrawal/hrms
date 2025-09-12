import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build where clause based on user role
    const where: any = {
      isActive: true,
      tags: {
        not: null
      }
    }

    // Role-based access control
    if (!['ADMIN', 'HR'].includes(currentUser.role)) {
      // Non-admin users can only see tags from their own documents or shared documents
      where.OR = [
        { employeeId: currentUser.employee?.id },
        {
          shares: {
            some: {
              sharedWith: session.user.id,
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            }
          }
        }
      ]
    }

    // Get all documents with tags
    const documents = await prisma.document.findMany({
      where,
      select: {
        tags: true
      }
    })

    // Extract and flatten all tags
    const allTags = new Set<string>()
    
    documents.forEach(doc => {
      if (doc.tags) {
        try {
          const tags = JSON.parse(doc.tags as string)
          if (Array.isArray(tags)) {
            tags.forEach(tag => {
              if (typeof tag === 'string' && tag.trim()) {
                allTags.add(tag.trim().toLowerCase())
              }
            })
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
    })

    // Convert to sorted array
    const tags = Array.from(allTags).sort()

    // Get tag usage statistics
    const tagStats = new Map<string, number>()
    
    documents.forEach(doc => {
      if (doc.tags) {
        try {
          const tags = JSON.parse(doc.tags as string)
          if (Array.isArray(tags)) {
            tags.forEach(tag => {
              if (typeof tag === 'string' && tag.trim()) {
                const normalizedTag = tag.trim().toLowerCase()
                tagStats.set(normalizedTag, (tagStats.get(normalizedTag) || 0) + 1)
              }
            })
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
    })

    // Create tag objects with usage counts
    const tagsWithStats = tags.map(tag => ({
      name: tag,
      count: tagStats.get(tag) || 0
    }))

    // Sort by usage count (descending) then by name
    tagsWithStats.sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count
      }
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ 
      tags: tagsWithStats,
      totalTags: tags.length,
      totalDocuments: documents.length
    })
  } catch (error) {
    console.error('Error fetching document tags:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}