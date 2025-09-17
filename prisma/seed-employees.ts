import { PrismaClient, Gender } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function seedEmployees() {
  console.log('🌱 Seeding additional employees for directory and org chart...')

  // Get existing departments
  const departments = await prisma.department.findMany()
  const engDept = departments.find(d => d.code === 'ENG')!
  const hrDept = departments.find(d => d.code === 'HR')!
  const finDept = departments.find(d => d.code === 'FIN')!
  const mktDept = departments.find(d => d.code === 'MKT')!

  // Get employee role
  const employeeRole = await prisma.role.findUnique({ where: { code: 'EMPLOYEE' } })
  const managerRole = await prisma.role.findUnique({ where: { code: 'MANAGER' } })
  
  if (!employeeRole || !managerRole) {
    throw new Error('Required roles not found. Please run the main seed first.')
  }

  const hashedPassword = await bcrypt.hash('password123', 12)

  // Create department heads/managers first
  const managers = []

  // Engineering Manager
  const engManagerUser = await prisma.user.create({
    data: {
      email: 'sarah.wilson@pekka-hr.com',
      name: 'Sarah Wilson',
      password: hashedPassword,
      role: 'MANAGER',
      roleId: managerRole.id,
    },
  })

  const engManager = await prisma.employee.create({
    data: {
      userId: engManagerUser.id,
      employeeCode: 'EMP004',
      firstName: 'Sarah',
      lastName: 'Wilson',
      email: 'sarah.wilson@pekka-hr.com',
      phone: '+91-9876543211',
      dateOfBirth: new Date('1985-03-20'),
      gender: Gender.FEMALE,
      designation: 'Engineering Manager',
      departmentId: engDept.id,
      joiningDate: new Date('2023-06-01'),
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      basicSalary: 120000,
      ctc: 150000,
      salaryGrade: 'L1',
      address: {
        street: '123 Tech Street',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        country: 'India'
      }
    },
  })
  managers.push(engManager)

  // Finance Manager
  const finManagerUser = await prisma.user.create({
    data: {
      email: 'michael.brown@pekka-hr.com',
      name: 'Michael Brown',
      password: hashedPassword,
      role: 'MANAGER',
      roleId: managerRole.id,
    },
  })

  const finManager = await prisma.employee.create({
    data: {
      userId: finManagerUser.id,
      employeeCode: 'EMP005',
      firstName: 'Michael',
      lastName: 'Brown',
      email: 'michael.brown@pekka-hr.com',
      phone: '+91-9876543212',
      dateOfBirth: new Date('1982-11-10'),
      gender: Gender.MALE,
      designation: 'Finance Manager',
      departmentId: finDept.id,
      joiningDate: new Date('2023-04-15'),
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      basicSalary: 110000,
      ctc: 135000,
      salaryGrade: 'L1',
      address: {
        street: '456 Finance Avenue',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India'
      }
    },
  })
  managers.push(finManager)

  // Marketing Manager
  const mktManagerUser = await prisma.user.create({
    data: {
      email: 'lisa.garcia@pekka-hr.com',
      name: 'Lisa Garcia',
      password: hashedPassword,
      role: 'MANAGER',
      roleId: managerRole.id,
    },
  })

  const mktManager = await prisma.employee.create({
    data: {
      userId: mktManagerUser.id,
      employeeCode: 'EMP006',
      firstName: 'Lisa',
      lastName: 'Garcia',
      email: 'lisa.garcia@pekka-hr.com',
      phone: '+91-9876543213',
      dateOfBirth: new Date('1988-07-25'),
      gender: Gender.FEMALE,
      designation: 'Marketing Manager',
      departmentId: mktDept.id,
      joiningDate: new Date('2023-08-01'),
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      basicSalary: 100000,
      ctc: 125000,
      salaryGrade: 'L1',
      address: {
        street: '789 Marketing Plaza',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        country: 'India'
      }
    },
  })
  managers.push(mktManager)

  console.log('✅ Managers created')

  // Create engineering team members
  const engineeringEmployees = [
    {
      firstName: 'Alex',
      lastName: 'Johnson',
      email: 'alex.johnson@pekka-hr.com',
      designation: 'Senior Software Engineer',
      phone: '+91-9876543214',
      dateOfBirth: new Date('1992-01-15'),
      gender: Gender.MALE,
      joiningDate: new Date('2024-01-15'),
      basicSalary: 80000,
      ctc: 95000,
      salaryGrade: 'L2',
      city: 'Bangalore'
    },
    {
      firstName: 'Emily',
      lastName: 'Davis',
      email: 'emily.davis@pekka-hr.com',
      designation: 'Frontend Developer',
      phone: '+91-9876543215',
      dateOfBirth: new Date('1994-09-22'),
      gender: Gender.FEMALE,
      joiningDate: new Date('2024-02-01'),
      basicSalary: 70000,
      ctc: 82000,
      salaryGrade: 'L3',
      city: 'Bangalore'
    },
    {
      firstName: 'David',
      lastName: 'Miller',
      email: 'david.miller@pekka-hr.com',
      designation: 'Backend Developer',
      phone: '+91-9876543216',
      dateOfBirth: new Date('1991-12-08'),
      gender: Gender.MALE,
      joiningDate: new Date('2024-01-20'),
      basicSalary: 75000,
      ctc: 88000,
      salaryGrade: 'L3',
      city: 'Bangalore'
    },
    {
      firstName: 'Jessica',
      lastName: 'Taylor',
      email: 'jessica.taylor@pekka-hr.com',
      designation: 'DevOps Engineer',
      phone: '+91-9876543217',
      dateOfBirth: new Date('1993-04-12'),
      gender: 'FEMALE',
      joiningDate: new Date('2024-03-01'),
      basicSalary: 85000,
      ctc: 100000,
      salaryGrade: 'L2',
      city: 'Bangalore'
    },
    {
      firstName: 'Ryan',
      lastName: 'Anderson',
      email: 'ryan.anderson@pekka-hr.com',
      designation: 'QA Engineer',
      phone: '+91-9876543218',
      dateOfBirth: new Date('1995-06-30'),
      gender: 'MALE',
      joiningDate: new Date('2024-02-15'),
      basicSalary: 65000,
      ctc: 76000,
      salaryGrade: 'L3',
      city: 'Bangalore'
    }
  ]

  let empCode = 7
  for (const emp of engineeringEmployees) {
    const user = await prisma.user.create({
      data: {
        email: emp.email,
        name: `${emp.firstName} ${emp.lastName}`,
        password: hashedPassword,
        role: 'EMPLOYEE',
        roleId: employeeRole.id,
      },
    })

    await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode: `EMP${empCode.toString().padStart(3, '0')}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        dateOfBirth: emp.dateOfBirth,
        gender: emp.gender as Gender,
        designation: emp.designation,
        departmentId: engDept.id,
        joiningDate: emp.joiningDate,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        reportingTo: engManager.id,
        basicSalary: emp.basicSalary,
        ctc: emp.ctc,
        salaryGrade: emp.salaryGrade,
        address: {
          street: `${empCode * 10} Tech Street`,
          city: emp.city,
          state: 'Karnataka',
          pincode: '560001',
          country: 'India'
        }
      },
    })
    empCode++
  }

  console.log('✅ Engineering team created')

  // Create finance team members
  const financeEmployees = [
    {
      firstName: 'Amanda',
      lastName: 'White',
      email: 'amanda.white@pekka-hr.com',
      designation: 'Senior Accountant',
      phone: '+91-9876543219',
      dateOfBirth: new Date('1990-08-14'),
      gender: 'FEMALE',
      joiningDate: new Date('2024-01-10'),
      basicSalary: 70000,
      ctc: 82000,
      salaryGrade: 'L2',
      city: 'Mumbai'
    },
    {
      firstName: 'Robert',
      lastName: 'Lee',
      email: 'robert.lee@pekka-hr.com',
      designation: 'Payroll Specialist',
      phone: '+91-9876543220',
      dateOfBirth: new Date('1987-02-28'),
      gender: 'MALE',
      joiningDate: new Date('2023-12-01'),
      basicSalary: 65000,
      ctc: 76000,
      salaryGrade: 'L3',
      city: 'Mumbai'
    },
    {
      firstName: 'Jennifer',
      lastName: 'Clark',
      email: 'jennifer.clark@pekka-hr.com',
      designation: 'Financial Analyst',
      phone: '+91-9876543221',
      dateOfBirth: new Date('1992-10-05'),
      gender: 'FEMALE',
      joiningDate: new Date('2024-02-20'),
      basicSalary: 75000,
      ctc: 88000,
      salaryGrade: 'L2',
      city: 'Mumbai'
    }
  ]

  for (const emp of financeEmployees) {
    const user = await prisma.user.create({
      data: {
        email: emp.email,
        name: `${emp.firstName} ${emp.lastName}`,
        password: hashedPassword,
        role: 'EMPLOYEE',
        roleId: employeeRole.id,
      },
    })

    await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode: `EMP${empCode.toString().padStart(3, '0')}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        dateOfBirth: emp.dateOfBirth,
        gender: emp.gender as Gender,
        designation: emp.designation,
        departmentId: finDept.id,
        joiningDate: emp.joiningDate,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        reportingTo: finManager.id,
        basicSalary: emp.basicSalary,
        ctc: emp.ctc,
        salaryGrade: emp.salaryGrade,
        address: {
          street: `${empCode * 10} Finance Avenue`,
          city: emp.city,
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India'
        }
      },
    })
    empCode++
  }

  console.log('✅ Finance team created')

  // Create marketing team members
  const marketingEmployees = [
    {
      firstName: 'Kevin',
      lastName: 'Martinez',
      email: 'kevin.martinez@pekka-hr.com',
      designation: 'Digital Marketing Specialist',
      phone: '+91-9876543222',
      dateOfBirth: new Date('1993-05-18'),
      gender: 'MALE',
      joiningDate: new Date('2024-01-25'),
      basicSalary: 60000,
      ctc: 72000,
      salaryGrade: 'L3',
      city: 'Delhi'
    },
    {
      firstName: 'Nicole',
      lastName: 'Rodriguez',
      email: 'nicole.rodriguez@pekka-hr.com',
      designation: 'Content Marketing Manager',
      phone: '+91-9876543223',
      dateOfBirth: new Date('1989-11-03'),
      gender: 'FEMALE',
      joiningDate: new Date('2023-11-15'),
      basicSalary: 75000,
      ctc: 88000,
      salaryGrade: 'L2',
      city: 'Delhi'
    },
    {
      firstName: 'Daniel',
      lastName: 'Thompson',
      email: 'daniel.thompson@pekka-hr.com',
      designation: 'Social Media Manager',
      phone: '+91-9876543224',
      dateOfBirth: new Date('1996-01-20'),
      gender: 'MALE',
      joiningDate: new Date('2024-03-10'),
      basicSalary: 55000,
      ctc: 65000,
      salaryGrade: 'L3',
      city: 'Delhi'
    }
  ]

  for (const emp of marketingEmployees) {
    const user = await prisma.user.create({
      data: {
        email: emp.email,
        name: `${emp.firstName} ${emp.lastName}`,
        password: hashedPassword,
        role: 'EMPLOYEE',
        roleId: employeeRole.id,
      },
    })

    await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode: `EMP${empCode.toString().padStart(3, '0')}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        dateOfBirth: emp.dateOfBirth,
        gender: emp.gender as Gender,
        designation: emp.designation,
        departmentId: mktDept.id,
        joiningDate: emp.joiningDate,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        reportingTo: mktManager.id,
        basicSalary: emp.basicSalary,
        ctc: emp.ctc,
        salaryGrade: emp.salaryGrade,
        address: {
          street: `${empCode * 10} Marketing Plaza`,
          city: emp.city,
          state: 'Delhi',
          pincode: '110001',
          country: 'India'
        }
      },
    })
    empCode++
  }

  console.log('✅ Marketing team created')

  // Create additional HR team members
  const hrEmployees = [
    {
      firstName: 'Rachel',
      lastName: 'Green',
      email: 'rachel.green@pekka-hr.com',
      designation: 'HR Business Partner',
      phone: '+91-9876543225',
      dateOfBirth: new Date('1991-07-12'),
      gender: 'FEMALE',
      joiningDate: new Date('2024-01-05'),
      basicSalary: 70000,
      ctc: 82000,
      salaryGrade: 'L2',
      city: 'Bangalore'
    },
    {
      firstName: 'Mark',
      lastName: 'Wilson',
      email: 'mark.wilson@pekka-hr.com',
      designation: 'Talent Acquisition Specialist',
      phone: '+91-9876543226',
      dateOfBirth: new Date('1994-03-08'),
      gender: 'MALE',
      joiningDate: new Date('2024-02-10'),
      basicSalary: 65000,
      ctc: 76000,
      salaryGrade: 'L3',
      city: 'Bangalore'
    }
  ]

  // Get HR Manager to report to
  const hrManager = await prisma.employee.findFirst({
    where: { email: 'hr@pekka-hr.com' }
  })

  for (const emp of hrEmployees) {
    const user = await prisma.user.create({
      data: {
        email: emp.email,
        name: `${emp.firstName} ${emp.lastName}`,
        password: hashedPassword,
        role: 'EMPLOYEE',
        roleId: employeeRole.id,
      },
    })

    await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode: `EMP${empCode.toString().padStart(3, '0')}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        dateOfBirth: emp.dateOfBirth,
        gender: emp.gender as Gender,
        designation: emp.designation,
        departmentId: hrDept.id,
        joiningDate: emp.joiningDate,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        reportingTo: hrManager?.id,
        basicSalary: emp.basicSalary,
        ctc: emp.ctc,
        salaryGrade: emp.salaryGrade,
        address: {
          street: `${empCode * 10} HR Street`,
          city: emp.city,
          state: 'Karnataka',
          pincode: '560001',
          country: 'India'
        }
      },
    })
    empCode++
  }

  console.log('✅ HR team created')

  // Create some employees with different statuses for testing
  const testEmployees = [
    {
      firstName: 'Tom',
      lastName: 'Inactive',
      email: 'tom.inactive@pekka-hr.com',
      designation: 'Test Engineer',
      status: 'INACTIVE',
      departmentId: engDept.id,
      reportingTo: engManager.id
    },
    {
      firstName: 'Jane',
      lastName: 'OnLeave',
      email: 'jane.onleave@pekka-hr.com',
      designation: 'Marketing Executive',
      status: 'ON_LEAVE',
      departmentId: mktDept.id,
      reportingTo: mktManager.id
    }
  ]

  for (const emp of testEmployees) {
    const user = await prisma.user.create({
      data: {
        email: emp.email,
        name: `${emp.firstName} ${emp.lastName}`,
        password: hashedPassword,
        role: 'EMPLOYEE',
        roleId: employeeRole.id,
        isActive: emp.status === 'ACTIVE'
      },
    })

    await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode: `EMP${empCode.toString().padStart(3, '0')}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: `+91-987654${empCode.toString().padStart(4, '0')}`,
        dateOfBirth: new Date('1990-01-01'),
        gender: 'MALE',
        designation: emp.designation,
        departmentId: emp.departmentId,
        joiningDate: new Date('2024-01-01'),
        employmentType: 'FULL_TIME',
        status: emp.status as any,
        reportingTo: emp.reportingTo,
        basicSalary: 50000,
        ctc: 60000,
        salaryGrade: 'L3',
        address: {
          street: `${empCode * 10} Test Street`,
          city: 'Test City',
          state: 'Test State',
          pincode: '000000',
          country: 'India'
        }
      },
    })
    empCode++
  }

  console.log('✅ Test employees created')

  console.log('🎉 Employee seeding completed successfully!')
  console.log(`📊 Total employees created: ${empCode - 7}`)
}

export default seedEmployees

// Only run directly if this file is executed directly
if (require.main === module) {
  seedEmployees()
    .catch((e) => {
      console.error('❌ Employee seeding failed:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}