import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

interface EncryptionResult {
  encryptedData: Buffer
  iv: Buffer
  key: string
}

interface WatermarkOptions {
  text: string
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  opacity: number
  fontSize: number
  color: string
}

export class DocumentSecurityService {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32
  private static readonly IV_LENGTH = 16

  /**
   * Encrypt document data
   */
  static encryptDocument(data: Buffer, password?: string): EncryptionResult {
    const key = password 
      ? crypto.scryptSync(password, 'salt', this.KEY_LENGTH)
      : crypto.randomBytes(this.KEY_LENGTH)
    
    const iv = crypto.randomBytes(this.IV_LENGTH)
    const cipher = crypto.createCipher(this.ALGORITHM, key)
    
    const encryptedData = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ])

    return {
      encryptedData,
      iv,
      key: key.toString('hex')
    }
  }

  /**
   * Decrypt document data
   */
  static decryptDocument(encryptedData: Buffer, key: string, iv: Buffer): Buffer {
    const keyBuffer = Buffer.from(key, 'hex')
    const decipher = crypto.createDecipher(this.ALGORITHM, keyBuffer)
    
    return Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ])
  }

  /**
   * Generate document access token with expiry
   */
  static generateAccessToken(documentId: string, userId: string, expiresIn: number = 3600): string {
    const payload = {
      documentId,
      userId,
      exp: Math.floor(Date.now() / 1000) + expiresIn,
      iat: Math.floor(Date.now() / 1000)
    }

    const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
    const token = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')

    return Buffer.from(JSON.stringify({ ...payload, token })).toString('base64')
  }

  /**
   * Verify document access token
   */
  static verifyAccessToken(token: string): { documentId: string; userId: string } | null {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString())
      const { documentId, userId, exp, iat, token: signature } = payload

      // Check expiry
      if (exp < Math.floor(Date.now() / 1000)) {
        return null
      }

      // Verify signature
      const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
      const expectedToken = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify({ documentId, userId, exp, iat }))
        .digest('hex')

      if (signature !== expectedToken) {
        return null
      }

      return { documentId, userId }
    } catch (error) {
      return null
    }
  }

  /**
   * Apply watermark to document (for PDFs and images)
   */
  static async applyWatermark(
    documentBuffer: Buffer, 
    mimeType: string, 
    options: WatermarkOptions
  ): Promise<Buffer> {
    // This is a simplified implementation
    // In a real application, you would use libraries like:
    // - pdf-lib for PDF watermarking
    // - sharp for image watermarking
    // - canvas for generating watermark overlays

    if (mimeType === 'application/pdf') {
      return this.watermarkPDF(documentBuffer, options)
    } else if (mimeType.startsWith('image/')) {
      return this.watermarkImage(documentBuffer, options)
    }

    // Return original buffer if watermarking not supported
    return documentBuffer
  }

  /**
   * Watermark PDF documents
   */
  private static async watermarkPDF(pdfBuffer: Buffer, options: WatermarkOptions): Promise<Buffer> {
    // Placeholder implementation
    // In production, use pdf-lib:
    /*
    import { PDFDocument, rgb } from 'pdf-lib'
    
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const pages = pdfDoc.getPages()
    
    for (const page of pages) {
      const { width, height } = page.getSize()
      
      let x, y
      switch (options.position) {
        case 'top-left':
          x = 50
          y = height - 50
          break
        case 'top-right':
          x = width - 200
          y = height - 50
          break
        case 'bottom-left':
          x = 50
          y = 50
          break
        case 'bottom-right':
          x = width - 200
          y = 50
          break
        case 'center':
        default:
          x = width / 2 - 100
          y = height / 2
          break
      }
      
      page.drawText(options.text, {
        x,
        y,
        size: options.fontSize,
        color: rgb(0.5, 0.5, 0.5),
        opacity: options.opacity
      })
    }
    
    return Buffer.from(await pdfDoc.save())
    */
    
    // For now, return original buffer
    return pdfBuffer
  }

  /**
   * Watermark image documents
   */
  private static async watermarkImage(imageBuffer: Buffer, options: WatermarkOptions): Promise<Buffer> {
    // Placeholder implementation
    // In production, use sharp:
    /*
    import sharp from 'sharp'
    
    const image = sharp(imageBuffer)
    const { width, height } = await image.metadata()
    
    // Create watermark SVG
    const watermarkSvg = `
      <svg width="${width}" height="${height}">
        <text x="50%" y="50%" 
              font-family="Arial" 
              font-size="${options.fontSize}" 
              fill="${options.color}" 
              opacity="${options.opacity}" 
              text-anchor="middle" 
              dominant-baseline="middle">
          ${options.text}
        </text>
      </svg>
    `
    
    return await image
      .composite([{ input: Buffer.from(watermarkSvg), blend: 'over' }])
      .toBuffer()
    */
    
    // For now, return original buffer
    return imageBuffer
  }

  /**
   * Check if user has permission to access document
   */
  static async checkDocumentAccess(
    documentId: string, 
    userId: string, 
    action: 'VIEW' | 'DOWNLOAD' | 'EDIT' | 'DELETE' = 'VIEW'
  ): Promise<boolean> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          employee: {
            include: {
              user: true
            }
          },
          shares: {
            where: {
              sharedWith: userId,
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            }
          }
        }
      })

      if (!document) {
        return false
      }

      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { employee: true }
      })

      if (!user) {
        return false
      }

      // Admin and HR have full access
      if (['ADMIN', 'HR'].includes(user.role)) {
        return true
      }

      // Document owner has full access
      if (document.employee?.userId === userId) {
        return true
      }

      // Manager has access to subordinate documents
      if (user.employee && document.employee?.reportingTo === user.employee.id) {
        return true
      }

      // Check shared access
      const sharedAccess = document.shares.find(share => share.sharedWith === userId)
      if (sharedAccess) {
        switch (action) {
          case 'VIEW':
            return ['READ', 'write', 'admin'].includes(sharedAccess.permissions.toLowerCase())
          case 'DOWNLOAD':
            return ['read', 'write', 'admin'].includes(sharedAccess.permissions.toLowerCase())
          case 'EDIT':
            return ['write', 'admin'].includes(sharedAccess.permissions.toLowerCase())
          case 'DELETE':
            return sharedAccess.permissions.toLowerCase() === 'admin'
          default:
            return false
        }
      }

      return false
    } catch (error) {
      console.error('Error checking document access:', error)
      return false
    }
  }

  /**
   * Log document access for audit trail
   */
  static async logDocumentAccess(
    documentId: string,
    userId: string,
    action: 'VIEW' | 'DOWNLOAD' | 'UPLOAD' | 'UPDATE' | 'DELETE' | 'SHARE' | 'APPROVE' | 'REJECT',
    ipAddress?: string,
    userAgent?: string,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      await prisma.documentAccessLog.create({
        data: {
          documentId,
          userId,
          userName: user?.name || user?.email || 'Unknown',
          action,
          ipAddress,
          userAgent,
          success,
          errorMessage
        }
      })
    } catch (error) {
      console.error('Error logging document access:', error)
    }
  }

  /**
   * Check if document has expired
   */
  static isDocumentExpired(document: { expiryDate?: Date | null }): boolean {
    if (!document.expiryDate) {
      return false
    }
    return new Date(document.expiryDate) < new Date()
  }

  /**
   * Generate secure download URL with expiry
   */
  static generateSecureDownloadUrl(
    documentId: string, 
    userId: string, 
    expiresIn: number = 3600
  ): string {
    const token = this.generateAccessToken(documentId, userId, expiresIn)
    return `/api/documents/${documentId}/download?token=${encodeURIComponent(token)}`
  }

  /**
   * Validate file type against allowed types
   */
  static validateFileType(mimeType: string, allowedTypes: string[]): boolean {
    return allowedTypes.some(type => {
      if (type.includes('*')) {
        const baseType = type.split('/')[0]
        return mimeType.startsWith(baseType + '/')
      }
      return mimeType === type
    })
  }

  /**
   * Validate file size against maximum allowed size
   */
  static validateFileSize(fileSize: number, maxSize: number): boolean {
    return fileSize <= maxSize
  }

  /**
   * Sanitize filename to prevent path traversal attacks
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .substring(0, 255)
  }

  /**
   * Generate document hash for integrity verification
   */
  static generateDocumentHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Verify document integrity
   */
  static verifyDocumentIntegrity(data: Buffer, expectedHash: string): boolean {
    const actualHash = this.generateDocumentHash(data)
    return actualHash === expectedHash
  }
}