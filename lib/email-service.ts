// Email service for payslip distribution
// This is a placeholder implementation that can be replaced with actual email providers

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
  
  private constructor() {}
  
  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  /**
   * Send email with optional attachments
   * In production, this would integrate with services like:
   * - SendGrid
   * - AWS SES
   * - Nodemailer with SMTP
   * - Resend
   * - Postmark
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Simulate email sending
      console.log('📧 Sending email:', {
        to: options.to,
        subject: options.subject,
        attachments: options.attachments?.length || 0,
      })

      // In production, replace this with actual email service integration
      // Example with SendGrid:
      /*
      const sgMail = require('@sendgrid/mail')
      sgMail.setApiKey(process.env.SENDGRID_API_KEY)
      
      const msg = {
        to: options.to,
        from: process.env.FROM_EMAIL,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments?.map(att => ({
          content: att.content.toString('base64'),
          filename: att.filename,
          type: att.contentType,
          disposition: 'attachment',
        })),
      }
      
      await sgMail.send(msg)
      */

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100))
      
      return true
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
}

// Export singleton instance
export const emailService = EmailService.getInstance()