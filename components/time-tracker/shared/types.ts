// Shared types for the Time Tracker module

export interface Project {
  id: string
  name: string
  code: string
  description?: string
  clientName?: string
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED'
  startDate: string
  endDate?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
  _count?: {
    timeEntries: number
  }
}

export interface TimeEntry {
  id?: string
  date: string
  startTime?: string
  endTime?: string
  breakDuration: number
  projectId?: string
  taskDescription?: string
  billableHours: number
  nonBillableHours: number
  overtimeHours: number
  isRunning?: boolean
  location?: {
    latitude: number
    longitude: number
    address?: string
  }
  project?: {
    id: string
    name: string
    code: string
  }
}

export interface Timesheet {
  id: string
  employeeId: string
  startDate: string
  endDate: string
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  totalHours: number
  billableHours: number
  nonBillableHours: number
  overtimeHours: number
  submittedAt?: string
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectionReason?: string
  comments?: string
  createdAt: string
  updatedAt: string
  entries: TimeEntry[]
  employee: {
    id: string
    firstName: string
    lastName: string
    email: string
    employeeId: string
    department?: { name: string }
  }
  approver?: {
    id: string
    name: string
  }
}

export interface TimesheetTemplate {
  id: string
  name: string
  description?: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  entries: Array<{
    id: string
    startTime: string
    endTime: string
    breakDuration: number
    projectId?: string
    taskDescription?: string
    billableHours: number
    nonBillableHours: number
    overtimeHours: number
    dayOfWeek: number
    project?: {
      id: string
      name: string
      code: string
    }
  }>
}

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
    status: string
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

// Form data types
export interface TimesheetFormData {
  startDate: string
  endDate: string
  entries: TimeEntry[]
}

export interface ProjectFormData {
  name: string
  code: string
  description?: string
  clientName?: string
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED'
  startDate: string
  endDate?: string
}

// API response types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export type TimesheetListResponse = PaginatedResponse<Timesheet>
export type ProjectListResponse = PaginatedResponse<Project>

// Filter and query types
export interface TimesheetFilters {
  startDate?: string
  endDate?: string
  employeeId?: string
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  projectId?: string
  page?: number
  limit?: number
}

export interface ProjectFilters {
  status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED'
  search?: string
  page?: number
  limit?: number
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
