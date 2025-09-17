import { prisma } from '@/lib/prisma'
import { AccrualType, LeavePolicy, Employee, LeaveBalance } from '@prisma/client'

export class LeaveService {
  /**
   * Calculate leave accrual for an employee based on policy
   */
  static async calculateAccrual(
    employee: Employee,
    policy: LeavePolicy,
    asOfDate: Date = new Date()
  ): Promise<number> {
    // Validate inputs
    if (!employee || !policy) {
      throw new Error('Employee and policy are required for leave accrual calculation')
    }

    if (!employee.joiningDate) {
      throw new Error('Employee joining date is required for leave accrual calculation')
    }

    const joiningDate = new Date(employee.joiningDate)
    const currentDate = new Date(asOfDate)

    // Validate dates
    if (isNaN(joiningDate.getTime()) || isNaN(currentDate.getTime())) {
      throw new Error('Invalid dates provided for leave accrual calculation')
    }

    if (currentDate < joiningDate) {
      return 0 // Cannot accrue leave before joining
    }

    // Check if employee is still in probation period
    if (policy.probationPeriodDays && policy.probationPeriodDays > 0) {
      const probationEndDate = new Date(joiningDate)
      probationEndDate.setDate(probationEndDate.getDate() + policy.probationPeriodDays)

      if (currentDate < probationEndDate) {
        return 0 // No leave accrual during probation
      }
    }

    const currentYear = currentDate.getFullYear()
    const yearStartDate = new Date(currentYear, 0, 1)
    const yearEndDate = new Date(currentYear, 11, 31)
    
    // Determine the effective start date for accrual calculation
    let accrualStartDate: Date
    
    switch (policy.accrualType) {
      case 'ON_JOINING':
        accrualStartDate = new Date(Math.max(joiningDate.getTime(), yearStartDate.getTime()))
        break
      case 'ANNUAL':
        accrualStartDate = yearStartDate
        break
      case 'MONTHLY':
      case 'QUARTERLY':
        accrualStartDate = new Date(Math.max(joiningDate.getTime(), yearStartDate.getTime()))
        break
      default:
        accrualStartDate = yearStartDate
    }

    // If employee joined after the current date, no accrual
    if (accrualStartDate > currentDate) {
      return 0
    }

    let accruedDays = 0

    switch (policy.accrualType) {
      case 'ANNUAL':
        // All days allocated at the beginning of the year
        accruedDays = policy.daysPerYear
        break
        
      case 'MONTHLY':
        // Days accrued monthly
        const monthsWorked = this.getMonthsBetweenDates(accrualStartDate, currentDate)
        const monthlyRate = Number(policy.accrualRate) || (Number(policy.daysPerYear) / 12)
        accruedDays = Math.floor(monthsWorked * monthlyRate)
        break
        
      case 'QUARTERLY':
        // Days accrued quarterly
        const quartersWorked = Math.floor(this.getMonthsBetweenDates(accrualStartDate, currentDate) / 3)
        const quarterlyRate = Number(policy.daysPerYear) / 4
        accruedDays = Math.floor(quartersWorked * quarterlyRate)
        break
        
      case 'ON_JOINING':
        // Pro-rated based on joining date
        const totalDaysInYear = this.getDaysInYear(currentYear)
        const daysWorkedInYear = this.getDaysBetweenDates(accrualStartDate.getTime(), Math.min(currentDate.getTime(), yearEndDate.getTime()))
        accruedDays = Math.floor((daysWorkedInYear / totalDaysInYear) * Number(policy.daysPerYear))
        break
    }

    return Math.max(0, accruedDays)
  }

  /**
   * Process carry forward for leave balances
   */
  static async processCarryForward(employeeId: string, fromYear: number, toYear: number): Promise<void> {
    const previousYearBalances = await prisma.leaveBalance.findMany({
      where: {
        employeeId,
        year: fromYear
      },
      include: {
        policy: true
      }
    })

    for (const balance of previousYearBalances) {
      if (!balance.policy.carryForward) {
        continue // Skip policies that don't allow carry forward
      }

      const availableBalance = Number(balance.available)
      let carryForwardAmount = availableBalance

      // Apply maximum carry forward limit
      if (balance.policy.maxCarryForward && carryForwardAmount > balance.policy.maxCarryForward) {
        carryForwardAmount = balance.policy.maxCarryForward
        
        // Mark excess as expired
        const expiredAmount = availableBalance - carryForwardAmount
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            expired: Number(balance.expired) + expiredAmount,
            available: Number(balance.available) - expiredAmount
          }
        })
      }

      if (carryForwardAmount > 0) {
        // Create or update next year's balance with carry forward
        await prisma.leaveBalance.upsert({
          where: {
            employeeId_policyId_year: {
              employeeId,
              policyId: balance.policyId,
              year: toYear
            }
          },
          update: {
            carriedForward: carryForwardAmount,
            available: {
              increment: carryForwardAmount
            }
          },
          create: {
            employeeId,
            policyId: balance.policyId,
            year: toYear,
            allocated: balance.policy.daysPerYear,
            used: 0,
            pending: 0,
            carriedForward: carryForwardAmount,
            encashed: 0,
            expired: 0,
            available: balance.policy.daysPerYear + carryForwardAmount
          }
        })
      }
    }
  }

  /**
   * Initialize leave balances for a new employee
   */
  static async initializeEmployeeLeaveBalances(employeeId: string): Promise<void> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    })

    if (!employee) {
      throw new Error('Employee not found')
    }

    const activePolicies = await prisma.leavePolicy.findMany({
      where: { isActive: true }
    })

    const currentYear = new Date().getFullYear()
    const balances = []

    for (const policy of activePolicies) {
      // Skip gender-specific policies if they don't apply
      if (policy.gender && employee.gender !== policy.gender) {
        continue
      }

      const accruedDays = await this.calculateAccrual(employee, policy)
      
      balances.push({
        employeeId,
        policyId: policy.id,
        year: currentYear,
        allocated: accruedDays,
        used: 0,
        pending: 0,
        carriedForward: 0,
        encashed: 0,
        expired: 0,
        available: accruedDays,
        lastAccrualDate: new Date()
      })
    }

    await prisma.leaveBalance.createMany({
      data: balances,
      skipDuplicates: true
    })
  }

  /**
   * Update leave balance when a leave request is approved/rejected
   */
  static async updateBalanceForLeaveRequest(
    leaveRequestId: string,
    status: 'APPROVED' | 'REJECTED' | 'CANCELLED'
  ): Promise<void> {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: { policy: true }
    })

    if (!leaveRequest) {
      throw new Error('Leave request not found')
    }

    const year = new Date(leaveRequest.startDate).getFullYear()
    const days = Number(leaveRequest.days)

    const balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_policyId_year: {
          employeeId: leaveRequest.employeeId,
          policyId: leaveRequest.policyId,
          year
        }
      }
    })

    if (!balance) {
      throw new Error('Leave balance not found')
    }

    switch (status) {
      case 'APPROVED':
        // Move from pending to used
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            used: { increment: days },
            pending: { decrement: days },
            available: { decrement: days }
          }
        })
        break
        
      case 'REJECTED':
      case 'CANCELLED':
        // Move from pending back to available
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pending: { decrement: days },
            available: { increment: days }
          }
        })
        break
    }
  }

  /**
   * Check if employee has sufficient leave balance
   */
  static async checkLeaveBalance(
    employeeId: string,
    policyId: string,
    days: number,
    startDate: Date
  ): Promise<{ hasBalance: boolean; availableDays: number; message?: string }> {
    const year = startDate.getFullYear()
    
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_policyId_year: {
          employeeId,
          policyId,
          year
        }
      },
      include: {
        policy: true
      }
    })

    if (!balance) {
      return {
        hasBalance: false,
        availableDays: 0,
        message: 'No leave balance found for this policy'
      }
    }

    const availableDays = Number(balance.available)
    
    if (days > availableDays) {
      return {
        hasBalance: false,
        availableDays,
        message: `Insufficient leave balance. Available: ${availableDays} days, Requested: ${days} days`
      }
    }

    return {
      hasBalance: true,
      availableDays
    }
  }

  // Helper methods
  private static getMonthsBetweenDates(startDate: Date, endDate: Date): number {
    const start: Date = new Date(startDate)
    const end: Date = new Date(endDate)
    
    let months: number = (end.getFullYear() - start.getFullYear()) * 12
    months += end.getMonth() - start.getMonth()
    
    // Add partial month if end date is after start date in the month
    if (end.getDate() >= start.getDate()) {
      months += 1
    }
    
    return Math.max(0, months)
  }

  private static getDaysBetweenDates(startTime: number, endTime: number): number {
    const millisecondsPerDay = 24 * 60 * 60 * 1000
    return Math.floor((endTime - startTime) / millisecondsPerDay) + 1
  }

  // Overloaded method to accept Date parameters
  private static getDaysBetweenDatesFromDates(startDate: Date, endDate: Date): number {
    return this.getDaysBetweenDates(startDate.getTime(), endDate.getTime())
  }

  private static getDaysInYear(year: number): number {
    return ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365
  }

  /**
   * Validate leave request for overlapping dates and sufficient balance
   */
  static async validateLeaveRequest(
    employeeId: string,
    policyId: string,
    startDate: Date,
    endDate: Date,
    days: number,
    excludeRequestId?: string
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      // Check for overlapping leave requests
      const overlappingRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          id: excludeRequestId ? { not: excludeRequestId } : undefined,
          status: { in: ['PENDING', 'APPROVED'] },
          OR: [
            {
              startDate: { lte: endDate },
              endDate: { gte: startDate }
            }
          ]
        }
      })

      if (overlappingRequests.length > 0) {
        errors.push('Leave request overlaps with existing leave requests')
      }

      // Check leave balance
      const currentYear = new Date().getFullYear()
      const leaveBalance = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_policyId_year: {
            employeeId,
            policyId,
            year: currentYear
          }
        }
      })

      if (!leaveBalance) {
        errors.push('Leave balance not found for the current year')
      } else if (Number(leaveBalance.available) < days) {
        errors.push(`Insufficient leave balance. Available: ${leaveBalance.available}, Requested: ${days}`)
      }

      return {
        isValid: errors.length === 0,
        errors
      }
    } catch (error) {
      console.error('Error validating leave request:', error)
      return {
        isValid: false,
        errors: ['Failed to validate leave request']
      }
    }
  }
}