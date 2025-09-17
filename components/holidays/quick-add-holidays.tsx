'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { Calendar, Plus, Loader2 } from 'lucide-react'

interface QuickHoliday {
  name: string
  date: string
  type: 'PUBLIC' | 'COMPANY' | 'OPTIONAL' | 'RELIGIOUS' | 'NATIONAL'
  description: string
  isOptional: boolean
}

interface QuickAddHolidaysProps {
  year: number
  onHolidaysAdded: () => void
}

export function QuickAddHolidays({ year, onHolidaysAdded }: QuickAddHolidaysProps) {
  const [selectedHolidays, setSelectedHolidays] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Common Indian holidays template
  const commonHolidays: QuickHoliday[] = [
    {
      name: 'New Year\'s Day',
      date: `${year}-01-01`,
      type: 'COMPANY',
      description: 'Start of the new year',
      isOptional: false
    },
    {
      name: 'Republic Day',
      date: `${year}-01-26`,
      type: 'NATIONAL',
      description: 'Republic Day of India',
      isOptional: false
    },
    {
      name: 'Holi',
      date: `${year}-03-14`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Festival of Colors',
      isOptional: true
    },
    {
      name: 'Good Friday',
      date: `${year}-03-29`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Crucifixion of Jesus Christ',
      isOptional: true
    },
    {
      name: 'Eid ul-Fitr',
      date: `${year}-04-11`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Festival marking the end of Ramadan',
      isOptional: true
    },
    {
      name: 'Buddha Purnima',
      date: `${year}-05-23`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Birth anniversary of Gautama Buddha',
      isOptional: true
    },
    {
      name: 'Eid ul-Adha',
      date: `${year}-06-17`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Festival of Sacrifice',
      isOptional: true
    },
    {
      name: 'Independence Day',
      date: `${year}-08-15`,
      type: 'NATIONAL',
      description: 'Independence Day of India',
      isOptional: false
    },
    {
      name: 'Raksha Bandhan',
      date: `${year}-08-19`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Festival celebrating brother-sister bond',
      isOptional: true
    },
    {
      name: 'Janmashtami',
      date: `${year}-08-26`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Birth of Lord Krishna',
      isOptional: true
    },
    {
      name: 'Ganesh Chaturthi',
      date: `${year}-09-07`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Birth of Lord Ganesha',
      isOptional: true
    },
    {
      name: 'Gandhi Jayanti',
      date: `${year}-10-02`,
      type: 'NATIONAL',
      description: 'Birth anniversary of Mahatma Gandhi',
      isOptional: false
    },
    {
      name: 'Dussehra',
      date: `${year}-10-12`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Victory of good over evil',
      isOptional: true
    },
    {
      name: 'Karva Chauth',
      date: `${year}-11-01`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Hindu festival observed by married women',
      isOptional: true
    },
    {
      name: 'Diwali',
      date: `${year}-11-01`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Festival of Lights',
      isOptional: true
    },
    {
      name: 'Guru Nanak Jayanti',
      date: `${year}-11-15`, // Approximate date, varies each year
      type: 'RELIGIOUS',
      description: 'Birth anniversary of Guru Nanak',
      isOptional: true
    },
    {
      name: 'Christmas',
      date: `${year}-12-25`,
      type: 'RELIGIOUS',
      description: 'Birth of Jesus Christ',
      isOptional: true
    }
  ]

  const handleHolidayToggle = (holidayName: string) => {
    setSelectedHolidays(prev => 
      prev.includes(holidayName)
        ? prev.filter(name => name !== holidayName)
        : [...prev, holidayName]
    )
  }

  const handleSelectAll = () => {
    if (selectedHolidays.length === commonHolidays.length) {
      setSelectedHolidays([])
    } else {
      setSelectedHolidays(commonHolidays.map(h => h.name))
    }
  }

  const handleAddHolidays = async () => {
    if (selectedHolidays.length === 0) {
      toast({
        title: 'No holidays selected',
        description: 'Please select at least one holiday to add',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const holidaysToAdd = commonHolidays.filter(h => selectedHolidays.includes(h.name))
      
      // Add holidays one by one
      const results = await Promise.allSettled(
        holidaysToAdd.map(holiday =>
          fetch('/api/holidays', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(holiday),
          })
        )
      )

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      if (successful > 0) {
        toast({
          title: 'Success',
          description: `${successful} holidays added successfully${failed > 0 ? `, ${failed} failed` : ''}`,
        })
        setSelectedHolidays([])
        onHolidaysAdded()
      } else {
        throw new Error('All holidays failed to add')
      }
    } catch (error) {
      console.error('Error adding holidays:', error)
      toast({
        title: 'Error',
        description: 'Failed to add holidays. Some may already exist.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getTypeColor = (type: string) => {
    const colors = {
      PUBLIC: 'bg-blue-100 text-blue-800',
      COMPANY: 'bg-green-100 text-green-800',
      OPTIONAL: 'bg-purple-100 text-purple-800',
      RELIGIOUS: 'bg-orange-100 text-orange-800',
      NATIONAL: 'bg-red-100 text-red-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          Quick Add Common Holidays
        </CardTitle>
        <CardDescription>
          Select from common Indian holidays for {year}. Note: Dates for religious festivals are approximate and may need adjustment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
          >
            {selectedHolidays.length === commonHolidays.length ? 'Deselect All' : 'Select All'}
          </Button>
          <div className="text-sm text-muted-foreground">
            {selectedHolidays.length} of {commonHolidays.length} selected
          </div>
        </div>

        <div className="grid gap-3 max-h-96 overflow-y-auto">
          {commonHolidays.map((holiday) => (
            <div
              key={holiday.name}
              className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50"
            >
              <Checkbox
                id={holiday.name}
                checked={selectedHolidays.includes(holiday.name)}
                onCheckedChange={() => handleHolidayToggle(holiday.name)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={holiday.name}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {holiday.name}
                  </label>
                  <div className="flex items-center space-x-2">
                    <Badge className={getTypeColor(holiday.type)}>
                      {holiday.type}
                    </Badge>
                    {holiday.isOptional && (
                      <Badge variant="secondary" className="text-xs">
                        Optional
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(holiday.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })} • {holiday.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button
            onClick={handleAddHolidays}
            disabled={selectedHolidays.length === 0 || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Plus className="mr-2 h-4 w-4" />
            Add {selectedHolidays.length} Holiday{selectedHolidays.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}