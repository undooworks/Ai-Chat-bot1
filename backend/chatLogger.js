import fs from 'fs';
import path from 'path';

/**
 * Chat Logger - Logs all chat conversations
 */
class ChatLogger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log a chat message
   */
  logChat(sessionId, userMessage, aiResponse, agent, language, timestamp = new Date()) {
    const logEntry = {
      timestamp: timestamp.toISOString(),
      sessionId,
      userMessage,
      aiResponse,
      agent,
      language,
      success: true
    };

    // Write to daily log file
    const dateStr = timestamp.toISOString().split('T')[0];
    const dailyLogFile = path.join(this.logDir, `chat-${dateStr}.json`);
    
    let logs = [];
    if (fs.existsSync(dailyLogFile)) {
      try {
        logs = JSON.parse(fs.readFileSync(dailyLogFile, 'utf8'));
      } catch (error) {
        console.error('[ChatLogger] Error reading log file:', error);
        logs = [];
      }
    }
    
    logs.push(logEntry);
    
    try {
      fs.writeFileSync(dailyLogFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('[ChatLogger] Error writing log file:', error);
    }

    // Also log to console for debugging
    console.log(`[CHAT LOG] ${timestamp.toISOString()} | Session: ${sessionId} | Agent: ${agent} | Lang: ${language}`);
    console.log(`[CHAT LOG] User: "${userMessage}"`);
    console.log(`[CHAT LOG] AI: "${aiResponse.substring(0, 100)}..."`);
  }

  /**
   * Log an error
   */
  logError(sessionId, userMessage, error, timestamp = new Date()) {
    const logEntry = {
      timestamp: timestamp.toISOString(),
      sessionId,
      userMessage,
      error: error.message,
      success: false
    };

    const dateStr = timestamp.toISOString().split('T')[0];
    const errorLogFile = path.join(this.logDir, `errors-${dateStr}.json`);
    
    let logs = [];
    if (fs.existsSync(errorLogFile)) {
      try {
        logs = JSON.parse(fs.readFileSync(errorLogFile, 'utf8'));
      } catch (error) {
        console.error('[ChatLogger] Error reading error log file:', error);
        logs = [];
      }
    }
    
    logs.push(logEntry);
    
    try {
      fs.writeFileSync(errorLogFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('[ChatLogger] Error writing error log file:', error);
    }

    console.error(`[CHAT ERROR] ${timestamp.toISOString()} | Session: ${sessionId} | Error: ${error.message}`);
  }

  /**
   * Get chat logs for a specific date
   */
  getChatLogs(date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `chat-${dateStr}.json`);
    
    if (fs.existsSync(logFile)) {
      try {
        return JSON.parse(fs.readFileSync(logFile, 'utf8'));
      } catch (error) {
        console.error('[ChatLogger] Error reading chat logs:', error);
        return [];
      }
    }
    
    return [];
  }

  /**
   * Get all chat logs
   */
  getAllChatLogs() {
    const logs = [];
    
    if (fs.existsSync(this.logDir)) {
      const files = fs.readdirSync(this.logDir);
      
      for (const file of files) {
        if (file.startsWith('chat-') && file.endsWith('.json')) {
          try {
            const filePath = path.join(this.logDir, file);
            const fileLogs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            logs.push(...fileLogs);
          } catch (error) {
            console.error(`[ChatLogger] Error reading ${file}:`, error);
          }
        }
      }
    }
    
    return logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Get chat logs for a specific session
   */
  getSessionLogs(sessionId) {
    const allLogs = this.getAllChatLogs();
    return allLogs.filter(log => log.sessionId === sessionId);
  }

  /**
   * Get statistics
   */
  getStats() {
    const allLogs = this.getAllChatLogs();
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = allLogs.filter(log => log.timestamp.startsWith(today));
    
    return {
      totalChats: allLogs.length,
      todayChats: todayLogs.length,
      successfulChats: allLogs.filter(log => log.success).length,
      errorChats: allLogs.filter(log => !log.success).length,
      uniqueSessions: [...new Set(allLogs.map(log => log.sessionId))].length,
      agents: [...new Set(allLogs.map(log => log.agent).filter(Boolean))],
      languages: [...new Set(allLogs.map(log => log.language).filter(Boolean))]
    };
  }
}

// Export singleton instance
export const chatLogger = new ChatLogger(); 