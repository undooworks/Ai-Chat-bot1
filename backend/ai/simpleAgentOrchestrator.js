import 'dotenv/config';
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

/**
 * Simple Agent Orchestrator (without LangGraph)
 * Uses basic LangChain agents for routing and responses
 */

class SimpleAgentOrchestrator {
  constructor() {
    this.llm = null;
    this.agents = {};
    this.initializeLLM();
    this.initializeAgents();
  }

  /**
   * Initialize Groq LLM
   */
  initializeLLM() {
    try {
      if (!process.env.GROQ_API_KEY) {
        console.warn("[AI] GROQ_API_KEY not found, using fallback mode");
        this.llm = null;
        return;
      }
      
      this.llm = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: "llama3-8b-8192",
        temperature: 0.7,
        maxTokens: 1000,
      });
      console.log("[AI] Groq LLM initialized successfully");
    } catch (error) {
      console.error("[AI] Failed to initialize Groq LLM:", error);
      this.llm = null;
    }
  }

  /**
   * Initialize simple agents
   */
  async initializeAgents() {
    if (!this.llm) {
      console.warn("[AI] LLM not available, agents will use fallback mode");
      return;
    }

    try {
      // Router Agent
      const routerPrompt = ChatPromptTemplate.fromTemplate(`
You are an intelligent router for a transport company's AI system.
Your job is to analyze user messages and route them to the appropriate specialized agent.

Available agents:
- booking: For ticket reservations, schedule inquiries, route information
- support: For customer service issues, complaints, technical problems
- greeting: For greetings, introductions, general welcome messages
- fallback: For everything else, general questions, or when unsure

User message: {message}
User language: {language}

Respond with ONLY the agent name (booking, support, greeting, or fallback).
`);

      this.agents.router = RunnableSequence.from([
        routerPrompt,
        this.llm,
        new StringOutputParser(),
      ]);

      // Booking Agent
      const bookingPrompt = ChatPromptTemplate.fromTemplate(`
You are a specialized booking agent for a transport company.
You help users with ticket reservations, schedule inquiries, and route information.

User message: {message}
User language: {language}

Provide helpful, accurate responses about bookings, schedules, and routes.
Always respond in the user's language ({language}).
`);

      this.agents.booking = RunnableSequence.from([
        bookingPrompt,
        this.llm,
        new StringOutputParser(),
      ]);

      // Support Agent
      const supportPrompt = ChatPromptTemplate.fromTemplate(`
You are a specialized customer support agent for a transport company.
You help users with issues, complaints, lost luggage, delays, and technical problems.

User message: {message}
User language: {language}

Be empathetic and helpful. Create support tickets when appropriate.
Always respond in the user's language ({language}).
`);

      this.agents.support = RunnableSequence.from([
        supportPrompt,
        this.llm,
        new StringOutputParser(),
      ]);

      // Greeting Agent
      const greetingPrompt = ChatPromptTemplate.fromTemplate(`
You are a friendly greeting agent for a transport company.
You welcome users and provide general information about services.

User message: {message}
User language: {language}

Provide warm, welcoming responses. Offer to help with bookings, support, or general information.
Always respond in the user's language ({language}).
`);

      this.agents.greeting = RunnableSequence.from([
        greetingPrompt,
        this.llm,
        new StringOutputParser(),
      ]);

      // Fallback Agent
      const fallbackPrompt = ChatPromptTemplate.fromTemplate(`
You are a helpful AI assistant for a transport company.
You handle general questions and provide information about transport services.

User message: {message}
User language: {language}

If the question is not related to transport, politely redirect to transport services.
Always respond in the user's language ({language}).
Be helpful and professional.
`);

      this.agents.fallback = RunnableSequence.from([
        fallbackPrompt,
        this.llm,
        new StringOutputParser(),
      ]);

      console.log("[AI] All simple agents initialized successfully");
    } catch (error) {
      console.error("[AI] Failed to initialize agents:", error);
    }
  }

  /**
   * Process message using simple agent routing
   */
  async processMessage(message, sessionId, language = null) {
    try {
      console.log(`[AI] Processing message for session ${sessionId}:`, message);

      // Check if agents are available
      if (!this.llm || !this.agents.router) {
        console.log("[AI] Agents not available, using fallback response");
        return {
          reply: this.getFallbackResponse(message, language),
          agent: "fallback",
          language: language || "ro",
          sessionId,
          error: false,
        };
      }

      // Detect language if not provided
      const detectedLanguage = language || "ro";

      // Route to appropriate agent
      const agentType = await this.agents.router.invoke({
        message,
        language: detectedLanguage,
      });

      const cleanAgentType = agentType.trim().toLowerCase();
      console.log(`[AI] Routed to agent: ${cleanAgentType}`);

      // Get response from the appropriate agent
      const agent = this.agents[cleanAgentType] || this.agents.fallback;
      const response = await agent.invoke({
        message,
        language: detectedLanguage,
      });

      console.log(`[AI] Response from ${cleanAgentType} agent:`, response);

      return {
        reply: response,
        agent: cleanAgentType,
        language: detectedLanguage,
        sessionId,
        error: false,
      };

    } catch (error) {
      console.error("[AI] Error processing message:", error);
      
      return {
        reply: this.getFallbackResponse(message, language),
        agent: "fallback",
        language: language || "ro",
        sessionId,
        error: true,
      };
    }
  }

  /**
   * Get fallback response when agents are not available
   */
  getFallbackResponse(message, language) {
    const responses = {
      ro: "Bună! Sunt asistentul pentru transport. Cum vă pot ajuta cu rezervările sau întrebările dumneavoastră?",
      en: "Hello! I'm the transport assistant. How can I help you with bookings or questions?",
      fr: "Bonjour! Je suis l'assistant de transport. Comment puis-je vous aider avec vos réservations ou questions?",
      de: "Hallo! Ich bin der Transportassistent. Wie kann ich Ihnen bei Buchungen oder Fragen helfen?"
    };

    return responses[language] || responses.ro;
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      status: this.llm ? "active" : "fallback",
      agents: Object.keys(this.agents),
      llm: this.llm ? "groq" : "none",
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const simpleAgentOrchestrator = new SimpleAgentOrchestrator(); 