import { prisma } from "@/lib/prisma";
import puppeteer from 'puppeteer';

export interface PayslipData {
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    designation: string;
    joiningDate: string;
    panNumber?: string;
    pfNumber?: string;
    esiNumber?: string;
    department: {
      name: string;
      code: string;
    };
  };
  payrollRun: {
    id: string;
    period: string;
    startDate: string;
    endDate: string;
  };
  payrollRecord: {
    id: string;
    basicSalary: number;
    grossSalary: number;
    netSalary: number;
    totalEarnings: number;
    totalDeductions: number;
    workingDays: number;
    presentDays: number;
    absentDays: number;
    overtimeHours?: number;
    overtimeAmount?: number;
    lopDays?: number;
    lopAmount?: number;
    pfDeduction?: number;
    esiDeduction?: number;
    tdsDeduction?: number;
    ptDeduction?: number;
    earnings: Array<{
      componentName: string;
      componentCode: string;
      calculatedValue: number;
      isProrated: boolean;
    }>;
    deductions: Array<{
      componentName: string;
      componentCode: string;
      calculatedValue: number;
      isProrated: boolean;
    }>;
  };
  company: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    panNumber: string;
    pfNumber?: string;
    esiNumber?: string;
    logo?: string;
  };
}

export interface PayslipTemplate {
  header: {
    companyName: string;
    companyAddress: string;
    title: string;
    period: string;
  };
  employee: {
    name: string;
    employeeCode: string;
    designation: string;
    department: string;
    joiningDate: string;
    panNumber?: string;
    pfNumber?: string;
    esiNumber?: string;
  };
  attendance: {
    workingDays: number;
    presentDays: number;
    absentDays: number;
    lopDays?: number;
    overtimeHours?: number;
  };
  earnings: Array<{
    component: string;
    amount: number;
    isProrated?: boolean;
  }>;
  deductions: Array<{
    component: string;
    amount: number;
    isProrated?: boolean;
  }>;
  summary: {
    totalEarnings: number;
    totalDeductions: number;
    netSalary: number;
  };
  footer: {
    generatedDate: string;
    note: string;
  };
}

export class PayslipService {
  /**
   * Get payslip data for a specific payroll record
   */
  async getPayslipData(payrollRecordId: string): Promise<PayslipData> {
    const payrollRecord = await prisma.payrollRecord.findUnique({
      where: { id: payrollRecordId },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
        payrollRun: true,
      },
    });

    if (!payrollRecord) {
      throw new Error("Payroll record not found");
    }

    // Get company information (in a real app, this would come from settings)
    const company = {
      name: "Pekka HR Solutions",
      address: "Tech Park, Electronic City",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560100",
      panNumber: "ABCDE1234F",
      pfNumber: "KA/BGE/12345",
      esiNumber: "12345678901234567",
    };

    return {
      employee: {
        id: payrollRecord.employee.id,
        employeeCode: payrollRecord.employee.employeeCode,
        firstName: payrollRecord.employee.firstName,
        lastName: payrollRecord.employee.lastName,
        email: payrollRecord.employee.email,
        designation: payrollRecord.employee.designation,
        joiningDate: payrollRecord.employee.joiningDate.toISOString(),
        panNumber: payrollRecord.employee.panNumber || undefined,
        pfNumber: payrollRecord.employee.pfNumber || undefined,
        esiNumber: payrollRecord.employee.esiNumber || undefined,
        department: {
          name: payrollRecord.employee.department.name,
          code: payrollRecord.employee.department.code,
        },
      },
      payrollRun: {
        id: payrollRecord.payrollRun.id,
        period: payrollRecord.payrollRun.period,
        startDate: payrollRecord.payrollRun.startDate.toISOString(),
        endDate: payrollRecord.payrollRun.endDate.toISOString(),
      },
      payrollRecord: {
        id: payrollRecord.id,
        basicSalary: Number(payrollRecord.basicSalary),
        grossSalary: Number(payrollRecord.grossSalary),
        netSalary: Number(payrollRecord.netSalary),
        totalEarnings: Number(payrollRecord.totalEarnings),
        totalDeductions: Number(payrollRecord.totalDeductions),
        workingDays: payrollRecord.workingDays,
        presentDays: Number(payrollRecord.presentDays),
        absentDays: Number(payrollRecord.absentDays),
        overtimeHours: payrollRecord.overtimeHours
          ? Number(payrollRecord.overtimeHours)
          : undefined,
        overtimeAmount: payrollRecord.overtimeAmount
          ? Number(payrollRecord.overtimeAmount)
          : undefined,
        lopDays: payrollRecord.lopDays
          ? Number(payrollRecord.lopDays)
          : undefined,
        lopAmount: payrollRecord.lopAmount
          ? Number(payrollRecord.lopAmount)
          : undefined,
        pfDeduction: payrollRecord.pfDeduction
          ? Number(payrollRecord.pfDeduction)
          : undefined,
        esiDeduction: payrollRecord.esiDeduction
          ? Number(payrollRecord.esiDeduction)
          : undefined,
        tdsDeduction: payrollRecord.tdsDeduction
          ? Number(payrollRecord.tdsDeduction)
          : undefined,
        ptDeduction: payrollRecord.ptDeduction
          ? Number(payrollRecord.ptDeduction)
          : undefined,
        earnings: (payrollRecord.earnings as any[]) || [],
        deductions: (payrollRecord.deductions as any[]) || [],
      },
      company,
    };
  }

  /**
   * Generate payslip template data
   */
  generatePayslipTemplate(payslipData: PayslipData): PayslipTemplate {
    const { employee, payrollRun, payrollRecord, company } = payslipData;

    return {
      header: {
        companyName: company.name,
        companyAddress: `${company.address}, ${company.city}, ${company.state} - ${company.pincode}`,
        title: "Salary Slip",
        period: this.formatPeriod(payrollRun.period),
      },
      employee: {
        name: `${employee.firstName} ${employee.lastName}`,
        employeeCode: employee.employeeCode,
        designation: employee.designation,
        department: employee.department.name,
        joiningDate: this.formatDate(employee.joiningDate),
        panNumber: employee.panNumber,
        pfNumber: employee.pfNumber,
        esiNumber: employee.esiNumber,
      },
      attendance: {
        workingDays: payrollRecord.workingDays,
        presentDays: payrollRecord.presentDays,
        absentDays: payrollRecord.absentDays,
        lopDays: payrollRecord.lopDays,
        overtimeHours: payrollRecord.overtimeHours,
      },
      earnings: payrollRecord.earnings.map((earning) => ({
        component: earning.componentName,
        amount: earning.calculatedValue,
        isProrated: earning.isProrated,
      })),
      deductions: payrollRecord.deductions.map((deduction) => ({
        component: deduction.componentName,
        amount: deduction.calculatedValue,
        isProrated: deduction.isProrated,
      })),
      summary: {
        totalEarnings: payrollRecord.totalEarnings,
        totalDeductions: payrollRecord.totalDeductions,
        netSalary: payrollRecord.netSalary,
      },
      footer: {
        generatedDate: new Date().toLocaleDateString("en-IN"),
        note: "This is a computer-generated payslip and does not require a signature.",
      },
    };
  }

  /**
   * Generate HTML content for payslip
   */
  generatePayslipHTML(template: PayslipTemplate): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payslip - ${template.employee.name} - ${
      template.header.period
    }</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .payslip-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .company-name {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .company-address {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 20px;
        }
        .payslip-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .period {
            font-size: 16px;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 15px;
            padding-bottom: 5px;
            border-bottom: 2px solid #e2e8f0;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f1f5f9;
        }
        .info-label {
            font-weight: 600;
            color: #64748b;
        }
        .info-value {
            font-weight: 500;
        }
        .earnings-deductions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .component-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .component-table th {
            background-color: #f8fafc;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #475569;
            border-bottom: 2px solid #e2e8f0;
        }
        .component-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #f1f5f9;
        }
        .component-table .amount {
            text-align: right;
            font-weight: 500;
        }
        .earnings-section {
            border-left: 4px solid #10b981;
            padding-left: 20px;
        }
        .deductions-section {
            border-left: 4px solid #ef4444;
            padding-left: 20px;
        }
        .total-row {
            background-color: #f8fafc;
            font-weight: bold;
        }
        .summary {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            text-align: center;
        }
        .summary-item {
            padding: 15px;
            background: white;
            border-radius: 6px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        .summary-label {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 5px;
        }
        .summary-value {
            font-size: 20px;
            font-weight: bold;
        }
        .earnings-value { color: #10b981; }
        .deductions-value { color: #ef4444; }
        .net-value { color: #667eea; }
        .footer {
            background-color: #f8fafc;
            padding: 20px 30px;
            text-align: center;
            color: #64748b;
            font-size: 12px;
            border-top: 1px solid #e2e8f0;
        }
        .prorated {
            color: #f59e0b;
            font-size: 11px;
            font-weight: 500;
        }
        @media print {
            body { background-color: white; padding: 0; }
            .payslip-container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="payslip-container">
        <div class="header">
            <div class="company-name">${template.header.companyName}</div>
            <div class="company-address">${template.header.companyAddress}</div>
            <div class="payslip-title">${template.header.title}</div>
            <div class="period">${template.header.period}</div>
        </div>
        
        <div class="content">
            <div class="section">
                <div class="section-title">Employee Information</div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Name:</span>
                        <span class="info-value">${
                          template.employee.name
                        }</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Employee Code:</span>
                        <span class="info-value">${
                          template.employee.employeeCode
                        }</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Designation:</span>
                        <span class="info-value">${
                          template.employee.designation
                        }</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Department:</span>
                        <span class="info-value">${
                          template.employee.department
                        }</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Date of Joining:</span>
                        <span class="info-value">${
                          template.employee.joiningDate
                        }</span>
                    </div>
                    ${
                      template.employee.panNumber
                        ? `
                    <div class="info-item">
                        <span class="info-label">PAN Number:</span>
                        <span class="info-value">${template.employee.panNumber}</span>
                    </div>
                    `
                        : ""
                    }
                </div>
            </div>

            <div class="section">
                <div class="section-title">Attendance Summary</div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Working Days:</span>
                        <span class="info-value">${
                          template.attendance.workingDays
                        }</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Present Days:</span>
                        <span class="info-value">${
                          template.attendance.presentDays
                        }</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Absent Days:</span>
                        <span class="info-value">${
                          template.attendance.absentDays
                        }</span>
                    </div>
                    ${
                      template.attendance.lopDays
                        ? `
                    <div class="info-item">
                        <span class="info-label">LOP Days:</span>
                        <span class="info-value">${template.attendance.lopDays}</span>
                    </div>
                    `
                        : ""
                    }
                    ${
                      template.attendance.overtimeHours
                        ? `
                    <div class="info-item">
                        <span class="info-label">Overtime Hours:</span>
                        <span class="info-value">${template.attendance.overtimeHours}</span>
                    </div>
                    `
                        : ""
                    }
                </div>
            </div>

            <div class="earnings-deductions">
                <div class="earnings-section">
                    <div class="section-title">Earnings</div>
                    <table class="component-table">
                        <thead>
                            <tr>
                                <th>Component</th>
                                <th class="amount">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${template.earnings
                              .map(
                                (earning) => `
                            <tr>
                                <td>
                                    ${earning.component}
                                    ${
                                      earning.isProrated
                                        ? '<span class="prorated">*</span>'
                                        : ""
                                    }
                                </td>
                                <td class="amount">${earning.amount.toLocaleString(
                                  "en-IN",
                                  {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  }
                                )}</td>
                            </tr>
                            `
                              )
                              .join("")}
                            <tr class="total-row">
                                <td>Total Earnings</td>
                                <td class="amount">${template.summary.totalEarnings.toLocaleString(
                                  "en-IN",
                                  {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  }
                                )}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="deductions-section">
                    <div class="section-title">Deductions</div>
                    <table class="component-table">
                        <thead>
                            <tr>
                                <th>Component</th>
                                <th class="amount">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${template.deductions
                              .map(
                                (deduction) => `
                            <tr>
                                <td>
                                    ${deduction.component}
                                    ${
                                      deduction.isProrated
                                        ? '<span class="prorated">*</span>'
                                        : ""
                                    }
                                </td>
                                <td class="amount">${deduction.amount.toLocaleString(
                                  "en-IN",
                                  {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  }
                                )}</td>
                            </tr>
                            `
                              )
                              .join("")}
                            <tr class="total-row">
                                <td>Total Deductions</td>
                                <td class="amount">${template.summary.totalDeductions.toLocaleString(
                                  "en-IN",
                                  {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  }
                                )}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="summary">
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">Total Earnings</div>
                        <div class="summary-value earnings-value">₹${template.summary.totalEarnings.toLocaleString(
                          "en-IN"
                        )}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Total Deductions</div>
                        <div class="summary-value deductions-value">₹${template.summary.totalDeductions.toLocaleString(
                          "en-IN"
                        )}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Net Salary</div>
                        <div class="summary-value net-value">₹${template.summary.netSalary.toLocaleString(
                          "en-IN"
                        )}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p><strong>Generated on:</strong> ${
              template.footer.generatedDate
            }</p>
            <p>${template.footer.note}</p>
            ${
              template.earnings.some((e) => e.isProrated) ||
              template.deductions.some((d) => d.isProrated)
                ? '<p><span class="prorated">*</span> Prorated based on attendance</p>'
                : ""
            }
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Get payslips for multiple employees
   */
  async getBulkPayslips(payrollRunId: string): Promise<PayslipData[]> {
    const payrollRecords = await prisma.payrollRecord.findMany({
      where: {
        payrollRunId,
        status: { in: ["APPROVED", "PAID"] },
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
        payrollRun: true,
      },
      orderBy: {
        employee: {
          employeeCode: "asc",
        },
      },
    });

    const payslips: PayslipData[] = [];

    for (const record of payrollRecords) {
      try {
        const payslipData = await this.getPayslipData(record.id);
        payslips.push(payslipData);
      } catch (error) {
        console.error(
          `Error generating payslip for record ${record.id}:`,
          error
        );
      }
    }

    return payslips;
  }

  /**
   * Format currency amount
   */
  private formatCurrency(amount: number): string {
    return amount.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  /**
   * Format number
   */
  private formatNumber(amount: number): string {
    return amount.toLocaleString("en-IN");
  }

  /**
   * Format date
   */
  private formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /**
   * Generate payslip PDF buffer using Puppeteer
   */
  async generatePayslipPDF(payslipData: PayslipData): Promise<Buffer> {
    const template = this.generatePayslipTemplate(payslipData);
    const html = this.generatePayslipHTML(template);
    
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      return Buffer.from(pdfBuffer);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Generate payslip HTML buffer (for backward compatibility)
   */
  async generatePayslip(payslipData: PayslipData): Promise<Buffer> {
    const template = this.generatePayslipTemplate(payslipData);
    const html = this.generatePayslipHTML(template);
    
    return Buffer.from(html, 'utf-8');
  }

  /**
   * Format period
   */
  private formatPeriod(period: string): string {
    const [year, month] = period.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }
}

// Export singleton instance
export const payslipService = new PayslipService();

// Export generator for backward compatibility
export const payslipGenerator = payslipService;
