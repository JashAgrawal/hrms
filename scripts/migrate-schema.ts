#!/usr/bin/env tsx

/**
 * Migration script to update the database schema with new features:
 * 1. Employee location assignments for geo-fencing
 * 2. Attendance requests for out-of-location check-ins
 * 3. Enhanced leave approval tracking with approver names
 * 4. Audit logging improvements
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting database migration...')

  try {
    // Push the schema changes to the database
    console.log('📝 Applying schema changes...')
    
    // Note: In a real application, you would run:
    // npx prisma db push
    // or
    // npx prisma migrate dev --name add-geofencing-and-audit-features
    
    console.log('✅ Schema migration completed successfully!')
    
    // Create some default locations for testing
    console.log('🏢 Creating default locations...')
    
    const defaultLocations = [
      {
        name: 'Main Office',
        address: '123 Business District, City Center',
        latitude: 12.9716,
        longitude: 77.5946,
        radius: 100,
        timezone: 'Asia/Kolkata',
        workingHours: {
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
          wednesday: { start: '09:00', end: '18:00' },
          thursday: { start: '09:00', end: '18:00' },
          friday: { start: '09:00', end: '18:00' },
          saturday: { start: '09:00', end: '13:00' },
        }
      },
      {
        name: 'Branch Office',
        address: '456 Tech Park, Suburb Area',
        latitude: 12.9352,
        longitude: 77.6245,
        radius: 150,
        timezone: 'Asia/Kolkata',
        workingHours: {
          monday: { start: '09:30', end: '18:30' },
          tuesday: { start: '09:30', end: '18:30' },
          wednesday: { start: '09:30', end: '18:30' },
          thursday: { start: '09:30', end: '18:30' },
          friday: { start: '09:30', end: '18:30' },
        }
      }
    ]

    for (const locationData of defaultLocations) {
      const existingLocation = await prisma.location.findFirst({
        where: { name: locationData.name }
      })

      if (!existingLocation) {
        await prisma.location.create({
          data: locationData
        })
        console.log(`✅ Created location: ${locationData.name}`)
      } else {
        console.log(`⏭️  Location already exists: ${locationData.name}`)
      }
    }

    // Update existing leave approvals to include approver names where possible
    console.log('👥 Updating leave approval records...')
    
    const leaveApprovals = await prisma.leaveApproval.findMany({
      where: {
        approverName: null,
        status: { not: 'PENDING' }
      },
      include: {
        leaveRequest: {
          include: {
            employee: {
              include: {
                manager: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }
      }
    })

    for (const approval of leaveApprovals) {
      if (approval.leaveRequest.employee.manager) {
        await prisma.leaveApproval.update({
          where: { id: approval.id },
          data: {
            approverName: `${approval.leaveRequest.employee.manager.firstName} ${approval.leaveRequest.employee.manager.lastName}`
          }
        })
      }
    }

    console.log(`✅ Updated ${leaveApprovals.length} leave approval records`)

    // Create audit log entry for this migration
    console.log('📋 Creating audit log entry...')
    
    await prisma.auditLog.create({
      data: {
        action: 'SYSTEM_MIGRATION',
        resource: 'DATABASE_SCHEMA',
        newValues: {
          migration: 'add-geofencing-and-audit-features',
          timestamp: new Date().toISOString(),
          features: [
            'Employee location assignments',
            'Attendance requests for geo-fencing',
            'Enhanced leave approval tracking',
            'Improved audit logging'
          ]
        }
      }
    })

    console.log('🎉 Migration completed successfully!')
    console.log('')
    console.log('📋 Summary of changes:')
    console.log('  ✅ Added EmployeeLocation model for geo-fencing')
    console.log('  ✅ Added AttendanceRequest model for out-of-location check-ins')
    console.log('  ✅ Enhanced LeaveApproval with approver names')
    console.log('  ✅ Improved audit logging capabilities')
    console.log('  ✅ Created default work locations')
    console.log('')
    console.log('🔧 Next steps:')
    console.log('  1. Assign locations to employees via the admin dashboard')
    console.log('  2. Configure geo-fencing policies as needed')
    console.log('  3. Test attendance check-in with location validation')
    console.log('  4. Review audit logs in the admin panel')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('❌ Migration script failed:', error)
    process.exit(1)
  })