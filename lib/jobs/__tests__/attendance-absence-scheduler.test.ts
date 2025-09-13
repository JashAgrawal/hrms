import { describe, it, expect, beforeEach, vi } from 'vitest'
import { markAbsentForMissingCheckout, getAbsenceMarkingPreview } from '../attendance-absence-scheduler'

// Mock Prisma
const mockPrisma = {
  attendanceRecord: {
    findMany: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}

// Mock the prisma import
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

describe('Attendance Absence Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('markAbsentForMissingCheckout', () => {
    it('should skip processing if current time is before cutoff time', async () => {
      // Set target date to a future date to simulate running before cutoff
      const futureDate = new Date()
      futureDate.setHours(10, 0, 0, 0) // 10 AM, before 12 PM cutoff

      const result = await markAbsentForMissingCheckout(futureDate)

      expect(result.success).toBe(true)
      expect(result.processed).toBe(0)
      expect(result.summary.totalRecordsFound).toBe(0)
      expect(mockPrisma.attendanceRecord.findMany).not.toHaveBeenCalled()
    })

    it('should process attendance records after cutoff time', async () => {
      // Mock attendance records
      const mockAttendanceRecords = [
        {
          id: 'record1',
          checkIn: new Date('2024-01-01T09:00:00Z'),
          checkOut: null,
          status: 'PRESENT',
          notes: null,
          employee: {
            id: 'emp1',
            employeeCode: 'EMP001',
            firstName: 'John',
            lastName: 'Doe',
            status: 'ACTIVE',
          },
        },
        {
          id: 'record2',
          checkIn: new Date('2024-01-01T08:30:00Z'),
          checkOut: null,
          status: 'LATE',
          notes: 'Late arrival',
          employee: {
            id: 'emp2',
            employeeCode: 'EMP002',
            firstName: 'Jane',
            lastName: 'Smith',
            status: 'ACTIVE',
          },
        },
      ]

      mockPrisma.attendanceRecord.findMany.mockResolvedValue(mockAttendanceRecords)
      mockPrisma.attendanceRecord.update.mockResolvedValue({})
      mockPrisma.auditLog.create.mockResolvedValue({})

      // Set target date to past date to simulate running after cutoff
      const pastDate = new Date('2024-01-01T13:00:00Z') // 1 PM, after 12 PM cutoff

      const result = await markAbsentForMissingCheckout(pastDate)

      expect(result.success).toBe(true)
      expect(result.processed).toBe(2)
      expect(result.summary.totalRecordsFound).toBe(2)
      expect(result.summary.successful).toBe(2)
      expect(result.summary.failed).toBe(0)
      expect(result.summary.skipped).toBe(0)

      // Verify database calls
      expect(mockPrisma.attendanceRecord.findMany).toHaveBeenCalledWith({
        where: {
          date: new Date('2024-01-01T00:00:00.000Z'),
          checkIn: { not: null },
          checkOut: null,
          status: { notIn: ['ABSENT', 'ON_LEAVE', 'HOLIDAY'] },
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
        },
      })

      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledTimes(2)
      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2)
    })

    it('should skip inactive employees', async () => {
      const mockAttendanceRecords = [
        {
          id: 'record1',
          checkIn: new Date('2024-01-01T09:00:00Z'),
          checkOut: null,
          status: 'PRESENT',
          notes: null,
          employee: {
            id: 'emp1',
            employeeCode: 'EMP001',
            firstName: 'John',
            lastName: 'Doe',
            status: 'INACTIVE', // Inactive employee
          },
        },
      ]

      mockPrisma.attendanceRecord.findMany.mockResolvedValue(mockAttendanceRecords)

      const pastDate = new Date('2024-01-01T13:00:00Z')
      const result = await markAbsentForMissingCheckout(pastDate)

      expect(result.success).toBe(true)
      expect(result.processed).toBe(0)
      expect(result.summary.successful).toBe(0)
      expect(result.summary.skipped).toBe(1)

      // Should not update inactive employee
      expect(mockPrisma.attendanceRecord.update).not.toHaveBeenCalled()
    })

    it('should skip employees who checked in after cutoff time', async () => {
      const mockAttendanceRecords = [
        {
          id: 'record1',
          checkIn: new Date('2024-01-01T13:00:00Z'), // Checked in after 12 PM
          checkOut: null,
          status: 'PRESENT',
          notes: null,
          employee: {
            id: 'emp1',
            employeeCode: 'EMP001',
            firstName: 'John',
            lastName: 'Doe',
            status: 'ACTIVE',
          },
        },
      ]

      mockPrisma.attendanceRecord.findMany.mockResolvedValue(mockAttendanceRecords)

      const pastDate = new Date('2024-01-01T14:00:00Z') // 2 PM
      const result = await markAbsentForMissingCheckout(pastDate)

      expect(result.success).toBe(true)
      expect(result.processed).toBe(0)
      expect(result.summary.successful).toBe(0)
      expect(result.summary.skipped).toBe(1)

      // Should not update employee who checked in after cutoff
      expect(mockPrisma.attendanceRecord.update).not.toHaveBeenCalled()
    })
  })

  describe('getAbsenceMarkingPreview', () => {
    it('should return preview data correctly', async () => {
      const mockAttendanceRecords = [
        {
          id: 'record1',
          checkIn: new Date('2024-01-01T09:00:00Z'),
          checkOut: null,
          status: 'PRESENT',
          employee: {
            employeeCode: 'EMP001',
            firstName: 'John',
            lastName: 'Doe',
            status: 'ACTIVE',
          },
        },
        {
          id: 'record2',
          checkIn: new Date('2024-01-01T08:30:00Z'),
          checkOut: new Date('2024-01-01T17:00:00Z'),
          status: 'PRESENT',
          employee: {
            employeeCode: 'EMP002',
            firstName: 'Jane',
            lastName: 'Smith',
            status: 'ACTIVE',
          },
        },
        {
          id: 'record3',
          checkIn: new Date('2024-01-01T09:15:00Z'),
          checkOut: null,
          status: 'ABSENT',
          employee: {
            employeeCode: 'EMP003',
            firstName: 'Bob',
            lastName: 'Johnson',
            status: 'ACTIVE',
          },
        },
      ]

      mockPrisma.attendanceRecord.findMany.mockResolvedValue(mockAttendanceRecords)

      const targetDate = new Date('2024-01-01')
      const result = await getAbsenceMarkingPreview(targetDate)

      expect(result.totalRecords).toBe(3)
      expect(result.eligibleForMarking).toBe(1) // Only EMP001 is eligible
      expect(result.alreadyProcessed).toBe(1) // EMP003 is already absent
      expect(result.employees).toHaveLength(1)
      expect(result.employees[0].employeeCode).toBe('EMP001')
      expect(result.employees[0].employeeName).toBe('John Doe')
    })
  })
})
