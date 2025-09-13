"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: {
    name: string;
  } | null;
  designation?: string;
  status: "ACTIVE" | "INACTIVE" | "TERMINATED";
}

interface EmployeeSelectProps {
  employees: Employee[];
  value?: string | string[];
  onValueChange: (value: string | string[]) => void;
  placeholder?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  maxDisplayed?: number;
}

export function EmployeeSelect({
  employees,
  value,
  onValueChange,
  placeholder = "Select employee...",
  multiple = false,
  disabled = false,
  className,
  maxDisplayed = 3,
}: EmployeeSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter employees based on search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees.filter((emp) => emp.status === "ACTIVE");

    const query = searchQuery.toLowerCase();
    return employees.filter(
      (employee) =>
        employee.status === "ACTIVE" &&
        (employee.firstName.toLowerCase().includes(query) ||
          employee.lastName.toLowerCase().includes(query) ||
          employee.email.toLowerCase().includes(query) ||
          employee.employeeCode.toLowerCase().includes(query) ||
          employee.department?.name?.toLowerCase().includes(query) ||
          employee.designation?.toLowerCase().includes(query))
    );
  }, [employees, searchQuery]);

  // Get selected employees
  const selectedEmployees = useMemo(() => {
    if (!value) return [];
    const selectedIds = Array.isArray(value) ? value : [value];
    return employees.filter((emp) => selectedIds.includes(emp.id));
  }, [employees, value]);

  const handleSelect = (employeeId: string) => {
    if (multiple) {
      const currentValue = Array.isArray(value) ? value : [];
      const newValue = currentValue.includes(employeeId)
        ? currentValue.filter((id) => id !== employeeId)
        : [...currentValue, employeeId];
      onValueChange(newValue);
    } else {
      onValueChange(employeeId);
      setOpen(false);
    }
  };

  const handleRemove = (employeeId: string) => {
    if (multiple) {
      const currentValue = Array.isArray(value) ? value : [];
      onValueChange(currentValue.filter((id) => id !== employeeId));
    } else {
      onValueChange("");
    }
  };

  const getDisplayText = () => {
    if (selectedEmployees.length === 0) return placeholder;

    if (!multiple) {
      const employee = selectedEmployees[0];
      return `${employee.firstName} ${employee.lastName} (${employee.employeeCode})`;
    }

    if (selectedEmployees.length <= maxDisplayed) {
      return `${selectedEmployees.length} employee${
        selectedEmployees.length > 1 ? "s" : ""
      } selected`;
    }

    return `${selectedEmployees.length} employees selected`;
  };

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 px-3 py-2"
            disabled={disabled}
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedEmployees.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : multiple ? (
                <>
                  {selectedEmployees.slice(0, maxDisplayed).map((employee) => (
                    <Badge
                      key={employee.id}
                      variant="secondary"
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className="text-xs">
                          {employee.firstName[0]}
                          {employee.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs">
                        {employee.firstName} {employee.lastName}
                      </span>
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(employee.id);
                        }}
                      />
                    </Badge>
                  ))}
                  {selectedEmployees.length > maxDisplayed && (
                    <Badge variant="outline" className="px-2 py-1">
                      +{selectedEmployees.length - maxDisplayed} more
                    </Badge>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {selectedEmployees[0].firstName[0]}
                      {selectedEmployees[0].lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span>{getDisplayText()}</span>
                </div>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Search employees..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <CommandList className="max-h-[300px]">
              <CommandEmpty>No employees found.</CommandEmpty>
              <CommandGroup>
                {filteredEmployees.map((employee) => {
                  const isSelected = multiple
                    ? Array.isArray(value) && value.includes(employee.id)
                    : value === employee.id;

                  return (
                    <CommandItem
                      key={employee.id}
                      value={`${employee.firstName} ${employee.lastName} ${employee.employeeCode}`}
                      onSelect={() => handleSelect(employee.id)}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {employee.firstName[0]}
                            {employee.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {employee.firstName} {employee.lastName}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {employee.employeeCode}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {employee.designation && employee.department?.name
                              ? `${employee.designation} • ${employee.department.name}`
                              : employee.designation ||
                                employee.department?.name ||
                                employee.email}
                          </div>
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
