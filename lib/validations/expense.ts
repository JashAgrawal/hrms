import { z } from 'zod'

// Expense Category Schemas
export const expenseCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  code: z.string().min(1, 'Code is required').max(20, 'Code too long').regex(/^[A-Z0-9_]+$/, 'Code must contain only uppercase letters, numbers, and underscores'),
  description: z.string().max(500, 'Description too long').optional(),
  maxAmount: z.number().positive('Maximum amount must be positive').optional(),
  requiresReceipt: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  approvalLevels: z.number().int().min(1, 'At least 1 approval level required').max(5, 'Maximum 5 approval levels').default(1),
})

export const updateExpenseCategorySchema = expenseCategorySchema.partial().omit({ code: true })

// Expense Policy Rule Schemas
export const expensePolicyRuleSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  ruleType: z.enum(['AMOUNT_LIMIT', 'FREQUENCY_LIMIT', 'APPROVAL_REQUIRED', 'RECEIPT_REQUIRED', 'GPS_REQUIRED']),
  ruleValue: z.record(z.any()), // Flexible JSON object for rule configuration
})

// Expense Claim Schemas
export const expenseClaimSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  amount: z.number().positive('Amount must be positive').max(1000000, 'Amount too large'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('INR'),
  expenseDate: z.date().max(new Date(), 'Expense date cannot be in the future'),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional(),
    accuracy: z.number().optional(),
  }).optional(),
  merchantName: z.string().max(200, 'Merchant name too long').optional(),
  merchantAddress: z.string().max(500, 'Merchant address too long').optional(),
  billNumber: z.string().max(100, 'Bill number too long').optional(),
  taxAmount: z.number().min(0, 'Tax amount cannot be negative').optional(),
  taxRate: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%').optional(),
  distanceTraveled: z.number().min(0, 'Distance cannot be negative').optional(),
  vehicleNumber: z.string().max(20, 'Vehicle number too long').optional(),
  travelRequestId: z.string().optional(),
})

export const updateExpenseClaimSchema = expenseClaimSchema.partial().omit({ categoryId: true })

// Expense Approval Schemas
export const expenseApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().max(1000, 'Comments too long').optional(),
})

// Travel Request Schemas
export const travelRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  purpose: z.string().min(1, 'Purpose is required').max(500, 'Purpose too long'),
  destination: z.string().min(1, 'Destination is required').max(200, 'Destination too long'),
  fromLocation: z.string().min(1, 'From location is required').max(200, 'From location too long'),
  startDate: z.date().min(new Date(), 'Start date must be in the future'),
  endDate: z.date(),
  estimatedCost: z.number().positive('Estimated cost must be positive').max(1000000, 'Estimated cost too large'),
  travelMode: z.enum(['FLIGHT', 'TRAIN', 'BUS', 'CAR', 'TAXI', 'OTHER']).default('FLIGHT'),
  accommodationRequired: z.boolean().default(false),
  advanceRequired: z.boolean().default(false),
  advanceAmount: z.number().positive('Advance amount must be positive').optional(),
  itinerary: z.array(z.object({
    date: z.date(),
    location: z.string(),
    activity: z.string(),
    estimatedCost: z.number().optional(),
  })).optional(),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
}).refine((data) => !data.advanceRequired || data.advanceAmount, {
  message: 'Advance amount is required when advance is requested',
  path: ['advanceAmount'],
})

export const updateTravelRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  purpose: z.string().min(1, 'Purpose is required').max(500, 'Purpose too long').optional(),
  destination: z.string().min(1, 'Destination is required').optional(),
  fromLocation: z.string().min(1, 'From location is required').optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  estimatedCost: z.number().positive('Estimated cost must be positive').optional(),
  travelMode: z.enum(['FLIGHT', 'TRAIN', 'BUS', 'CAR', 'TAXI', 'OTHER']).optional(),
  accommodationRequired: z.boolean().optional(),
  advanceRequired: z.boolean().optional(),
  advanceAmount: z.number().optional(),
  itinerary: z.array(z.object({
    date: z.date(),
    location: z.string().min(1, 'Location is required'),
    activity: z.string().min(1, 'Activity is required'),
    estimatedCost: z.number().optional(),
    notes: z.string().optional(),
  })).optional(),
})

// Travel Approval Schemas
export const travelApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().max(1000, 'Comments too long').optional(),
})

// Petrol Expense Configuration Schemas
export const petrolExpenseConfigSchema = z.object({
  ratePerKm: z.number().positive('Rate per km must be positive').max(1000, 'Rate too high'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('INR'),
  effectiveFrom: z.date().optional(),
})

// Monthly Petrol Expense Schemas
export const monthlyPetrolExpenseSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  month: z.number().int().min(1, 'Month must be 1-12').max(12, 'Month must be 1-12'),
  year: z.number().int().min(2020, 'Year too old').max(2030, 'Year too far in future'),
  totalDistance: z.number().min(0, 'Distance cannot be negative').max(10000, 'Distance too large'),
  ratePerKm: z.number().positive('Rate per km must be positive'),
})

// File Upload Schemas
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
}).refine((data) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  return allowedTypes.includes(data.file.type)
}, {
  message: 'Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed',
}).refine((data) => {
  const maxSize = 10 * 1024 * 1024 // 10MB
  return data.file.size <= maxSize
}, {
  message: 'File size too large. Maximum size is 10MB',
})

// Query Parameter Schemas
export const expenseClaimQuerySchema = z.object({
  employeeId: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED', 'CANCELLED']).optional(),
  categoryId: z.string().optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional(),
  page: z.string().transform((str) => parseInt(str, 10)).default('1'),
  limit: z.string().transform((str) => parseInt(str, 10)).default('10'),
  sortBy: z.enum(['createdAt', 'expenseDate', 'amount', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const travelRequestQuerySchema = z.object({
  employeeId: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED']).optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional(),
  page: z.string().transform((str) => parseInt(str, 10)).default('1'),
  limit: z.string().transform((str) => parseInt(str, 10)).default('10'),
  sortBy: z.enum(['createdAt', 'startDate', 'estimatedCost', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Expense Policy Validation Functions
export const validateExpensePolicy = (
  claim: z.infer<typeof expenseClaimSchema>,
  category: any,
  policyRules: any[]
): string[] => {
  const violations: string[] = []

  // Check category max amount
  if (category.maxAmount && claim.amount > category.maxAmount) {
    violations.push(`Amount exceeds category limit of ${category.maxAmount} ${claim.currency}`)
  }

  // Check policy rules
  for (const rule of policyRules) {
    const ruleValue = rule.ruleValue as any

    switch (rule.ruleType) {
      case 'AMOUNT_LIMIT':
        if (ruleValue.maxAmount && claim.amount > ruleValue.maxAmount) {
          violations.push(`Amount exceeds policy limit of ${ruleValue.maxAmount} ${claim.currency}`)
        }
        break

      case 'RECEIPT_REQUIRED':
        if (ruleValue.required && !claim.billNumber) {
          violations.push('Receipt/bill number is required for this expense category')
        }
        break

      case 'GPS_REQUIRED':
        if (ruleValue.required && !claim.location) {
          violations.push('GPS location is required for this expense category')
        }
        break

      case 'FREQUENCY_LIMIT':
        // This would require checking existing claims in the database
        // Implementation would be in the API endpoint
        break
    }
  }

  return violations
}

// Type exports
export type ExpenseClaimInput = z.infer<typeof expenseClaimSchema>
export type UpdateExpenseClaimInput = z.infer<typeof updateExpenseClaimSchema>
export type ExpenseApprovalInput = z.infer<typeof expenseApprovalSchema>
export type TravelRequestInput = z.infer<typeof travelRequestSchema>
export type UpdateTravelRequestInput = z.infer<typeof updateTravelRequestSchema>
export type TravelApprovalInput = z.infer<typeof travelApprovalSchema>
export type PetrolExpenseConfigInput = z.infer<typeof petrolExpenseConfigSchema>
export type ExpenseClaimQuery = z.infer<typeof expenseClaimQuerySchema>
export type TravelRequestQuery = z.infer<typeof travelRequestQuerySchema>