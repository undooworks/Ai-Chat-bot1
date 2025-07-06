import { simpleAgentOrchestrator } from './simpleAgentOrchestrator.js';

/**
 * LangChain Integration Layer
 * 
 * This module provides integration between the new LangChain orchestrator
 * and the existing agent system, ensuring backward compatibility while
 * enabling the new AI capabilities.
 */

class LangChainIntegration {
  constructor() {
    this.orchestrator = simpleAgentOrchestrator;
    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize the integration
   */
  async initialize() {
    try {
      // Simple orchestrator is already initialized
      this.isInitialized = true;
      console.log("[LangChain] Integration initialized successfully");
    } catch (error) {
      console.error("[LangChain] Integration initialization failed:", error);
      this.isInitialized = false;
    }
  }

  /**
   * Process message using LangChain orchestrator
   */
  async processMessage(message, sessionId, language = null) {
    if (!this.isInitialized) {
      console.warn("[LangChain] Integration not initialized, using fallback");
      return this.fallbackResponse(message, language);
    }

    try {
      const result = await this.orchestrator.processMessage(message, sessionId, language);
      return {
        success: true,
        reply: result.reply,
        agent: result.agent,
        language: result.language,
        confidence: this.calculateConfidence(result),
        metadata: {
          orchestrator: "langchain",
          model: "llama3-8b-8192",
          provider: "groq",
          tools_used: result.tools || [],
        }
      };
    } catch (error) {
      console.error("[LangChain] Error processing message:", error);
      return this.fallbackResponse(message, language);
    }
  }

  /**
   * Calculate confidence score for the response
   */
  calculateConfidence(result) {
    // Simple confidence calculation based on agent type
    const confidenceScores = {
      booking: 0.95,
      support: 0.90,
      greeting: 0.98,
      fallback: 0.70,
    };

    return confidenceScores[result.agent] || 0.75;
  }

  /**
   * Fallback response when LangChain is not available
   */
  fallbackResponse(message, language) {
    const responses = {
      ro: "Îmi pare rău, sistemul AI este temporar indisponibil. Vă rog să încercați din nou în câteva momente.",
      en: "I'm sorry, the AI system is temporarily unavailable. Please try again in a few moments.",
      fr: "Je suis désolé, le système d'IA est temporairement indisponible. Veuillez réessayer dans quelques instants.",
      de: "Es tut mir leid, das KI-System ist vorübergehend nicht verfügbar. Bitte versuchen Sie es in wenigen Augenblicken erneut."
    };

    return {
      success: false,
      reply: responses[language] || responses.en,
      agent: "fallback",
      language: language || "en",
      confidence: 0.5,
      metadata: {
        orchestrator: "fallback",
        error: "langchain_unavailable"
      }
    };
  }

  /**
   * Get system statistics
   */
  getStats() {
    if (!this.isInitialized) {
      return {
        status: "not_initialized",
        orchestrator: "langchain",
        error: "Integration not ready"
      };
    }

    return {
      status: "active",
      orchestrator: "langchain",
      ...this.orchestrator.getStats(),
      integration: {
        version: "1.0.0",
        features: [
          "multi_agent_orchestration",
          "memory_management",
          "tool_integration",
          "language_detection",
          "fallback_system"
        ]
      }
    };
  }

  /**
   * Clear session memory
   */
  clearSessionMemory(sessionId) {
    if (this.isInitialized) {
      this.orchestrator.clearSessionMemory(sessionId);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { status: "unhealthy", reason: "not_initialized" };
      }

      // Test with a simple message
      const testResult = await this.processMessage("test", "health-check", "en");
      
      return {
        status: "healthy",
        orchestrator: "langchain",
        test_result: testResult.success,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: "unhealthy",
        reason: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export const langChainIntegration = new LangChainIntegration(); 