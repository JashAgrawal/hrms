import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/performance/dashboard - Get performance dashboard data
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const cycleId = searchParams.get('cycleId')
    const period = searchParams.get('period') // e.g., "2024-Q1" or "2024"

    // Get current user's employee record
    const currentUser = await prisma.employee.findFirst({
      where: { userId: session.user.id }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Determine which employee's data to fetch
    const targetEmployeeId = employeeId || currentUser.id

    // Build base filters
    const baseWhere: any = {
      employeeId: targetEmployeeId,
    }

    if (cycleId) {
      baseWhere.cycleId = cycleId
    }

    if (period) {
      baseWhere.period = period
    }

    // Fetch performance reviews
    const reviews = await prisma.performanceReview.findMany({
      where: baseWhere,
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          }
        },
        _count: {
          select: {
            objectives: true,
            feedbacks: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
    })

    // Fetch objectives
    const objectives = await prisma.objective.findMany({
      where: {
        employeeId: targetEmployeeId,
        ...(cycleId && { cycleId }),
      },
      include: {
        keyResults: {
          select: {
            id: true,
            title: true,
            status: true,
            progress: true,
            targetValue: true,
            currentValue: true,
            unit: true,
          }
        },
        _count: {
          select: {
            updates: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10,
    })

    // Fetch feedback summary
    const feedbackSummary = await prisma.feedback.groupBy({
      by: ['reviewerType', 'status'],
      where: {
        employeeId: targetEmployeeId,
        ...(period && {
          review: {
            period: period
          }
        })
      },
      _count: {
        id: true,
      }
    })

    // Calculate objective statistics
    const objectiveStats = {
      total: objectives.length,
      completed: objectives.filter(obj => obj.status === 'COMPLETED').length,
      onTrack: objectives.filter(obj => obj.status === 'ON_TRACK').length,
      atRisk: objectives.filter(obj => obj.status === 'AT_RISK').length,
      behind: objectives.filter(obj => obj.status === 'BEHIND').length,
      averageProgress: objectives.length > 0 
        ? objectives.reduce((sum, obj) => sum + Number(obj.progress), 0) / objectives.length 
        : 0,
    }

    // Calculate key results statistics
    const allKeyResults = objectives.flatMap(obj => obj.keyResults)
    const keyResultStats = {
      total: allKeyResults.length,
      completed: allKeyResults.filter(kr => kr.status === 'COMPLETED').length,
      active: allKeyResults.filter(kr => kr.status === 'ACTIVE').length,
      averageProgress: allKeyResults.length > 0
        ? allKeyResults.reduce((sum, kr) => sum + Number(kr.progress), 0) / allKeyResults.length
        : 0,
    }

    // Calculate review statistics
    const reviewStats = {
      total: reviews.length,
      draft: reviews.filter(r => r.status === 'DRAFT').length,
      submitted: reviews.filter(r => r.status === 'SUBMITTED').length,
      completed: reviews.filter(r => r.status === 'COMPLETED').length,
      averageRating: reviews
        .filter(r => r.overallRating)
        .reduce((sum, r, _, arr) => sum + Number(r.overallRating!) / arr.length, 0) || 0,
    }

    // Process feedback summary
    const feedbackStats = feedbackSummary.reduce((acc, item) => {
      if (!acc[item.reviewerType]) {
        acc[item.reviewerType] = { total: 0, pending: 0, submitted: 0 }
      }
      acc[item.reviewerType].total += item._count.id
      if (item.status === 'PENDING') {
        acc[item.reviewerType].pending += item._count.id
      } else if (item.status === 'SUBMITTED') {
        acc[item.reviewerType].submitted += item._count.id
      }
      return acc
    }, {} as Record<string, { total: number; pending: number; submitted: number }>)

    // Get recent activity (recent updates, feedback submissions, etc.)
    const recentObjectiveUpdates = await prisma.objectiveUpdate.findMany({
      where: {
        objective: {
          employeeId: targetEmployeeId,
        }
      },
      include: {
        objective: {
          select: {
            id: true,
            title: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
    })

    const recentKeyResultUpdates = await prisma.keyResultUpdate.findMany({
      where: {
        keyResult: {
          objective: {
            employeeId: targetEmployeeId,
          }
        }
      },
      include: {
        keyResult: {
          select: {
            id: true,
            title: true,
            objective: {
              select: {
                id: true,
                title: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
    })

    // Get active cycles
    const activeCycles = await prisma.performanceCycle.findMany({
      where: {
        status: 'ACTIVE',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        startDate: true,
        endDate: true,
        dueDate: true,
      },
      orderBy: {
        startDate: 'desc'
      }
    })

    return NextResponse.json({
      employee: {
        id: targetEmployeeId,
        ...(targetEmployeeId !== currentUser.id && {
          // Include employee details if viewing someone else's dashboard
          details: await prisma.employee.findUnique({
            where: { id: targetEmployeeId },
            select: {
              firstName: true,
              lastName: true,
              employeeCode: true,
              designation: true,
              department: {
                select: {
                  name: true,
                }
              }
            }
          })
        })
      },
      statistics: {
        objectives: objectiveStats,
        keyResults: keyResultStats,
        reviews: reviewStats,
        feedback: feedbackStats,
      },
      recentActivity: {
        objectiveUpdates: recentObjectiveUpdates,
        keyResultUpdates: recentKeyResultUpdates,
      },
      data: {
        reviews,
        objectives,
        activeCycles,
      }
    })
  } catch (error) {
    console.error('Error fetching performance dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance dashboard' },
      { status: 500 }
    )
  }
}