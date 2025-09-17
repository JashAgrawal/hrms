#!/usr/bin/env node

/**
 * Test script for document upload API
 * Usage: node scripts/test-document-upload.js
 */

const fs = require('fs')
const path = require('path')

async function testDocumentUpload() {
  try {
    console.log('🧪 Testing Document Upload API...')
    
    // Create a test file
    const testContent = 'This is a test document for upload API testing.'
    const testFilePath = path.join(__dirname, 'test-document.txt')
    fs.writeFileSync(testFilePath, testContent)
    
    // Create FormData
    const FormData = require('form-data')
    const formData = new FormData()
    
    formData.append('file', fs.createReadStream(testFilePath))
    formData.append('category', 'OTHER')
    formData.append('employeeId', 'test-employee-id-123456789') // This should be a valid employee ID
    formData.append('title', 'Test Document Upload')
    
    // Make the request
    const fetch = require('node-fetch')
    const response = await fetch('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Note: In real testing, you'd need to include authentication headers
        // 'Cookie': 'your-session-cookie'
      }
    })
    
    const result = await response.json()
    
    console.log('📊 Response Status:', response.status)
    console.log('📄 Response Body:', JSON.stringify(result, null, 2))
    
    if (response.ok) {
      console.log('✅ Upload test passed!')
    } else {
      console.log('❌ Upload test failed!')
      console.log('Error:', result.error)
      if (result.validCategories) {
        console.log('Valid categories:', result.validCategories)
      }
    }
    
    // Clean up test file
    fs.unlinkSync(testFilePath)
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message)
  }
}

// Run the test
testDocumentUpload()