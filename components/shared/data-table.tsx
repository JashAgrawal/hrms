"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Search,
  Filter
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Column<T> {
  key: keyof T | string
  accessorKey?: string
  id?: string
  header: string
  cell?: (props: { row: { original: T } }) => React.ReactNode
  sortable?: boolean
  searchable?: boolean
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  searchable?: boolean
  filterable?: boolean
  pagination?: boolean
  pageSize?: number
  className?: string
  emptyMessage?: string
  searchKey?: string
  searchPlaceholder?: string
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  searchable = true,
  filterable = false,
  pagination = true,
  pageSize = 10,
  className,
  emptyMessage = "No data available",
  searchKey,
  searchPlaceholder = "Search..."
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [sortConfig, setSortConfig] = React.useState<{
    key: string
    direction: "asc" | "desc"
  } | null>(null)

  // Filter data based on search term
  const filteredData = React.useMemo(() => {
    if (!searchTerm) return data
    
    return data.filter((item) => {
      if (searchKey) {
        // Use specific search key if provided
        const keys = searchKey.split('.')
        let value: any = item
        for (const key of keys) {
          value = value?.[key]
        }
        return String(value || "").toLowerCase().includes(searchTerm.toLowerCase())
      }
      
      // Fallback to searching all searchable columns
      return columns.some((column) => {
        if (!column.searchable) return false
        const value = item[column.key as keyof T]
        return String(value).toLowerCase().includes(searchTerm.toLowerCase())
      })
    })
  }, [data, searchTerm, columns, searchKey])

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortConfig) return filteredData
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]
      
      // Convert to strings for comparison if they're not primitive types
      const aStr = String(aValue ?? "")
      const bStr = String(bValue ?? "")
      
      if (aStr < bStr) {
        return sortConfig.direction === "asc" ? -1 : 1
      }
      if (aStr > bStr) {
        return sortConfig.direction === "asc" ? 1 : -1
      }
      return 0
    })
  }, [filteredData, sortConfig])

  // Paginate data
  const paginatedData = React.useMemo(() => {
    if (!pagination) return sortedData
    
    const startIndex = (currentPage - 1) * pageSize
    return sortedData.slice(startIndex, startIndex + pageSize)
  }, [sortedData, currentPage, pageSize, pagination])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc"
        }
      }
      return { key, direction: "asc" }
    })
  }

  const renderCell = (item: T, column: Column<T>) => {
    if (column.cell) {
      return column.cell({ row: { original: item } })
    }
    return String(item[column.key as keyof T] || "")
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and Filter Bar */}
      {(searchable || filterable) && (
        <div className="flex items-center justify-between gap-4">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          {filterable && (
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={cn(
                    column.sortable && "cursor-pointer hover:bg-muted/50",
                    column.className
                  )}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && sortConfig?.key === column.key && (
                      <span className="text-xs">
                        {sortConfig.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className={column.className}
                    >
                      {renderCell(item, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to{" "}
            {Math.min(currentPage * pageSize, sortedData.length)} of{" "}
            {sortedData.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}