import { prisma } from '@/lib/prisma'

export interface StructureVersionInfo {
  id: string
  version: string
  effectiveFrom: Date
  effectiveTo?: Date
  isActive: boolean
  createdAt: Date
  changeLog?: string
}

export interface EffectiveDateValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
  affectedEmployees?: number
}

export class SalaryStructureService {
  
  /**
   * Create a new salary structure with version control
   */
  async createStructure(data: {
    name: string
    code: string
    gradeId?: string
    description?: string
    effectiveFrom?: Date
    effectiveTo?: Date
    components: Array<{
      componentId: string
      value?: number
      percentage?: number
      baseComponent?: string
      minValue?: number
      maxValue?: number
      isVariable?: boolean
      order: number
    }>
    metadata?: {
      category?: string
      version?: string
      isTemplate?: boolean
      approvalRequired?: boolean
    }
  }) {
    return await prisma.$transaction(async (tx) => {
      // Check for duplicate name/code
      const existing = await tx.salaryStructure.findFirst({
        where: {
          OR: [
            { name: data.name },
            { code: data.code },
          ],
        },
      })

      if (existing) {
        throw new Error('Salary structure with this name or code already exists')
      }

      // Create the structure
      const structure = await tx.salaryStructure.create({
        data: {
          name: data.name,
          code: data.code,
          gradeId: data.gradeId,
          description: data.description,
          effectiveFrom: data.effectiveFrom || new Date(),
          effectiveTo: data.effectiveTo,
          isActive: true,
        },
      })

      // Create structure components
      await tx.salaryStructureComponent.createMany({
        data: data.components.map(comp => ({
          structureId: structure.id,
          componentId: comp.componentId,
          value: comp.value,
          percentage: comp.percentage,
          baseComponent: comp.baseComponent,
          minValue: comp.minValue,
          maxValue: comp.maxValue,
          isVariable: comp.isVariable || false,
          order: comp.order,
        })),
      })

      return structure
    })
  }

  /**
   * Create a new version of an existing structure
   */
  async createStructureVersion(
    originalStructureId: string,
    changes: {
      effectiveFrom: Date
      effectiveTo?: Date
      changeLog?: string
      components?: Array<{
        componentId: string
        value?: number
        percentage?: number
        baseComponent?: string
        minValue?: number
        maxValue?: number
        isVariable?: boolean
        order: number
      }>
    }
  ) {
    return await prisma.$transaction(async (tx) => {
      // Get original structure
      const originalStructure = await tx.salaryStructure.findUnique({
        where: { id: originalStructureId },
        include: {
          components: {
            include: {
              component: true,
            },
          },
        },
      })

      if (!originalStructure) {
        throw new Error('Original structure not found')
      }

      // Validate effective dates
      const validation = await this.validateEffectiveDate(
        originalStructureId,
        changes.effectiveFrom,
        changes.effectiveTo
      )

      if (!validation.isValid) {
        throw new Error(`Invalid effective date: ${validation.errors.join(', ')}`)
      }

      // Set end date for current active version
      await tx.salaryStructure.updateMany({
        where: {
          OR: [
            { id: originalStructureId },
            { name: originalStructure.name, isActive: true },
          ],
        },
        data: {
          effectiveTo: changes.effectiveFrom,
          isActive: false,
        },
      })

      // Create new version
      const newVersion = await tx.salaryStructure.create({
        data: {
          name: originalStructure.name,
          code: originalStructure.code,
          gradeId: originalStructure.gradeId,
          description: originalStructure.description,
          effectiveFrom: changes.effectiveFrom,
          effectiveTo: changes.effectiveTo,
          isActive: true,
        },
      })

      // Copy or update components
      const componentsToCreate = changes.components || originalStructure.components.map(comp => ({
        componentId: comp.componentId,
        value: comp.value ? parseFloat(comp.value.toString()) : undefined,
        percentage: comp.percentage ? parseFloat(comp.percentage.toString()) : undefined,
        baseComponent: comp.baseComponent,
        minValue: comp.minValue ? parseFloat(comp.minValue.toString()) : undefined,
        maxValue: comp.maxValue ? parseFloat(comp.maxValue.toString()) : undefined,
        isVariable: comp.isVariable,
        order: comp.order,
      }))

      await tx.salaryStructureComponent.createMany({
        data: componentsToCreate.map(comp => ({
          structureId: newVersion.id,
          componentId: comp.componentId,
          value: comp.value,
          percentage: comp.percentage,
          baseComponent: comp.baseComponent,
          minValue: comp.minValue,
          maxValue: comp.maxValue,
          isVariable: comp.isVariable || false,
          order: comp.order,
        })),
      })

      return newVersion
    })
  }

  /**
   * Get all versions of a salary structure
   */
  async getStructureVersions(structureName: string): Promise<StructureVersionInfo[]> {
    const structures = await prisma.salaryStructure.findMany({
      where: { name: structureName },
      orderBy: { effectiveFrom: 'desc' },
      select: {
        id: true,
        effectiveFrom: true,
        effectiveTo: true,
        isActive: true,
        createdAt: true,
      },
    })

    return structures.map((struct, index) => ({
      id: struct.id,
      version: `v${structures.length - index}`,
      effectiveFrom: struct.effectiveFrom,
      effectiveTo: struct.effectiveTo || undefined,
      isActive: struct.isActive,
      createdAt: struct.createdAt,
    }))
  }

  /**
   * Get active structure for a given date
   */
  async getActiveStructure(structureName: string, date: Date = new Date()) {
    return await prisma.salaryStructure.findFirst({
      where: {
        name: structureName,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      include: {
        grade: true,
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
   * Validate effective date for structure changes
   */
  async validateEffectiveDate(
    structureId: string,
    effectiveFrom: Date,
    effectiveTo?: Date
  ): Promise<EffectiveDateValidation> {
    const errors: string[] = []
    const warnings: string[] = []

    // Check if effective from is in the past
    const now = new Date()
    if (effectiveFrom < now) {
      warnings.push('Effective date is in the past')
    }

    // Check if effective to is before effective from
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      errors.push('Effective to date must be after effective from date')
    }

    // Check for overlapping periods with other versions
    const structure = await prisma.salaryStructure.findUnique({
      where: { id: structureId },
    })

    if (structure) {
      const overlapping = await prisma.salaryStructure.findMany({
        where: {
          name: structure.name,
          id: { not: structureId },
          OR: [
            {
              effectiveFrom: { lte: effectiveFrom },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: effectiveFrom } },
              ],
            },
            ...(effectiveTo ? [{
              effectiveFrom: { lte: effectiveTo },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: effectiveTo } },
              ],
            }] : []),
          ],
        },
      })

      if (overlapping.length > 0) {
        errors.push('Effective date range overlaps with existing structure versions')
      }
    }

    // Check how many employees will be affected
    const affectedEmployees = await prisma.employeeSalaryStructure.count({
      where: {
        structureId,
        isActive: true,
        effectiveFrom: { lte: effectiveFrom },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: effectiveFrom } },
        ],
      },
    })

    if (affectedEmployees > 0) {
      warnings.push(`${affectedEmployees} employees will be affected by this change`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      affectedEmployees,
    }
  }

  /**
   * Assign salary structure to employee with effective date handling
   */
  async assignStructureToEmployee(data: {
    employeeId: string
    structureId: string
    ctc: number
    effectiveFrom: Date
    effectiveTo?: Date
    revisionReason?: string
    approvedBy?: string
    componentOverrides?: Array<{
      componentId: string
      value: number
    }>
  }) {
    return await prisma.$transaction(async (tx) => {
      // Validate structure exists and is active for the effective date
      const structure = await tx.salaryStructure.findFirst({
        where: {
          id: data.structureId,
          effectiveFrom: { lte: data.effectiveFrom },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: data.effectiveFrom } },
          ],
        },
        include: {
          grade: true,
        },
      })

      if (!structure) {
        throw new Error('Structure not found or not active for the specified date')
      }

      // Validate CTC against grade limits
      if (structure.grade) {
        if (data.ctc < Number(structure.grade.minSalary) || data.ctc > Number(structure.grade.maxSalary)) {
          throw new Error(
            `CTC must be between ₹${structure.grade.minSalary.toLocaleString()} and ₹${structure.grade.maxSalary.toLocaleString()}`
          )
        }
      }

      // End current active assignment if exists
      await tx.employeeSalaryStructure.updateMany({
        where: {
          employeeId: data.employeeId,
          isActive: true,
        },
        data: {
          effectiveTo: data.effectiveFrom,
          isActive: false,
        },
      })

      // Create new assignment
      const assignment = await tx.employeeSalaryStructure.create({
        data: {
          employeeId: data.employeeId,
          structureId: data.structureId,
          ctc: data.ctc,
          effectiveFrom: data.effectiveFrom,
          effectiveTo: data.effectiveTo,
          revisionReason: data.revisionReason,
          approvedBy: data.approvedBy,
          isActive: true,
        },
      })

      // Create component overrides if provided
      if (data.componentOverrides && data.componentOverrides.length > 0) {
        await tx.employeeSalaryComponent.createMany({
          data: data.componentOverrides.map(override => ({
            employeeSalaryId: assignment.id,
            componentId: override.componentId,
            value: override.value,
            isOverride: true,
          })),
        })
      }

      return assignment
    })
  }

  /**
   * Get employee salary history
   */
  async getEmployeeSalaryHistory(employeeId: string) {
    return await prisma.employeeSalaryStructure.findMany({
      where: { employeeId },
      include: {
        structure: {
          include: {
            grade: true,
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
   * Get employees affected by structure changes
   */
  async getAffectedEmployees(structureId: string, effectiveDate: Date) {
    return await prisma.employeeSalaryStructure.findMany({
      where: {
        structureId,
        isActive: true,
        effectiveFrom: { lte: effectiveDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: effectiveDate } },
        ],
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
              },
            },
          },
        },
      },
    })
  }

  /**
   * Bulk update employee salaries when structure changes
   */
  async bulkUpdateEmployeeSalaries(
    structureId: string,
    effectiveDate: Date,
    updates: Array<{
      employeeId: string
      newCTC?: number
      componentOverrides?: Array<{
        componentId: string
        value: number
      }>
    }>
  ) {
    return await prisma.$transaction(async (tx) => {
      const results = []

      for (const update of updates) {
        // End current assignment
        await tx.employeeSalaryStructure.updateMany({
          where: {
            employeeId: update.employeeId,
            structureId,
            isActive: true,
          },
          data: {
            effectiveTo: effectiveDate,
            isActive: false,
          },
        })

        // Get current CTC if not provided
        let ctc = update.newCTC
        if (!ctc) {
          const current = await tx.employeeSalaryStructure.findFirst({
            where: {
              employeeId: update.employeeId,
              structureId,
            },
            orderBy: {
              effectiveFrom: 'desc',
            },
          })
          ctc = current?.ctc ? parseFloat(current.ctc.toString()) : 0
        }

        // Create new assignment
        const newAssignment = await tx.employeeSalaryStructure.create({
          data: {
            employeeId: update.employeeId,
            structureId,
            ctc,
            effectiveFrom: effectiveDate,
            revisionReason: 'STRUCTURE_UPDATE',
            isActive: true,
          },
        })

        // Add component overrides
        if (update.componentOverrides) {
          await tx.employeeSalaryComponent.createMany({
            data: update.componentOverrides.map(override => ({
              employeeSalaryId: newAssignment.id,
              componentId: override.componentId,
              value: override.value,
              isOverride: true,
            })),
          })
        }

        results.push(newAssignment)
      }

      return results
    })
  }

  /**
   * Archive old structure versions
   */
  async archiveOldVersions(structureName: string, keepVersions: number = 5) {
    const versions = await prisma.salaryStructure.findMany({
      where: { 
        name: structureName,
        isActive: false,
      },
      orderBy: { effectiveFrom: 'desc' },
      skip: keepVersions,
    })

    if (versions.length > 0) {
      const idsToArchive = versions.map(v => v.id)
      
      // Instead of deleting, mark as archived
      await prisma.salaryStructure.updateMany({
        where: { id: { in: idsToArchive } },
        data: { 
          // Add archived field to schema if needed
          description: `ARCHIVED: ${new Date().toISOString()}`,
        },
      })
    }

    return versions.length
  }
}

// Export singleton instance
export const salaryStructureService = new SalaryStructureService()