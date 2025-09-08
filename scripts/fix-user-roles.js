#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixUserRoles() {
  console.log('🔧 Fixing user roles...')

  try {
    // Update admin user
    await prisma.user.update({
      where: { email: 'admin@pekka-hr.com' },
      data: { role: 'ADMIN' }
    })
    console.log('✅ Updated admin role')

    // Update HR user
    await prisma.user.update({
      where: { email: 'hr@pekka-hr.com' },
      data: { role: 'HR' }
    })
    console.log('✅ Updated HR role')

    // Update employee user (already correct)
    await prisma.user.update({
      where: { email: 'john.doe@pekka-hr.com' },
      data: { role: 'EMPLOYEE' }
    })
    console.log('✅ Updated employee role')

    // Verify the changes
    const users = await prisma.user.findMany({
      select: {
        email: true,
        role: true,
        isActive: true
      }
    })

    console.log('\n📋 Updated user roles:')
    users.forEach(user => {
      console.log(`   ${user.email}: ${user.role} (${user.isActive ? 'Active' : 'Inactive'})`)
    })

    console.log('\n✅ User roles fixed successfully!')

  } catch (error) {
    console.error('❌ Failed to fix user roles:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixUserRoles()