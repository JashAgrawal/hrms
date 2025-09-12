// Email service for payslip distribution
import nodemailer from 'nodemailer';

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
}

export class EmailService {
  private static instance: EmailService
  private transporter: nodemailer.Transporter | null = null
  
  private constructor() {
    this.initializeTransporter()
  }
  
  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  private initializeTransporter() {
    // Initialize email transporter based on environment variables
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    } else if (process.env.SENDGRID_API_KEY) {
      // SendGrid configuration would go here
      console.log('SendGrid configuration detected but not implemented in this example')
    } else {
      // Development mode - use Ethereal Email for testing
      console.log('No email configuration found, using development mode')
    }
  }

  /**
   * Send email with optional attachments
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (this.transporter) {
        // Use configured transporter
        const mailOptions = {
          from: process.env.FROM_EMAIL || 'noreply@pekka-hr.com',
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          attachments: options.attachments?.map(att => ({
            filename: att.filename,
            content: att.content,
            contentType: att.contentType,
          })),
        }

        await this.transporter.sendMail(mailOptions)
        console.log('📧 Email sent successfully to:', options.to)
        return true
      } else {
        // Development mode - simulate email sending
        console.log('📧 [DEV MODE] Simulating email send:', {
          to: options.to,
          subject: options.subject,
          attachments: options.attachments?.length || 0,
        })

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100))
        return true
      }
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }

  /**
   * Send payslip email with standardized template
   */
  async sendPayslipEmail({
    employeeEmail,
    employeeName,
    period,
    payslipBuffer,
    payslipFileName,
    customSubject,
    customMessage,
  }: {
    employeeEmail: string
    employeeName: string
    period: string
    payslipBuffer: Buffer
    payslipFileName: string
    customSubject?: string
    customMessage?: string
  }): Promise<boolean> {
    const periodText = new Date(period + '-01').toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })

    const subject = customSubject || `Payslip for ${periodText}`
    
    const defaultMessage = `Dear ${employeeName},

Please find attached your payslip for ${periodText}.

If you have any questions regarding your payslip, please contact the HR department.

Best regards,
HR Team`

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Payslip - ${periodText}</h2>
          <div style="background-color: white; padding: 20px; border-radius: 4px; border-left: 4px solid #007bff;">
            ${(customMessage || defaultMessage).replace(/\n/g, '<br>')}
          </div>
          <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              This is an automated email. Please do not reply to this message.
              For any queries, please contact your HR department.
            </p>
          </div>
        </div>
      </div>
    `

    return this.sendEmail({
      to: employeeEmail,
      subject,
      html,
      text: customMessage || defaultMessage,
      attachments: [
        {
          filename: payslipFileName,
          content: payslipBuffer,
          contentType: 'application/pdf',
        },
      ],
    })
  }

  /**
   * Send bulk payslip emails
   */
  async sendBulkPayslipEmails(payslips: Array<{
    employeeEmail: string
    employeeName: string
    period: string
    payslipBuffer: Buffer
    payslipFileName: string
  }>, options?: {
    customSubject?: string
    customMessage?: string
    batchSize?: number
    delayBetweenBatches?: number
  }): Promise<{
    sent: number
    failed: number
    errors: string[]
  }> {
    const batchSize = options?.batchSize || 10
    const delay = options?.delayBetweenBatches || 1000
    
    let sent = 0
    let failed = 0
    const errors: string[] = []

    // Process in batches to avoid overwhelming the email service
    for (let i = 0; i < payslips.length; i += batchSize) {
      const batch = payslips.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (payslip) => {
        try {
          const success = await this.sendPayslipEmail({
            ...payslip,
            customSubject: options?.customSubject,
            customMessage: options?.customMessage,
          })
          
          if (success) {
            sent++
          } else {
            failed++
            errors.push(`Failed to send to ${payslip.employeeEmail}`)
          }
        } catch (error) {
          failed++
          errors.push(`Error sending to ${payslip.employeeEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      })

      await Promise.all(batchPromises)
      
      // Add delay between batches
      if (i + batchSize < payslips.length) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    return { sent, failed, errors }
  }

  /**
   * Send reimbursement notification email
   */
  async sendReimbursementNotification({
    employeeEmail,
    employeeName,
    type,
    batchId,
    amount,
    claimCount,
    referenceNumber,
    paymentMethod,
    failureReason,
    customMessage
  }: {
    employeeEmail: string
    employeeName: string
    type: 'PROCESSING' | 'COMPLETED' | 'FAILED'
    batchId: string
    amount: number
    claimCount: number
    referenceNumber?: string
    paymentMethod?: string
    failureReason?: string
    customMessage?: string
  }): Promise<boolean> {
    let subject: string
    let message: string

    switch (type) {
      case 'PROCESSING':
        subject = `Reimbursement Payment Processing - Batch ${batchId}`
        message = `Dear ${employeeName},

Your reimbursement request is now being processed.

Batch Details:
- Batch ID: ${batchId}
- Total Amount: ₹${amount.toLocaleString()}
- Number of Claims: ${claimCount}
- Payment Method: ${paymentMethod || 'Bank Transfer'}

Your payment is being processed and should be completed within 1-2 business days.

You will receive another notification once the payment is completed.

Best regards,
Finance Team`
        break

      case 'COMPLETED':
        subject = `Reimbursement Payment Completed - Batch ${batchId}`
        message = `Dear ${employeeName},

Great news! Your reimbursement payment has been successfully processed.

Payment Details:
- Batch ID: ${batchId}
- Total Amount: ₹${amount.toLocaleString()}
- Number of Claims: ${claimCount}
- Payment Method: ${paymentMethod || 'Bank Transfer'}
- Reference Number: ${referenceNumber || 'N/A'}

The payment should reflect in your account within 1-2 business days.

If you have any questions or don't see the payment in your account after 2 business days, please contact the Finance team.

Best regards,
Finance Team`
        break

      case 'FAILED':
        subject = `Reimbursement Payment Failed - Batch ${batchId}`
        message = `Dear ${employeeName},

We regret to inform you that your reimbursement payment could not be processed.

Batch Details:
- Batch ID: ${batchId}
- Total Amount: ₹${amount.toLocaleString()}
- Number of Claims: ${claimCount}
- Failure Reason: ${failureReason || 'Technical error during processing'}

Your expense claims have been reset to approved status and will be included in the next payment batch. We will retry the payment processing shortly.

We apologize for the inconvenience. If you have any questions, please contact the Finance team immediately.

Best regards,
Finance Team`
        break

      default:
        return false
    }

    if (customMessage) {
      message = customMessage
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">
            ${type === 'COMPLETED' ? '✅' : type === 'FAILED' ? '❌' : '⏳'} 
            Reimbursement ${type === 'COMPLETED' ? 'Completed' : type === 'FAILED' ? 'Failed' : 'Processing'}
          </h2>
          <div style="background-color: white; padding: 20px; border-radius: 4px; border-left: 4px solid ${type === 'COMPLETED' ? '#28a745' : type === 'FAILED' ? '#dc3545' : '#007bff'};">
            ${message.replace(/\n/g, '<br>')}
          </div>
          <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              This is an automated email. Please do not reply to this message.
              For any queries, please contact your Finance department.
            </p>
          </div>
        </div>
      </div>
    `

    return this.sendEmail({
      to: employeeEmail,
      subject,
      html,
      text: message
    })
  }

  /**
   * Send bulk reimbursement notifications
   */
  async sendBulkReimbursementNotifications(
    notifications: Array<{
      employeeEmail: string
      employeeName: string
      type: 'PROCESSING' | 'COMPLETED' | 'FAILED'
      batchId: string
      amount: number
      claimCount: number
      referenceNumber?: string
      paymentMethod?: string
      failureReason?: string
    }>,
    options?: {
      batchSize?: number
      delayBetweenBatches?: number
    }
  ): Promise<{
    sent: number
    failed: number
    errors: string[]
  }> {
    const batchSize = options?.batchSize || 10
    const delay = options?.delayBetweenBatches || 1000
    
    let sent = 0
    let failed = 0
    const errors: string[] = []

    // Process in batches to avoid overwhelming the email service
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (notification) => {
        try {
          const success = await this.sendReimbursementNotification(notification)
          
          if (success) {
            sent++
          } else {
            failed++
            errors.push(`Failed to send to ${notification.employeeEmail}`)
          }
        } catch (error) {
          failed++
          errors.push(`Error sending to ${notification.employeeEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      })

      await Promise.all(batchPromises)
      
      // Add delay between batches
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    return { sent, failed, errors }
  }

  /**
   * Send finance team notification for reimbursement batch
   */
  async sendFinanceTeamNotification({
    type,
    batchId,
    totalAmount,
    totalClaims,
    processedBy,
    referenceNumber,
    failureReason
  }: {
    type: 'BATCH_CREATED' | 'BATCH_COMPLETED' | 'BATCH_FAILED'
    batchId: string
    totalAmount: number
    totalClaims: number
    processedBy: string
    referenceNumber?: string
    failureReason?: string
  }): Promise<boolean> {
    const financeEmails = process.env.FINANCE_TEAM_EMAILS?.split(',') || ['finance@company.com']
    
    let subject: string
    let message: string

    switch (type) {
      case 'BATCH_CREATED':
        subject = `New Reimbursement Batch Created - ${batchId}`
        message = `A new reimbursement batch has been created and is ready for processing.

Batch Details:
- Batch ID: ${batchId}
- Total Amount: ₹${totalAmount.toLocaleString()}
- Total Claims: ${totalClaims}
- Created By: ${processedBy}

Please review and process the batch in the finance dashboard.`
        break

      case 'BATCH_COMPLETED':
        subject = `Reimbursement Batch Completed - ${batchId}`
        message = `Reimbursement batch has been successfully completed.

Batch Details:
- Batch ID: ${batchId}
- Total Amount: ₹${totalAmount.toLocaleString()}
- Total Claims: ${totalClaims}
- Reference Number: ${referenceNumber || 'N/A'}
- Processed By: ${processedBy}

All employees have been notified of their payment status.`
        break

      case 'BATCH_FAILED':
        subject = `Reimbursement Batch Failed - ${batchId}`
        message = `Reimbursement batch processing has failed and requires attention.

Batch Details:
- Batch ID: ${batchId}
- Total Amount: ₹${totalAmount.toLocaleString()}
- Total Claims: ${totalClaims}
- Failure Reason: ${failureReason || 'Unknown error'}
- Processed By: ${processedBy}

Please review the batch and retry processing. All affected expense claims have been reset to approved status.`
        break

      default:
        return false
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">
            ${type === 'BATCH_COMPLETED' ? '✅' : type === 'BATCH_FAILED' ? '❌' : '📋'} 
            Finance Team Notification
          </h2>
          <div style="background-color: white; padding: 20px; border-radius: 4px; border-left: 4px solid ${type === 'BATCH_COMPLETED' ? '#28a745' : type === 'BATCH_FAILED' ? '#dc3545' : '#007bff'};">
            ${message.replace(/\n/g, '<br>')}
          </div>
          <div style="margin-top: 20px; text-align: center;">
            <a href="${process.env.NEXTAUTH_URL}/dashboard/expenses/reimbursement" 
               style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
              View Reimbursement Dashboard
            </a>
          </div>
        </div>
      </div>
    `

    // Send to all finance team members
    const results = await Promise.all(
      financeEmails.map(email => 
        this.sendEmail({
          to: email.trim(),
          subject,
          html,
          text: message
        })
      )
    )

    return results.every(result => result)
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance()