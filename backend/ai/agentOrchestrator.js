import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { DynamicTool } from "@langchain/core/tools";
import { StateGraph, END } from "@langchain/langgraph";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

/**
 * Enterprise AI Agent Orchestrator
 * 
 * This orchestrator uses LangChain and LangGraph to create a real AI agent system
 * with proper memory, reasoning, tool usage, and fallback mechanisms.
 * 
 * Architecture:
 * 1. Router Agent (LangGraph) - decides which specialized agent to use
 * 2. Specialized Agents (LangChain) - Booking, Support, Greeting, Fallback
 * 3. Memory Management - conversation history per session
 * 4. Tool Integration - database, external APIs, etc.
 * 5. Fallback System - real LLM reasoning when agents can't handle requests
 */

class AgentOrchestrator {
  constructor() {
    this.llm = null;
    this.memoryStore = new Map(); // Session-based memory
    this.initializeLLM();
    this.initializeTools();
    this.initializeAgents();
    this.initializeGraph();
  }

  /**
   * Initialize Groq LLM for all agents
   */
  initializeLLM() {
    try {
      if (!process.env.GROQ_API_KEY) {
        console.warn("[AI] GROQ_API_KEY not found, LangChain will use fallback mode");
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
   * Initialize tools for agents to use
   */
  initializeTools() {
    this.tools = {
      // Database tools
      getBookingHistory: new DynamicTool({
        name: "get_booking_history",
        description: "Get booking history for a user session",
        func: async (sessionId) => {
          // This would integrate with your database
          return JSON.stringify({ bookings: [], sessionId });
        },
      }),

      createBooking: new DynamicTool({
        name: "create_booking",
        description: "Create a new bus booking",
        func: async (bookingData) => {
          // This would integrate with your booking system
          const booking = JSON.parse(bookingData);
          return JSON.stringify({ 
            success: true, 
            bookingId: `BK${Date.now()}`,
            ...booking 
          });
        },
      }),

      getSchedule: new DynamicTool({
        name: "get_schedule",
        description: "Get bus schedule for a route",
        func: async (route) => {
          // This would integrate with your schedule system
          return JSON.stringify({
            route,
            schedules: [
              { time: "08:00", price: 150, seats: 20 },
              { time: "14:00", price: 150, seats: 15 },
              { time: "20:00", price: 150, seats: 25 }
            ]
          });
        },
      }),

      // Support tools
      createSupportTicket: new DynamicTool({
        name: "create_support_ticket",
        description: "Create a support ticket for user issues",
        func: async (issueData) => {
          const issue = JSON.parse(issueData);
          return JSON.stringify({
            ticketId: `TKT${Date.now()}`,
            status: "open",
            priority: issue.priority || "medium",
            ...issue
          });
        },
      }),

      // Language detection tool
      detectLanguage: new DynamicTool({
        name: "detect_language",
        description: "Detect the language of user input",
        func: async (text) => {
          const languages = {
            ro: /[ăâîșț]/i,
            fr: /[àâäéèêëïîôöùûüÿç]/i,
            de: /[äöüß]/i,
            en: /^[a-zA-Z\s.,!?]+$/
          };

          for (const [lang, pattern] of Object.entries(languages)) {
            if (pattern.test(text)) {
              return lang;
            }
          }
          return "en"; // default
        },
      }),
    };

    console.log("[AI] Tools initialized:", Object.keys(this.tools));
  }

  /**
   * Initialize specialized agents using LangChain
   */
  async initializeAgents() {
    try {
      if (!this.llm) {
        console.warn("[AI] LLM not available, agents will use fallback mode");
        return;
      }

      // Router Agent - decides which agent to use
      this.routerAgent = await this.createRouterAgent();

      // Booking Agent
      this.bookingAgent = await this.createBookingAgent();

      // Support Agent
      this.supportAgent = await this.createSupportAgent();

      // Greeting Agent
      this.greetingAgent = await this.createGreetingAgent();

      // Fallback Agent
      this.fallbackAgent = await this.createFallbackAgent();

      console.log("[AI] All agents initialized successfully");
    } catch (error) {
      console.error("[AI] Failed to initialize agents:", error);
      // Don't throw, just log the error
    }
  }

  /**
   * Create Router Agent using LangChain
   */
  async createRouterAgent() {
    const prompt = ChatPromptTemplate.fromTemplate(`
You are an intelligent router for a transport company's AI system.
Your job is to analyze user messages and route them to the appropriate specialized agent.

Available agents:
- booking: For ticket reservations, schedule inquiries, route information
- support: For customer service issues, complaints, technical problems
- greeting: For greetings, introductions, general welcome messages
- fallback: For everything else, general questions, or when unsure

User message: {message}
User language: {language}
Session context: {context}

Agent scratchpad: {agent_scratchpad}

Respond with ONLY the agent name (booking, support, greeting, or fallback).
`);

    const chain = RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);

    return chain;
  }

  /**
   * Create Booking Agent with tools
   */
  async createBookingAgent() {
    const prompt = ChatPromptTemplate.fromTemplate(`
You are a specialized booking agent for a transport company.
You help users with ticket reservations, schedule inquiries, and route information.

You have access to these tools:
- get_schedule: Get bus schedules for routes
- create_booking: Create new bookings
- get_booking_history: Get user's booking history

Current conversation context: {context}
User language: {language}

User message: {message}

Agent scratchpad: {agent_scratchpad}

Provide helpful, accurate responses. Use tools when needed to get real information.
Always respond in the user's language ({language}).
`);

    const agent = await createOpenAIFunctionsAgent({
      llm: this.llm,
      tools: [this.tools.getSchedule, this.tools.createBooking, this.tools.getBookingHistory],
      prompt,
    });

    return new AgentExecutor({ agent, tools: [this.tools.getSchedule, this.tools.createBooking, this.tools.getBookingHistory] });
  }

  /**
   * Create Support Agent with tools
   */
  async createSupportAgent() {
    const prompt = ChatPromptTemplate.fromTemplate(`
You are a specialized customer support agent for a transport company.
You help users with issues, complaints, lost luggage, delays, and technical problems.

You have access to these tools:
- create_support_ticket: Create support tickets for issues

Current conversation context: {context}
User language: {language}

User message: {message}

Agent scratchpad: {agent_scratchpad}

Be empathetic and helpful. Create support tickets when appropriate.
Always respond in the user's language ({language}).
`);

    const agent = await createOpenAIFunctionsAgent({
      llm: this.llm,
      tools: [this.tools.createSupportTicket],
      prompt,
    });

    return new AgentExecutor({ agent, tools: [this.tools.createSupportTicket] });
  }

  /**
   * Create Greeting Agent
   */
  async createGreetingAgent() {
    const prompt = ChatPromptTemplate.fromTemplate(`
You are a friendly greeting agent for a transport company.
You welcome users and provide general information about services.

Current conversation context: {context}
User language: {language}

User message: {message}

Agent scratchpad: {agent_scratchpad}

Provide warm, welcoming responses. Offer to help with bookings, support, or general information.
Always respond in the user's language ({language}).
`);

    return RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);
  }

  /**
   * Create Fallback Agent for general questions
   */
  async createFallbackAgent() {
    const prompt = ChatPromptTemplate.fromTemplate(`
You are a helpful AI assistant for a transport company.
You handle general questions and provide information about transport services.

Current conversation context: {context}
User language: {language}

User message: {message}

Agent scratchpad: {agent_scratchpad}

If the question is not related to transport, politely redirect to transport services.
Always respond in the user's language ({language}).
Be helpful and professional.
`);

    return RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);
  }

  /**
   * Initialize LangGraph for orchestration
   */
  initializeGraph() {
    // Define the state schema
    const stateSchema = {
      message: { value: "" },
      language: { value: "en" },
      context: { value: "" },
      agent: { value: "" },
      response: { value: "" },
      sessionId: { value: "" },
    };

    // Create the graph
    this.graph = new StateGraph({
      channels: stateSchema,
    });

    // Add nodes
    this.graph.addNode("router", this.routerNode.bind(this));
    this.graph.addNode("booking", this.bookingNode.bind(this));
    this.graph.addNode("support", this.supportNode.bind(this));
    this.graph.addNode("greeting", this.greetingNode.bind(this));
    this.graph.addNode("fallback", this.fallbackNode.bind(this));

    // Add edges
    this.graph.addEdge("router", "booking");
    this.graph.addEdge("router", "support");
    this.graph.addEdge("router", "greeting");
    this.graph.addEdge("router", "fallback");

    // Add conditional edges
    this.graph.addConditionalEdges(
      "router",
      this.routeToAgent.bind(this),
      {
        booking: "booking",
        support: "support",
        greeting: "greeting",
        fallback: "fallback",
      }
    );

    // Set entry point
    this.graph.setEntryPoint("router");

    // Compile the graph
    this.app = this.graph.compile();

    console.log("[AI] LangGraph orchestration initialized");
  }

  /**
   * Router node - decides which agent to use
   */
  async routerNode(state) {
    const { message, language, context, sessionId } = state;
    
    // Detect language if not provided
    const detectedLanguage = language || await this.tools.detectLanguage.func(message);
    
    const result = await this.routerAgent.invoke({
      message,
      language: detectedLanguage,
      context,
      agent_scratchpad: "",
    });

    const agent = result.trim().toLowerCase();
    
    return {
      ...state,
      language: detectedLanguage,
      agent,
    };
  }

  /**
   * Route to appropriate agent
   */
  routeToAgent(state) {
    return state.agent;
  }

  /**
   * Booking agent node
   */
  async bookingNode(state) {
    const { message, language, context, sessionId } = state;
    
    const result = await this.bookingAgent.invoke({
      message,
      language,
      context,
      agent_scratchpad: "",
    });

    return {
      ...state,
      response: result.output || result,
    };
  }

  /**
   * Support agent node
   */
  async supportNode(state) {
    const { message, language, context, sessionId } = state;
    
    const result = await this.supportAgent.invoke({
      message,
      language,
      context,
      agent_scratchpad: "",
    });

    return {
      ...state,
      response: result.output || result,
    };
  }

  /**
   * Greeting agent node
   */
  async greetingNode(state) {
    const { message, language, context, sessionId } = state;
    
    const result = await this.greetingAgent.invoke({
      message,
      language,
      context,
      agent_scratchpad: "",
    });

    return {
      ...state,
      response: result,
    };
  }

  /**
   * Fallback agent node
   */
  async fallbackNode(state) {
    const { message, language, context, sessionId } = state;
    
    const result = await this.fallbackAgent.invoke({
      message,
      language,
      context,
      agent_scratchpad: "",
    });

    return {
      ...state,
      response: result,
    };
  }

  /**
   * Get or create memory for a session
   */
  getSessionMemory(sessionId) {
    if (!this.memoryStore.has(sessionId)) {
      this.memoryStore.set(sessionId, new BufferMemory({
        returnMessages: true,
        memoryKey: "history",
      }));
    }
    return this.memoryStore.get(sessionId);
  }

  /**
   * Main method to process user messages
   */
  async processMessage(message, sessionId, language = null) {
    try {
      console.log(`[AI] Processing message for session ${sessionId}:`, message);

      // Check if LangChain is available
      if (!this.llm || !this.app) {
        console.log("[AI] LangChain not available, using fallback response");
        return {
          reply: this.getFallbackResponse(message, language),
          agent: "fallback",
          language: language || "ro",
          sessionId,
          error: false,
        };
      }

      // Get session memory
      const memory = this.getSessionMemory(sessionId);
      const history = await memory.loadMemoryVariables({});
      const context = history.history || [];

      // Run the orchestration graph
      const result = await this.app.invoke({
        message,
        language,
        context: JSON.stringify(context),
        sessionId,
        agent: "",
        response: "",
      });

      // Save to memory
      await memory.saveContext(
        { input: message },
        { output: result.response }
      );

      console.log(`[AI] Response from ${result.agent} agent:`, result.response);

      return {
        reply: result.response,
        agent: result.agent,
        language: result.language,
        sessionId,
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
   * Get fallback response when LangChain is not available
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
   * Get agent statistics
   */
  getStats() {
    return {
      totalSessions: this.memoryStore.size,
      llmModel: "llama3-8b-8192",
      provider: "Groq",
      tools: Object.keys(this.tools),
      agents: ["router", "booking", "support", "greeting", "fallback"],
    };
  }

  /**
   * Clear session memory
   */
  clearSessionMemory(sessionId) {
    this.memoryStore.delete(sessionId);
    console.log(`[AI] Cleared memory for session ${sessionId}`);
  }
}

// Export singleton instance
export const agentOrchestrator = new AgentOrchestrator(); 