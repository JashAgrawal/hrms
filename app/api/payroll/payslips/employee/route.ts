import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { payslipService, payslipGenerator } from '@/lib/payslip-service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')
    const download = searchParams.get('download') === 'true'

    // Get employee ID from session
    let employeeId = session.user.employeeId
    
    // Allow HR/Admin to access other employee's payslips
    if (['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      const requestedEmployeeId = searchParams.get('employeeId')
      if (requestedEmployeeId) {
        employeeId = requestedEmployeeId
      }
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID not found' }, { status: 400 })
    }

    if (period && download) {
      // Download specific payslip
      const payrollRecord = await prisma.payrollRecord.findFirst({
        where: {
          employeeId,
          payrollRun: {
            period,
          },
          status: { in: ['APPROVED', 'PAID'] },
        },
        include: {
          employee: {
            include: {
              department: true,
            },
          },
          payrollRun: true,
        },
      })

      if (!payrollRecord) {
        return NextResponse.json(
          { error: 'Payslip not found for the specified period' },
          { status: 404 }
        )
      }

      // Check if payslip exists in database
      let payslip = await prisma.payslip.findFirst({
        where: {
          employeeId,
          payrollRunId: payrollRecord.payrollRunId,
        },
      })

      // Generate payslip if it doesn't exist
      if (!payslip) {
        const payslipData = await getPayslipData(payrollRecord)
        const buffer = await payslipGenerator.generatePayslip(payslipData)
        const fileName = `payslip_${payrollRecord.employee.employeeCode}_${payrollRecord.payrollRun.period}.pdf`

        // Create payslip record
        payslip = await prisma.payslip.create({
          data: {
            employeeId,
            payrollRunId: payrollRecord.payrollRunId,
            fileName,
            fileSize: buffer.length,
            generatedBy: session.user.id,
            status: 'ACCESSED',
            accessedAt: new Date(),
            downloadCount: 1,
          },
        })

        // Return PDF
        return new NextResponse(buffer as BodyInit, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': buffer.length.toString(),
          },
        })
      } else {
        // Update access tracking
        await prisma.payslip.update({
          where: { id: payslip.id },
          data: {
            accessedAt: new Date(),
            downloadCount: { increment: 1 },
            status: 'DOWNLOADED',
          },
        })

        // Generate and return PDF
        const payslipData = await getPayslipData(payrollRecord)
        const buffer = await payslipGenerator.generatePayslip(payslipData)

        return new NextResponse(buffer as BodyInit, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${payslip.fileName}"`,
            'Content-Length': buffer.length.toString(),
          },
        })
      }
    } else {
      // List available payslips for employee
      const payslips = await prisma.payslip.findMany({
        where: {
          employeeId,
        },
        include: {
          payrollRun: {
            select: {
              period: true,
              startDate: true,
              endDate: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return NextResponse.json({ payslips })
    }
  } catch (error) {
    console.error('Error accessing payslips:', error)
    return NextResponse.json(
      { error: 'Failed to access payslips' },
      { status: 500 }
    )
  }
}

async function getCompanyInfo() {
  return {
    name: 'Pekka HR Solutions',
    address: '123 Business Park, Tech City',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    panNumber: 'ABCDE1234F',
    pfNumber: 'KA/BGE/12345',
    esiNumber: '12345678901234567',
  }
}

async function getPayslipData(payrollRecord: any) {
  const company = await getCompanyInfo()
  
  return {
    employee: {
      id: payrollRecord.employee.id,
      employeeCode: payrollRecord.employee.employeeCode,
      firstName: payrollRecord.employee.firstName,
      lastName: payrollRecord.employee.lastName,
      email: payrollRecord.employee.email,
      designation: payrollRecord.employee.designation || 'N/A',
      joiningDate: payrollRecord.employee.joiningDate?.toISOString() || '',
      department: {
        name: payrollRecord.employee.department?.name || 'N/A',
        code: payrollRecord.employee.department?.code || 'N/A',
      },
    },
    payrollRun: {
      id: payrollRecord.payrollRun.id,
      period: payrollRecord.payrollRun.period,
      startDate: payrollRecord.payrollRun.startDate.toISOString(),
      endDate: payrollRecord.payrollRun.endDate.toISOString(),
    },
    payrollRecord: {
      id: payrollRecord.id,
      basicSalary: Number(payrollRecord.basicSalary),
      grossSalary: Number(payrollRecord.grossSalary),
      netSalary: Number(payrollRecord.netSalary),
      totalEarnings: Number(payrollRecord.totalEarnings),
      totalDeductions: Number(payrollRecord.totalDeductions),
      workingDays: payrollRecord.workingDays,
      presentDays: Number(payrollRecord.presentDays),
      absentDays: Number(payrollRecord.absentDays),
      lopDays: payrollRecord.lopDays ? Number(payrollRecord.lopDays) : undefined,
      lopAmount: payrollRecord.lopAmount ? Number(payrollRecord.lopAmount) : undefined,
      overtimeHours: payrollRecord.overtimeHours ? Number(payrollRecord.overtimeHours) : undefined,
      overtimeAmount: payrollRecord.overtimeAmount ? Number(payrollRecord.overtimeAmount) : undefined,
      pfDeduction: payrollRecord.pfDeduction ? Number(payrollRecord.pfDeduction) : undefined,
      esiDeduction: payrollRecord.esiDeduction ? Number(payrollRecord.esiDeduction) : undefined,
      tdsDeduction: payrollRecord.tdsDeduction ? Number(payrollRecord.tdsDeduction) : undefined,
      ptDeduction: payrollRecord.ptDeduction ? Number(payrollRecord.ptDeduction) : undefined,
      earnings: (payrollRecord.earnings as any[]) || [],
      deductions: (payrollRecord.deductions as any[]) || [],
    },
    company,
  }
}