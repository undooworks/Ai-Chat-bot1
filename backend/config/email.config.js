// Email Configuration for AI Transport Assistant
// Copy this file to .env and fill in your actual values

export const emailConfig = {
  // Gmail Configuration (Recommended for testing)
  gmail: {
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASSWORD || 'your-app-password' // Use App Password, not regular password
    }
  },

  // Outlook/Hotmail Configuration
  outlook: {
    service: 'outlook',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@outlook.com',
      pass: process.env.EMAIL_PASSWORD || 'your-password'
    }
  },

  // Custom SMTP Configuration
  custom: {
    host: process.env.SMTP_HOST || 'smtp.your-provider.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER || 'your-email@domain.com',
      pass: process.env.EMAIL_PASSWORD || 'your-password'
    }
  },

  // Email Recipients
  recipients: {
    admin: process.env.ADMIN_EMAIL || 'admin@yourcompany.com',
    support: process.env.SUPPORT_EMAIL || 'support@yourcompany.com',
    booking: process.env.BOOKING_EMAIL || 'bookings@yourcompany.com',
    reports: process.env.REPORTS_EMAIL || 'reports@yourcompany.com'
  },

  // Email Templates
  templates: {
    dailyReport: {
      subject: '🚌 AI Transport Assistant - Daily Report',
      from: process.env.EMAIL_USER || 'noreply@yourcompany.com'
    },
    escalationAlert: {
      subject: '🚨 Escalation Alert - AI Transport Assistant',
      from: process.env.EMAIL_USER || 'alerts@yourcompany.com'
    },
    bookingNotification: {
      subject: '🎫 New Booking - AI Transport Assistant',
      from: process.env.EMAIL_USER || 'bookings@yourcompany.com'
    }
  },

  // Email Settings
  settings: {
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    timeout: 30000, // 30 seconds
    pool: true, // Use pooled connections
    maxConnections: 5,
    maxMessages: 100
  }
};

// Instructions for setting up email:

/*
1. GMAIL SETUP (Recommended for testing):
   - Go to your Google Account settings
   - Enable 2-Factor Authentication
   - Generate an App Password:
     * Go to Security > 2-Step Verification > App passwords
     * Generate a new app password for "Mail"
     * Use this password in EMAIL_PASSWORD, not your regular password

2. OUTLOOK/HOTMAIL SETUP:
   - Enable "Less secure app access" or use App Password
   - Use your regular email and password

3. CUSTOM SMTP SETUP:
   - Get SMTP settings from your email provider
   - Configure host, port, and authentication

4. ENVIRONMENT VARIABLES (.env file):
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   ADMIN_EMAIL=admin@yourcompany.com
   SUPPORT_EMAIL=support@yourcompany.com
   BOOKING_EMAIL=bookings@yourcompany.com
   REPORTS_EMAIL=reports@yourcompany.com

5. TESTING:
   - Run the email test script: node scripts/testEmail.js
   - Check logs for email service status
   - Verify emails are received

6. PRODUCTION CONSIDERATIONS:
   - Use environment variables for all sensitive data
   - Set up proper SPF, DKIM, and DMARC records
   - Monitor email delivery rates
   - Set up email bounce handling
   - Consider using a transactional email service (SendGrid, Mailgun, etc.)
*/

export default emailConfig; 