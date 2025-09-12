import { prisma } from '@/lib/prisma'
import { 
  PayComponentType, 
  PayComponentCategory, 
  CalculationType 
} from '@prisma/client'

export interface ComponentCalculationContext {
  employeeId: string
  period: string
  ctc: number
  basicSalary: number
  grossSalary: number
  attendanceRatio: number
  workingDays: number
  presentDays: number
  overtimeHours: number
  components: Map<string, number> // componentCode -> calculatedValue
}

export interface ComponentCalculationRule {
  id: string
  name: string
  code: string
  type: PayComponentType
  category: PayComponentCategory
  calculationType: CalculationType
  isStatutory: boolean
  isTaxable: boolean
  formula?: string
  validationRules?: {
    minValue?: number
    maxValue?: number
    dependsOn?: string[]
    applicableRoles?: string[]
    effectiveDate?: Date
    expiryDate?: Date
  }
  calculationParams?: {
    baseComponent?: string
    multiplier?: number
    roundingRule?: 'ROUND_UP' | 'ROUND_DOWN' | 'ROUND_NEAREST'
    prorationRule?: 'DAILY' | 'MONTHLY' | 'NONE'
  }
}

export interface ComponentCalculationResult {
  componentId: string
  componentCode: string
  componentName: string
  type: PayComponentType
  category: PayComponentCategory
  baseValue: number
  calculatedValue: number
  isProrated: boolean
  isStatutory: boolean
  isTaxable: boolean
  calculationDetails: {
    formula?: string
    baseComponent?: string
    appliedRate?: number
    roundingApplied?: boolean
    prorationApplied?: boolean
    validationErrors?: string[]
  }
}

export class SalaryCalculationEngine {
  
  /**
   * Calculate all components for an employee
   */
  async calculateAllComponents(
    employeeId: string,
    structureId: string,
    ctc: number,
    context: Partial<ComponentCalculationContext>
  ): Promise<ComponentCalculationResult[]> {
    
    // Get salary structure with components
    const structure = await this.getSalaryStructure(structureId)
    if (!structure) {
      throw new Error(`Salary structure ${structureId} not found`)
    }

    // Initialize calculation context
    const calculationContext: ComponentCalculationContext = {
      employeeId,
      period: context.period || new Date().toISOString().slice(0, 7),
      ctc,
      basicSalary: 0,
      grossSalary: 0,
      attendanceRatio: context.attendanceRatio || 1,
      workingDays: context.workingDays || 22,
      presentDays: context.presentDays || 22,
      overtimeHours: context.overtimeHours || 0,
      components: new Map(),
    }

    const results: ComponentCalculationResult[] = []
    
    // Sort components by calculation order (basic first, then others)
    const componentRules: ComponentCalculationRule[] = structure.components.map(sc => ({
      id: sc.component.id,
      name: sc.component.name,
      code: sc.component.code,
      type: sc.component.type,
      category: sc.component.category,
      calculationType: sc.component.calculationType,
      isStatutory: sc.component.isStatutory,
      isTaxable: sc.component.isTaxable,
      formula: sc.component.formula || undefined,
      validationRules: undefined, // Not available in this model
      order: sc.order,
      isActive: sc.component.isActive,
      effectiveFrom: sc.component.createdAt, // Use createdAt as fallback
      effectiveTo: undefined, // Not available in this model
    }))
    const sortedComponents = this.sortComponentsByCalculationOrder(componentRules)
    
    // Calculate each component
    for (const component of sortedComponents) {
      try {
        const result = await this.calculateSingleComponent(component, calculationContext)
        results.push(result)
        
        // Update context with calculated value
        calculationContext.components.set(component.code, result.calculatedValue)
        
        // Update basic salary and gross salary in context
        if (component.category === PayComponentCategory.BASIC) {
          calculationContext.basicSalary = result.calculatedValue
        }
        
        if (component.type === PayComponentType.EARNING) {
          calculationContext.grossSalary += result.calculatedValue
        }
        
      } catch (error) {
        console.error(`Error calculating component ${component.code}:`, error)
        // Add error result
        results.push({
          componentId: component.id,
          componentCode: component.code,
          componentName: component.name,
          type: component.type,
          category: component.category,
          baseValue: 0,
          calculatedValue: 0,
          isProrated: false,
          isStatutory: component.isStatutory,
          isTaxable: component.isTaxable,
          calculationDetails: {
            validationErrors: [error instanceof Error ? error.message : 'Calculation failed']
          }
        })
      }
    }

    return results
  }

  /**
   * Calculate a single component
   */
  private async calculateSingleComponent(
    component: ComponentCalculationRule,
    context: ComponentCalculationContext
  ): Promise<ComponentCalculationResult> {
    
    let baseValue = 0
    let calculatedValue = 0
    let isProrated = false
    const calculationDetails: any = {}

    // Validate component applicability
    const validationErrors = this.validateComponent(component, context)
    if (validationErrors.length > 0) {
      calculationDetails.validationErrors = validationErrors
    }

    // Calculate base value based on calculation type
    switch (component.calculationType) {
      case CalculationType.FIXED:
        baseValue = await this.calculateFixedAmount(component, context)
        break
        
      case CalculationType.PERCENTAGE:
        const percentageResult = await this.calculatePercentageAmount(component, context)
        baseValue = percentageResult.amount
        calculationDetails.baseComponent = percentageResult.baseComponent
        calculationDetails.appliedRate = percentageResult.rate
        break
        
      case CalculationType.FORMULA:
        const formulaResult = await this.calculateFormulaAmount(component, context)
        baseValue = formulaResult.amount
        calculationDetails.formula = component.formula
        break
        
      case CalculationType.ATTENDANCE_BASED:
        baseValue = await this.calculateAttendanceBasedAmount(component, context)
        break
        
      default:
        throw new Error(`Unsupported calculation type: ${component.calculationType}`)
    }

    calculatedValue = baseValue

    // Apply proration if needed
    if (this.shouldApplyProration(component, context)) {
      calculatedValue = this.applyProration(baseValue, component, context)
      isProrated = true
      calculationDetails.prorationApplied = true
    }

    // Apply rounding
    if (component.calculationParams?.roundingRule) {
      const roundedValue = this.applyRounding(calculatedValue, component.calculationParams.roundingRule)
      if (roundedValue !== calculatedValue) {
        calculatedValue = roundedValue
        calculationDetails.roundingApplied = true
      }
    }

    // Apply validation constraints
    calculatedValue = this.applyValidationConstraints(calculatedValue, component)

    return {
      componentId: component.id,
      componentCode: component.code,
      componentName: component.name,
      type: component.type,
      category: component.category,
      baseValue,
      calculatedValue,
      isProrated,
      isStatutory: component.isStatutory,
      isTaxable: component.isTaxable,
      calculationDetails,
    }
  }

  /**
   * Calculate fixed amount
   */
  private async calculateFixedAmount(
    component: ComponentCalculationRule,
    context: ComponentCalculationContext
  ): Promise<number> {
    // For fixed components, we need to get the value from the salary structure
    const structureComponent = await prisma.salaryStructureComponent.findFirst({
      where: {
        componentId: component.id,
      },
    })
    
    return structureComponent?.value ? parseFloat(structureComponent.value.toString()) : 0
  }

  /**
   * Calculate percentage amount
   */
  private async calculatePercentageAmount(
    component: ComponentCalculationRule,
    context: ComponentCalculationContext
  ): Promise<{ amount: number; baseComponent: string; rate: number }> {
    const structureComponent = await prisma.salaryStructureComponent.findFirst({
      where: {
        componentId: component.id,
      },
    })
    
    const percentage = structureComponent?.percentage ? parseFloat(structureComponent.percentage.toString()) : 0
    const baseComponent = component.calculationParams?.baseComponent || structureComponent?.baseComponent || 'CTC'
    
    let baseAmount = 0
    
    switch (baseComponent) {
      case 'CTC':
        baseAmount = context.ctc
        break
      case 'BASIC':
        baseAmount = context.basicSalary
        break
      case 'GROSS':
        baseAmount = context.grossSalary
        break
      default:
        // Look for specific component
        baseAmount = context.components.get(baseComponent) || 0
        break
    }
    
    const amount = (baseAmount * percentage) / 100
    
    return {
      amount,
      baseComponent,
      rate: percentage,
    }
  }

  /**
   * Calculate formula-based amount
   */
  private async calculateFormulaAmount(
    component: ComponentCalculationRule,
    context: ComponentCalculationContext
  ): Promise<{ amount: number }> {
    if (!component.formula) {
      throw new Error(`Formula not defined for component ${component.code}`)
    }

    try {
      // Replace variables in formula with actual values
      let formula = component.formula
      
      // Replace standard variables
      formula = formula.replace(/CTC/g, context.ctc.toString())
      formula = formula.replace(/BASIC/g, context.basicSalary.toString())
      formula = formula.replace(/GROSS/g, context.grossSalary.toString())
      
      // Replace component codes with their values
      for (const [code, value] of context.components.entries()) {
        const regex = new RegExp(`\\b${code}\\b`, 'g')
        formula = formula.replace(regex, value.toString())
      }
      
      // Evaluate the formula (in a real implementation, use a safe formula evaluator)
      const amount = this.evaluateFormula(formula)
      
      return { amount }
    } catch (error) {
      throw new Error(`Formula evaluation failed for component ${component.code}: ${error}`)
    }
  }

  /**
   * Calculate attendance-based amount
   */
  private async calculateAttendanceBasedAmount(
    component: ComponentCalculationRule,
    context: ComponentCalculationContext
  ): Promise<number> {
    // This would typically involve complex attendance calculations
    // For now, return a simple calculation based on attendance ratio
    const structureComponent = await prisma.salaryStructureComponent.findFirst({
      where: {
        componentId: component.id,
      },
    })
    
    const baseAmount = structureComponent?.value ? parseFloat(structureComponent.value.toString()) : 0
    return baseAmount * context.attendanceRatio
  }

  /**
   * Validate component applicability
   */
  private validateComponent(
    component: ComponentCalculationRule,
    context: ComponentCalculationContext
  ): string[] {
    const errors: string[] = []
    
    // Check effective date
    if (component.validationRules?.effectiveDate) {
      const effectiveDate = new Date(component.validationRules.effectiveDate)
      const currentDate = new Date()
      if (currentDate < effectiveDate) {
        errors.push(`Component not yet effective (effective from ${effectiveDate.toDateString()})`)
      }
    }
    
    // Check expiry date
    if (component.validationRules?.expiryDate) {
      const expiryDate = new Date(component.validationRules.expiryDate)
      const currentDate = new Date()
      if (currentDate > expiryDate) {
        errors.push(`Component has expired (expired on ${expiryDate.toDateString()})`)
      }
    }
    
    // Check dependencies
    if (component.validationRules?.dependsOn) {
      for (const dependency of component.validationRules.dependsOn) {
        if (!context.components.has(dependency)) {
          errors.push(`Missing dependency: ${dependency}`)
        }
      }
    }
    
    return errors
  }

  /**
   * Check if proration should be applied
   */
  private shouldApplyProration(
    component: ComponentCalculationRule,
    context: ComponentCalculationContext
  ): boolean {
    // Don't prorate basic salary or statutory deductions
    if (component.category === PayComponentCategory.BASIC || component.isStatutory) {
      return false
    }
    
    // Check proration rule
    const prorationRule = component.calculationParams?.prorationRule || 'DAILY'
    if (prorationRule === 'NONE') {
      return false
    }
    
    // Apply proration if attendance ratio is less than 1
    return context.attendanceRatio < 1
  }

  /**
   * Apply proration
   */
  private applyProration(
    amount: number,
    component: ComponentCalculationRule,
    context: ComponentCalculationContext
  ): number {
    const prorationRule = component.calculationParams?.prorationRule || 'DAILY'
    
    switch (prorationRule) {
      case 'DAILY':
        return amount * context.attendanceRatio
      case 'MONTHLY':
        // Monthly proration based on calendar days
        const daysInMonth = new Date(
          parseInt(context.period.split('-')[0]),
          parseInt(context.period.split('-')[1]),
          0
        ).getDate()
        return amount * (context.presentDays / daysInMonth)
      default:
        return amount
    }
  }

  /**
   * Apply rounding
   */
  private applyRounding(amount: number, rule: 'ROUND_UP' | 'ROUND_DOWN' | 'ROUND_NEAREST'): number {
    switch (rule) {
      case 'ROUND_UP':
        return Math.ceil(amount)
      case 'ROUND_DOWN':
        return Math.floor(amount)
      case 'ROUND_NEAREST':
        return Math.round(amount)
      default:
        return amount
    }
  }

  /**
   * Apply validation constraints
   */
  private applyValidationConstraints(
    amount: number,
    component: ComponentCalculationRule
  ): number {
    let constrainedAmount = amount
    
    if (component.validationRules?.minValue !== undefined) {
      constrainedAmount = Math.max(constrainedAmount, component.validationRules.minValue)
    }
    
    if (component.validationRules?.maxValue !== undefined) {
      constrainedAmount = Math.min(constrainedAmount, component.validationRules.maxValue)
    }
    
    return constrainedAmount
  }

  /**
   * Sort components by calculation order
   */
  private sortComponentsByCalculationOrder(components: ComponentCalculationRule[]): ComponentCalculationRule[] {
    return components.sort((a, b) => {
      // Basic salary first
      if (a.category === PayComponentCategory.BASIC) return -1
      if (b.category === PayComponentCategory.BASIC) return 1
      
      // Earnings before deductions
      if (a.type === PayComponentType.EARNING && b.type === PayComponentType.DEDUCTION) return -1
      if (a.type === PayComponentType.DEDUCTION && b.type === PayComponentType.EARNING) return 1
      
      // Fixed amounts before percentage/formula
      if (a.calculationType === CalculationType.FIXED && b.calculationType !== CalculationType.FIXED) return -1
      if (a.calculationType !== CalculationType.FIXED && b.calculationType === CalculationType.FIXED) return 1
      
      return 0
    })
  }

  /**
   * Get salary structure with components
   */
  private async getSalaryStructure(structureId: string) {
    return await prisma.salaryStructure.findUnique({
      where: { id: structureId },
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
    })
  }

  /**
   * Safe formula evaluator (simplified version)
   */
  private evaluateFormula(formula: string): number {
    // In a production environment, use a proper formula evaluator library
    // This is a simplified version for demonstration
    try {
      // Remove any non-mathematical characters for safety
      const sanitized = formula.replace(/[^0-9+\-*/.() ]/g, '')
      
      // Use Function constructor for evaluation (be careful in production)
      const result = new Function(`return ${sanitized}`)()
      
      return typeof result === 'number' && !isNaN(result) ? result : 0
    } catch {
      return 0
    }
  }

  /**
   * Calculate statutory deductions with proper rates
   */
  async calculateStatutoryDeductions(
    basicSalary: number,
    grossSalary: number,
    employeeId: string
  ): Promise<{
    pf: number
    esi: number
    tds: number
    pt: number
  }> {
    // PF: 12% of basic salary, capped at ₹1,800 (for basic salary up to ₹15,000)
    const pfAmount = Math.min(basicSalary * 0.12, 1800)
    
    // ESI: 0.75% of gross salary (applicable if gross <= ₹25,000)
    const esiAmount = grossSalary <= 25000 ? grossSalary * 0.0075 : 0
    
    // Professional Tax: State-specific (typically ₹200 per month)
    const ptAmount = 200
    
    // TDS: Complex calculation based on annual salary and tax slabs
    const tdsAmount = await this.calculateTDS(grossSalary, employeeId)
    
    return {
      pf: pfAmount,
      esi: esiAmount,
      tds: tdsAmount,
      pt: ptAmount,
    }
  }

  /**
   * Calculate TDS (simplified)
   */
  private async calculateTDS(grossSalary: number, employeeId: string): Promise<number> {
    // This is a simplified TDS calculation
    // In reality, you'd need to consider:
    // - Annual salary
    // - Tax slabs
    // - Deductions under 80C, 80D, etc.
    // - Previous tax paid
    
    const annualSalary = grossSalary * 12
    
    // Basic tax calculation (FY 2023-24 slabs)
    let tax = 0
    
    if (annualSalary > 250000) {
      if (annualSalary <= 500000) {
        tax = (annualSalary - 250000) * 0.05
      } else if (annualSalary <= 1000000) {
        tax = 250000 * 0.05 + (annualSalary - 500000) * 0.20
      } else {
        tax = 250000 * 0.05 + 500000 * 0.20 + (annualSalary - 1000000) * 0.30
      }
    }
    
    // Monthly TDS
    return tax / 12
  }
}

// Export singleton instance
export const salaryCalculationEngine = new SalaryCalculationEngine()