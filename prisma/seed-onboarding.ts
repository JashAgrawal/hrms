import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedOnboardingTemplates() {
  console.log('Seeding onboarding templates...')

  // Create default onboarding template
  const defaultTemplate = await prisma.onboardingTemplate.upsert({
    where: { name: 'Standard Employee Onboarding' },
    update: {},
    create: {
      name: 'Standard Employee Onboarding',
      description: 'Comprehensive onboarding process for new employees',
      isActive: true,
      tasks: {
        create: [
          {
            title: 'Complete Personal Information Form',
            description: 'Fill out all personal details including emergency contacts and address information',
            category: 'PERSONAL_INFO',
            isRequired: true,
            order: 1,
            daysToComplete: 1,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Upload Profile Photo',
            description: 'Upload a professional profile photo for ID card and system profile',
            category: 'PERSONAL_INFO',
            isRequired: true,
            order: 2,
            daysToComplete: 2,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Submit Identity Documents',
            description: 'Upload PAN card, Aadhar card, passport, and passport size photos',
            category: 'DOCUMENTS',
            isRequired: true,
            order: 3,
            daysToComplete: 3,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Bank Account Details',
            description: 'Provide bank account details and cancelled cheque for salary processing',
            category: 'DOCUMENTS',
            isRequired: true,
            order: 4,
            daysToComplete: 3,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Educational Certificates',
            description: 'Upload degree certificates, mark sheets, and professional certifications',
            category: 'DOCUMENTS',
            isRequired: true,
            order: 5,
            daysToComplete: 5,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Previous Employment Documents',
            description: 'Upload experience letters, relieving letters, and salary certificates',
            category: 'DOCUMENTS',
            isRequired: false,
            order: 6,
            daysToComplete: 5,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Create System Accounts',
            description: 'Set up email account, HRMS access, and other system accounts',
            category: 'SYSTEM_ACCESS',
            isRequired: true,
            order: 7,
            daysToComplete: 1,
            assignedRole: 'HR'
          },
          {
            title: 'IT Equipment Assignment',
            description: 'Assign laptop, mobile phone, access cards, and other IT equipment',
            category: 'EQUIPMENT',
            isRequired: true,
            order: 8,
            daysToComplete: 2,
            assignedRole: 'HR'
          },
          {
            title: 'Office Tour and Introduction',
            description: 'Introduce to team members, show office facilities, and explain office policies',
            category: 'INTRODUCTION',
            isRequired: true,
            order: 9,
            daysToComplete: 1,
            assignedRole: 'MANAGER'
          },
          {
            title: 'Team Introduction Meeting',
            description: 'Schedule and conduct team introduction meeting with immediate colleagues',
            category: 'INTRODUCTION',
            isRequired: true,
            order: 10,
            daysToComplete: 2,
            assignedRole: 'MANAGER'
          },
          {
            title: 'Company Policies Training',
            description: 'Complete mandatory training on company policies, code of conduct, and procedures',
            category: 'TRAINING',
            isRequired: true,
            order: 11,
            daysToComplete: 7,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Security and Compliance Training',
            description: 'Complete security awareness, data protection, and compliance training modules',
            category: 'COMPLIANCE',
            isRequired: true,
            order: 12,
            daysToComplete: 7,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Role-Specific Training',
            description: 'Complete job-specific training and orientation programs',
            category: 'TRAINING',
            isRequired: true,
            order: 13,
            daysToComplete: 14,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Buddy Assignment',
            description: 'Assign a workplace buddy to help with initial settling in and questions',
            category: 'INTRODUCTION',
            isRequired: false,
            order: 14,
            daysToComplete: 1,
            assignedRole: 'HR'
          },
          {
            title: 'First Week Check-in',
            description: 'Conduct first week check-in meeting to address any concerns or questions',
            category: 'INTRODUCTION',
            isRequired: true,
            order: 15,
            daysToComplete: 7,
            assignedRole: 'MANAGER'
          }
        ]
      }
    }
  })

  // Create IT-specific onboarding template
  const itTemplate = await prisma.onboardingTemplate.upsert({
    where: { name: 'IT Department Onboarding' },
    update: {},
    create: {
      name: 'IT Department Onboarding',
      description: 'Specialized onboarding process for IT department employees',
      isActive: true,
      tasks: {
        create: [
          {
            title: 'Complete Personal Information Form',
            description: 'Fill out all personal details including emergency contacts',
            category: 'PERSONAL_INFO',
            isRequired: true,
            order: 1,
            daysToComplete: 1,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Submit Identity and Educational Documents',
            description: 'Upload all required identity and educational documents',
            category: 'DOCUMENTS',
            isRequired: true,
            order: 2,
            daysToComplete: 3,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'IT Security Clearance',
            description: 'Complete IT security clearance and background verification',
            category: 'COMPLIANCE',
            isRequired: true,
            order: 3,
            daysToComplete: 5,
            assignedRole: 'HR'
          },
          {
            title: 'Development Environment Setup',
            description: 'Set up development environment, tools, and access permissions',
            category: 'SYSTEM_ACCESS',
            isRequired: true,
            order: 4,
            daysToComplete: 2,
            assignedRole: 'HR'
          },
          {
            title: 'Code Repository Access',
            description: 'Provide access to code repositories, version control systems, and project management tools',
            category: 'SYSTEM_ACCESS',
            isRequired: true,
            order: 5,
            daysToComplete: 1,
            assignedRole: 'HR'
          },
          {
            title: 'Technical Equipment Assignment',
            description: 'Assign high-spec laptop, additional monitors, and specialized IT equipment',
            category: 'EQUIPMENT',
            isRequired: true,
            order: 6,
            daysToComplete: 1,
            assignedRole: 'HR'
          },
          {
            title: 'Architecture and Codebase Overview',
            description: 'Provide overview of system architecture, codebase structure, and development practices',
            category: 'TRAINING',
            isRequired: true,
            order: 7,
            daysToComplete: 3,
            assignedRole: 'MANAGER'
          },
          {
            title: 'Security Protocols Training',
            description: 'Complete comprehensive security protocols and secure coding practices training',
            category: 'COMPLIANCE',
            isRequired: true,
            order: 8,
            daysToComplete: 5,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'First Development Task Assignment',
            description: 'Assign first development task to familiarize with codebase and processes',
            category: 'TRAINING',
            isRequired: true,
            order: 9,
            daysToComplete: 7,
            assignedRole: 'MANAGER'
          }
        ]
      }
    }
  })

  // Create Sales team onboarding template
  const salesTemplate = await prisma.onboardingTemplate.upsert({
    where: { name: 'Sales Team Onboarding' },
    update: {},
    create: {
      name: 'Sales Team Onboarding',
      description: 'Specialized onboarding process for sales team members',
      isActive: true,
      tasks: {
        create: [
          {
            title: 'Complete Personal Information Form',
            description: 'Fill out all personal details and contact information',
            category: 'PERSONAL_INFO',
            isRequired: true,
            order: 1,
            daysToComplete: 1,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Submit Required Documents',
            description: 'Upload identity documents and previous sales experience certificates',
            category: 'DOCUMENTS',
            isRequired: true,
            order: 2,
            daysToComplete: 3,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'CRM System Access Setup',
            description: 'Set up access to CRM system and sales management tools',
            category: 'SYSTEM_ACCESS',
            isRequired: true,
            order: 3,
            daysToComplete: 1,
            assignedRole: 'HR'
          },
          {
            title: 'Sales Equipment Assignment',
            description: 'Assign laptop, mobile phone, and sales presentation materials',
            category: 'EQUIPMENT',
            isRequired: true,
            order: 4,
            daysToComplete: 1,
            assignedRole: 'HR'
          },
          {
            title: 'Product Knowledge Training',
            description: 'Complete comprehensive product knowledge and features training',
            category: 'TRAINING',
            isRequired: true,
            order: 5,
            daysToComplete: 7,
            assignedRole: 'EMPLOYEE'
          },
          {
            title: 'Sales Process Training',
            description: 'Learn company sales processes, methodologies, and best practices',
            category: 'TRAINING',
            isRequired: true,
            order: 6,
            daysToComplete: 5,
            assignedRole: 'MANAGER'
          },
          {
            title: 'Territory Assignment',
            description: 'Assign sales territory and provide territory-specific information',
            category: 'INTRODUCTION',
            isRequired: true,
            order: 7,
            daysToComplete: 2,
            assignedRole: 'MANAGER'
          },
          {
            title: 'Customer Introduction',
            description: 'Introduce to key customers and schedule initial customer meetings',
            category: 'INTRODUCTION',
            isRequired: true,
            order: 8,
            daysToComplete: 7,
            assignedRole: 'MANAGER'
          },
          {
            title: 'Sales Target Setting',
            description: 'Set initial sales targets and KPIs for the first quarter',
            category: 'TRAINING',
            isRequired: true,
            order: 9,
            daysToComplete: 3,
            assignedRole: 'MANAGER'
          }
        ]
      }
    }
  })

  console.log('Onboarding templates seeded successfully!')
  console.log(`Created templates:`)
  console.log(`- ${defaultTemplate.name}`)
  console.log(`- ${itTemplate.name}`)
  console.log(`- ${salesTemplate.name}`)
}

async function main() {
  try {
    await seedOnboardingTemplates()
  } catch (error) {
    console.error('Error seeding onboarding templates:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { seedOnboardingTemplates }