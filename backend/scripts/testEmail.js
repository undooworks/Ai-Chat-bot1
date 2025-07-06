#!/usr/bin/env node

import { emailService } from '../utils/emailService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');

  // Test 1: Check email service status
  console.log('1. Checking email service status...');
  const status = emailService.getStatus();
  console.log('Status:', status);
  console.log('');

  if (!status.configured) {
    console.log('❌ Email service is not configured properly.');
    console.log('Please check your .env file and ensure EMAIL_USER and EMAIL_PASSWORD are set.');
    console.log('');
    console.log('Example .env configuration:');
    console.log('EMAIL_USER=your-email@gmail.com');
    console.log('EMAIL_PASSWORD=your-app-password');
    console.log('ADMIN_EMAIL=admin@yourcompany.com');
    console.log('');
    return;
  }

  // Test 2: Test daily report
  console.log('2. Testing daily report email...');
  const dailyReportData = {
    totalConversations: 150,
    totalBookings: 25,
    totalSupport: 10,
    totalFallbacks: 5,
    averageResponseTime: 1200,
    topAgents: [
      { name: 'BookingAgent', count: 80 },
      { name: 'SupportAgent', count: 45 },
      { name: 'FallbackAgent', count: 15 },
      { name: 'GreetingAgent', count: 10 }
    ],
    errors: [
      { type: 'API', message: 'Timeout on external service' },
      { type: 'Database', message: 'Connection pool exhausted' }
    ],
    date: new Date().toLocaleDateString()
  };

  try {
    const dailyReportResult = await emailService.sendDailyReport(dailyReportData);
    console.log('Daily report test:', dailyReportResult ? '✅ SUCCESS' : '❌ FAILED');
  } catch (error) {
    console.log('Daily report test: ❌ ERROR -', error.message);
  }
  console.log('');

  // Test 3: Test escalation alert
  console.log('3. Testing escalation alert email...');
  const escalationData = {
    sessionId: 'test-session-123',
    message: 'I have an urgent problem with my booking!',
    agent: 'FallbackAgent',
    reply: 'I understand this is urgent. Let me connect you with our support team immediately.',
    timestamp: new Date().toISOString(),
    userLanguage: 'ro'
  };

  try {
    const escalationResult = await emailService.sendEscalationAlert(escalationData);
    console.log('Escalation alert test:', escalationResult ? '✅ SUCCESS' : '❌ FAILED');
  } catch (error) {
    console.log('Escalation alert test: ❌ ERROR -', error.message);
  }
  console.log('');

  // Test 4: Test booking notification
  console.log('4. Testing booking notification email...');
  const bookingData = {
    booking: {
      id: 'BK123456789',
      busNumber: 'BU1234',
      trip: {
        route: 'Bucharest-Vienna',
        departure: new Date().toISOString(),
        arrival: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        price: 150
      }
    },
    passenger: 'John Doe',
    sessionId: 'test-session-456'
  };

  try {
    const bookingResult = await emailService.sendBookingNotification(bookingData);
    console.log('Booking notification test:', bookingResult ? '✅ SUCCESS' : '❌ FAILED');
  } catch (error) {
    console.log('Booking notification test: ❌ ERROR -', error.message);
  }
  console.log('');

  // Test 5: Test custom email
  console.log('5. Testing custom email...');
  const customEmailData = {
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: '🧪 Email Service Test - AI Transport Assistant',
    htmlContent: `
      <h2>Email Service Test</h2>
      <p>This is a test email to verify that the email service is working correctly.</p>
      <p><strong>Test Details:</strong></p>
      <ul>
        <li>Service: ${status.service}</li>
        <li>User: ${status.user}</li>
        <li>Timestamp: ${new Date().toISOString()}</li>
      </ul>
      <p>If you received this email, the email service is configured correctly! 🎉</p>
    `
  };

  try {
    const customResult = await emailService.sendCustomEmail(
      customEmailData.to,
      customEmailData.subject,
      customEmailData.htmlContent
    );
    console.log('Custom email test:', customResult ? '✅ SUCCESS' : '❌ FAILED');
  } catch (error) {
    console.log('Custom email test: ❌ ERROR -', error.message);
  }
  console.log('');

  // Test 6: Test local report saving
  console.log('6. Testing local report saving...');
  try {
    const savedPath = await emailService.saveReportLocally(dailyReportData, 'test');
    console.log('Local report saving test:', savedPath ? '✅ SUCCESS' : '❌ FAILED');
    if (savedPath) {
      console.log('Report saved to:', savedPath);
    }
  } catch (error) {
    console.log('Local report saving test: ❌ ERROR -', error.message);
  }
  console.log('');

  console.log('🧪 Email Service Test Complete!');
  console.log('');
  console.log('📧 Check your email inbox for test messages.');
  console.log('📁 Check the logs/reports directory for saved reports.');
  console.log('');
  console.log('If you encountered any errors:');
  console.log('1. Verify your .env configuration');
  console.log('2. Check your email provider settings');
  console.log('3. Ensure 2FA and App Passwords are configured (for Gmail)');
  console.log('4. Check the console output above for specific error messages');
}

// Run the test
testEmailService().catch(error => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
}); 