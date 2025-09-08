import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedPayrollData() {
  console.log('🌱 Seeding payroll data...')

  // Create salary grades
  const salaryGrades = [
    {
      name: 'Junior Level',
      code: 'L1',
      description: 'Entry level positions',
      minSalary: 300000,
      maxSalary: 600000,
      currency: 'INR',
    },
    {
      name: 'Mid Level',
      code: 'L2',
      description: 'Mid-level positions with 2-4 years experience',
      minSalary: 600000,
      maxSalary: 1200000,
      currency: 'INR',
    },
    {
      name: 'Senior Level',
      code: 'L3',
      description: 'Senior positions with 5+ years experience',
      minSalary: 1200000,
      maxSalary: 2000000,
      currency: 'INR',
    },
    {
      name: 'Manager',
      code: 'MGR',
      description: 'Management positions',
      minSalary: 1500000,
      maxSalary: 3000000,
      currency: 'INR',
    },
    {
      name: 'Senior Manager',
      code: 'SMGR',
      description: 'Senior management positions',
      minSalary: 2500000,
      maxSalary: 5000000,
      currency: 'INR',
    },
  ]

  for (const grade of salaryGrades) {
    await prisma.salaryGrade.upsert({
      where: { code: grade.code },
      update: grade,
      create: grade,
    })
  }

  console.log('✅ Created salary grades')

  // Create pay components
  const payComponents = [
    // Earnings
    {
      name: 'Basic Salary',
      code: 'BASIC',
      type: 'EARNING' as const,
      category: 'BASIC' as const,
      calculationType: 'PERCENTAGE' as const,
      isStatutory: false,
      isTaxable: true,
      description: 'Basic salary component, typically 40-50% of CTC',
    },
    {
      name: 'House Rent Allowance',
      code: 'HRA',
      type: 'EARNING' as const,
      category: 'ALLOWANCE' as const,
      calculationType: 'PERCENTAGE' as const,
      isStatutory: false,
      isTaxable: true,
      description: 'House rent allowance, typically 40-50% of basic salary',
    },
    {
      name: 'Transport Allowance',
      code: 'TRANSPORT',
      type: 'EARNING' as const,
      category: 'ALLOWANCE' as const,
      calculationType: 'FIXED' as const,
      isStatutory: false,
      isTaxable: true,
      description: 'Fixed transport allowance',
    },
    {
      name: 'Medical Allowance',
      code: 'MEDICAL',
      type: 'EARNING' as const,
      category: 'ALLOWANCE' as const,
      calculationType: 'FIXED' as const,
      isStatutory: false,
      isTaxable: true,
      description: 'Medical allowance for healthcare expenses',
    },
    {
      name: 'Special Allowance',
      code: 'SPECIAL',
      type: 'EARNING' as const,
      category: 'ALLOWANCE' as const,
      calculationType: 'PERCENTAGE' as const,
      isStatutory: false,
      isTaxable: true,
      description: 'Special allowance to balance the CTC',
    },
    {
      name: 'Performance Bonus',
      code: 'BONUS',
      type: 'EARNING' as const,
      category: 'BONUS' as const,
      calculationType: 'PERCENTAGE' as const,
      isStatutory: false,
      isTaxable: true,
      description: 'Variable performance-based bonus',
    },
    {
      name: 'Overtime Pay',
      code: 'OVERTIME',
      type: 'EARNING' as const,
      category: 'OVERTIME' as const,
      calculationType: 'ATTENDANCE_BASED' as const,
      isStatutory: false,
      isTaxable: true,
      description: 'Overtime compensation based on extra hours worked',
    },

    // Deductions
    {
      name: 'Provident Fund',
      code: 'PF',
      type: 'DEDUCTION' as const,
      category: 'STATUTORY_DEDUCTION' as const,
      calculationType: 'PERCENTAGE' as const,
      isStatutory: true,
      isTaxable: false,
      description: 'Employee Provident Fund contribution (12% of basic)',
      formula: 'BASIC * 0.12',
    },
    {
      name: 'Employee State Insurance',
      code: 'ESI',
      type: 'DEDUCTION' as const,
      category: 'STATUTORY_DEDUCTION' as const,
      calculationType: 'PERCENTAGE' as const,
      isStatutory: true,
      isTaxable: false,
      description: 'ESI contribution (0.75% of gross salary)',
      formula: 'GROSS * 0.0075',
    },
    {
      name: 'Tax Deducted at Source',
      code: 'TDS',
      type: 'DEDUCTION' as const,
      category: 'STATUTORY_DEDUCTION' as const,
      calculationType: 'FORMULA' as const,
      isStatutory: true,
      isTaxable: false,
      description: 'Income tax deducted at source',
    },
    {
      name: 'Professional Tax',
      code: 'PT',
      type: 'DEDUCTION' as const,
      category: 'STATUTORY_DEDUCTION' as const,
      calculationType: 'FIXED' as const,
      isStatutory: true,
      isTaxable: false,
      description: 'State professional tax',
    },
    {
      name: 'Loan Deduction',
      code: 'LOAN',
      type: 'DEDUCTION' as const,
      category: 'OTHER_DEDUCTION' as const,
      calculationType: 'FIXED' as const,
      isStatutory: false,
      isTaxable: false,
      description: 'Employee loan repayment deduction',
    },
    {
      name: 'Advance Deduction',
      code: 'ADVANCE',
      type: 'DEDUCTION' as const,
      category: 'OTHER_DEDUCTION' as const,
      calculationType: 'FIXED' as const,
      isStatutory: false,
      isTaxable: false,
      description: 'Salary advance recovery',
    },
  ]

  for (const component of payComponents) {
    await prisma.payComponent.upsert({
      where: { code: component.code },
      update: component,
      create: component,
    })
  }

  console.log('✅ Created pay components')

  // Create sample salary structures
  const juniorGrade = await prisma.salaryGrade.findUnique({
    where: { code: 'L1' },
  })

  const midGrade = await prisma.salaryGrade.findUnique({
    where: { code: 'L2' },
  })

  if (juniorGrade && midGrade) {
    // Junior Software Engineer Structure
    const juniorStructure = await prisma.salaryStructure.upsert({
      where: { code: 'SE_L1' },
      update: {},
      create: {
        name: 'Software Engineer L1',
        code: 'SE_L1',
        gradeId: juniorGrade.id,
        description: 'Standard salary structure for junior software engineers',
      },
    })

    // Mid-level Software Engineer Structure
    const midStructure = await prisma.salaryStructure.upsert({
      where: { code: 'SE_L2' },
      update: {},
      create: {
        name: 'Software Engineer L2',
        code: 'SE_L2',
        gradeId: midGrade.id,
        description: 'Standard salary structure for mid-level software engineers',
      },
    })

    // Get pay components
    const basicComponent = await prisma.payComponent.findUnique({ where: { code: 'BASIC' } })
    const hraComponent = await prisma.payComponent.findUnique({ where: { code: 'HRA' } })
    const transportComponent = await prisma.payComponent.findUnique({ where: { code: 'TRANSPORT' } })
    const specialComponent = await prisma.payComponent.findUnique({ where: { code: 'SPECIAL' } })
    const pfComponent = await prisma.payComponent.findUnique({ where: { code: 'PF' } })
    const ptComponent = await prisma.payComponent.findUnique({ where: { code: 'PT' } })

    if (basicComponent && hraComponent && transportComponent && specialComponent && pfComponent && ptComponent) {
      // Junior structure components
      const juniorComponents = [
        {
          structureId: juniorStructure.id,
          componentId: basicComponent.id,
          percentage: 45,
          baseComponent: 'CTC',
          order: 1,
        },
        {
          structureId: juniorStructure.id,
          componentId: hraComponent.id,
          percentage: 40,
          baseComponent: 'BASIC',
          order: 2,
        },
        {
          structureId: juniorStructure.id,
          componentId: transportComponent.id,
          value: 2000,
          order: 3,
        },
        {
          structureId: juniorStructure.id,
          componentId: specialComponent.id,
          percentage: 25,
          baseComponent: 'CTC',
          order: 4,
        },
        {
          structureId: juniorStructure.id,
          componentId: pfComponent.id,
          percentage: 12,
          baseComponent: 'BASIC',
          order: 5,
        },
        {
          structureId: juniorStructure.id,
          componentId: ptComponent.id,
          value: 200,
          order: 6,
        },
      ]

      for (const component of juniorComponents) {
        await prisma.salaryStructureComponent.upsert({
          where: {
            structureId_componentId: {
              structureId: component.structureId,
              componentId: component.componentId,
            },
          },
          update: component,
          create: component,
        })
      }

      // Mid-level structure components
      const midComponents = [
        {
          structureId: midStructure.id,
          componentId: basicComponent.id,
          percentage: 45,
          baseComponent: 'CTC',
          order: 1,
        },
        {
          structureId: midStructure.id,
          componentId: hraComponent.id,
          percentage: 40,
          baseComponent: 'BASIC',
          order: 2,
        },
        {
          structureId: midStructure.id,
          componentId: transportComponent.id,
          value: 3000,
          order: 3,
        },
        {
          structureId: midStructure.id,
          componentId: specialComponent.id,
          percentage: 25,
          baseComponent: 'CTC',
          order: 4,
        },
        {
          structureId: midStructure.id,
          componentId: pfComponent.id,
          percentage: 12,
          baseComponent: 'BASIC',
          order: 5,
        },
        {
          structureId: midStructure.id,
          componentId: ptComponent.id,
          value: 200,
          order: 6,
        },
      ]

      for (const component of midComponents) {
        await prisma.salaryStructureComponent.upsert({
          where: {
            structureId_componentId: {
              structureId: component.structureId,
              componentId: component.componentId,
            },
          },
          update: component,
          create: component,
        })
      }

      console.log('✅ Created sample salary structures')
    }
  }

  console.log('🎉 Payroll data seeding completed!')
}

export default seedPayrollData