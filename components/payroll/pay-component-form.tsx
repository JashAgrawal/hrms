"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

// Define the enums that are referenced in the component
enum PayComponentType {
  EARNING = "EARNING",
  DEDUCTION = "DEDUCTION",
}

enum PayComponentCategory {
  BASIC = "BASIC",
  ALLOWANCE = "ALLOWANCE",
  BONUS = "BONUS",
  OVERTIME = "OVERTIME",
  STATUTORY_DEDUCTION = "STATUTORY_DEDUCTION",
  OTHER_DEDUCTION = "OTHER_DEDUCTION",
  REIMBURSEMENT = "REIMBURSEMENT",
}

enum CalculationType {
  FIXED = "FIXED",
  PERCENTAGE = "PERCENTAGE",
  FORMULA = "FORMULA",
  ATTENDANCE_BASED = "ATTENDANCE_BASED",
}

const payComponentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  type: z.enum(["EARNING", "DEDUCTION"]),
  category: z.enum([
    "BASIC",
    "ALLOWANCE",
    "BONUS",
    "OVERTIME",
    "STATUTORY_DEDUCTION",
    "OTHER_DEDUCTION",
    "REIMBURSEMENT",
  ]),
  calculationType: z.enum([
    "FIXED",
    "PERCENTAGE",
    "FORMULA",
    "ATTENDANCE_BASED",
  ]),
  isStatutory: z.boolean().default(false),
  isTaxable: z.boolean().default(true),
  description: z.string().optional(),
  formula: z.string().optional(),
});

type PayComponentFormData = z.infer<typeof payComponentSchema>;

interface PayComponentFormProps {
  initialData?: Partial<PayComponentFormData>;
  onSubmit: (data: PayComponentFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const componentTypeOptions = [
  { value: PayComponentType.EARNING, label: "Earning" },
  { value: PayComponentType.DEDUCTION, label: "Deduction" },
];

const componentCategoryOptions = [
  { value: PayComponentCategory.BASIC, label: "Basic Salary" },
  { value: PayComponentCategory.ALLOWANCE, label: "Allowance" },
  { value: PayComponentCategory.BONUS, label: "Bonus" },
  { value: PayComponentCategory.OVERTIME, label: "Overtime" },
  {
    value: PayComponentCategory.STATUTORY_DEDUCTION,
    label: "Statutory Deduction",
  },
  { value: PayComponentCategory.OTHER_DEDUCTION, label: "Other Deduction" },
  { value: PayComponentCategory.REIMBURSEMENT, label: "Reimbursement" },
];

const calculationTypeOptions = [
  { value: CalculationType.FIXED, label: "Fixed Amount" },
  { value: CalculationType.PERCENTAGE, label: "Percentage" },
  { value: CalculationType.FORMULA, label: "Formula" },
  { value: CalculationType.ATTENDANCE_BASED, label: "Attendance Based" },
];

export function PayComponentForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: PayComponentFormProps) {
  const [error, setError] = useState<string | null>(null);

  const form = useForm<PayComponentFormData>({
    resolver: zodResolver(payComponentSchema) as any,
    defaultValues: {
      isStatutory: false,
      isTaxable: true,
      ...initialData,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = form;

  const watchedType = watch("type");
  const watchedCalculationType = watch("calculationType");

  const handleFormSubmit = async (data: PayComponentFormData) => {
    try {
      setError(null);
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {initialData ? "Edit Pay Component" : "Create Pay Component"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit as any)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Component Name *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g., Basic Salary"
                disabled={isLoading || isSubmitting}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Component Code *</Label>
              <Input
                id="code"
                {...register("code")}
                placeholder="e.g., BASIC"
                disabled={isLoading || isSubmitting}
              />
              {errors.code && (
                <p className="text-sm text-red-600">{errors.code.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Component Type *</Label>
              <Select
                value={watch("type")}
                onValueChange={(value) =>
                  setValue("type", value as "EARNING" | "DEDUCTION")
                }
                disabled={isLoading || isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {componentTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-red-600">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={watch("category")}
                onValueChange={(value) =>
                  setValue(
                    "category",
                    value as
                      | "BASIC"
                      | "ALLOWANCE"
                      | "BONUS"
                      | "OVERTIME"
                      | "STATUTORY_DEDUCTION"
                      | "OTHER_DEDUCTION"
                      | "REIMBURSEMENT"
                  )
                }
                disabled={isLoading || isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {componentCategoryOptions
                    .filter((option) => {
                      if (watchedType === "EARNING") {
                        return ![
                          "STATUTORY_DEDUCTION",
                          "OTHER_DEDUCTION",
                        ].includes(option.value);
                      } else if (watchedType === "DEDUCTION") {
                        return [
                          "STATUTORY_DEDUCTION",
                          "OTHER_DEDUCTION",
                        ].includes(option.value);
                      }
                      return true;
                    })
                    .map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-600">
                  {errors.category.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="calculationType">Calculation Type *</Label>
            <Select
              value={watch("calculationType")}
              onValueChange={(value) =>
                setValue(
                  "calculationType",
                  value as
                    | "FIXED"
                    | "PERCENTAGE"
                    | "FORMULA"
                    | "ATTENDANCE_BASED"
                )
              }
              disabled={isLoading || isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select calculation type" />
              </SelectTrigger>
              <SelectContent>
                {calculationTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.calculationType && (
              <p className="text-sm text-red-600">
                {errors.calculationType.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Optional description for this component"
              disabled={isLoading || isSubmitting}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-600">
                {errors.description.message}
              </p>
            )}
          </div>

          {watchedCalculationType === "FORMULA" && (
            <div className="space-y-2">
              <Label htmlFor="formula">Formula</Label>
              <Textarea
                id="formula"
                {...register("formula")}
                placeholder="e.g., BASIC * 0.12 (for PF calculation)"
                disabled={isLoading || isSubmitting}
                rows={2}
              />
              <p className="text-xs text-gray-500">
                Use component codes like BASIC, HRA, etc. in your formula
              </p>
              {errors.formula && (
                <p className="text-sm text-red-600">{errors.formula.message}</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isStatutory"
                checked={watch("isStatutory")}
                onCheckedChange={(checked) =>
                  setValue("isStatutory", !!checked)
                }
                disabled={isLoading || isSubmitting}
              />
              <Label htmlFor="isStatutory" className="text-sm font-normal">
                Statutory component (PF, ESI, TDS, etc.)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isTaxable"
                checked={watch("isTaxable")}
                onCheckedChange={(checked) => setValue("isTaxable", !!checked)}
                disabled={isLoading || isSubmitting}
              />
              <Label htmlFor="isTaxable" className="text-sm font-normal">
                Taxable component
              </Label>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading || isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {initialData ? "Update Component" : "Create Component"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
