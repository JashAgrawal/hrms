import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { RevisionType, RevisionStatus } from '@prisma/client'

const createSalaryRevisionSchema = z.object({
  employeeId: z.string(),
  revisionType: z.nativeEnum(RevisionType),
  newCTC: z.number().positive('New CTC must be positive'),
  effectiveFrom: z.string().datetime(),
  reason: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status') as RevisionStatus | null
    const revisionType = searchParams.get('type') as RevisionType | null

    const salaryRevisions = await prisma.salaryRevision.findMany({
      where: {
        ...(employeeId && { employeeId }),
        ...(status && { status }),
        ...(revisionType && { revisionType }),
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
            department: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: [
        { effectiveFrom: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json(salaryRevisions)
  } catch (error) {
    console.error('Error fetching salary revisions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch salary revisions' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create salary revisions
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createSalaryRevisionSchema.parse(body)

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: validatedData.employeeId },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Get current salary structure
    const currentSalary = await prisma.employeeSalaryStructure.findFirst({
      where: {
        employeeId: validatedData.employeeId,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } },
        ],
      },
      orderBy: {
        effectiveFrom: 'desc',
      },
    })

    if (!currentSalary) {
      return NextResponse.json(
        { error: 'Employee does not have an active salary structure' },
        { status: 400 }
      )
    }

    const oldCTC = currentSalary.ctc.toNumber()
    const newCTC = validatedData.newCTC
    const incrementAmount = newCTC - oldCTC
    const incrementPercent = (incrementAmount / oldCTC) * 100

    // Check for existing pending revision
    const existingRevision = await prisma.salaryRevision.findFirst({
      where: {
        employeeId: validatedData.employeeId,
        status: 'PENDING',
        effectiveFrom: { gte: new Date() },
      },
    })

    if (existingRevision) {
      return NextResponse.json(
        { error: 'Employee already has a pending salary revision' },
        { status: 400 }
      )
    }

    const salaryRevision = await prisma.salaryRevision.create({
      data: {
        employeeId: validatedData.employeeId,
        revisionType: validatedData.revisionType,
        oldCTC,
        newCTC,
        incrementAmount,
        incrementPercent,
        effectiveFrom: new Date(validatedData.effectiveFrom),
        reason: validatedData.reason,
        status: 'PENDING',
      },
    })

    // Fetch the created revision with employee details
    const result = await prisma.salaryRevision.findUnique({
      where: { id: salaryRevision.id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
            department: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating salary revision:', error)
    return NextResponse.json(
      { error: 'Failed to create salary revision' },
      { status: 500 }
    )
  }
}