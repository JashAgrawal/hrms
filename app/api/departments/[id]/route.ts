import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/departments/[id] - Update a department
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 })
    }

    const { id } = await params

    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { id }
    })

    if (!existingDepartment) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    // Check if another department with same name exists
    const duplicateDepartment = await prisma.department.findFirst({
      where: { 
        name: {
          equals: name,
          mode: 'insensitive'
        },
        id: {
          not: id
        }
      }
    })

    if (duplicateDepartment) {
      return NextResponse.json({ error: 'Department with this name already exists' }, { status: 400 })
    }

    // Generate department code
    const code = name.toUpperCase().replace(/\s+/g, '_').substring(0, 10)

    const department = await prisma.department.update({
      where: { id },
      data: {
        name,
        code,
        description,
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        createdAt: true,
      }
    })

    return NextResponse.json({ department })
  } catch (error) {
    console.error('Error updating department:', error)
    return NextResponse.json(
      { error: 'Failed to update department' },
      { status: 500 }
    )
  }
}

// DELETE /api/departments/[id] - Delete a department
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params

    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: {
              where: {
                status: 'ACTIVE'
              }
            }
          }
        }
      }
    })

    if (!existingDepartment) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    // Check if department has active employees
    if (existingDepartment._count.employees > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete department with active employees. Please reassign employees first.' 
      }, { status: 400 })
    }

    // Soft delete by setting isActive to false
    await prisma.department.update({
      where: { id },
      data: {
        isActive: false,
      }
    })

    return NextResponse.json({ message: 'Department deleted successfully' })
  } catch (error) {
    console.error('Error deleting department:', error)
    return NextResponse.json(
      { error: 'Failed to delete department' },
      { status: 500 }
    )
  }
}