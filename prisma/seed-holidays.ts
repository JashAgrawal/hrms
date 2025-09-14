import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedHolidays() {
  console.log('Seeding holidays...')

  const holidays = [
    {
      name: 'New Year\'s Day',
      date: new Date('2025-01-01'),
      type: 'PUBLIC' as const,
      description: 'New Year celebration',
      year: 2025
    },
    {
      name: 'Republic Day',
      date: new Date('2025-01-26'),
      type: 'NATIONAL' as const,
      description: 'Indian Republic Day',
      year: 2025
    },
    {
      name: 'Holi',
      date: new Date('2025-03-14'),
      type: 'RELIGIOUS' as const,
      description: 'Festival of Colors',
      year: 2025
    },
    {
      name: 'Good Friday',
      date: new Date('2025-04-18'),
      type: 'OPTIONAL' as const,
      description: 'Christian holiday',
      isOptional: true,
      year: 2025
    },
    {
      name: 'Independence Day',
      date: new Date('2025-08-15'),
      type: 'NATIONAL' as const,
      description: 'Indian Independence Day',
      year: 2025
    },
    {
      name: 'Gandhi Jayanti',
      date: new Date('2025-10-02'),
      type: 'NATIONAL' as const,
      description: 'Mahatma Gandhi\'s Birthday',
      year: 2025
    },
    {
      name: 'Diwali',
      date: new Date('2025-10-20'),
      type: 'RELIGIOUS' as const,
      description: 'Festival of Lights',
      year: 2025
    },
    {
      name: 'Christmas Day',
      date: new Date('2025-12-25'),
      type: 'PUBLIC' as const,
      description: 'Christmas celebration',
      year: 2025
    }
  ]

  for (const holiday of holidays) {
    await prisma.holiday.upsert({
      where: {
        name_date: {
          name: holiday.name,
          date: holiday.date
        }
      },
      update: {},
      create: holiday
    })
  }

  console.log('Holidays seeded successfully!')
}

seedHolidays()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })