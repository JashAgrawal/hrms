import { z } from 'zod'

// Performance Review Schemas
export const performanceReviewSchema = z.object({
  employeeId: z.string().cuid(),
  cycleId: z.string().cuid().optional(),
  period: z.string().min(1),
  type: z.enum(['QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'PROBATION', 'MID_YEAR', 'PROJECT_BASED']).default('ANNUAL'),
  status: z.enum(['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'COMPLETED', 'CALIBRATED', 'PUBLISHED']).default('DRAFT'),
  selfRating: z.record(z.number().min(1).max(5)).optional(),
  managerRating: z.record(z.number().min(1).max(5)).optional(),
  peerRating: z.record(z.number().min(1).max(5)).optional(),
  subordinateRating: z.record(z.number().min(1).max(5)).optional(),
  goals: z.any().optional(),
  achievements: z.array(z.string()).optional(),
  developmentAreas: z.array(z.string()).optional(),
  feedback: z.string().optional(),
  overallRating: z.number().min(1).max(5).optional(),
  calibrationRating: z.number().min(1).max(5).optional(),
  dueDate: z.string().datetime().optional(),
})

export const createPerformanceReviewSchema = performanceReviewSchema.omit({
  status: true,
  selfRating: true,
  managerRating: true,
  peerRating: true,
  subordinateRating: true,
  overallRating: true,
  calibrationRating: true,
})

export const updatePerformanceReviewSchema = performanceReviewSchema.partial()

// Performance Cycle Schemas
export const performanceCycleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'PROBATION', 'MID_YEAR', 'PROJECT_BASED']).default('ANNUAL'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  status: z.enum(['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'CALIBRATION', 'COMPLETED', 'ARCHIVED']).default('DRAFT'),
  template: z.record(z.any()).optional(),
})

export const createPerformanceCycleSchema = performanceCycleSchema.omit({ status: true })
export const updatePerformanceCycleSchema = performanceCycleSchema.partial()

// Objective Schemas
export const objectiveSchema = z.object({
  employeeId: z.string().cuid(),
  reviewId: z.string().cuid().optional(),
  cycleId: z.string().cuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(['INDIVIDUAL', 'TEAM', 'DEPARTMENT', 'COMPANY', 'PROJECT']).default('INDIVIDUAL'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  weight: z.number().min(0).max(100).default(25),
  status: z.enum(['DRAFT', 'ACTIVE', 'ON_TRACK', 'AT_RISK', 'BEHIND', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
  progress: z.number().min(0).max(100).default(0),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  parentId: z.string().cuid().optional(),
  alignedTo: z.string().optional(),
})

export const createObjectiveSchema = objectiveSchema.omit({ status: true, progress: true })
export const updateObjectiveSchema = objectiveSchema.partial()

// Key Result Schemas
export const keyResultSchema = z.object({
  objectiveId: z.string().cuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['QUANTITATIVE', 'QUALITATIVE', 'MILESTONE', 'BINARY']).default('QUANTITATIVE'),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().optional(),
  targetDate: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'DEFERRED']).default('ACTIVE'),
  progress: z.number().min(0).max(100).default(0),
  weight: z.number().min(0).max(100).default(25),
})

export const createKeyResultSchema = keyResultSchema.omit({ currentValue: true, status: true, progress: true })
export const updateKeyResultSchema = keyResultSchema.partial()

// Objective Update Schemas
export const objectiveUpdateSchema = z.object({
  objectiveId: z.string().cuid(),
  progress: z.number().min(0).max(100),
  comments: z.string().optional(),
  challenges: z.string().optional(),
  nextSteps: z.string().optional(),
  updateDate: z.string().datetime(),
})

// Key Result Update Schemas
export const keyResultUpdateSchema = z.object({
  keyResultId: z.string().cuid(),
  currentValue: z.number(),
  progress: z.number().min(0).max(100),
  comments: z.string().optional(),
  evidence: z.array(z.string()).optional(), // URLs or file references
  updateDate: z.string().datetime(),
})

// Feedback Schemas
export const feedbackSchema = z.object({
  reviewId: z.string().cuid().optional(),
  employeeId: z.string().cuid(),
  reviewerId: z.string().cuid(),
  reviewerType: z.enum(['SELF', 'MANAGER', 'PEER', 'SUBORDINATE', 'EXTERNAL', 'SKIP_LEVEL']),
  relationship: z.string().optional(),
  isAnonymous: z.boolean().default(false),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'OVERDUE']).default('PENDING'),
  responses: z.record(z.any()).optional(),
  overallRating: z.number().min(1).max(5).optional(),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  comments: z.string().optional(),
  dueDate: z.string().datetime().optional(),
})

export const createFeedbackSchema = feedbackSchema.omit({ 
  status: true, 
  responses: true, 
  overallRating: true, 
  strengths: true, 
  improvements: true, 
  comments: true 
})

export const updateFeedbackSchema = feedbackSchema.partial()

// Feedback Template Schemas
export const feedbackQuestionSchema = z.object({
  question: z.string().min(1),
  type: z.enum(['RATING', 'TEXT', 'MULTIPLE_CHOICE', 'YES_NO', 'SCALE']).default('RATING'),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().default(true),
  category: z.string().optional(),
})

export const feedbackTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  reviewerType: z.enum(['SELF', 'MANAGER', 'PEER', 'SUBORDINATE', 'EXTERNAL', 'SKIP_LEVEL']),
  isActive: z.boolean().default(true),
  questions: z.array(feedbackQuestionSchema),
})

export const createFeedbackTemplateSchema = feedbackTemplateSchema
export const updateFeedbackTemplateSchema = feedbackTemplateSchema.partial()

// Validation helper functions
export function validateDateRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return start < end
}

export function validateObjectiveWeight(objectives: { weight: number }[]): boolean {
  const totalWeight = objectives.reduce((sum, obj) => sum + obj.weight, 0)
  return totalWeight <= 100
}

export function validateKeyResultWeight(keyResults: { weight: number }[]): boolean {
  const totalWeight = keyResults.reduce((sum, kr) => sum + kr.weight, 0)
  return totalWeight <= 100
}

// Type exports
export type PerformanceReview = z.infer<typeof performanceReviewSchema>
export type CreatePerformanceReview = z.infer<typeof createPerformanceReviewSchema>
export type UpdatePerformanceReview = z.infer<typeof updatePerformanceReviewSchema>

export type PerformanceCycle = z.infer<typeof performanceCycleSchema>
export type CreatePerformanceCycle = z.infer<typeof createPerformanceCycleSchema>
export type UpdatePerformanceCycle = z.infer<typeof updatePerformanceCycleSchema>

export type Objective = z.infer<typeof objectiveSchema>
export type CreateObjective = z.infer<typeof createObjectiveSchema>
export type UpdateObjective = z.infer<typeof updateObjectiveSchema>

export type KeyResult = z.infer<typeof keyResultSchema>
export type CreateKeyResult = z.infer<typeof createKeyResultSchema>
export type UpdateKeyResult = z.infer<typeof updateKeyResultSchema>

export type ObjectiveUpdate = z.infer<typeof objectiveUpdateSchema>
export type KeyResultUpdate = z.infer<typeof keyResultUpdateSchema>

export type Feedback = z.infer<typeof feedbackSchema>
export type CreateFeedback = z.infer<typeof createFeedbackSchema>
export type UpdateFeedback = z.infer<typeof updateFeedbackSchema>

export type FeedbackTemplate = z.infer<typeof feedbackTemplateSchema>
export type CreateFeedbackTemplate = z.infer<typeof createFeedbackTemplateSchema>
export type UpdateFeedbackTemplate = z.infer<typeof updateFeedbackTemplateSchema>

export type FeedbackQuestion = z.infer<typeof feedbackQuestionSchema>