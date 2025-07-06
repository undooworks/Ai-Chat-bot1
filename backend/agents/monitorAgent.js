export class MonitoringAgent {
  constructor() {
    this.activityLog = [];
    this.fallbackCount = 0;
    this.sessionQuality = new Map(); // Track quality per session
    this.escalationThreshold = 3; // Number of failed interactions before escalation
    this.escalatedSessions = new Set(); // Track already escalated sessions
  }

  log(agent, message, response, isFallback = false, sessionId = 'default') {
    this.activityLog.push({
      agent,
      message,
      response,
      isFallback,
      sessionId,
      time: new Date().toISOString(),
    });
    
    if (isFallback) this.fallbackCount++;
    
    // Track session quality
    if (!this.sessionQuality.has(sessionId)) {
      this.sessionQuality.set(sessionId, {
        failedInteractions: 0,
        totalInteractions: 0,
        lastEscalationCheck: null,
        escalationTriggered: false
      });
    }
    
    const sessionData = this.sessionQuality.get(sessionId);
    sessionData.totalInteractions++;
    
    // Detect failed interactions
    if (this.isFailedInteraction(message, response, agent)) {
      sessionData.failedInteractions++;
    }
    
    // Check for escalation
    if (!sessionData.escalationTriggered && 
        sessionData.failedInteractions >= this.escalationThreshold) {
      sessionData.escalationTriggered = true;
      this.escalatedSessions.add(sessionId);
      console.log(`🚨 ESCALATION TRIGGERED for session ${sessionId} after ${sessionData.failedInteractions} failed interactions`);
    }
    
    // Keep log size reasonable
    if (this.activityLog.length > 1000) this.activityLog.shift();
    console.log(`[Monitor] ${agent}: ${message} => ${response} (Session: ${sessionId}, Failed: ${sessionData.failedInteractions}/${sessionData.totalInteractions})`);
  }

  // Detect failed interactions based on response patterns
  isFailedInteraction(message, response, agent) {
    const msg = message.toLowerCase();
    const resp = response.toLowerCase();
    
    // Patterns that indicate failed interactions
    const failurePatterns = [
      /nu înțeleg|nu inteleg/i,
      /te rog să îmi spui dacă vrei să faci/i,
      /te rog să specificați/i,
      /te rog să alegeți/i,
      /nu înțeleg ce vrei să spui/i,
      /nu am înțeles/i,
      /te rog să repeți/i
    ];
    
    // Check if response contains failure patterns
    const hasFailurePattern = failurePatterns.some(pattern => pattern.test(resp));
    
    // Additional checks for specific scenarios
    const isBookingAgentFailure = agent === 'BookingAgent' && 
      (resp.includes('nu înțeleg') || resp.includes('te rog să îmi spui'));
    
    const isSupportAgentFailure = agent === 'SupportAgent' && 
      resp.includes('te rog să îmi spui mai multe detalii');
    
    const isFallbackAgentFailure = agent === 'FallbackAgent' && 
      resp.includes('te rog să îmi spui mai multe detalii');
    
    return hasFailurePattern || isBookingAgentFailure || isSupportAgentFailure || isFallbackAgentFailure;
  }

  // Check if session should be escalated
  shouldEscalate(sessionId) {
    return this.escalatedSessions.has(sessionId);
  }

  // Get escalation message
  getEscalationMessage(sessionId) {
    const sessionData = this.sessionQuality.get(sessionId);
    if (!sessionData) return null;
    
    return {
      message: `🚨 Sesiunea dvs. a fost transferată către un agent uman pentru asistență personalizată. 
      
Agentul va prelua conversația în câteva momente. Vă mulțumim pentru răbdare!

Numărul de referință: ESC-${Date.now()}`,
      sessionData: sessionData
    };
  }

  // Reset session quality (for testing or after successful resolution)
  resetSessionQuality(sessionId) {
    this.sessionQuality.delete(sessionId);
    this.escalatedSessions.delete(sessionId);
  }

  // Get session quality summary
  getSessionQuality(sessionId) {
    return this.sessionQuality.get(sessionId) || {
      failedInteractions: 0,
      totalInteractions: 0,
      escalationTriggered: false
    };
  }

  getRecentActivity(limit = 20) {
    return this.activityLog.slice(-limit);
  }

  getFallbackCount() {
    return this.fallbackCount;
  }

  // Get escalation statistics
  getEscalationStats() {
    const totalSessions = this.sessionQuality.size;
    const escalatedCount = this.escalatedSessions.size;
    const sessionsWithFailures = Array.from(this.sessionQuality.values())
      .filter(session => session.failedInteractions > 0).length;
    
    return {
      totalSessions,
      escalatedSessions: escalatedCount,
      sessionsWithFailures,
      escalationRate: totalSessions > 0 ? (escalatedCount / totalSessions * 100).toFixed(2) + '%' : '0%'
    };
  }

  healthCheck() {
    return {
      status: 'ok',
      fallbackCount: this.fallbackCount,
      escalationStats: this.getEscalationStats(),
      recent: this.getRecentActivity(5),
    };
  }
} 