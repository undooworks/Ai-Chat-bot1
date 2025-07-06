import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      // Verifică dacă avem credențialele necesare
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.warn('[EMAIL] Email credentials not found, email service disabled');
        this.isConfigured = false;
        return;
      }

      // Configurare pentru Gmail
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD // App password pentru Gmail
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verifică configurația
      await this.transporter.verify();
      this.isConfigured = true;
      console.log('[EMAIL] Email service configured successfully');
    } catch (error) {
      console.error('[EMAIL] Failed to configure email service:', error);
      this.isConfigured = false;
    }
  }

  // Template pentru raportul zilnic
  generateDailyReport(data) {
    const {
      totalConversations,
      totalBookings,
      totalSupport,
      totalFallbacks,
      averageResponseTime,
      topAgents,
      errors,
      date
    } = data;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0 0 0; opacity: 0.9; }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
          .stat-card { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; }
          .stat-number { font-size: 32px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }
          .stat-label { color: #64748b; font-size: 14px; }
          .section { margin-bottom: 30px; }
          .section h2 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
          .agent-list { list-style: none; padding: 0; }
          .agent-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
          .error-list { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; }
          .error-item { color: #dc2626; margin-bottom: 10px; padding: 10px; background: white; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚌 AI Transport Assistant - Daily Report</h1>
            <p>${date}</p>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">${totalConversations}</div>
              <div class="stat-label">Total Conversations</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${totalBookings}</div>
              <div class="stat-label">Bookings Made</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${totalSupport}</div>
              <div class="stat-label">Support Requests</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${totalFallbacks}</div>
              <div class="stat-label">AI Fallbacks</div>
            </div>
          </div>

          <div class="section">
            <h2>📊 Performance Metrics</h2>
            <div class="stat-card">
              <div class="stat-number">${averageResponseTime}ms</div>
              <div class="stat-label">Average Response Time</div>
            </div>
          </div>

          <div class="section">
            <h2>🤖 Agent Performance</h2>
            <ul class="agent-list">
              ${topAgents.map(agent => `
                <li class="agent-item">
                  <span>${agent.name}</span>
                  <span>${agent.count} requests</span>
                </li>
              `).join('')}
            </ul>
          </div>

          ${errors.length > 0 ? `
            <div class="section">
              <h2>⚠️ Errors & Issues</h2>
              <div class="error-list">
                ${errors.map(error => `
                  <div class="error-item">
                    <strong>${error.type}:</strong> ${error.message}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="footer">
            <p>This report was generated automatically by the AI Transport Assistant system.</p>
            <p>For questions or support, contact the development team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template pentru alerta de escaladare
  generateEscalationAlert(data) {
    const { sessionId, message, agent, reply, timestamp, userLanguage } = data;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 20px; }
          .content { margin-bottom: 30px; }
          .field { margin-bottom: 15px; }
          .field-label { font-weight: bold; color: #1e293b; margin-bottom: 5px; }
          .field-value { background: #f8fafc; padding: 10px; border-radius: 4px; border-left: 3px solid #2563eb; }
          .message-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Escalation Alert</h1>
          </div>

          <div class="content">
            <div class="field">
              <div class="field-label">Session ID:</div>
              <div class="field-value">${sessionId}</div>
            </div>

            <div class="field">
              <div class="field-label">Timestamp:</div>
              <div class="field-value">${timestamp}</div>
            </div>

            <div class="field">
              <div class="field-label">User Language:</div>
              <div class="field-value">${userLanguage}</div>
            </div>

            <div class="field">
              <div class="field-label">Agent Used:</div>
              <div class="field-value">${agent}</div>
            </div>

            <div class="field">
              <div class="field-label">User Message:</div>
              <div class="message-box">${message}</div>
            </div>

            <div class="field">
              <div class="field-label">AI Response:</div>
              <div class="message-box">${reply}</div>
            </div>
          </div>

          <div class="footer">
            <p>This alert was triggered automatically. Please review and take appropriate action.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template pentru notificare de rezervare
  generateBookingNotification(data) {
    const { booking, passenger, sessionId } = data;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 20px; }
          .booking-details { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .detail-label { font-weight: bold; color: #1e293b; }
          .detail-value { color: #059669; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎫 New Booking Notification</h1>
          </div>

          <div class="booking-details">
            <div class="detail-row">
              <span class="detail-label">Booking ID:</span>
              <span class="detail-value">${booking.id}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Passenger:</span>
              <span class="detail-value">${passenger}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Route:</span>
              <span class="detail-value">${booking.trip.route}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Departure:</span>
              <span class="detail-value">${new Date(booking.trip.departure).toLocaleString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Price:</span>
              <span class="detail-value">€${booking.trip.price}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Session ID:</span>
              <span class="detail-value">${sessionId}</span>
            </div>
          </div>

          <div class="footer">
            <p>This booking was made through the AI Transport Assistant.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Trimite raportul zilnic
  async sendDailyReport(reportData) {
    const htmlContent = this.generateDailyReport(reportData);
    const subject = `🚌 AI Transport Assistant - Daily Report - ${reportData.date}`;
    const to = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'anhdoo@gmail.com';
    
    try {
      if (this.isConfigured) {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: to,
          subject: subject,
          html: htmlContent
        };

        const result = await this.transporter.sendMail(mailOptions);
        console.log('[EMAIL] Daily report sent successfully:', result.messageId);
        return true;
      }
    } catch (error) {
      console.error('[EMAIL] Failed to send daily report:', error);
    }
    
    // Fallback - salvează local și loghează
    console.warn('[EMAIL] Using fallback for daily report');
    await this.saveReportLocally(reportData, 'daily');
    await this.sendFallbackEmail(to, subject, htmlContent);
    return true;
  }

  // Trimite alerta de escaladare
  async sendEscalationAlert(escalationData) {
    if (!this.isConfigured) {
      console.warn('[EMAIL] Email service not configured, skipping escalation alert');
      return false;
    }

    try {
      const htmlContent = this.generateEscalationAlert(escalationData);
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
        subject: `🚨 Escalation Alert - Session ${escalationData.sessionId}`,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('[EMAIL] Escalation alert sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('[EMAIL] Failed to send escalation alert:', error);
      return false;
    }
  }

  // Trimite notificare de rezervare
  async sendBookingNotification(bookingData) {
    if (!this.isConfigured) {
      console.warn('[EMAIL] Email service not configured, skipping booking notification');
      return false;
    }

    try {
      const htmlContent = this.generateBookingNotification(bookingData);
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.BOOKING_EMAIL || process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
        subject: `🎫 New Booking - ${bookingData.booking.id}`,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('[EMAIL] Booking notification sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('[EMAIL] Failed to send booking notification:', error);
      return false;
    }
  }

  // Trimite email personalizat
  async sendCustomEmail(to, subject, htmlContent) {
    if (!this.isConfigured) {
      console.warn('[EMAIL] Email service not configured, skipping custom email');
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: subject,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('[EMAIL] Custom email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('[EMAIL] Failed to send custom email:', error);
      return false;
    }
  }

  // Generează și salvează raportul local
  async saveReportLocally(reportData, type = 'daily') {
    try {
      const reportsDir = path.join(__dirname, '..', '..', 'logs', 'reports');
      await fs.mkdir(reportsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${type}-report-${timestamp}.json`;
      const filepath = path.join(reportsDir, filename);

      await fs.writeFile(filepath, JSON.stringify(reportData, null, 2));
      console.log(`[EMAIL] Report saved locally: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error('[EMAIL] Failed to save report locally:', error);
      return null;
    }
  }

  // Metodă pentru fallback - salvează în log în loc să trimită email
  async sendFallbackEmail(to, subject, content) {
    console.log('[EMAIL FALLBACK] Would send email:');
    console.log('[EMAIL FALLBACK] To:', to);
    console.log('[EMAIL FALLBACK] Subject:', subject);
    console.log('[EMAIL FALLBACK] Content:', content);
    
    // Salvează în fișier de log pentru debugging
    const logEntry = {
      timestamp: new Date().toISOString(),
      to: to,
      subject: subject,
      content: content
    };
    
    try {
      const logPath = path.join(__dirname, '..', '..', 'logs', 'email-fallback.log');
      await fs.appendFile(logPath, JSON.stringify(logEntry) + '\n');
      console.log('[EMAIL FALLBACK] Logged to:', logPath);
    } catch (logError) {
      console.error('[EMAIL FALLBACK] Failed to log:', logError);
    }
    
    return true;
  }

  // Verifică statusul serviciului de email
  getStatus() {
    return {
      configured: this.isConfigured,
      service: 'gmail',
      user: process.env.EMAIL_USER ? 'configured' : 'not configured'
    };
  }
}

// Export singleton instance
export const emailService = new EmailService(); 