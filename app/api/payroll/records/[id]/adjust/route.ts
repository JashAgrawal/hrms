import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PayrollRecordStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const adjustPayrollRecordSchema = z.object({
  adjustmentType: z.enum(["BONUS", "DEDUCTION", "CORRECTION", "ALLOWANCE"]),
  amount: z.number(),
  reason: z.string().min(1, "Reason is required"),
  componentCode: z.string().optional(), // For component-specific adjustments
  description: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to adjust payroll records
    if (!["ADMIN", "HR", "FINANCE"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = adjustPayrollRecordSchema.parse(body);

    // Get the payroll record
    const payrollRecord = await prisma.payrollRecord.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        payrollRun: {
          select: {
            id: true,
            period: true,
            status: true,
          },
        },
      },
    });

    if (!payrollRecord) {
      return NextResponse.json(
        { error: "Payroll record not found" },
        { status: 404 }
      );
    }

    // Check if adjustments are allowed
    if (payrollRecord.status === PayrollRecordStatus.PAID) {
      return NextResponse.json(
        { error: "Cannot adjust payroll records that have already been paid" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Store original values for audit
      const originalValues = {
        grossSalary: payrollRecord.grossSalary,
        netSalary: payrollRecord.netSalary,
        totalEarnings: payrollRecord.totalEarnings,
        totalDeductions: payrollRecord.totalDeductions,
        earnings: payrollRecord.earnings,
        deductions: payrollRecord.deductions,
      };

      // Calculate new values based on adjustment type
      let newGrossSalary = Number(payrollRecord.grossSalary);
      let newNetSalary = Number(payrollRecord.netSalary);
      let newTotalEarnings = Number(payrollRecord.totalEarnings);
      let newTotalDeductions = Number(payrollRecord.totalDeductions);
      let newEarnings = payrollRecord.earnings as any[];
      let newDeductions = payrollRecord.deductions as any[];

      switch (validatedData.adjustmentType) {
        case "BONUS":
          newTotalEarnings += validatedData.amount;
          newGrossSalary += validatedData.amount;
          newNetSalary += validatedData.amount;

          // Add bonus to earnings
          newEarnings = [
            ...newEarnings,
            {
              componentId: "adjustment",
              componentName: "Bonus Adjustment",
              componentCode: "BONUS_ADJ",
              baseValue: validatedData.amount,
              calculatedValue: validatedData.amount,
              isProrated: false,
            },
          ];
          break;

        case "DEDUCTION":
          newTotalDeductions += validatedData.amount;
          newNetSalary -= validatedData.amount;

          // Add deduction
          newDeductions = [
            ...newDeductions,
            {
              componentId: "adjustment",
              componentName: "Deduction Adjustment",
              componentCode: "DEDUCTION_ADJ",
              baseValue: validatedData.amount,
              calculatedValue: validatedData.amount,
              isProrated: false,
            },
          ];
          break;

        case "ALLOWANCE":
          newTotalEarnings += validatedData.amount;
          newGrossSalary += validatedData.amount;
          newNetSalary += validatedData.amount;

          // Add allowance to earnings
          newEarnings = [
            ...newEarnings,
            {
              componentId: "adjustment",
              componentName: validatedData.description || "Special Allowance",
              componentCode: validatedData.componentCode || "SPECIAL_ADJ",
              baseValue: validatedData.amount,
              calculatedValue: validatedData.amount,
              isProrated: false,
            },
          ];
          break;

        case "CORRECTION":
          // For corrections, the amount represents the new net salary
          const difference =
            validatedData.amount - Number(payrollRecord.netSalary);
          newNetSalary = validatedData.amount;
          newGrossSalary += difference;
          newTotalEarnings += difference;
          break;
      }

      // Update the payroll record
      const updatedRecord = await tx.payrollRecord.update({
        where: { id },
        data: {
          grossSalary: new Decimal(newGrossSalary),
          netSalary: new Decimal(newNetSalary),
          totalEarnings: new Decimal(newTotalEarnings),
          totalDeductions: new Decimal(newTotalDeductions),
          earnings: newEarnings,
          deductions: newDeductions,
          status: PayrollRecordStatus.CALCULATED, // Reset to calculated for re-approval
        },
      });

      // Create audit log for the adjustment
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "PAYROLL_RECORD_ADJUSTED",
          resource: "PAYROLL_RECORD",
          resourceId: id,
          oldValues: originalValues,
          newValues: {
            grossSalary: newGrossSalary,
            netSalary: newNetSalary,
            totalEarnings: newTotalEarnings,
            totalDeductions: newTotalDeductions,
            adjustmentType: validatedData.adjustmentType,
            adjustmentAmount: validatedData.amount,
            reason: validatedData.reason,
            description: validatedData.description,
          },
        },
      });

      // Update payroll run totals
      const allRecords = await tx.payrollRecord.findMany({
        where: { payrollRunId: payrollRecord.payrollRunId },
      });

      const totalGross = allRecords.reduce(
        (sum, record) =>
          sum +
          (record.id === id
            ? newGrossSalary
            : Number(record.grossSalary)),
        0
      );
      const totalNet = allRecords.reduce(
        (sum, record) =>
          sum +
          (record.id === id ? newNetSalary : Number(record.netSalary)),
        0
      );
      const runTotalDeductions = allRecords.reduce(
        (sum, record) =>
          sum +
          (record.id === id
            ? newTotalDeductions
            : Number(record.totalDeductions)),
        0
      );

      await tx.payrollRun.update({
        where: { id: payrollRecord.payrollRunId },
        data: {
          totalGross: new Decimal(totalGross),
          totalNet: new Decimal(totalNet),
          totalDeductions: new Decimal(runTotalDeductions),
        },
      });

      return updatedRecord;
    });

    return NextResponse.json({
      message: "Payroll record adjusted successfully",
      payrollRecord: result,
      adjustment: {
        type: validatedData.adjustmentType,
        amount: validatedData.amount,
        reason: validatedData.reason,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error adjusting payroll record:", error);
    return NextResponse.json(
      { error: "Failed to adjust payroll record" },
      { status: 500 }
    );
  }
}
