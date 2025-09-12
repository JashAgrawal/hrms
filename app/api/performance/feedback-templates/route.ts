import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for creating feedback templates
const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  reviewerType: z.enum(['SELF', 'MANAGER', 'PEER', 'SUBORDINATE', 'EXTERNAL', 'SKIP_LEVEL']),
  questions: z.array(z.object({
    question: z.string().min(1),
    type: z.enum(['RATING', 'TEXT', 'MULTIPLE_CHOICE', 'YES_NO', 'SCALE']).default('RATING'),
    options: z.any().optional(),
    isRequired: z.boolean().default(true),
    category: z.string().optional(),
  })),
})

const updateTemplateSchema = createTemplateSchema.partial()

// GET /api/performance/feedback-templates - List feedback templates
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reviewerType = searchParams.get('reviewerType')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Build where clause based on filters
    const where: any = {}
    
    if (reviewerType) {
      where.reviewerType = reviewerType
    }
    
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // Get templates with questions
    const [templates, total] = await Promise.all([
      prisma.feedbackTemplate.findMany({
        where,
        include: {
          questions: {
            orderBy: {
              order: 'asc'
            }
          },
          _count: {
            select: {
              questions: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.feedbackTemplate.count({ where })
    ])

    return NextResponse.json({
      templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching feedback templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback templates' },
      { status: 500 }
    )
  }
}

// POST /api/performance/feedback-templates - Create a new feedback template
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createTemplateSchema.parse(body)

    // Check if template with same name already exists
    const existingTemplate = await prisma.feedbackTemplate.findUnique({
      where: { name: validatedData.name }
    })

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'Feedback template with this name already exists' },
        { status: 409 }
      )
    }

    // Create the template with questions in a transaction
    const template = await prisma.$transaction(async (tx) => {
      // Create the template
      const newTemplate = await tx.feedbackTemplate.create({
        data: {
          name: validatedData.name,
          description: validatedData.description,
          reviewerType: validatedData.reviewerType,
        }
      })

      // Create the questions
      const questions = await Promise.all(
        validatedData.questions.map((question, index) =>
          tx.feedbackQuestion.create({
            data: {
              templateId: newTemplate.id,
              question: question.question,
              type: question.type,
              options: question.options,
              isRequired: question.isRequired,
              category: question.category,
              order: index + 1,
            }
          })
        )
      )

      return {
        ...newTemplate,
        questions,
      }
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating feedback template:', error)
    return NextResponse.json(
      { error: 'Failed to create feedback template' },
      { status: 500 }
    )
  }
}