"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  contentClassName?: string
  loading?: boolean
  allowClear?: boolean
  renderOption?: (option: SearchableSelectOption) => React.ReactNode
  renderValue?: (option: SearchableSelectOption | null) => React.ReactNode
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search options...",
  emptyMessage = "No options found.",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  loading = false,
  allowClear = false,
  renderOption,
  renderValue,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)

  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [options, searchValue])

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === value && allowClear) {
      onValueChange?.("")
    } else {
      onValueChange?.(selectedValue)
    }
    setOpen(false)
    setSearchValue("")
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange?.("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !selectedOption && "text-muted-foreground",
            triggerClassName
          )}
          disabled={disabled || loading}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {loading ? (
              <span>Loading...</span>
            ) : selectedOption ? (
              renderValue ? (
                renderValue(selectedOption)
              ) : (
                <span className="truncate">{selectedOption.label}</span>
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {allowClear && selectedOption && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center"
              >
                ×
              </button>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-full p-0", contentClassName)} align="start">
        <Command className={className}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={setSearchValue}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                  disabled={option.disabled}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    {renderOption ? (
                      renderOption(option)
                    ) : (
                      <div>
                        <div className="truncate">{option.label}</div>
                        {option.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {option.description}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Hook for easier integration with react-hook-form
export function useSearchableSelect(
  options: SearchableSelectOption[],
  defaultValue?: string
) {
  const [value, setValue] = React.useState(defaultValue || "")

  const selectedOption = options.find((option) => option.value === value)

  return {
    value,
    setValue,
    selectedOption,
    props: {
      options,
      value,
      onValueChange: setValue,
    },
  }
}
