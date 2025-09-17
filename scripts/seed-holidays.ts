import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const holidays2024 = [
  // National Holidays
  {
    name: 'Republic Day',
    date: '2024-01-26',
    type: 'NATIONAL' as const,
    description: 'Republic Day of India',
    isOptional: false
  },
  {
    name: 'Independence Day',
    date: '2024-08-15',
    type: 'NATIONAL' as const,
    description: 'Independence Day of India',
    isOptional: false
  },
  {
    name: 'Gandhi Jayanti',
    date: '2024-10-02',
    type: 'NATIONAL' as const,
    description: 'Birth anniversary of Mahatma Gandhi',
    isOptional: false
  },

  // Religious Holidays (Optional)
  {
    name: 'Diwali',
    date: '2024-11-01',
    type: 'RELIGIOUS' as const,
    description: 'Festival of Lights',
    isOptional: true
  },
  {
    name: 'Holi',
    date: '2024-03-25',
    type: 'RELIGIOUS' as const,
    description: 'Festival of Colors',
    isOptional: true
  },
  {
    name: 'Dussehra',
    date: '2024-10-12',
    type: 'RELIGIOUS' as const,
    description: 'Victory of good over evil',
    isOptional: true
  },
  {
    name: 'Eid ul-Fitr',
    date: '2024-04-11',
    type: 'RELIGIOUS' as const,
    description: 'Festival marking the end of Ramadan',
    isOptional: true
  },
  {
    name: 'Eid ul-Adha',
    date: '2024-06-17',
    type: 'RELIGIOUS' as const,
    description: 'Festival of Sacrifice',
    isOptional: true
  },
  {
    name: 'Christmas',
    date: '2024-12-25',
    type: 'RELIGIOUS' as const,
    description: 'Birth of Jesus Christ',
    isOptional: true
  },
  {
    name: 'Good Friday',
    date: '2024-03-29',
    type: 'RELIGIOUS' as const,
    description: 'Crucifixion of Jesus Christ',
    isOptional: true
  },
  {
    name: 'Karva Chauth',
    date: '2024-11-01',
    type: 'RELIGIOUS' as const,
    description: 'Hindu festival observed by married women',
    isOptional: true
  },
  {
    name: 'Raksha Bandhan',
    date: '2024-08-19',
    type: 'RELIGIOUS' as const,
    description: 'Festival celebrating brother-sister bond',
    isOptional: true
  },
  {
    name: 'Janmashtami',
    date: '2024-08-26',
    type: 'RELIGIOUS' as const,
    description: 'Birth of Lord Krishna',
    isOptional: true
  },

  // Company Holidays
  {
    name: 'New Year\'s Day',
    date: '2024-01-01',
    type: 'COMPANY' as const,
    description: 'Start of the new year',
    isOptional: false
  },
  {
    name: 'Company Foundation Day',
    date: '2024-05-15',
    type: 'COMPANY' as const,
    description: 'Anniversary of company establishment',
    isOptional: false
  }
]

const holidays2025 = [
  // National Holidays
  {
    name: 'Republic Day',
    date: '2025-01-26',
    type: 'NATIONAL' as const,
    description: 'Republic Day of India',
    isOptional: false
  },
  {
    name: 'Independence Day',
    date: '2025-08-15',
    type: 'NATIONAL' as const,
    description: 'Independence Day of India',
    isOptional: false
  },
  {
    name: 'Gandhi Jayanti',
    date: '2025-10-02',
    type: 'NATIONAL' as const,
    description: 'Birth anniversary of Mahatma Gandhi',
    isOptional: false
  },

  // Religious Holidays (Optional)
  {
    name: 'Diwali',
    date: '2025-10-20',
    type: 'RELIGIOUS' as const,
    description: 'Festival of Lights',
    isOptional: true
  },
  {
    name: 'Holi',
    date: '2025-03-14',
    type: 'RELIGIOUS' as const,
    description: 'Festival of Colors',
    isOptional: true
  },
  {
    name: 'Dussehra',
    date: '2025-10-02',
    type: 'RELIGIOUS' as const,
    description: 'Victory of good over evil',
    isOptional: true
  },
  {
    name: 'Christmas',
    date: '2025-12-25',
    type: 'RELIGIOUS' as const,
    description: 'Birth of Jesus Christ',
    isOptional: true
  },

  // Company Holidays
  {
    name: 'New Year\'s Day',
    date: '2025-01-01',
    type: 'COMPANY' as const,
    description: 'Start of the new year',
    isOptional: false
  },
  {
    name: 'Company Foundation Day',
    date: '2025-05-15',
    type: 'COMPANY' as const,
    description: 'Anniversary of company establishment',
    isOptional: false
  }
]

async function seedHolidays() {
  console.log('🌟 Seeding holidays...')

  try {
    // Seed 2024 holidays
    for (const holiday of holidays2024) {
      const holidayDate = new Date(holiday.date)
      await prisma.holiday.upsert({
        where: {
          name_date: {
            name: holiday.name,
            date: holidayDate
          }
        },
        update: {},
        create: {
          ...holiday,
          date: holidayDate,
          year: 2024
        }
      })
    }

    // Seed 2025 holidays
    for (const holiday of holidays2025) {
      const holidayDate = new Date(holiday.date)
      await prisma.holiday.upsert({
        where: {
          name_date: {
            name: holiday.name,
            date: holidayDate
          }
        },
        update: {},
        create: {
          ...holiday,
          date: holidayDate,
          year: 2025
        }
      })
    }

    // Create sample optional leave policy for 2024
    const optionalHolidays2024 = await prisma.holiday.findMany({
      where: {
        year: 2024,
        isOptional: true,
        type: 'RELIGIOUS'
      }
    })

    if (optionalHolidays2024.length > 0) {
      const policy2024 = await prisma.optionalLeavePolicy.upsert({
        where: {
          name: 'Festival Holidays 2024'
        },
        update: {},
        create: {
          name: 'Festival Holidays 2024',
          description: 'Choose up to 3 religious festivals as optional holidays',
          year: 2024,
          maxSelectableLeaves: 3,
          selectionDeadline: new Date('2024-03-31'),
          holidays: {
            create: optionalHolidays2024.slice(0, 8).map(holiday => ({
              holidayId: holiday.id
            }))
          }
        }
      })
      console.log('✅ Created optional leave policy for 2024')
    }

    // Create sample optional leave policy for 2025
    const optionalHolidays2025 = await prisma.holiday.findMany({
      where: {
        year: 2025,
        isOptional: true,
        type: 'RELIGIOUS'
      }
    })

    if (optionalHolidays2025.length > 0) {
      const policy2025 = await prisma.optionalLeavePolicy.upsert({
        where: {
          name: 'Festival Holidays 2025'
        },
        update: {},
        create: {
          name: 'Festival Holidays 2025',
          description: 'Choose up to 3 religious festivals as optional holidays',
          year: 2025,
          maxSelectableLeaves: 3,
          selectionDeadline: new Date('2025-03-31'),
          holidays: {
            create: optionalHolidays2025.map(holiday => ({
              holidayId: holiday.id
            }))
          }
        }
      })
      console.log('✅ Created optional leave policy for 2025')
    }

    console.log('🎉 Holiday seeding completed successfully!')
    
    // Display summary
    const totalHolidays = await prisma.holiday.count()
    const totalPolicies = await prisma.optionalLeavePolicy.count()
    
    console.log(`📊 Summary:`)
    console.log(`   - Total holidays: ${totalHolidays}`)
    console.log(`   - Optional leave policies: ${totalPolicies}`)

  } catch (error) {
    console.error('❌ Error seeding holidays:', error)
    throw error
  }
}

async function main() {
  await seedHolidays()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })