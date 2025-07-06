import { chatLogger } from '../chatLogger.js';
import fs from 'fs';
import path from 'path';

/**
 * Learning System - Învață din logurile chat-urilor pentru a îmbunătăți AI-ul
 */
class LearningSystem {
  constructor() {
    this.learningData = {
      patterns: {},
      improvements: [],
      userFeedback: [],
      commonIssues: []
    };
    this.loadLearningData();
  }

  /**
   * Analizează logurile pentru a găsi pattern-uri
   */
  async analyzeChatLogs(days = 7) {
    try {
      const logs = chatLogger.getAllChatLogs();
      const recentLogs = logs.filter(log => {
        const logDate = new Date(log.timestamp);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        return logDate >= cutoffDate;
      });

      console.log(`[LEARNING] Analyzing ${recentLogs.length} recent chat logs...`);

      // Analizează pattern-uri
      const patterns = this.extractPatterns(recentLogs);
      
      // Identifică probleme comune
      const issues = this.identifyCommonIssues(recentLogs);
      
      // Generează sugestii de îmbunătățire
      const improvements = this.generateImprovements(patterns, issues);

      this.learningData.patterns = patterns;
      this.learningData.commonIssues = issues;
      this.learningData.improvements = improvements;

      this.saveLearningData();
      
      console.log(`[LEARNING] Analysis complete. Found ${patterns.length} patterns, ${issues.length} issues, ${improvements.length} improvements`);
      
      return {
        patterns,
        issues,
        improvements,
        stats: {
          totalLogs: recentLogs.length,
          successfulChats: recentLogs.filter(log => log.success).length,
          errorChats: recentLogs.filter(log => !log.success).length,
          averageResponseLength: this.calculateAverageResponseLength(recentLogs),
          topAgents: this.getTopAgents(recentLogs)
        }
      };

    } catch (error) {
      console.error('[LEARNING] Error analyzing chat logs:', error);
      return null;
    }
  }

  /**
   * Extrage pattern-uri din loguri
   */
  extractPatterns(logs) {
    const patterns = {};
    
    // Grupează după tipul de mesaj
    logs.forEach(log => {
      const messageType = this.categorizeMessage(log.userMessage);
      if (!patterns[messageType]) {
        patterns[messageType] = {
          count: 0,
          examples: [],
          agents: {},
          avgResponseLength: 0
        };
      }
      
      patterns[messageType].count++;
      patterns[messageType].examples.push({
        message: log.userMessage,
        response: log.aiResponse,
        agent: log.agent,
        timestamp: log.timestamp
      });
      
      if (!patterns[messageType].agents[log.agent]) {
        patterns[messageType].agents[log.agent] = 0;
      }
      patterns[messageType].agents[log.agent]++;
    });

    // Calculează lungimea medie a răspunsurilor
    Object.keys(patterns).forEach(type => {
      const responses = patterns[type].examples.map(ex => ex.response.length);
      patterns[type].avgResponseLength = responses.reduce((a, b) => a + b, 0) / responses.length;
    });

    return patterns;
  }

  /**
   * Categorizează mesajele
   */
  categorizeMessage(message) {
    const msg = message.toLowerCase();
    
    if (msg.includes('salut') || msg.includes('bună') || msg.includes('hello')) {
      return 'greeting';
    }
    if (msg.includes('rezervare') || msg.includes('bilet') || msg.includes('program')) {
      return 'booking';
    }
    if (msg.includes('problemă') || msg.includes('ajutor') || msg.includes('suport')) {
      return 'support';
    }
    if (msg.includes('preț') || msg.includes('cost') || msg.includes('cât costă')) {
      return 'pricing';
    }
    if (msg.includes('bagaj') || msg.includes('întârziere') || msg.includes('urgent')) {
      return 'urgent_support';
    }
    
    return 'general';
  }

  /**
   * Identifică probleme comune
   */
  identifyCommonIssues(logs) {
    const issues = [];
    
    // Mesaje care au primit răspunsuri scurte (posibil neadecvate)
    const shortResponses = logs.filter(log => 
      log.aiResponse.length < 50 && log.success
    );
    
    if (shortResponses.length > 0) {
      issues.push({
        type: 'short_responses',
        count: shortResponses.length,
        examples: shortResponses.slice(0, 5).map(log => ({
          message: log.userMessage,
          response: log.aiResponse,
          agent: log.agent
        }))
      });
    }

    // Mesaje care au fost rutate la fallback (posibil neadecvate)
    const fallbackMessages = logs.filter(log => 
      log.agent === 'fallback' && log.success
    );
    
    if (fallbackMessages.length > 0) {
      issues.push({
        type: 'fallback_overuse',
        count: fallbackMessages.length,
        examples: fallbackMessages.slice(0, 5).map(log => ({
          message: log.userMessage,
          response: log.aiResponse
        }))
      });
    }

    // Mesaje cu erori
    const errorMessages = logs.filter(log => !log.success);
    
    if (errorMessages.length > 0) {
      issues.push({
        type: 'errors',
        count: errorMessages.length,
        examples: errorMessages.slice(0, 5).map(log => ({
          message: log.userMessage,
          error: log.error || 'Unknown error'
        }))
      });
    }

    return issues;
  }

  /**
   * Generează sugestii de îmbunătățire
   */
  generateImprovements(patterns, issues) {
    const improvements = [];

    // Sugestii bazate pe pattern-uri
    Object.keys(patterns).forEach(type => {
      const pattern = patterns[type];
      
      if (pattern.count > 10) {
        improvements.push({
          type: 'frequent_pattern',
          category: type,
          suggestion: `Pattern "${type}" appears ${pattern.count} times. Consider optimizing agent responses for this category.`,
          priority: 'medium'
        });
      }
    });

    // Sugestii bazate pe probleme
    issues.forEach(issue => {
      if (issue.type === 'short_responses') {
        improvements.push({
          type: 'response_quality',
          suggestion: `${issue.count} responses were too short. Consider improving response length for better user experience.`,
          priority: 'high'
        });
      }
      
      if (issue.type === 'fallback_overuse') {
        improvements.push({
          type: 'routing_improvement',
          suggestion: `${issue.count} messages were routed to fallback. Consider improving agent routing logic.`,
          priority: 'high'
        });
      }
      
      if (issue.type === 'errors') {
        improvements.push({
          type: 'error_handling',
          suggestion: `${issue.count} errors occurred. Review error handling and system stability.`,
          priority: 'critical'
        });
      }
    });

    return improvements;
  }

  /**
   * Calculează lungimea medie a răspunsurilor
   */
  calculateAverageResponseLength(logs) {
    const successfulLogs = logs.filter(log => log.success);
    if (successfulLogs.length === 0) return 0;
    
    const totalLength = successfulLogs.reduce((sum, log) => sum + log.aiResponse.length, 0);
    return Math.round(totalLength / successfulLogs.length);
  }

  /**
   * Obține agenții cei mai folosiți
   */
  getTopAgents(logs) {
    const agentCounts = {};
    
    logs.forEach(log => {
      if (!agentCounts[log.agent]) {
        agentCounts[log.agent] = 0;
      }
      agentCounts[log.agent]++;
    });

    return Object.entries(agentCounts)
      .map(([agent, count]) => ({ agent, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Salvează datele de învățare
   */
  saveLearningData() {
    try {
      const learningDir = path.join(process.cwd(), 'logs', 'learning');
      if (!fs.existsSync(learningDir)) {
        fs.mkdirSync(learningDir, { recursive: true });
      }

      const filename = `learning-data-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(learningDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(this.learningData, null, 2));
      console.log(`[LEARNING] Data saved to ${filepath}`);
    } catch (error) {
      console.error('[LEARNING] Error saving learning data:', error);
    }
  }

  /**
   * Încarcă datele de învățare
   */
  loadLearningData() {
    try {
      const learningDir = path.join(process.cwd(), 'logs', 'learning');
      const today = new Date().toISOString().split('T')[0];
      const filename = `learning-data-${today}.json`;
      const filepath = path.join(learningDir, filename);
      
      if (fs.existsSync(filepath)) {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        this.learningData = { ...this.learningData, ...data };
        console.log(`[LEARNING] Data loaded from ${filepath}`);
      }
    } catch (error) {
      console.error('[LEARNING] Error loading learning data:', error);
    }
  }

  /**
   * Obține raportul de învățare
   */
  getLearningReport() {
    return {
      patterns: this.learningData.patterns,
      issues: this.learningData.commonIssues,
      improvements: this.learningData.improvements,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const learningSystem = new LearningSystem(); 