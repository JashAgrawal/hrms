// Time Tracker types using Prisma client types directly
import { 
  Project, 
  Timesheet, 
  TimeEntry, 
  ProjectStatus, 
  TimesheetStatus,
  Employee,
  User,
  Department
} from '@prisma/client'

// Extended types with relations
export type ProjectWithCount = Project & {
  _count?: {
    timeEntries: number
  }
}

export type TimeEntryWithProject = TimeEntry & {
  project?: {
    id: string
    name: string
    code: string
  }
}

export type TimesheetWithRelations = Timesheet & {
  employee: Employee & {
    department?: Department | null
  }
  approver?: User | null
  entries: TimeEntryWithProject[]
}

export type EmployeeBasic = {
  id: string
  firstName: string
  lastName: string
  email: string
  employeeId: string
  department?: { name: string } | null
}

export type TimesheetWithEmployee = Timesheet & {
  employee: EmployeeBasic
  approver?: {
    id: string
    name: string | null
  } | null
  entries: TimeEntryWithProject[]
}

// Form data types using Prisma enums
export interface TimesheetFormData {
  startDate: string
  endDate: string
  entries: Omit<TimeEntry, 'id' | 'timesheetId' | 'employeeId' | 'createdAt' | 'updatedAt' | 'isApproved'>[]
}

export interface ProjectFormData {
  name: string
  code: string
  description?: string
  clientName?: string
  status: ProjectStatus
  startDate: string
  endDate?: string
}

// API response types
export interface PaginatedResponse<T> {
  data?: T[]
  projects?: T[] // For projects API
  timesheets?: T[] // For timesheets API
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export type TimesheetListResponse = PaginatedResponse<TimesheetWithEmployee>
export type ProjectListResponse = PaginatedResponse<ProjectWithCount>

// Filter and query types using Prisma enums
export interface TimesheetFilters {
  startDate?: string
  endDate?: string
  employeeId?: string
  status?: TimesheetStatus
  projectId?: string
  page?: number
  limit?: number
}

export interface ProjectFilters {
  status?: ProjectStatus
  search?: string
  page?: number
  limit?: number
}

// Analytics types
export interface TimesheetAnalytics {
  totalHours: number
  billableHours: number
  nonBillableHours: number
  overtimeHours: number
  projectBreakdown: Array<{
    projectId: string
    projectName: string
    hours: number
    percentage: number
  }>
  trends: Array<{
    date: string
    billableHours: number
    nonBillableHours: number
    overtimeHours: number
  }>
  statusDistribution: Array<{
    status: TimesheetStatus
    count: number
    percentage: number
  }>
}

export interface ProjectAnalytics {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  totalHours: number
  utilizationRate: number
  projectUtilization: Array<{
    projectId: string
    projectName: string
    totalHours: number
    utilizationPercentage: number
  }>
}

// Component prop types
export interface TimeTrackerPermissions {
  canCreateProject: boolean
  canEditProject: boolean
  canDeleteProject: boolean
  canViewAllProjects: boolean
  canCreateTimesheet: boolean
  canEditTimesheet: boolean
  canDeleteTimesheet: boolean
  canViewAllTimesheets: boolean
  canApproveTimesheet: boolean
  canRejectTimesheet: boolean
}

// Re-export Prisma types for convenience
export { 
  ProjectStatus, 
  TimesheetStatus 
} from '@prisma/client'