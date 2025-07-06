import fs from 'fs/promises';
import path from 'path';

class Logger {
  constructor() {
    this.logDir = path.resolve('logs');
    this.initLogDirectory();
  }

  async initLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  async writeLog(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    const logFile = path.join(this.logDir, `${level}.log`);
    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      await fs.appendFile(logFile, logLine);
    } catch (error) {
      console.error('Failed to write log:', error);
    }

    // Console output cu culori
    const colors = {
      info: '\x1b[36m',    // Cyan
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      debug: '\x1b[35m',   // Magenta
      success: '\x1b[32m'  // Green
    };

    const reset = '\x1b[0m';
    const color = colors[level] || '';
    
    console.log(`${color}[${level.toUpperCase()}]${reset} ${timestamp} - ${message}`);
    if (Object.keys(data).length > 0) {
      console.log(`${color}Data:${reset}`, data);
    }
  }

  info(message, data = {}) {
    this.writeLog('info', message, data);
  }

  warn(message, data = {}) {
    this.writeLog('warn', message, data);
  }

  error(message, data = {}) {
    this.writeLog('error', message, data);
  }

  debug(message, data = {}) {
    this.writeLog('debug', message, data);
  }

  success(message, data = {}) {
    this.writeLog('success', message, data);
  }

  // Log specific pentru agenți
  agentLog(agentName, sessionId, action, data = {}) {
    this.info(`Agent ${agentName} - ${action}`, {
      sessionId,
      agent: agentName,
      action,
      ...data
    });
  }

  // Log pentru conversații
  conversationLog(sessionId, message, response, agent) {
    this.info('Conversation', {
      sessionId,
      message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      response: response.substring(0, 100) + (response.length > 100 ? '...' : ''),
      agent,
      timestamp: new Date().toISOString()
    });
  }

  // Log pentru erori
  errorLog(error, context = {}) {
    this.error('Application Error', {
      message: error.message,
      stack: error.stack,
      context
    });
  }

  // Log pentru performanță
  performanceLog(operation, duration, data = {}) {
    this.debug('Performance', {
      operation,
      duration: `${duration}ms`,
      ...data
    });
  }

  // Obține logurile din fișiere
  async getLogs(level = 'info', limit = 100) {
    try {
      const logFile = path.join(this.logDir, `${level}.log`);
      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n').slice(-limit);
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      return [];
    }
  }

  // Cleanup loguri vechi
  async cleanupOldLogs(daysOld = 7) {
    try {
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          this.info(`Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      this.error('Failed to cleanup old logs', { error: error.message });
    }
  }
}

// Singleton instance
const logger = new Logger();

export default logger; 