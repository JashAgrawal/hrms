import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import seedPayrollData from './seed-payroll'
import seedEmployees from './seed-employees'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create roles first
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: {
        name: 'Administrator',
        code: 'ADMIN',
        description: 'System administrator with full access',
      },
    }),
    prisma.role.upsert({
      where: { code: 'HR' },
      update: {},
      create: {
        name: 'HR Manager',
        code: 'HR',
        description: 'Human resources manager',
      },
    }),
    prisma.role.upsert({
      where: { code: 'MANAGER' },
      update: {},
      create: {
        name: 'Manager',
        code: 'MANAGER',
        description: 'Team manager with approval rights',
      },
    }),
    prisma.role.upsert({
      where: { code: 'FINANCE' },
      update: {},
      create: {
        name: 'Finance Officer',
        code: 'FINANCE',
        description: 'Finance and payroll officer',
      },
    }),
    prisma.role.upsert({
      where: { code: 'EMPLOYEE' },
      update: {},
      create: {
        name: 'Employee',
        code: 'EMPLOYEE',
        description: 'Regular employee',
      },
    }),
  ])

  console.log('✅ Roles created')

  // Create permissions
  const permissions = await Promise.all([
    // Employee management permissions
    prisma.permission.upsert({
      where: { code: 'EMPLOYEE_CREATE' },
      update: {},
      create: {
        name: 'Create Employee',
        code: 'EMPLOYEE_CREATE',
        module: 'HR',
        action: 'CREATE',
        resource: 'EMPLOYEE',
        description: 'Create new employee records',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'EMPLOYEE_READ' },
      update: {},
      create: {
        name: 'View Employee',
        code: 'EMPLOYEE_READ',
        module: 'HR',
        action: 'READ',
        resource: 'EMPLOYEE',
        description: 'View employee information',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'EMPLOYEE_UPDATE' },
      update: {},
      create: {
        name: 'Update Employee',
        code: 'EMPLOYEE_UPDATE',
        module: 'HR',
        action: 'UPDATE',
        resource: 'EMPLOYEE',
        description: 'Update employee information',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'EMPLOYEE_DELETE' },
      update: {},
      create: {
        name: 'Delete Employee',
        code: 'EMPLOYEE_DELETE',
        module: 'HR',
        action: 'DELETE',
        resource: 'EMPLOYEE',
        description: 'Delete employee records',
      },
    }),
    // Attendance permissions
    prisma.permission.upsert({
      where: { code: 'ATTENDANCE_MARK' },
      update: {},
      create: {
        name: 'Mark Attendance',
        code: 'ATTENDANCE_MARK',
        module: 'ATTENDANCE',
        action: 'CREATE',
        resource: 'ATTENDANCE',
        description: 'Mark own attendance',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'ATTENDANCE_VIEW_ALL' },
      update: {},
      create: {
        name: 'View All Attendance',
        code: 'ATTENDANCE_VIEW_ALL',
        module: 'ATTENDANCE',
        action: 'READ',
        resource: 'ATTENDANCE',
        description: 'View all employee attendance',
      },
    }),
    // Leave permissions
    prisma.permission.upsert({
      where: { code: 'LEAVE_APPLY' },
      update: {},
      create: {
        name: 'Apply Leave',
        code: 'LEAVE_APPLY',
        module: 'LEAVE',
        action: 'CREATE',
        resource: 'LEAVE',
        description: 'Apply for leave',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'LEAVE_APPROVE' },
      update: {},
      create: {
        name: 'Approve Leave',
        code: 'LEAVE_APPROVE',
        module: 'LEAVE',
        action: 'APPROVE',
        resource: 'LEAVE',
        description: 'Approve leave requests',
      },
    }),
    // Payroll permissions
    prisma.permission.upsert({
      where: { code: 'PAYROLL_PROCESS' },
      update: {},
      create: {
        name: 'Process Payroll',
        code: 'PAYROLL_PROCESS',
        module: 'PAYROLL',
        action: 'CREATE',
        resource: 'PAYROLL',
        description: 'Process monthly payroll',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'PAYROLL_VIEW' },
      update: {},
      create: {
        name: 'View Payroll',
        code: 'PAYROLL_VIEW',
        module: 'PAYROLL',
        action: 'READ',
        resource: 'PAYROLL',
        description: 'View payroll information',
      },
    }),
  ])

  console.log('✅ Permissions created')

  // Assign permissions to roles
  const adminRole = roles.find(r => r.code === 'ADMIN')!
  const hrRole = roles.find(r => r.code === 'HR')!
  const managerRole = roles.find(r => r.code === 'MANAGER')!
  const financeRole = roles.find(r => r.code === 'FINANCE')!
  const employeeRole = roles.find(r => r.code === 'EMPLOYEE')!

  // Admin gets all permissions
  await Promise.all(
    permissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // HR role permissions
  const hrPermissions = permissions.filter(p => 
    ['EMPLOYEE_CREATE', 'EMPLOYEE_READ', 'EMPLOYEE_UPDATE', 'ATTENDANCE_VIEW_ALL', 'LEAVE_APPROVE'].includes(p.code)
  )
  await Promise.all(
    hrPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: hrRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: hrRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // Manager role permissions
  const managerPermissions = permissions.filter(p => 
    ['EMPLOYEE_READ', 'ATTENDANCE_VIEW_ALL', 'LEAVE_APPROVE'].includes(p.code)
  )
  await Promise.all(
    managerPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: managerRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: managerRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // Finance role permissions
  const financePermissions = permissions.filter(p => 
    ['PAYROLL_PROCESS', 'PAYROLL_VIEW', 'EMPLOYEE_READ'].includes(p.code)
  )
  await Promise.all(
    financePermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: financeRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: financeRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // Employee role permissions
  const empPermissions = permissions.filter(p => 
    ['ATTENDANCE_MARK', 'LEAVE_APPLY'].includes(p.code)
  )
  await Promise.all(
    empPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: employeeRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: employeeRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  console.log('✅ Role permissions assigned')

  // Create departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: 'ENG' },
      update: {},
      create: {
        name: 'Engineering',
        code: 'ENG',
        description: 'Software development and engineering team',
      },
    }),
    prisma.department.upsert({
      where: { code: 'HR' },
      update: {},
      create: {
        name: 'Human Resources',
        code: 'HR',
        description: 'Human resources and people operations',
      },
    }),
    prisma.department.upsert({
      where: { code: 'FIN' },
      update: {},
      create: {
        name: 'Finance',
        code: 'FIN',
        description: 'Finance and accounting department',
      },
    }),
    prisma.department.upsert({
      where: { code: 'MKT' },
      update: {},
      create: {
        name: 'Marketing',
        code: 'MKT',
        description: 'Marketing and business development',
      },
    }),
  ])

  console.log('✅ Departments created')

  // Create leave policies
  await Promise.all([
    prisma.leavePolicy.upsert({
      where: { name: 'Annual Leave' },
      update: {},
      create: {
        name: 'Annual Leave',
        code: 'AL',
        type: 'ANNUAL',
        description: 'Annual vacation leave for all employees',
        daysPerYear: 21,
        carryForward: true,
        maxCarryForward: 5,
        maxConsecutiveDays: 15,
        minAdvanceNotice: 7,
        requiresApproval: true,
        approvalLevels: 1,
        accrualType: 'ANNUAL',
        probationPeriodDays: 90,
        isEncashable: true,
        encashmentRate: 100.00,
      },
    }),
    prisma.leavePolicy.upsert({
      where: { name: 'Sick Leave' },
      update: {},
      create: {
        name: 'Sick Leave',
        code: 'SL',
        type: 'SICK',
        description: 'Medical leave for illness and health issues',
        daysPerYear: 12,
        carryForward: false,
        maxConsecutiveDays: 7,
        minAdvanceNotice: 0,
        requiresApproval: false,
        approvalLevels: 1,
        accrualType: 'ANNUAL',
        probationPeriodDays: 0,
        isEncashable: false,
      },
    }),
    prisma.leavePolicy.upsert({
      where: { name: 'Casual Leave' },
      update: {},
      create: {
        name: 'Casual Leave',
        code: 'CL',
        type: 'CASUAL',
        description: 'Short-term personal leave for urgent matters',
        daysPerYear: 12,
        carryForward: false,
        maxConsecutiveDays: 3,
        minAdvanceNotice: 1,
        requiresApproval: true,
        approvalLevels: 1,
        accrualType: 'MONTHLY',
        accrualRate: 1.00,
        probationPeriodDays: 30,
        isEncashable: false,
      },
    }),
  ])

  console.log('✅ Leave policies created')

  // Create locations for geo-fencing
  const locations = await Promise.all([
    prisma.location.upsert({
      where: { name: 'Head Office' },
      update: {},
      create: {
        name: 'Head Office',
        address: 'Tech Park, Bangalore, Karnataka, India',
        latitude: 12.9716,
        longitude: 77.5946,
        radius: 100, // 100 meters
        workingHours: {
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
          wednesday: { start: '09:00', end: '18:00' },
          thursday: { start: '09:00', end: '18:00' },
          friday: { start: '09:00', end: '18:00' },
          saturday: { start: '09:00', end: '14:00' },
          sunday: { closed: true },
        },
      },
    }),
    prisma.location.upsert({
      where: { name: 'Branch Office Mumbai' },
      update: {},
      create: {
        name: 'Branch Office Mumbai',
        address: 'BKC, Mumbai, Maharashtra, India',
        latitude: 19.0760,
        longitude: 72.8777,
        radius: 150,
        workingHours: {
          monday: { start: '09:30', end: '18:30' },
          tuesday: { start: '09:30', end: '18:30' },
          wednesday: { start: '09:30', end: '18:30' },
          thursday: { start: '09:30', end: '18:30' },
          friday: { start: '09:30', end: '18:30' },
          saturday: { closed: true },
          sunday: { closed: true },
        },
      },
    }),
  ])

  console.log('✅ Locations created')

  // Create office locations for employee assignment
  const officeLocations = await Promise.all([
    prisma.officeLocation.upsert({
      where: { code: 'HO' },
      update: {},
      create: {
        name: 'Head Office',
        code: 'HO',
        address: 'Tech Park, Whitefield, Bangalore, Karnataka, India',
        city: 'Bangalore',
        state: 'Karnataka',
        latitude: 12.9716,
        longitude: 77.5946,
        radius: 100,
        timezone: 'Asia/Kolkata',
        isHeadOffice: true,
        workingHours: {
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
          wednesday: { start: '09:00', end: '18:00' },
          thursday: { start: '09:00', end: '18:00' },
          friday: { start: '09:00', end: '18:00' },
          saturday: { start: '09:00', end: '14:00' },
          sunday: { closed: true },
        },
      },
    }),
    prisma.officeLocation.upsert({
      where: { code: 'MUM' },
      update: {},
      create: {
        name: 'Mumbai Branch',
        code: 'MUM',
        address: 'Bandra Kurla Complex, Mumbai, Maharashtra, India',
        city: 'Mumbai',
        state: 'Maharashtra',
        latitude: 19.0760,
        longitude: 72.8777,
        radius: 150,
        timezone: 'Asia/Kolkata',
        workingHours: {
          monday: { start: '09:30', end: '18:30' },
          tuesday: { start: '09:30', end: '18:30' },
          wednesday: { start: '09:30', end: '18:30' },
          thursday: { start: '09:30', end: '18:30' },
          friday: { start: '09:30', end: '18:30' },
          saturday: { closed: true },
          sunday: { closed: true },
        },
      },
    }),
    prisma.officeLocation.upsert({
      where: { code: 'DEL' },
      update: {},
      create: {
        name: 'Delhi Office',
        code: 'DEL',
        address: 'Connaught Place, New Delhi, Delhi, India',
        city: 'New Delhi',
        state: 'Delhi',
        latitude: 28.6139,
        longitude: 77.2090,
        radius: 120,
        timezone: 'Asia/Kolkata',
        workingHours: {
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
          wednesday: { start: '09:00', end: '18:00' },
          thursday: { start: '09:00', end: '18:00' },
          friday: { start: '09:00', end: '18:00' },
          saturday: { start: '10:00', end: '15:00' },
          sunday: { closed: true },
        },
      },
    }),
  ])

  console.log('✅ Office locations created')

  // Create attendance policies
  await Promise.all([
    prisma.attendancePolicy.upsert({
      where: { name: 'Standard Policy' },
      update: {},
      create: {
        name: 'Standard Policy',
        description: 'Standard 8-hour work day policy',
        workingHoursPerDay: 8.00,
        workingDaysPerWeek: 5,
        graceTimeMinutes: 15,
        halfDayThresholdHours: 4.00,
        overtimeThresholdHours: 8.00,
        allowFlexiTime: false,
        requireGeoFencing: true,
      },
    }),
    prisma.attendancePolicy.upsert({
      where: { name: 'Flexible Policy' },
      update: {},
      create: {
        name: 'Flexible Policy',
        description: 'Flexible working hours policy',
        workingHoursPerDay: 8.00,
        workingDaysPerWeek: 5,
        graceTimeMinutes: 30,
        halfDayThresholdHours: 4.00,
        overtimeThresholdHours: 9.00,
        allowFlexiTime: true,
        requireGeoFencing: false,
      },
    }),
  ])

  console.log('✅ Attendance policies created')

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12)
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@pekka-hr.com' },
    update: {},
    create: {
      email: 'admin@pekka-hr.com',
      name: 'System Administrator',
      password: hashedPassword,
      role: 'ADMIN',
      roleId: adminRole.id,
    },
  })

  await prisma.employee.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      employeeCode: 'EMP001',
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@pekka-hr.com',
      designation: 'System Administrator',
      departmentId: departments[1].id, // HR department
      joiningDate: new Date('2024-01-01'),
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      basicSalary: 100000,
      ctc: 120000,
      salaryGrade: 'L1',
    },
  })

  // Create HR user
  const hrPassword = await bcrypt.hash('hr123', 12)
  
  const hrUser = await prisma.user.upsert({
    where: { email: 'hr@pekka-hr.com' },
    update: {},
    create: {
      email: 'hr@pekka-hr.com',
      name: 'HR Manager',
      password: hrPassword,
      role: 'HR',
      roleId: hrRole.id,
    },
  })

  await prisma.employee.upsert({
    where: { userId: hrUser.id },
    update: {},
    create: {
      userId: hrUser.id,
      employeeCode: 'EMP002',
      firstName: 'HR',
      lastName: 'Manager',
      email: 'hr@pekka-hr.com',
      designation: 'HR Manager',
      departmentId: departments[1].id, // HR department
      joiningDate: new Date('2024-01-15'),
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      basicSalary: 80000,
      ctc: 95000,
      salaryGrade: 'L2',
    },
  })

  // Create sample employee
  const empPassword = await bcrypt.hash('emp123', 12)
  
  const empUser = await prisma.user.upsert({
    where: { email: 'john.doe@pekka-hr.com' },
    update: {},
    create: {
      email: 'john.doe@pekka-hr.com',
      name: 'John Doe',
      password: empPassword,
      role: 'EMPLOYEE',
      roleId: employeeRole.id,
    },
  })

  await prisma.employee.upsert({
    where: { userId: empUser.id },
    update: {},
    create: {
      userId: empUser.id,
      employeeCode: 'EMP003',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@pekka-hr.com',
      phone: '+91-9876543210',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'MALE',
      designation: 'Software Engineer',
      departmentId: departments[0].id, // Engineering department
      joiningDate: new Date('2024-02-01'),
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      basicSalary: 60000,
      ctc: 72000,
      salaryGrade: 'L3',
    },
  })

  console.log('✅ Users and employees created')

  // Create expense categories
  const expenseCategories = await Promise.all([
    prisma.expenseCategory.upsert({
      where: { code: 'TRAVEL' },
      update: {},
      create: {
        name: 'Travel',
        code: 'TRAVEL',
        description: 'Travel expenses including flights, trains, buses',
        maxAmount: 50000,
        requiresReceipt: true,
        requiresApproval: true,
        approvalLevels: 1,
      },
    }),
    prisma.expenseCategory.upsert({
      where: { code: 'PETROL' },
      update: {},
      create: {
        name: 'Petrol/Fuel',
        code: 'PETROL',
        description: 'Petrol and fuel expenses for official travel',
        maxAmount: 10000,
        requiresReceipt: false, // Auto-generated based on distance
        requiresApproval: true,
        approvalLevels: 1,
      },
    }),
    prisma.expenseCategory.upsert({
      where: { code: 'MEALS' },
      update: {},
      create: {
        name: 'Meals & Entertainment',
        code: 'MEALS',
        description: 'Food and entertainment expenses during official travel',
        maxAmount: 2000,
        requiresReceipt: true,
        requiresApproval: true,
        approvalLevels: 1,
      },
    }),
    prisma.expenseCategory.upsert({
      where: { code: 'ACCOMMODATION' },
      update: {},
      create: {
        name: 'Accommodation',
        code: 'ACCOMMODATION',
        description: 'Hotel and lodging expenses',
        maxAmount: 15000,
        requiresReceipt: true,
        requiresApproval: true,
        approvalLevels: 2, // Higher approval for accommodation
      },
    }),
    prisma.expenseCategory.upsert({
      where: { code: 'OFFICE_SUPPLIES' },
      update: {},
      create: {
        name: 'Office Supplies',
        code: 'OFFICE_SUPPLIES',
        description: 'Office supplies and stationery',
        maxAmount: 5000,
        requiresReceipt: true,
        requiresApproval: true,
        approvalLevels: 1,
      },
    }),
    prisma.expenseCategory.upsert({
      where: { code: 'TRAINING' },
      update: {},
      create: {
        name: 'Training & Development',
        code: 'TRAINING',
        description: 'Training courses, certifications, and conferences',
        maxAmount: 25000,
        requiresReceipt: true,
        requiresApproval: true,
        approvalLevels: 2,
      },
    }),
    prisma.expenseCategory.upsert({
      where: { code: 'OTHER' },
      update: {},
      create: {
        name: 'Other',
        code: 'OTHER',
        description: 'Miscellaneous business expenses',
        maxAmount: 3000,
        requiresReceipt: true,
        requiresApproval: true,
        approvalLevels: 1,
      },
    }),
  ])

  console.log('✅ Expense categories created')

  // Create expense policy rules
  const petrolCategory = expenseCategories.find(c => c.code === 'PETROL')!
  const travelCategory = expenseCategories.find(c => c.code === 'TRAVEL')!
  const accommodationCategory = expenseCategories.find(c => c.code === 'ACCOMMODATION')!

  await Promise.all([
    // Petrol expense frequency limit
    prisma.expensePolicyRule.create({
      data: {
        categoryId: petrolCategory.id,
        name: 'Monthly Frequency Limit',
        description: 'Maximum 1 petrol expense claim per month',
        ruleType: 'FREQUENCY_LIMIT',
        ruleValue: {
          maxPerMonth: 1,
          message: 'Only one petrol expense claim allowed per month'
        },
      },
    }),
    // Travel expense approval requirement
    prisma.expensePolicyRule.create({
      data: {
        categoryId: travelCategory.id,
        name: 'High Amount Approval',
        description: 'Expenses above ₹10,000 require additional approval',
        ruleType: 'APPROVAL_REQUIRED',
        ruleValue: {
          minAmount: 10000,
          levels: 2,
          message: 'Travel expenses above ₹10,000 require manager and HR approval'
        },
      },
    }),
    // Accommodation advance booking requirement
    prisma.expensePolicyRule.create({
      data: {
        categoryId: accommodationCategory.id,
        name: 'Advance Booking Required',
        description: 'Accommodation must be booked in advance',
        ruleType: 'APPROVAL_REQUIRED',
        ruleValue: {
          minAmount: 0,
          advanceBookingDays: 3,
          message: 'Accommodation must be booked at least 3 days in advance'
        },
      },
    }),
  ])

  console.log('✅ Expense policy rules created')

  // Create petrol expense configuration
  await prisma.petrolExpenseConfig.create({
    data: {
      ratePerKm: 12.50, // ₹12.50 per km
      currency: 'INR',
      effectiveFrom: new Date('2024-01-01'),
      createdBy: adminUser.id,
    },
  })

  console.log('✅ Petrol expense configuration created')

  // Add expense permissions
  const expensePermissions = await Promise.all([
    prisma.permission.upsert({
      where: { code: 'EXPENSE_CREATE' },
      update: {},
      create: {
        name: 'Create Expense',
        code: 'EXPENSE_CREATE',
        module: 'EXPENSE',
        action: 'CREATE',
        resource: 'EXPENSE',
        description: 'Create expense claims',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'EXPENSE_READ' },
      update: {},
      create: {
        name: 'View Expense',
        code: 'EXPENSE_READ',
        module: 'EXPENSE',
        action: 'READ',
        resource: 'EXPENSE',
        description: 'View expense claims',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'EXPENSE_UPDATE' },
      update: {},
      create: {
        name: 'Update Expense',
        code: 'EXPENSE_UPDATE',
        module: 'EXPENSE',
        action: 'UPDATE',
        resource: 'EXPENSE',
        description: 'Update expense claims',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'EXPENSE_APPROVE' },
      update: {},
      create: {
        name: 'Approve Expense',
        code: 'EXPENSE_APPROVE',
        module: 'EXPENSE',
        action: 'APPROVE',
        resource: 'EXPENSE',
        description: 'Approve expense claims',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'EXPENSE_REIMBURSE' },
      update: {},
      create: {
        name: 'Process Reimbursement',
        code: 'EXPENSE_REIMBURSE',
        module: 'EXPENSE',
        action: 'APPROVE',
        resource: 'REIMBURSEMENT',
        description: 'Process expense reimbursements',
      },
    }),
  ])

  // Assign expense permissions to roles
  // Admin gets all expense permissions
  await Promise.all(
    expensePermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // HR role gets expense approval and view permissions
  const hrExpensePermissions = expensePermissions.filter(p => 
    ['EXPENSE_READ', 'EXPENSE_APPROVE'].includes(p.code)
  )
  await Promise.all(
    hrExpensePermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: hrRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: hrRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // Manager role gets expense approval permissions
  const managerExpensePermissions = expensePermissions.filter(p => 
    ['EXPENSE_READ', 'EXPENSE_APPROVE'].includes(p.code)
  )
  await Promise.all(
    managerExpensePermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: managerRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: managerRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // Finance role gets reimbursement permissions
  const financeExpensePermissions = expensePermissions.filter(p => 
    ['EXPENSE_READ', 'EXPENSE_REIMBURSE'].includes(p.code)
  )
  await Promise.all(
    financeExpensePermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: financeRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: financeRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // Employee role gets create and read permissions
  const empExpensePermissions = expensePermissions.filter(p => 
    ['EXPENSE_CREATE', 'EXPENSE_READ', 'EXPENSE_UPDATE'].includes(p.code)
  )
  await Promise.all(
    empExpensePermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: employeeRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: employeeRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  console.log('✅ Expense permissions assigned')

  // Create sample projects
  const projects = await Promise.all([
    prisma.project.upsert({
      where: { code: 'PROJ001' },
      update: {},
      create: {
        name: 'E-commerce Platform Development',
        code: 'PROJ001',
        description: 'Development of a modern e-commerce platform with React and Node.js',
        clientName: 'TechCorp Solutions',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-06-30'),
        status: 'ACTIVE',
      },
    }),
    prisma.project.upsert({
      where: { code: 'PROJ002' },
      update: {},
      create: {
        name: 'Mobile Banking App',
        code: 'PROJ002',
        description: 'Cross-platform mobile banking application with advanced security features',
        clientName: 'SecureBank Ltd',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-08-15'),
        status: 'ACTIVE',
      },
    }),
    prisma.project.upsert({
      where: { code: 'PROJ003' },
      update: {},
      create: {
        name: 'HR Management System',
        code: 'PROJ003',
        description: 'Comprehensive HR management system with payroll and attendance tracking',
        clientName: 'Internal Project',
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE',
      },
    }),
    prisma.project.upsert({
      where: { code: 'PROJ004' },
      update: {},
      create: {
        name: 'Data Analytics Dashboard',
        code: 'PROJ004',
        description: 'Real-time analytics dashboard for business intelligence',
        clientName: 'DataViz Inc',
        startDate: new Date('2023-11-01'),
        endDate: new Date('2024-01-31'),
        status: 'COMPLETED',
      },
    }),
    prisma.project.upsert({
      where: { code: 'PROJ005' },
      update: {},
      create: {
        name: 'Cloud Migration Project',
        code: 'PROJ005',
        description: 'Migration of legacy systems to cloud infrastructure',
        clientName: 'CloudFirst Technologies',
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-09-30'),
        status: 'ON_HOLD',
      },
    }),
  ])

  console.log('✅ Sample projects created')

  // Add project permissions
  const projectPermissions = await Promise.all([
    prisma.permission.upsert({
      where: { code: 'PROJECT_CREATE' },
      update: {},
      create: {
        name: 'Create Project',
        code: 'PROJECT_CREATE',
        module: 'PROJECT',
        action: 'CREATE',
        resource: 'ALL',
        description: 'Create new projects',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'PROJECT_READ' },
      update: {},
      create: {
        name: 'View Project',
        code: 'PROJECT_READ',
        module: 'PROJECT',
        action: 'READ',
        resource: 'ALL',
        description: 'View project information',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'PROJECT_UPDATE' },
      update: {},
      create: {
        name: 'Update Project',
        code: 'PROJECT_UPDATE',
        module: 'PROJECT',
        action: 'UPDATE',
        resource: 'ALL',
        description: 'Update project information',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'PROJECT_DELETE' },
      update: {},
      create: {
        name: 'Delete Project',
        code: 'PROJECT_DELETE',
        module: 'PROJECT',
        action: 'DELETE',
        resource: 'ALL',
        description: 'Delete projects',
      },
    }),
  ])

  // Assign project permissions to roles
  // Admin gets all project permissions
  await Promise.all(
    projectPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // HR role gets project read and create permissions
  const hrProjectPermissions = projectPermissions.filter(p => 
    ['PROJECT_READ', 'PROJECT_CREATE', 'PROJECT_UPDATE'].includes(p.code)
  )
  await Promise.all(
    hrProjectPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: hrRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: hrRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // Manager role gets project read permissions
  const managerProjectPermissions = projectPermissions.filter(p => 
    ['PROJECT_READ', 'PROJECT_CREATE', 'PROJECT_UPDATE'].includes(p.code)
  )
  await Promise.all(
    managerProjectPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: managerRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: managerRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // Employee role gets project read permissions
  const empProjectPermissions = projectPermissions.filter(p => 
    ['PROJECT_READ'].includes(p.code)
  )
  await Promise.all(
    empProjectPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: employeeRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: employeeRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  console.log('✅ Project permissions assigned')

  // Add timesheet permissions
  const timesheetPermissions = await Promise.all([
    prisma.permission.upsert({
      where: { code: 'TIMESHEET_CREATE' },
      update: {},
      create: {
        name: 'Create Timesheet',
        code: 'TIMESHEET_CREATE',
        module: 'TIMESHEET',
        action: 'CREATE',
        resource: 'ALL',
        description: 'Create timesheets',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'TIMESHEET_READ' },
      update: {},
      create: {
        name: 'View Timesheet',
        code: 'TIMESHEET_READ',
        module: 'TIMESHEET',
        action: 'READ',
        resource: 'ALL',
        description: 'View timesheet information',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'TIMESHEET_UPDATE' },
      update: {},
      create: {
        name: 'Update Timesheet',
        code: 'TIMESHEET_UPDATE',
        module: 'TIMESHEET',
        action: 'UPDATE',
        resource: 'ALL',
        description: 'Update timesheet information',
      },
    }),
    prisma.permission.upsert({
      where: { code: 'TIMESHEET_APPROVE' },
      update: {},
      create: {
        name: 'Approve Timesheet',
        code: 'TIMESHEET_APPROVE',
        module: 'TIMESHEET',
        action: 'APPROVE',
        resource: 'ALL',
        description: 'Approve timesheets',
      },
    }),
  ])

  // Assign timesheet permissions to roles
  // Admin gets all timesheet permissions
  await Promise.all(
    timesheetPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // HR role gets timesheet read and approve permissions
  const hrTimesheetPermissions = timesheetPermissions.filter(p => 
    ['TIMESHEET_READ', 'TIMESHEET_APPROVE'].includes(p.code)
  )
  await Promise.all(
    hrTimesheetPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: hrRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: hrRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // Manager role gets timesheet read and approve permissions
  const managerTimesheetPermissions = timesheetPermissions.filter(p => 
    ['TIMESHEET_READ', 'TIMESHEET_APPROVE'].includes(p.code)
  )
  await Promise.all(
    managerTimesheetPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: managerRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: managerRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  // Employee role gets timesheet create, read, and update permissions
  const empTimesheetPermissions = timesheetPermissions.filter(p => 
    ['TIMESHEET_CREATE', 'TIMESHEET_READ', 'TIMESHEET_UPDATE'].includes(p.code)
  )
  await Promise.all(
    empTimesheetPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: employeeRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: employeeRole.id,
          permissionId: permission.id,
        },
      })
    )
  )

  console.log('✅ Timesheet permissions assigned')

  // Seed payroll data
  await seedPayrollData()

  // Seed additional employees
  await seedEmployees()

  console.log('🎉 Seeding completed successfully!')
  console.log('\n📋 Test Credentials:')
  console.log('Admin: admin@pekka-hr.com / admin123')
  console.log('HR: hr@pekka-hr.com / hr123')
  console.log('Employee: john.doe@pekka-hr.com / emp123')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })