#!/usr/bin/env node

import { emailService } from '../utils/emailService.js';
import database from '../database.js';
import logger from '../logger.js';

class DailyReportGenerator {
  constructor() {
    this.reportData = {};
  }

  async generateReport() {
    try {
      console.log('[DAILY REPORT] Starting daily report generation...');
      
      // Colectează statistici din baza de date
      const stats = await this.collectStats();
      
      // Generează raportul
      this.reportData = {
        totalConversations: stats.totalConversations || 0,
        totalBookings: stats.totalBookings || 0,
        totalSupport: stats.totalSupport || 0,
        totalFallbacks: stats.totalFallbacks || 0,
        averageResponseTime: stats.averageResponseTime || 0,
        topAgents: stats.topAgents || [],
        errors: stats.errors || [],
        date: new Date().toLocaleDateString(),
        timestamp: new Date().toISOString()
      };

      // Salvează raportul local
      const savedPath = await emailService.saveReportLocally(this.reportData, 'daily');
      console.log(`[DAILY REPORT] Report saved locally: ${savedPath}`);

      // Trimite raportul prin email
      const emailSent = await emailService.sendDailyReport(this.reportData);
      
      if (emailSent) {
        console.log('[DAILY REPORT] Daily report sent successfully via email');
      } else {
        console.log('[DAILY REPORT] Email service not configured, report saved locally only');
      }

      // Loghează raportul
      logger.info('Daily report generated', {
        type: 'daily_report',
        data: this.reportData,
        emailSent
      });

      return {
        success: true,
        report: this.reportData,
        emailSent,
        savedPath
      };

    } catch (error) {
      console.error('[DAILY REPORT] Error generating daily report:', error);
      logger.error('Failed to generate daily report', { error: error.message });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async collectStats() {
    try {
      // Obține statistici din baza de date
      const dbStats = await database.getStats();
      
      // Colectează statistici suplimentare
      const additionalStats = await this.collectAdditionalStats();
      
      return {
        ...dbStats,
        ...additionalStats
      };
    } catch (error) {
      console.error('[DAILY REPORT] Error collecting stats:', error);
      return {};
    }
  }

  async collectAdditionalStats() {
    try {
      // Statistici despre agenți
      const agentStats = await this.getAgentStats();
      
      // Statistici despre erori
      const errorStats = await this.getErrorStats();
      
      // Statistici despre performanță
      const performanceStats = await this.getPerformanceStats();
      
      return {
        agentStats,
        errorStats,
        performanceStats
      };
    } catch (error) {
      console.error('[DAILY REPORT] Error collecting additional stats:', error);
      return {};
    }
  }

  async getAgentStats() {
    try {
      // Aici poți adăuga logica pentru a colecta statistici despre agenți
      // De exemplu, numărul de mesaje procesate de fiecare agent
      return {
        bookingAgent: { requests: 0, successRate: 0 },
        supportAgent: { requests: 0, successRate: 0 },
        fallbackAgent: { requests: 0, successRate: 0 },
        greetingAgent: { requests: 0, successRate: 0 }
      };
    } catch (error) {
      console.error('[DAILY REPORT] Error getting agent stats:', error);
      return {};
    }
  }

  async getErrorStats() {
    try {
      // Colectează erorile din ultimele 24 de ore
      const errors = await logger.getLogs('error', 100);
      
      return {
        totalErrors: errors.length,
        errorTypes: this.categorizeErrors(errors),
        criticalErrors: errors.filter(e => e.level === 'critical').length
      };
    } catch (error) {
      console.error('[DAILY REPORT] Error getting error stats:', error);
      return {};
    }
  }

  async getPerformanceStats() {
    try {
      // Statistici despre performanță
      return {
        averageResponseTime: 0,
        peakConcurrentUsers: 0,
        systemUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      };
    } catch (error) {
      console.error('[DAILY REPORT] Error getting performance stats:', error);
      return {};
    }
  }

  categorizeErrors(errors) {
    const categories = {};
    
    errors.forEach(error => {
      const category = this.getErrorCategory(error.message);
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return categories;
  }

  getErrorCategory(errorMessage) {
    if (errorMessage.includes('database')) return 'Database';
    if (errorMessage.includes('api')) return 'API';
    if (errorMessage.includes('telegram')) return 'Telegram';
    if (errorMessage.includes('email')) return 'Email';
    if (errorMessage.includes('agent')) return 'Agent';
    return 'Other';
  }

  async cleanup() {
    try {
      // Cleanup loguri vechi
      await logger.cleanupOldLogs(7); // Șterge logurile mai vechi de 7 zile
      console.log('[DAILY REPORT] Cleanup completed');
    } catch (error) {
      console.error('[DAILY REPORT] Error during cleanup:', error);
    }
  }
}

// Funcția principală
async function main() {
  const reportGenerator = new DailyReportGenerator();
  
  try {
    // Inițializează baza de date
    await database.init();
    
    // Generează raportul
    const result = await reportGenerator.generateReport();
    
    if (result.success) {
      console.log('[DAILY REPORT] Daily report completed successfully');
      console.log('[DAILY REPORT] Summary:', {
        conversations: result.report.totalConversations,
        bookings: result.report.totalBookings,
        support: result.report.totalSupport,
        fallbacks: result.report.totalFallbacks
      });
    } else {
      console.error('[DAILY REPORT] Failed to generate daily report:', result.error);
      process.exit(1);
    }
    
    // Cleanup
    await reportGenerator.cleanup();
    
  } catch (error) {
    console.error('[DAILY REPORT] Fatal error:', error);
    process.exit(1);
  } finally {
    // Închide conexiunea la baza de date
    if (database.db) {
      await database.db.close();
    }
    process.exit(0);
  }
}

// Rulează scriptul dacă este apelat direct
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DailyReportGenerator }; 