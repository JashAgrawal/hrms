import { prisma } from '@/lib/prisma'
import { 
  PayComponentType, 
  PayComponentCategory, 
  CalculationType,
  AttendanceStatus 
} from '@prisma/client'

export interface PayrollCalculationInput {
  employeeId: string
  period: string // YYYY-MM format
  startDate: Date
  endDate: Date
  workingDays: number
}

export interface ComponentCalculation {
  componentId: string
  componentName: string
  componentCode: string
  type: PayComponentType
  category: PayComponentCategory
  calculationType: CalculationType
  baseValue: number
  calculatedValue: number
  isProrated: boolean
  isStatutory: boolean
  isTaxable: boolean
}

export interface PayrollCalculationResult {
  employeeId: string
  period: string
  basicSalary: number
  grossSalary: number
  totalEarnings: number
  totalDeductions: number
  netSalary: number
  workingDays: number
  presentDays: number
  absentDays: number
  lopDays: number
  lopAmount: number
  overtimeHours: number
  overtimeAmount: number
  components: ComponentCalculation[]
  statutoryDeductions: {
    pf: number
    esi: number
    tds: number
    pt: number
  }
}

export class PayrollCalculationEngine {
  
  /**
   * Calculate payroll for a single employee for a given period
   */
  async calculateEmployeePayroll(input: PayrollCalculationInput): Promise<PayrollCalculationResult> {
    // Get employee's current salary structure
    const employeeSalary = await this.getEmployeeSalaryStructure(input.employeeId, input.startDate)
    if (!employeeSalary) {
      throw new Error(`No active salary structure found for employee ${input.employeeId}`)
    }

    // Get attendance data for the period
    const attendanceData = await this.getAttendanceData(input.employeeId, input.startDate, input.endDate)
    
    // Calculate attendance metrics
    const attendanceMetrics = this.calculateAttendanceMetrics(attendanceData, input.workingDays)
    
    // Calculate component values
    const components = await this.calculateComponents(
      employeeSalary,
      attendanceMetrics,
      input.period
    )

    // Calculate totals
    const earnings = components.filter(c => c.type === PayComponentType.EARNING)
    const deductions = components.filter(c => c.type === PayComponentType.DEDUCTION)
    
    const totalEarnings = earnings.reduce((sum, c) => sum + c.calculatedValue, 0)
    const totalDeductions = deductions.reduce((sum, c) => sum + c.calculatedValue, 0)
    
    const basicSalary = earnings.find(c => c.category === PayComponentCategory.BASIC)?.calculatedValue || 0
    const grossSalary = totalEarnings
    const netSalary = totalEarnings - totalDeductions

    // Extract statutory deductions
    const statutoryDeductions = {
      pf: deductions.find(c => c.componentCode === 'PF')?.calculatedValue || 0,
      esi: deductions.find(c => c.componentCode === 'ESI')?.calculatedValue || 0,
      tds: deductions.find(c => c.componentCode === 'TDS')?.calculatedValue || 0,
      pt: deductions.find(c => c.componentCode === 'PT')?.calculatedValue || 0,
    }

    return {
      employeeId: input.employeeId,
      period: input.period,
      basicSalary,
      grossSalary,
      totalEarnings,
      totalDeductions,
      netSalary,
      workingDays: input.workingDays,
      presentDays: attendanceMetrics.presentDays,
      absentDays: attendanceMetrics.absentDays,
      lopDays: attendanceMetrics.lopDays,
      lopAmount: attendanceMetrics.lopAmount,
      overtimeHours: attendanceMetrics.overtimeHours,
      overtimeAmount: attendanceMetrics.overtimeAmount,
      components,
      statutoryDeductions,
    }
  }

  /**
   * Get employee's active salary structure for a given date
   */
  private async getEmployeeSalaryStructure(employeeId: string, date: Date) {
    return await prisma.employeeSalaryStructure.findFirst({
      where: {
        employeeId,
        isActive: true,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      include: {
        structure: {
          include: {
            components: {
              include: {
                component: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        components: true,
      },
      orderBy: {
        effectiveFrom: 'desc',
      },
    })
  }

  /**
   * Get attendance data for the period
   */
  private async getAttendanceData(employeeId: string, startDate: Date, endDate: Date) {
    return await prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    })
  }

  /**
   * Calculate attendance metrics
   */
  private calculateAttendanceMetrics(attendanceRecords: any[], workingDays: number) {
    let presentDays = 0
    let absentDays = 0
    let halfDays = 0
    let overtimeHours = 0

    // Validate input data
    if (!Array.isArray(attendanceRecords)) {
      throw new Error('Invalid attendance data: expected array')
    }

    if (workingDays <= 0 || workingDays > 31) {
      throw new Error('Invalid working days: must be between 1 and 31')
    }

    attendanceRecords.forEach((record, index) => {
      if (!record || typeof record !== 'object') {
        console.warn(`Invalid attendance record at index ${index}:`, record)
        return
      }

      switch (record.status) {
        case AttendanceStatus.PRESENT:
          presentDays += 1
          break
        case AttendanceStatus.HALF_DAY:
          halfDays += 1
          presentDays += 0.5
          break
        case AttendanceStatus.ABSENT:
          absentDays += 1
          break
        case AttendanceStatus.ON_LEAVE:
          // Leave days are considered as present for payroll
          presentDays += 1
          break
        case AttendanceStatus.WORK_FROM_HOME:
          presentDays += 1
          break
        default:
          // Default to absent for unknown status
          console.warn(`Unknown attendance status: ${record.status}`)
          absentDays += 1
      }

      // Add overtime hours with validation
      if (record.overtime && record.overtime > 0) {
        const overtime = parseFloat(record.overtime.toString())
        // Validate overtime hours (max 12 hours per day)
        if (!isNaN(overtime) && overtime > 0 && overtime <= 12) {
          overtimeHours += overtime
        }
      }
    })

    // Ensure present days don't exceed working days
    presentDays = Math.min(presentDays, workingDays)

    // Calculate LOP (Loss of Pay) days - fixed calculation
    const lopDays = Math.max(0, workingDays - presentDays)

    // Validate calculated values
    if (presentDays < 0 || absentDays < 0 || lopDays < 0 || overtimeHours < 0) {
      throw new Error('Invalid attendance calculation results')
    }

    return {
      presentDays: Math.round(presentDays * 100) / 100, // Round to 2 decimal places
      absentDays: Math.round(absentDays * 100) / 100,
      halfDays: Math.round(halfDays * 100) / 100,
      lopDays: Math.round(lopDays * 100) / 100,
      lopAmount: 0, // Will be calculated based on daily rate
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      overtimeAmount: 0, // Will be calculated based on hourly rate
    }
  }

  /**
   * Calculate all component values
   */
  private async calculateComponents(
    employeeSalary: any,
    attendanceMetrics: any,
    period: string
  ): Promise<ComponentCalculation[]> {
    const components: ComponentCalculation[] = []
    const ctc = employeeSalary.ctc
    const presentDays = attendanceMetrics.presentDays
    const workingDays = this.getWorkingDaysInMonth(period)
    const attendanceRatio = presentDays / workingDays

    // First pass: Calculate fixed and basic components
    for (const structureComponent of employeeSalary.structure.components) {
      const component = structureComponent.component
      const employeeOverride = employeeSalary.components.find(
        (c: any) => c.componentId === component.id
      )

      let baseValue = 0
      let calculatedValue = 0

      if (employeeOverride) {
        baseValue = employeeOverride.value
        calculatedValue = baseValue
      } else {
        baseValue = await this.calculateComponentBaseValue(
          structureComponent,
          ctc,
          0 // Basic salary will be calculated in first pass
        )
        calculatedValue = baseValue
      }

      // Apply attendance proration for earnings (except basic salary)
      let isProrated = false
      if (component.type === PayComponentType.EARNING && 
          component.category !== PayComponentCategory.BASIC &&
          attendanceRatio < 1) {
        calculatedValue = baseValue * attendanceRatio
        isProrated = true
      }

      components.push({
        componentId: component.id,
        componentName: component.name,
        componentCode: component.code,
        type: component.type,
        category: component.category,
        calculationType: component.calculationType,
        baseValue,
        calculatedValue,
        isProrated,
        isStatutory: component.isStatutory,
        isTaxable: component.isTaxable,
      })
    }

    // Second pass: Calculate percentage-based components that depend on basic salary
    const basicSalaryComponent = components.find(c => c.category === PayComponentCategory.BASIC)
    const basicSalary = basicSalaryComponent?.calculatedValue || 0

    for (let i = 0; i < components.length; i++) {
      const component = components[i]
      const structureComponent = employeeSalary.structure.components.find(
        (sc: any) => sc.componentId === component.componentId
      )

      if (structureComponent.component.calculationType === CalculationType.PERCENTAGE &&
          structureComponent.baseComponent === 'BASIC') {
        const baseValue = (basicSalary * (structureComponent.percentage || 0)) / 100
        let calculatedValue = baseValue

        // Apply min/max constraints
        if (structureComponent.minValue && calculatedValue < structureComponent.minValue) {
          calculatedValue = structureComponent.minValue
        }
        if (structureComponent.maxValue && calculatedValue > structureComponent.maxValue) {
          calculatedValue = structureComponent.maxValue
        }

        // Apply attendance proration for earnings
        let isProrated = false
        if (component.type === PayComponentType.EARNING && attendanceRatio < 1) {
          calculatedValue = calculatedValue * attendanceRatio
          isProrated = true
        }

        components[i] = {
          ...component,
          baseValue,
          calculatedValue,
          isProrated,
        }
      }
    }

    // Calculate LOP amount
    if (attendanceMetrics.lopDays > 0) {
      const dailyRate = basicSalary / workingDays
      attendanceMetrics.lopAmount = dailyRate * attendanceMetrics.lopDays
    }

    // Calculate overtime amount with configurable rates
    if (attendanceMetrics.overtimeHours > 0) {
      // Get standard working hours per day (default 8, but should be configurable)
      const standardHoursPerDay = 8 // TODO: Make this configurable per company/employee
      const hourlyRate = basicSalary / (workingDays * standardHoursPerDay)

      // Overtime multiplier (1.5x is standard, but should be configurable)
      const overtimeMultiplier = 1.5 // TODO: Make this configurable per company policy

      // Validate hourly rate calculation
      if (hourlyRate <= 0 || !isFinite(hourlyRate)) {
        console.warn('Invalid hourly rate calculation:', { basicSalary, workingDays, standardHoursPerDay })
        attendanceMetrics.overtimeAmount = 0
      } else {
        attendanceMetrics.overtimeAmount = Math.round(hourlyRate * overtimeMultiplier * attendanceMetrics.overtimeHours * 100) / 100
      }
    }

    // Calculate statutory deductions
    await this.calculateStatutoryDeductions(components, basicSalary, period)

    return components
  }

  /**
   * Calculate base value for a component
   */
  private async calculateComponentBaseValue(
    structureComponent: any,
    ctc: number,
    basicSalary: number
  ): Promise<number> {
    const component = structureComponent.component

    switch (component.calculationType) {
      case CalculationType.FIXED:
        return structureComponent.value || 0

      case CalculationType.PERCENTAGE:
        let baseAmount = ctc
        if (structureComponent.baseComponent === 'BASIC') {
          baseAmount = basicSalary
        }
        
        const calculatedValue = (baseAmount * (structureComponent.percentage || 0)) / 100
        
        // Apply min/max constraints
        let finalValue = calculatedValue
        if (structureComponent.minValue && calculatedValue < structureComponent.minValue) {
          finalValue = structureComponent.minValue
        }
        if (structureComponent.maxValue && calculatedValue > structureComponent.maxValue) {
          finalValue = structureComponent.maxValue
        }
        
        return finalValue

      case CalculationType.FORMULA:
        // For now, return 0. Formula calculation would require a formula parser
        return 0

      case CalculationType.ATTENDANCE_BASED:
        // This would be calculated based on actual attendance data
        return 0

      default:
        return 0
    }
  }

  /**
   * Calculate statutory deductions (PF, ESI, TDS, PT) with configurable rates
   */
  private async calculateStatutoryDeductions(
    components: ComponentCalculation[],
    basicSalary: number,
    period: string
  ) {
    const grossSalary = components
      .filter(c => c.type === PayComponentType.EARNING)
      .reduce((sum, c) => sum + c.calculatedValue, 0)

    // Validate inputs
    if (basicSalary <= 0 || grossSalary <= 0) {
      console.warn('Invalid salary values for statutory deductions:', { basicSalary, grossSalary })
      return
    }

    // PF calculation (configurable rate and ceiling)
    const pfComponent = components.find(c => c.componentCode === 'PF')
    if (pfComponent) {
      // TODO: Make these configurable from database/settings
      const pfRate = 0.12 // 12%
      const pfCeiling = 1800 // ₹1,800 per month
      const pfAmount = Math.min(basicSalary * pfRate, pfCeiling)
      pfComponent.calculatedValue = Math.round(pfAmount * 100) / 100
    }

    // Update ESI calculation (0.75% of gross salary, applicable if gross <= ₹25,000)
    const esiComponent = components.find(c => c.componentCode === 'ESI')
    if (esiComponent && grossSalary <= 25000) {
      const esiAmount = grossSalary * 0.0075
      esiComponent.calculatedValue = esiAmount
    } else if (esiComponent) {
      esiComponent.calculatedValue = 0
    }

    // Update Professional Tax (state-specific, typically ₹200 per month)
    const ptComponent = components.find(c => c.componentCode === 'PT')
    if (ptComponent) {
      ptComponent.calculatedValue = 200 // Standard PT amount
    }

    // TDS calculation would require complex tax slab calculations
    // For now, we'll keep it simple or set to 0
    const tdsComponent = components.find(c => c.componentCode === 'TDS')
    if (tdsComponent) {
      // Simplified TDS calculation - would need proper tax calculation
      const annualSalary = grossSalary * 12
      if (annualSalary > 250000) {
        // Very simplified TDS calculation
        const tdsAmount = Math.max(0, (annualSalary - 250000) * 0.05 / 12)
        tdsComponent.calculatedValue = tdsAmount
      } else {
        tdsComponent.calculatedValue = 0
      }
    }
  }

  /**
   * Get working days in a month
   */
  public getWorkingDaysInMonth(period: string): number {
    const [year, month] = period.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0).getDate()
    
    let workingDays = 0
    for (let day = 1; day <= lastDay; day++) {
      const currentDate = new Date(year, month - 1, day)
      const dayOfWeek = currentDate.getDay()
      // Exclude Sundays (0) and Saturdays (6) - adjust based on company policy
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++
      }
    }
    
    return workingDays
  }

  /**
   * Calculate payroll for multiple employees
   */
  async calculateBulkPayroll(
    employeeIds: string[],
    period: string,
    startDate: Date,
    endDate: Date
  ): Promise<PayrollCalculationResult[]> {
    const workingDays = this.getWorkingDaysInMonth(period)
    const results: PayrollCalculationResult[] = []

    for (const employeeId of employeeIds) {
      try {
        const result = await this.calculateEmployeePayroll({
          employeeId,
          period,
          startDate,
          endDate,
          workingDays,
        })
        results.push(result)
      } catch (error) {
        console.error(`Error calculating payroll for employee ${employeeId}:`, error)
        // Continue with other employees
      }
    }

    return results
  }
}

// Export singleton instance
export const payrollCalculationEngine = new PayrollCalculationEngine()