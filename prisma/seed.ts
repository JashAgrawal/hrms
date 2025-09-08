import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import seedPayrollData from './seed-payroll'

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

  // Seed payroll data
  await seedPayrollData()

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