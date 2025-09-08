'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Search, Plus, MoreHorizontal, Edit, Trash2, Users } from 'lucide-react'

interface SalaryGrade {
  id: string
  name: string
  code: string
  description?: string
  minSalary: number
  maxSalary: number
  currency: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: {
    salaryStructures: number
  }
}

interface SalaryGradeListProps {
  grades: SalaryGrade[]
  onEdit: (grade: SalaryGrade) => void
  onDelete: (gradeId: string) => Promise<void>
  onCreate: () => void
  isLoading?: boolean
}

export function SalaryGradeList({
  grades,
  onEdit,
  onDelete,
  onCreate,
  isLoading = false,
}: SalaryGradeListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteGradeId, setDeleteGradeId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredGrades = grades.filter(grade =>
    grade.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    grade.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDelete = async () => {
    if (!deleteGradeId) return

    try {
      setIsDeleting(true)
      await onDelete(deleteGradeId)
      setDeleteGradeId(null)
    } catch (error) {
      console.error('Error deleting salary grade:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Salary Grades</CardTitle>
            <Button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Grade
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search grades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Salary Range</TableHead>
                  <TableHead>Structures</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchTerm ? 'No grades found matching your search.' : 'No salary grades found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGrades.map((grade) => (
                    <TableRow key={grade.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{grade.name}</div>
                          {grade.description && (
                            <div className="text-sm text-gray-500 mt-1">
                              {grade.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{grade.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatCurrency(grade.minSalary, grade.currency)}</div>
                          <div className="text-gray-500">to</div>
                          <div>{formatCurrency(grade.maxSalary, grade.currency)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{grade._count.salaryStructures}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={grade.isActive ? 'default' : 'secondary'}>
                          {grade.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(grade)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteGradeId(grade.id)}
                              disabled={grade._count.salaryStructures > 0}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteGradeId} onOpenChange={() => setDeleteGradeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Salary Grade</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this salary grade? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}