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
import { Client } from "langsmith";
import fs from 'fs';
import path from 'path';
// import Redis from 'redis';
import { getUserContext, setUserContext } from './userMemory.js';
import { validateAgentResponse, generateErrorResponse } from './jsonSchemas/agentSchemas.js';
import { z } from 'zod';

// LangSmith integration for production observability
const langSmithClient = new Client({
  apiUrl: process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com",
  apiKey: process.env.LANGSMITH_API_KEY,
});

// Enable LangSmith tracing
process.env.LANGCHAIN_TRACING_V2 = "true";
process.env.LANGCHAIN_PROJECT = process.env.LANGSMITH_PROJECT || "ai-chatbot-production";
process.env.LANGCHAIN_ENDPOINT = process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com";
process.env.LANGCHAIN_API_KEY = process.env.LANGSMITH_API_KEY;

// Advanced caching system for production performance
import { InMemoryCache } from "@langchain/core/caches";
// import { RedisCache } from "@langchain/community/caches/redis";

// Initialize caching system
let cacheSystem;
cacheSystem = new InMemoryCache();
console.log("[CACHE] In-memory cache initialized");

/**
 * Enterprise AI Agent Orchestrator - Production Ready
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

export { getUserContext, setUserContext };

class AgentOrchestrator {
  constructor() {
    this.llm = null;
    this.memoryStore = new Map(); // Session-based memory
    this.tools = {};
    this.routerAgent = null;
    this.bookingAgent = null;
    this.supportAgent = null;
    this.greetingAgent = null;
    this.fallbackAgent = null;
    this.paymentAgent = null;
    this.monitorAgent = null;
    this.graph = null;
    this.app = null;
    this.prompts = {};
    // Bind all node methods for LangGraph
    this.routerNode = this.routerNode.bind(this);
    this.greetingNode = this.greetingNode.bind(this);
    this.bookingNode = this.bookingNode.bind(this);
    this.supportNode = this.supportNode.bind(this);
    this.paymentNode = this.paymentNode.bind(this);
    this.fallbackNode = this.fallbackNode.bind(this);
    this.monitorNode = this.monitorNode.bind(this);
    this.routeToAgent = this.routeToAgent.bind(this);
  }

  async init() {
    await this.initializeLLM();
    await this.loadPrompts();
    await this.initializeAgents(); // Ensure agents are always re-initialized
    this.initializeGraph();
    console.log("[AI] Orchestrator initialized successfully");
  }

  /**
   * Initialize Groq LLM for all agents with fallback options
   */
  async initializeLLM() {
    try {
      // Primary model: Groq (fastest, most reliable)
      if (process.env.GROQ_API_KEY) {
        this.llm = new ChatGroq({
          apiKey: process.env.GROQ_API_KEY,
          model: "llama3-8b-8192",
          temperature: 0.7,
          maxTokens: 1000,
          cache: cacheSystem,
          callbacks: [
            {
              handleLLMStart: async (llm, prompts) => {
                console.log(`[LLM] Starting ${llm.constructor.name} with ${prompts.length} prompts`);
              },
              handleLLMEnd: async (output) => {
                console.log(`[LLM] Completed with ${output.generations[0][0].text.length} tokens`);
              },
              handleLLMError: async (error) => {
                console.error(`[LLM] Error: ${error.message}`);
              }
            }
          ]
        });
        console.log("[AI] Groq LLM initialized successfully");
        return;
      }
      
      // Fallback 1: Ollama (local, free)
      if (process.env.OLLAMA_BASE_URL) {
        const { ChatOllama } = await import("@langchain/community/chat_models/ollama");
        this.llm = new ChatOllama({
          baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
          model: "llama3.2:3b", // Fast local model
          temperature: 0.7,
          cache: cacheSystem,
        });
        console.log("[AI] Ollama LLM initialized successfully");
        return;
      }
      
      // Fallback 2: HuggingFace (free tier)
      if (process.env.HUGGINGFACE_API_KEY) {
        const { ChatHuggingFace } = await import("@langchain/community/chat_models/huggingface");
        this.llm = new ChatHuggingFace({
          model: "microsoft/DialoGPT-medium", // Free model
          temperature: 0.7,
          cache: cacheSystem,
        });
        console.log("[AI] HuggingFace LLM initialized successfully");
        return;
      }
      
      // Fallback 3: Local model with transformers
      console.warn("[AI] No API keys found, using local fallback");
      this.llm = null;
      
    } catch (error) {
      console.error("[AI] Failed to initialize LLM:", error);
      this.llm = null;
    }
  }

  /**
   * Load prompts from YAML/JSON files
   */
  async loadPrompts() {
    try {
      const promptsDir = path.join(process.cwd(), 'backend', 'ai', 'prompts');
      
      // Load prompts for each agent
      const agentNames = ['greeting', 'booking', 'support', 'payment', 'fallback', 'router'];
      
      for (const agentName of agentNames) {
        const promptPath = path.join(promptsDir, `${agentName}Agent.yaml`);
        if (fs.existsSync(promptPath) && agentName !== 'router') { // Skip YAML for router, use default
          const promptContent = fs.readFileSync(promptPath, 'utf8');
          this.prompts[agentName] = this.parsePrompt(promptContent);
        } else {
          // Use default prompts if files don't exist or for router
          this.prompts[agentName] = this.getDefaultPrompt(agentName);
        }
      }
      
      console.log("[AI] Prompts loaded successfully");
    } catch (error) {
      console.error("[AI] Failed to load prompts:", error);
      // Use default prompts
      this.prompts = this.getDefaultPrompts();
    }
  }

  /**
   * Parse YAML prompt to ChatPromptTemplate
   */
  parsePrompt(content) {
    try {
      // Simple YAML parsing for now
      const lines = content.split('\n');
      const system = [];
      const human = [];
      let currentSection = null;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('system:')) {
          currentSection = 'system';
        } else if (trimmedLine.startsWith('human:')) {
          currentSection = 'human';
        } else if (trimmedLine && currentSection) {
          if (currentSection === 'system') {
            system.push(trimmedLine);
          } else {
            human.push(trimmedLine);
          }
        }
      }
      
      const systemText = system.join('\n');
      const humanText = human.join('\n');
      
      // Clean up any template variables that might cause issues
      const cleanSystemText = systemText.replace(/\{([^}]+)\}/g, '{$1}');
      const cleanHumanText = humanText.replace(/\{([^}]+)\}/g, '{$1}');
      
      return ChatPromptTemplate.fromMessages([
        ["system", cleanSystemText],
        ["human", cleanHumanText]
      ]);
    } catch (error) {
      console.error('[AI] Error parsing prompt:', error);
      // Return a simple fallback prompt
      return ChatPromptTemplate.fromMessages([
        ["system", "You are a helpful AI assistant."],
        ["human", "Message: {message}\nLanguage: {language}"]
      ]);
    }
  }

  /**
   * Get default prompts for agents
   */
  getDefaultPrompts() {
    try {
      return {
        router: ChatPromptTemplate.fromMessages([
          ["system", `You are a router agent. Analyze the user message and respond with exactly one word: greeting, booking, support, payment, or fallback.

IMPORTANT RULES:
- If the user asks about time, weather, or general knowledge (e.g. 'cat e ceasul', 'care este vremea', 'cine este presedintele'), always respond with 'fallback'.
- If the user asks about bus tickets, reservations, schedules, or travel (e.g. 'vreau să rezerv', 'vreau bilet', 'rezerv un bilet', 'vreau să merg', 'bilet la', 'rezervare'), respond with 'booking'.
- If the user asks about problems, complaints, or support, respond with 'support'.
- If the user asks about payment, respond with 'payment'.
- If the user greets (e.g. 'buna', 'salut', 'hello'), respond with 'greeting'.

BOOKING KEYWORDS: 'rezerv', 'bilet', 'vreau să rezerv', 'vreau bilet', 'rezerv un bilet', 'vreau să merg', 'bilet la', 'rezervare', 'cursa', 'plecare', 'destinație', 'vienna', 'bucharest', 'viena', 'bucuresti'

Examples:
- "Cât e ceasul?" → fallback
- "Care este vremea?" → fallback
- "Vreau să rezerv un bilet la Vienna" → booking
- "Vreau să rezerv un bilet la Vienna pe 2024-07-10 pentru 2 persoane" → booking
- "Am o problemă cu rezervarea" → support
- "Cum plătesc?" → payment
- "Bună!" → greeting`],
          ["human", "Message: {message}\nLanguage: {language}\nHistory: {history}\nPreferences: {preferences}\nBookingContext: {bookingContext}\nSupportContext: {supportContext}\nRăspunde DOAR în limba: {language}. Nu folosi altă limbă."]
        ]),
        
        greeting: ChatPromptTemplate.fromMessages([
          ["system", "You are a greeting agent. Respond with a friendly greeting and suggest the next step if possible."],
          ["human", "Message: {message}\nLanguage: {language}\nHistory: {history}\nPreferences: {preferences}\nBookingContext: {bookingContext}\nSupportContext: {supportContext}\nRăspunde DOAR în limba: {language}. Nu folosi altă limbă."]
        ]),
        
        booking: ChatPromptTemplate.fromMessages([
          ["system", `You are a booking agent for bus travel. Help users book bus tickets. Ask for missing details if needed. Be clear and polite.\n\nIf the user sends a message of thanks, goodbye, or ending the conversation (e.g. 'mulțumesc', 'o zi bună', 'la revedere', 'bye', 'thanks', 'goodbye'), respond with a short, warm closing message (e.g. 'Cu plăcere! O zi frumoasă!') and mark the conversation as closed.\nIf the conversation is closed, do not continue with booking or ask for more details.\nAfter a successful booking, confirm the reservation and offer a warm closing.\nAlways keep responses concise and human.`],
          ["human", "Message: {message}\nLanguage: {language}\nHistory: {history}\nPreferences: {preferences}\nBookingContext: {bookingContext}\nSupportContext: {supportContext}\nRăspunde DOAR în limba: {language}. Nu folosi altă limbă."]
        ]),
        
        support: ChatPromptTemplate.fromMessages([
          ["system", "You are a support agent. Help users with issues, complaints, or technical problems. Be empathetic and helpful."],
          ["human", "Message: {message}\nLanguage: {language}\nHistory: {history}\nPreferences: {preferences}\nBookingContext: {bookingContext}\nSupportContext: {supportContext}\nRăspunde DOAR în limba: {language}. Nu folosi altă limbă."]
        ]),
        
        payment: ChatPromptTemplate.fromMessages([
          ["system", "You are a payment agent. Help users with payment processing and payment questions. Never ask for full card numbers."],
          ["human", "Message: {message}\nLanguage: {language}\nHistory: {history}\nPreferences: {preferences}\nBookingContext: {bookingContext}\nSupportContext: {supportContext}\nRăspunde DOAR în limba: {language}. Nu folosi altă limbă."]
        ]),
        
        fallback: ChatPromptTemplate.fromMessages([
          ["system", `You are a fallback agent. If the user asks something unrelated to transport (like time, weather, general knowledge), politely say you can only help with transport, bookings, or support. If the question is about transport, try to help or escalate. Always explain why you can't answer if it's not about transport.`],
          ["human", "Message: {message}\nLanguage: {language}\nHistory: {history}\nPreferences: {preferences}\nBookingContext: {bookingContext}\nSupportContext: {supportContext}\nRăspunde DOAR în limba: {language}. Nu folosi altă limbă."]
        ])
      };
    } catch (error) {
      console.error('[AI] Error creating default prompts:', error);
      // Return simple fallback prompts
      return {
        router: ChatPromptTemplate.fromMessages([
          ["system", "You are a router agent. Respond with: greeting, booking, support, payment, or fallback."],
          ["human", "Message: {message}"]
        ]),
        
        greeting: ChatPromptTemplate.fromMessages([
          ["system", "You are a greeting agent. Respond with a friendly greeting."],
          ["human", "Message: {message}"]
        ]),
        
        booking: ChatPromptTemplate.fromMessages([
          ["system", "You are a booking agent. Help with bus bookings."],
          ["human", "Message: {message}"]
        ]),
        
        support: ChatPromptTemplate.fromMessages([
          ["system", "You are a support agent. Help with customer issues."],
          ["human", "Message: {message}"]
        ]),
        
        payment: ChatPromptTemplate.fromMessages([
          ["system", "You are a payment agent. Handle payments."],
          ["human", "Message: {message}"]
        ]),
        
        fallback: ChatPromptTemplate.fromMessages([
          ["system", "You are a fallback agent. Provide helpful responses."],
          ["human", "Message: {message}"]
        ])
      };
    }
  }

  getDefaultPrompt(agentName) {
    return this.getDefaultPrompts()[agentName];
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

      // Payment Agent
      this.paymentAgent = await this.createPaymentAgent();

      // Monitor Agent
      this.monitorAgent = await this.createMonitorAgent();

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
    if (!this.llm) return null;
    
    const prompt = this.prompts.router;
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    
    // Wrap to ensure proper routing response
    return {
      invoke: async (input) => {
        try {
          const result = await chain.invoke(input);
          // Clean and validate the routing decision
          const cleanResult = result.trim().toLowerCase();
          
          // Validate against allowed agents
          const allowedAgents = ['greeting', 'booking', 'support', 'payment', 'fallback'];
          if (allowedAgents.includes(cleanResult)) {
            return cleanResult;
          } else {
            console.warn(`[AI] Router returned invalid agent: ${cleanResult}, using fallback`);
            return 'fallback';
          }
        } catch (error) {
          console.error("[AI] Router agent error:", error);
          return 'fallback';
        }
      }
    };
  }

  // AGENT WRAPPERS (ensure output is always { message: ... })
  async createGreetingAgent() {
    if (!this.llm) return null;
    const prompt = this.prompts.greeting;
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    return {
      invoke: async (input) => {
        try {
          const result = await chain.invoke(input);
          let parsed = {};
          try {
            parsed = typeof result === 'string' ? JSON.parse(result) : result;
          } catch (e) {
            parsed = { message: String(result) };
          }
          if (!parsed.message) parsed.message = String(result);
          console.log('[AGENT][greeting] Output:', parsed);
          return parsed;
        } catch (err) {
          console.log('[AGENT][greeting] Error:', err);
          return { message: 'Eroare agent greeting.' };
        }
      }
    };
  }
  async createBookingAgent() {
    if (!this.llm) return null;
    const prompt = this.prompts.booking;
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    return {
      invoke: async (input) => {
        try {
          const result = await chain.invoke(input);
          let parsed = {};
          try {
            parsed = typeof result === 'string' ? JSON.parse(result) : result;
          } catch (e) {
            parsed = { message: String(result) };
          }
          if (!parsed.message) parsed.message = String(result);
          if (!parsed.status) parsed.status = 'suggest';
          console.log('[AGENT][booking] Output:', parsed);
          return parsed;
        } catch (err) {
          console.log('[AGENT][booking] Error:', err);
          return { message: 'Eroare agent booking.', status: 'suggest' };
        }
      }
    };
  }
  async createSupportAgent() {
    if (!this.llm) return null;
    const prompt = this.prompts.support;
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    return {
      invoke: async (input) => {
        try {
          const result = await chain.invoke(input);
          let parsed = {};
          try {
            parsed = typeof result === 'string' ? JSON.parse(result) : result;
          } catch (e) {
            parsed = { message: String(result) };
          }
          if (!parsed.message) parsed.message = String(result);
          if (typeof parsed.escalate !== 'boolean') parsed.escalate = false;
          if (!parsed.issueType) parsed.issueType = 'general';
          console.log('[AGENT][support] Output:', parsed);
          return parsed;
        } catch (err) {
          console.log('[AGENT][support] Error:', err);
          return { message: 'Eroare agent support.', escalate: false, issueType: 'general' };
        }
      }
    };
  }
  async createFallbackAgent() {
    if (!this.llm) return null;
    const prompt = this.prompts.fallback;
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    return {
      invoke: async (input) => {
        try {
          const result = await chain.invoke(input);
          let parsed = {};
          try {
            parsed = typeof result === 'string' ? JSON.parse(result) : result;
          } catch (e) {
            parsed = { message: String(result) };
          }
          if (!parsed.message) parsed.message = String(result);
          parsed.fallback = true;
          if (!parsed.reason) parsed.reason = 'Fallback triggered';
          console.log('[AGENT][fallback] Output:', parsed);
          return parsed;
        } catch (err) {
          console.log('[AGENT][fallback] Error:', err);
          return { message: 'Eroare agent fallback.', fallback: true, reason: 'Fallback triggered' };
        }
      }
    };
  }
  async createPaymentAgent() {
    if (!this.llm) return null;
    const prompt = this.prompts.payment;
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    return {
      invoke: async (input) => {
        try {
          const result = await chain.invoke(input);
          let parsed = {};
          try {
            parsed = typeof result === 'string' ? JSON.parse(result) : result;
          } catch (e) {
            parsed = { message: String(result) };
          }
          if (!parsed.message) parsed.message = String(result);
          if (!parsed.status) parsed.status = 'initiated';
          console.log('[AGENT][payment] Output:', parsed);
          return parsed;
        } catch (error) {
          console.log('[AGENT][payment] Error:', error);
          return { message: 'Eroare agent payment.', status: 'initiated' };
        }
      }
    };
  }

  /**
   * Create Monitor Agent using LangChain
   */
  async createMonitorAgent() {
    if (!this.llm) return null;
    
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a monitor agent. Log all interactions and provide analytics."],
      ["human", "Log this interaction: {message}"]
    ]);
    
    return prompt.pipe(this.llm).pipe(new StringOutputParser());
  }

  /**
   * Initialize LangGraph for routing
   */
  initializeGraph() {
    if (!this.llm) {
      console.warn("[AI] LLM not available, skipping LangGraph initialization");
      return;
    }

    try {
      // Enhanced state schema for production
      const stateSchema = z.object({
        message: z.string().optional(),
        language: z.string().optional(),
        history: z.array(z.object({
          timestamp: z.number().optional(),
          role: z.string(),
          message: z.string(),
          metadata: z.record(z.any()).optional()
        })).optional(),
        sessionId: z.string().optional(),
        agent: z.string().optional(),
        response: z.any().optional(),
        preferences: z.any().optional(),
        bookingContext: z.any().optional(),
        supportContext: z.any().optional(),
        conversationClosed: z.boolean().optional(),
        // New production features
        userIntent: z.string().optional(),
        confidence: z.number().optional(),
        processingTime: z.number().optional(),
        tokensUsed: z.number().optional(),
        cost: z.number().optional(),
        errorCount: z.number().optional(),
        retryCount: z.number().optional(),
        contextWindow: z.number().optional(),
        memoryUsage: z.number().optional()
      });

      this.graph = new StateGraph(stateSchema);

      // Add nodes with enhanced monitoring
      this.graph.addNode("router", this.routerNode);
      this.graph.addNode("greeting", this.greetingNode);
      this.graph.addNode("booking", this.bookingNode);
      this.graph.addNode("support", this.supportNode);
      this.graph.addNode("payment", this.paymentNode);
      this.graph.addNode("fallback", this.fallbackNode);
      this.graph.addNode("monitor", this.monitorNode);

      // Add conditional edges from router
      this.graph.addConditionalEdges(
        "router",
        this.routeToAgent,
        {
          "greeting": "greeting",
          "booking": "booking", 
          "support": "support",
          "payment": "payment",
          "fallback": "fallback"
        }
      );

      // Add edges to monitor
      this.graph.addEdge("greeting", "monitor");
      this.graph.addEdge("booking", "monitor");
      this.graph.addEdge("support", "monitor");
      this.graph.addEdge("payment", "monitor");
      this.graph.addEdge("fallback", "monitor");
      this.graph.addEdge("monitor", END);

      // Set entry point
      this.graph.setEntryPoint("router");

      // Compile the graph with advanced configuration
      this.app = this.graph.compile({
        checkpointer: new MemorySaver(),
        interruptBefore: ["monitor"], // Allow interruption before monitoring
        interruptAfter: ["router"], // Allow interruption after routing
        debug: process.env.NODE_ENV === 'development'
      });
      console.log("[AI] LangGraph initialized successfully with production features");
    } catch (error) {
      console.error("[AI] Failed to initialize LangGraph:", error);
      this.app = null;
    }
  }

  /**
   * Enhanced router node with AI-powered intent detection
   */
  async routerNode(state) {
    const startTime = Date.now();
    console.log('[ROUTER_DEBUG] Input:', JSON.stringify(state));
    console.log('[ROUTER_CHOICE] Processing message:', state.message);
    
    try {
      // Direct booking detection bypass (fast path)
      if (state.message && state.message.toLowerCase().includes('bilet') && state.message.toLowerCase().includes('email')) {
        console.log('[ROUTER_CHOICE] Direct booking detection - bypassing router');
        return { 
          ...state, 
          agent: 'booking',
          processingTime: Date.now() - startTime,
          userIntent: 'booking',
          confidence: 0.95
        };
      }
      
      if (!this.routerAgent) {
        console.log('[ROUTER_CHOICE] No router agent, using fallback');
        return { 
          ...state, 
          agent: 'fallback',
          processingTime: Date.now() - startTime,
          userIntent: 'fallback',
          confidence: 0.5
        };
      }

      // Enhanced input with context
      const input = {
        message: state.message || '',
        language: ensureLanguage(state.language || 'ro'),
        history: AgentOrchestrator.serializeHistory(state.history || []),
        preferences: JSON.stringify(state.preferences || {}),
        bookingContext: JSON.stringify(state.bookingContext || {}),
        supportContext: JSON.stringify(state.supportContext || {}),
        // Additional context for better routing
        timestamp: new Date().toISOString(),
        sessionDuration: state.history ? state.history.length : 0,
        previousAgent: state.agent || 'none'
      };

      console.log('[ROUTER_CHOICE] Router input:', input);
      
      // Use caching for router decisions
      const cacheKey = `router:${JSON.stringify(input)}`;
      let result;
      
      try {
        result = await this.routerAgent.invoke(input);
      } catch (error) {
        console.error('[ROUTER_CHOICE] Router error, using cached decision:', error);
        // Try to get cached decision
        const cached = await cacheSystem.lookup(cacheKey);
        if (cached) {
          result = cached;
        } else {
          throw error;
        }
      }
      
      console.log('[ROUTER_CHOICE] Router result:', result);
      
      const agentChoice = result.response || result.content || result.message || 'fallback';
      console.log('[ROUTER_CHOICE] Selected agent:', agentChoice);
      
      // Cache the decision
      await cacheSystem.update(cacheKey, result);
      
      // Calculate confidence based on response quality
      const confidence = this.calculateConfidence(result, agentChoice);
      
      return { 
        ...state, 
        agent: agentChoice,
        processingTime: Date.now() - startTime,
        userIntent: agentChoice,
        confidence: confidence,
        tokensUsed: result.usage?.total_tokens || 0
      };
    } catch (error) {
      console.error('[ROUTER_CHOICE] Router error:', error);
      return { 
        ...state, 
        agent: 'fallback',
        processingTime: Date.now() - startTime,
        userIntent: 'fallback',
        confidence: 0.3,
        errorCount: (state.errorCount || 0) + 1
      };
    }
  }

  /**
   * Calculate confidence score for routing decisions
   */
  calculateConfidence(result, agentChoice) {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence for clear, specific responses
    if (result.response && result.response.length < 20) {
      confidence += 0.2;
    }
    
    // Higher confidence for booking and support (specific intents)
    if (['booking', 'support'].includes(agentChoice)) {
      confidence += 0.1;
    }
    
    // Lower confidence for fallback
    if (agentChoice === 'fallback') {
      confidence -= 0.2;
    }
    
    return Math.min(Math.max(confidence, 0.1), 0.95);
  }

  /**
   * Route to appropriate agent
   */
  routeToAgent(state) {
    const { agent, message } = state;
    console.log('[ROUTE_TO_AGENT] Routing message:', message);
    console.log('[ROUTE_TO_AGENT] Current agent:', agent);
    
    // Direct booking detection if router didn't work
    if (message && message.toLowerCase().includes('bilet') && message.toLowerCase().includes('email')) {
      console.log('[ROUTE_TO_AGENT] Direct booking detection - routing to booking');
      return "booking";
    }
    
    switch (agent) {
      case "greeting":
        return "greeting";
      case "booking":
        return "booking";
      case "support":
        return "support";
      case "payment":
        return "payment";
      default:
        console.log('[ROUTE_TO_AGENT] Defaulting to fallback');
        return "fallback";
    }
  }

  // Helper for serializing history
  static serializeHistory(history) {
    if (!history || !Array.isArray(history)) return '';
    return history.map(msg => `[${msg.role}] ${msg.message}`).join('\n');
  }

  // AGENT NODES (always propagate { ...state, response, agent, history })
  async bookingNode(state) {
    console.log('[DEBUG][bookingNode][IN]', JSON.stringify(state));
    let { message, language, history, sessionId, preferences, bookingContext, supportContext, agent } = state;
    language = ensureLanguage(language);
    
    // Check if this is a complete booking request with all details
    const destination = this.extractDestination(message);
    const date = this.extractDate(message);
    const emailMatch = message.match(/email[:\s-]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i) || message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const email = emailMatch ? emailMatch[1] : null;
    const passengersMatch = message.match(/(\d+)\s*(persoane?|pasageri?|people)/i);
    const passengers = passengersMatch ? parseInt(passengersMatch[1]) : 1;

    // Log detalii extrase și în fișier (sincron, fără import dinamic)
    console.log('[BOOKING_DEBUG] Extracted details:', JSON.stringify({ destination, date, email, passengers, message, sessionId }));

    console.log('[BOOKING_DEBUG] Extracted details:', { destination, date, email, passengers });

    // If we have all required details, make the booking
    if (destination && date && email) {
      console.log('[BOOKING_DEBUG] All details present, proceeding with booking...');
      try {
        console.log(`[BOOKING] Making booking for ${destination} on ${date} for ${passengers} passengers, email: ${email}`);
        
        // Import booking functions
        console.log('[BOOKING_DEBUG] Importing modules...');
        const { checkAvailability, makeBooking } = await import('../utils/calendarSystem.js');
        const { createTicket } = await import('../utils/ticketSystem.js');
        const { getBookingConfirmationTemplate } = await import('../utils/emailTemplates.js');
        const { sendEmail } = await import('../utils/emailService.js');
        console.log('[BOOKING_DEBUG] Modules imported successfully');
        
        // Check availability
        console.log('[BOOKING_DEBUG] Checking availability...');
        const availability = await checkAvailability(destination, date, passengers);
        console.log('[BOOKING_DEBUG] Availability result:', availability);
        
        if (availability.available) {
          console.log('[BOOKING_DEBUG] Availability confirmed, making booking...');
          // Make real booking in calendar
          const bookingResult = await makeBooking({
            route: availability.trip.route,
            date: date,
            passengers: passengers,
            user: null,
            email: email,
            phone: null
          });
          console.log('[BOOKING_DEBUG] Booking created:', bookingResult);

          // Create ticket
          console.log('[BOOKING_DEBUG] Creating ticket...');
          const ticket = createTicket({
            user: null,
            email: email,
            phone: null,
            details: {
              route: availability.trip.route,
              date: date,
              passengers: passengers,
              bookingId: bookingResult.booking.id
            }
          });
          console.log('[BOOKING_DEBUG] Ticket created:', ticket);

          // Send confirmation email
          console.log('[BOOKING_DEBUG] Sending email...');
          const emailHtml = getBookingConfirmationTemplate(bookingResult.booking, ticket.id);
          await sendEmail(
            email,
            `Confirmare Rezervare - ${ticket.id}`,
            emailHtml
          );
          console.log('[BOOKING_DEBUG] Email sent successfully');

          console.log(`[BOOKING] Success! Ticket: ${ticket.id}, Booking: ${bookingResult.booking.id}`);
          
          const result = {
            message: `Rezervare confirmată! 🎫\n\nTicket ID: ${ticket.id}\nRută: ${availability.trip.route}\nData: ${date}\nPasageri: ${passengers}\nPreț: ${bookingResult.booking.price} RON\n\nVeți primi un email de confirmare la ${email}.`,
            status: 'booked'
          };
          
          history = [...(history || []), { timestamp: Date.now(), role: 'agent', message: result.message }];
          const out = { ...state, agent: 'booking', response: result, history };
          console.log('[DEBUG][bookingNode][OUT]', JSON.stringify(out));
          return out;
        } else {
          console.log('[BOOKING_DEBUG] Availability check failed:', availability.message);
          
          // Build response message with alternatives if available
          let responseMessage = `Ne pare rău, nu sunt disponibile locuri pentru ${destination} pe ${date}. ${availability.message}`;
          
          if (availability.alternatives && availability.alternatives.length > 0) {
            responseMessage += `\n\n${availability.suggestionsMessage}\n\nAlternative disponibile:\n`;
            
            availability.alternatives.forEach((alt, index) => {
              const dateStr = new Date(alt.departureDate).toLocaleDateString('ro-RO');
              const timeStr = new Date(alt.departure).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
              const daysText = alt.daysDiff === 0 ? 'aceeași zi' : 
                              alt.daysDiff === 1 ? 'cu o zi înainte' : 
                              alt.daysDiff === -1 ? 'cu o zi după' :
                              `${Math.abs(alt.daysDiff)} zile ${alt.daysDiff > 0 ? 'înainte' : 'după'}`;
              
              responseMessage += `${index + 1}. ${alt.route} - ${dateStr} la ${timeStr} (${daysText})\n`;
              responseMessage += `   Preț: ${alt.price} RON, Locuri disponibile: ${alt.availableSeats}\n`;
            });
            
            responseMessage += `\nDoriți să rezervați una dintre aceste alternative? Dacă da, vă rog să specificați numărul opțiunii dorite.`;
          }
          
          const result = {
            message: responseMessage,
            status: 'unavailable',
            alternatives: availability.alternatives || null
          };
          history = [...(history || []), { timestamp: Date.now(), role: 'agent', message: result.message }];
          const out = { ...state, agent: 'booking', response: result, history };
          console.log('[DEBUG][bookingNode][OUT]', JSON.stringify(out));
          return out;
        }
      } catch (error) {
        console.error('[BOOKING] Error:', error);
        const result = {
          message: 'A apărut o eroare la procesarea rezervării. Vă rugăm să încercați din nou.',
          status: 'error'
        };
        history = [...(history || []), { timestamp: Date.now(), role: 'agent', message: result.message }];
        const out = { ...state, agent: 'booking', response: result, history };
        console.log('[DEBUG][bookingNode][OUT]', JSON.stringify(out));
        return out;
      }
    } else {
      console.log('[BOOKING_DEBUG] Missing details, using fallback logic. Details:', { destination, date, email });
      // Use existing booking agent logic for incomplete requests
      const input = {
        message,
        language,
        history: AgentOrchestrator.serializeHistory(history),
        preferences: JSON.stringify(preferences || {}),
        bookingContext: JSON.stringify(bookingContext || {}),
        supportContext: JSON.stringify(supportContext || {})
      };
      console.log('[DEBUG][bookingNode][LLM_INPUT]', input);
      if (!this.bookingAgent) {
        const response = this.getFallbackResponse(message, language);
        const out = { ...state, agent: 'fallback', response: { message: response, status: 'suggest' }, history };
        console.log('[DEBUG][bookingNode][OUT]', JSON.stringify(out));
        return out;
      }
      if (state.conversationClosed || isSessionTimedOut(state) || detectEndConversationIntent(message, history)) {
        state.conversationClosed = true;
        return {
          reply: 'Conversația a fost încheiată. Dacă ai nevoie de altceva, reîncepe o sesiune nouă.',
          agent: state.agent || 'booking',
          language: getLanguage(state),
          sessionId: state.sessionId,
          error: false
        };
      }
      try {
        let result = await this.bookingAgent.invoke(input);
        if (!result.status) result.status = 'suggest';
        if (!result.message) result.message = this.getFallbackResponse(message, language);
        history = [...(history || []), { timestamp: Date.now(), role: 'agent', message: result.message }];
        const out = { ...state, agent: 'booking', response: result, history };
        console.log('[DEBUG][bookingNode][OUT]', JSON.stringify(out));
        return out;
      } catch (e) {
        const response = this.getFallbackResponse(message, language);
        const out = { ...state, agent: 'fallback', response: { message: response, status: 'suggest' }, history };
        console.log('[DEBUG][bookingNode][OUT]', JSON.stringify(out));
        return out;
      }
    }
  }
  async supportNode(state) {
    console.log('[DEBUG][supportNode][IN]', JSON.stringify(state));
    let { message, language, history, sessionId, preferences, bookingContext, supportContext, agent } = state;
    language = ensureLanguage(language);
    const input = {
      message,
      language,
      history: AgentOrchestrator.serializeHistory(history),
      preferences: JSON.stringify(preferences || {}),
      bookingContext: JSON.stringify(bookingContext || {}),
      supportContext: JSON.stringify(supportContext || {})
    };
    console.log('[DEBUG][supportNode][LLM_INPUT]', input);
    if (!this.supportAgent) {
      const response = this.getFallbackResponse(message, language);
      const out = { ...state, agent: 'fallback', response: { message: response, escalate: false, issueType: 'general' }, history };
      console.log('[DEBUG][supportNode][OUT]', JSON.stringify(out));
      return out;
    }
    if (state.conversationClosed || isSessionTimedOut(state) || detectEndConversationIntent(message, history)) {
      state.conversationClosed = true;
      return {
        reply: 'Conversația a fost încheiată. Dacă ai nevoie de altceva, reîncepe o sesiune nouă.',
        agent: state.agent || 'support',
        language: getLanguage(state),
        sessionId: state.sessionId,
        error: false
      };
    }
    try {
      let result = await this.supportAgent.invoke(input);
      if (typeof result.escalate !== 'boolean') result.escalate = false;
      if (!result.issueType) result.issueType = 'general';
      if (!result.message) result.message = this.getFallbackResponse(message, language);
      history = [...(history || []), { timestamp: Date.now(), role: 'agent', message: result.message }];
      const out = { ...state, agent: 'support', response: result, history };
      console.log('[DEBUG][supportNode][OUT]', JSON.stringify(out));
      return out;
    } catch (e) {
      const response = this.getFallbackResponse(message, language);
      const out = { ...state, agent: 'fallback', response: { message: response, escalate: false, issueType: 'general' }, history };
      console.log('[DEBUG][supportNode][OUT]', JSON.stringify(out));
      return out;
    }
  }
  async greetingNode(state) {
    console.log('[DEBUG][greetingNode][IN]', JSON.stringify(state));
    let { message, language, history, sessionId, preferences, bookingContext, supportContext, agent } = state;
    language = ensureLanguage(language);
    const input = {
      message,
      language,
      history: AgentOrchestrator.serializeHistory(history),
      preferences: JSON.stringify(preferences || {}),
      bookingContext: JSON.stringify(bookingContext || {}),
      supportContext: JSON.stringify(supportContext || {})
    };
    console.log('[DEBUG][greetingNode][LLM_INPUT]', input);
    if (!this.greetingAgent) {
      const response = this.getFallbackResponse(message, language);
      const out = { ...state, agent: 'fallback', response: { message: response }, history };
      console.log('[DEBUG][greetingNode][OUT]', JSON.stringify(out));
      return out;
    }
    if (state.conversationClosed || isSessionTimedOut(state) || detectEndConversationIntent(message, history)) {
      state.conversationClosed = true;
      return {
        reply: 'Conversația a fost încheiată. Dacă ai nevoie de altceva, reîncepe o sesiune nouă.',
        agent: state.agent || 'greeting',
        language: getLanguage(state),
        sessionId: state.sessionId,
        error: false
      };
    }
    try {
      let result = await this.greetingAgent.invoke(input);
      if (!result.message) result.message = this.getFallbackResponse(message, language);
      history = [...(history || []), { timestamp: Date.now(), role: 'agent', message: result.message }];
      const out = { ...state, agent: 'greeting', response: result, history };
      console.log('[DEBUG][greetingNode][OUT]', JSON.stringify(out));
      return out;
    } catch (e) {
      const response = this.getFallbackResponse(message, language);
      const out = { ...state, agent: 'fallback', response: { message: response }, history };
      console.log('[DEBUG][greetingNode][OUT]', JSON.stringify(out));
      return out;
    }
  }
  async fallbackNode(state) {
    console.log('[DEBUG][fallbackNode][IN]', JSON.stringify(state));
    let { message, language, history, sessionId, preferences, bookingContext, supportContext, agent } = state;
    language = ensureLanguage(language || 'ro');
    
    try {
      if (!this.fallbackAgent) {
        console.log('[FALLBACK] No fallback agent available, using default response');
        return {
          ...state,
          response: {
            message: this.getFallbackResponse(message, language),
            agent: 'fallback',
            language: language
          },
          agent: 'fallback'
        };
      }

      const input = {
        message: message || '',
        language: language,
        history: AgentOrchestrator.serializeHistory(history || []),
        preferences: JSON.stringify(preferences || {}),
        bookingContext: JSON.stringify(bookingContext || {}),
        supportContext: JSON.stringify(supportContext || {})
      };

      console.log('[FALLBACK] Fallback input:', input);
      const result = await this.fallbackAgent.invoke(input);
      console.log('[FALLBACK] Fallback result:', result);

      return {
        ...state,
        response: {
          message: result.message || result.response || this.getFallbackResponse(message, language),
          agent: 'fallback',
          language: language
        },
        agent: 'fallback'
      };
    } catch (error) {
      console.error('[AGENT][fallback] Error:', error);
      return {
        ...state,
        response: {
          message: this.getFallbackResponse(message, language),
          agent: 'fallback',
          language: language
        },
        agent: 'fallback'
      };
    }
  }
  async paymentNode(state) {
    console.log('[DEBUG][paymentNode][IN]', JSON.stringify(state));
    let { message, language, history, sessionId, preferences, bookingContext, supportContext, agent } = state;
    language = ensureLanguage(language);
    const input = {
      message,
      language,
      history: AgentOrchestrator.serializeHistory(history),
      preferences: JSON.stringify(preferences || {}),
      bookingContext: JSON.stringify(bookingContext || {}),
      supportContext: JSON.stringify(supportContext || {})
    };
    console.log('[DEBUG][paymentNode][LLM_INPUT]', input);
    if (!this.paymentAgent) {
      const response = this.getFallbackResponse(message, language);
      const out = { ...state, agent: 'fallback', response: { message: response, status: 'initiated' }, history };
      console.log('[DEBUG][paymentNode][OUT]', JSON.stringify(out));
      return out;
    }
    if (state.conversationClosed || isSessionTimedOut(state) || detectEndConversationIntent(message, history)) {
      state.conversationClosed = true;
      return {
        reply: 'Conversația a fost încheiată. Dacă ai nevoie de altceva, reîncepe o sesiune nouă.',
        agent: state.agent || 'payment',
        language: getLanguage(state),
        sessionId: state.sessionId,
        error: false
      };
    }
    try {
      let result = await this.paymentAgent.invoke(input);
      if (!result.status) result.status = 'initiated';
      if (!result.message) result.message = this.getFallbackResponse(message, language);
      history = [...(history || []), { timestamp: Date.now(), role: 'agent', message: result.message }];
      const out = { ...state, agent: 'payment', response: result, history };
      console.log('[DEBUG][paymentNode][OUT]', JSON.stringify(out));
      return out;
    } catch (e) {
      const response = this.getFallbackResponse(message, language);
      const out = { ...state, agent: 'fallback', response: { message: response, status: 'initiated' }, history };
      console.log('[DEBUG][paymentNode][OUT]', JSON.stringify(out));
      return out;
    }
  }
  async monitorNode(state) {
    console.log('[DEBUG][monitorNode][IN]', JSON.stringify(state));
    const { message, language, history, sessionId, agent, response, processingTime, confidence, tokensUsed } = state;
    
    // Calculate memory usage
    const memoryUsage = process.memoryUsage();
    
    // Enhanced monitoring data
    const monitoringData = {
      timestamp: new Date().toISOString(),
      sessionId,
      agent,
      processingTime: processingTime || 0,
      confidence: confidence || 0.5,
      tokensUsed: tokensUsed || 0,
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
      contextWindow: history ? history.length : 0,
      userIntent: state.userIntent || 'unknown',
      errorCount: state.errorCount || 0,
      retryCount: state.retryCount || 0,
      // Calculate cost (approximate)
      cost: this.calculateCost(tokensUsed || 0, agent),
      // Performance metrics
      responseQuality: this.assessResponseQuality(response),
      sessionHealth: this.assessSessionHealth(state)
    };
    
    // Log to LangSmith for observability
    try {
      await langSmithClient.createRun({
        name: `agent-${agent}`,
        run_type: "chain",
        inputs: { message, language, sessionId },
        outputs: { response: response?.message || '', agent, confidence },
        extra: monitoringData
      });
    } catch (error) {
      console.warn('[MONITOR] LangSmith logging failed:', error.message);
    }
    
    // Store analytics in memory for dashboard
    this.storeAnalytics(sessionId, monitoringData);
    
    // Always propagate language and enhanced state
    return { 
      ...state, 
      response, 
      agent, 
      history, 
      language: ensureLanguage(language),
      // Add monitoring data to state
      monitoringData,
      memoryUsage: monitoringData.memoryUsage,
      cost: monitoringData.cost
    };
  }

  /**
   * Calculate approximate cost based on tokens and model
   */
  calculateCost(tokens, agent) {
    // Approximate costs per 1K tokens (varies by model)
    const costs = {
      'groq': 0.0001, // Very cheap
      'ollama': 0, // Free
      'huggingface': 0.00005 // Very cheap
    };
    
    const modelType = this.getModelType();
    const costPerToken = costs[modelType] || 0.0001;
    
    return (tokens / 1000) * costPerToken;
  }

  /**
   * Get current model type
   */
  getModelType() {
    if (this.llm?.constructor.name.includes('ChatGroq')) return 'groq';
    if (this.llm?.constructor.name.includes('ChatOllama')) return 'ollama';
    if (this.llm?.constructor.name.includes('ChatHuggingFace')) return 'huggingface';
    return 'unknown';
  }

  /**
   * Assess response quality
   */
  assessResponseQuality(response) {
    if (!response?.message) return 0;
    
    let quality = 0.5; // Base quality
    
    // Higher quality for longer, more detailed responses
    if (response.message.length > 50) quality += 0.2;
    if (response.message.length > 100) quality += 0.1;
    
    // Higher quality for structured responses
    if (response.status) quality += 0.1;
    if (response.alternatives) quality += 0.1;
    
    // Lower quality for error messages
    if (response.message.includes('error') || response.message.includes('eroare')) {
      quality -= 0.2;
    }
    
    return Math.min(Math.max(quality, 0), 1);
  }

  /**
   * Assess session health
   */
  assessSessionHealth(state) {
    let health = 1.0; // Perfect health
    
    // Reduce health for errors
    if (state.errorCount > 0) health -= 0.2 * state.errorCount;
    
    // Reduce health for long sessions (potential memory issues)
    if (state.history && state.history.length > 20) health -= 0.1;
    
    // Reduce health for low confidence
    if (state.confidence < 0.5) health -= 0.2;
    
    return Math.max(health, 0);
  }

  /**
   * Store analytics for dashboard
   */
  storeAnalytics(sessionId, data) {
    if (!this.analytics) this.analytics = new Map();
    
    if (!this.analytics.has(sessionId)) {
      this.analytics.set(sessionId, []);
    }
    
    this.analytics.get(sessionId).push(data);
    
    // Keep only last 100 entries per session
    if (this.analytics.get(sessionId).length > 100) {
      this.analytics.set(sessionId, this.analytics.get(sessionId).slice(-100));
    }
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
      console.log(`[DEBUG][PROCESS] START for session ${sessionId}`);
      console.log(`[DEBUG][PROCESS] LangGraph available: ${!!this.app}, LLM available: ${!!this.llm}`);
      console.log(`[DEBUG][PROCESS] Message: ${message}`);
      let context = await getUserContext(sessionId);
      console.log(`[DEBUG][PROCESS] Context after getUserContext:`, context);
      if (!context.history) context.history = [];
      language = ensureLanguage(language || context.language);

      // Use LangGraph if available
      if (this.app && this.llm) {
        console.log('[DEBUG][PROCESS] Using LangGraph for processing');
        try {
          const result = await this.app.invoke({
            message,
            language,
            history: context.history,
            sessionId
          });
          console.log('[DEBUG][LangGraph result]', JSON.stringify(result));
          // Extrage reply și agent din result.response și result.agent
          let agentReply = result.response?.message || result.response || result.message || '';
          const agentName = result.agent || context.lastAgent || 'fallback';

          // Validare output conform schema
          const validation = validateAgentResponse(`${agentName}Agent`, result.response || {});
          if (!validation.valid) {
            console.error(`[AI] ${agentName} agent response invalid:`, validation.errors);
            agentReply = this.getFallbackResponse(message, language);
          }

          // Update context
          context.history.push({ timestamp: Date.now(), role: 'user', message });
          context.history.push({ timestamp: Date.now(), role: 'agent', message: agentReply });
          context.lastAgent = agentName;
          await setUserContext(sessionId, context);

          // În funcția processMessage, după ce se actualizează context.history:
          if (context.history && context.history.length > 30) {
            context.history = context.history.slice(-30);
          }

          return {
            reply: agentReply,
            agent: agentName,
            language: ensureLanguage(language),
            sessionId,
            error: !validation.valid,
            response: result.response || null
          };
        } catch (graphError) {
          console.error("[AI] LangGraph error, falling back to direct routing:", graphError);
        }
      } else {
        console.log('[DEBUG][PROCESS] LangGraph not available, using direct routing');
      }

      // Fallback to direct routing if LangGraph fails
      if (!this.llm) {
        console.log("[AI] LLM not available, using fallback response");
        context.history.push({ timestamp: Date.now(), role: 'user', message });
        context.history.push({ timestamp: Date.now(), role: 'agent', message: this.getFallbackResponse(message, language) });
        context.lastAgent = "fallback";
        await setUserContext(sessionId, context);
        return {
          reply: this.getFallbackResponse(message, language),
          agent: "fallback",
          language: ensureLanguage(language),
          sessionId,
          error: false,
        };
      }

      // Direct routing with validation
      const routerResult = await this.routerAgent.invoke({
        message
      });
      const agent = routerResult.trim().toLowerCase();
      let agentReply = '';
      let agentName = agent;

      // Route to appropriate agent with validation
      let result = {};
      try {
        if (agent === 'booking' && this.bookingAgent) {
          result = await this.bookingAgent.invoke({ message });
        } else if (agent === 'support' && this.supportAgent) {
          result = await this.supportAgent.invoke({ message });
        } else if (agent === 'greeting' && this.greetingAgent) {
          result = await this.greetingAgent.invoke({ message });
        } else {
          result = await this.fallbackAgent.invoke({ message });
          agentName = 'fallback';
        }
        const validation = validateAgentResponse(`${agentName}Agent`, result);
        if (validation.valid) {
          agentReply = result.message || JSON.stringify(result);
        } else {
          console.error(`[AI] Agent ${agentName} response invalid:`, validation.errors);
          agentReply = this.getFallbackResponse(message, language);
          agentName = 'fallback';
        }
      } catch (agentError) {
        console.error(`[AI] Agent ${agent} error:`, agentError);
        agentReply = this.getFallbackResponse(message, language);
        agentName = 'fallback';
      }

      // Ensure we have a response
      if (!agentReply || (typeof agentReply === 'string' && agentReply.trim() === '')) {
        agentReply = this.getFallbackResponse(message, language);
        agentName = 'fallback';
      }

      // Update persistent memory
      context.history.push({ timestamp: Date.now(), role: 'user', message });
      context.history.push({ timestamp: Date.now(), role: 'agent', message: agentReply });
      context.lastAgent = agentName;
      await setUserContext(sessionId, context);

      // În funcția processMessage, după ce se actualizează context.history:
      if (context.history && context.history.length > 30) {
        context.history = context.history.slice(-30);
      }

      console.log(`[AI] Response from ${agentName} agent:`, agentReply);

      return {
        reply: agentReply,
        agent: agentName,
        language: ensureLanguage(language),
        sessionId,
        error: false,
      };

    } catch (error) {
      console.error("[AI] Error processing message:", error);
      let context = await getUserContext(sessionId);
      if (!context.history) context.history = [];
      context.history.push({ timestamp: Date.now(), role: 'user', message });
      context.history.push({ timestamp: Date.now(), role: 'agent', message: this.getFallbackResponse(message, language) });
      context.lastAgent = "fallback";
      await setUserContext(sessionId, context);
      return {
        reply: this.getFallbackResponse(message, language),
        agent: "fallback",
        language: ensureLanguage(language),
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
   * Get comprehensive agent statistics and analytics
   */
  getStats() {
    const baseStats = {
      totalSessions: this.memoryStore.size,
      llmModel: this.getModelType(),
      provider: this.getModelType(),
      tools: Object.keys(this.tools),
      agents: ["router", "booking", "support", "greeting", "fallback", "payment", "monitor"],
      graphActive: this.app !== null,
      promptsLoaded: Object.keys(this.prompts).length
    };

    // Enhanced analytics
    const analytics = this.getAnalyticsSummary();
    
    // Performance metrics
    const performance = {
      averageProcessingTime: analytics.avgProcessingTime,
      averageConfidence: analytics.avgConfidence,
      averageTokensUsed: analytics.avgTokensUsed,
      averageCost: analytics.avgCost,
      totalCost: analytics.totalCost,
      errorRate: analytics.errorRate,
      successRate: analytics.successRate
    };

    // System health
    const systemHealth = {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      cpuUsage: process.cpuUsage(),
      activeConnections: this.memoryStore.size
    };

    // Agent performance breakdown
    const agentPerformance = this.getAgentPerformance();

    return {
      ...baseStats,
      analytics,
      performance,
      systemHealth,
      agentPerformance,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary() {
    if (!this.analytics || this.analytics.size === 0) {
      return {
        totalRequests: 0,
        avgProcessingTime: 0,
        avgConfidence: 0,
        avgTokensUsed: 0,
        avgCost: 0,
        totalCost: 0,
        errorRate: 0,
        successRate: 0
      };
    }

    let totalRequests = 0;
    let totalProcessingTime = 0;
    let totalConfidence = 0;
    let totalTokensUsed = 0;
    let totalCost = 0;
    let totalErrors = 0;

    for (const [sessionId, data] of this.analytics) {
      for (const entry of data) {
        totalRequests++;
        totalProcessingTime += entry.processingTime || 0;
        totalConfidence += entry.confidence || 0;
        totalTokensUsed += entry.tokensUsed || 0;
        totalCost += entry.cost || 0;
        if (entry.errorCount > 0) totalErrors++;
      }
    }

    return {
      totalRequests,
      avgProcessingTime: totalRequests > 0 ? totalProcessingTime / totalRequests : 0,
      avgConfidence: totalRequests > 0 ? totalConfidence / totalRequests : 0,
      avgTokensUsed: totalRequests > 0 ? totalTokensUsed / totalRequests : 0,
      avgCost: totalRequests > 0 ? totalCost / totalRequests : 0,
      totalCost,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      successRate: totalRequests > 0 ? (totalRequests - totalErrors) / totalRequests : 0
    };
  }

  /**
   * Get agent performance breakdown
   */
  getAgentPerformance() {
    if (!this.analytics) return {};

    const agentStats = {};
    
    for (const [sessionId, data] of this.analytics) {
      for (const entry of data) {
        const agent = entry.agent || 'unknown';
        
        if (!agentStats[agent]) {
          agentStats[agent] = {
            count: 0,
            totalProcessingTime: 0,
            totalConfidence: 0,
            totalTokensUsed: 0,
            totalCost: 0,
            errors: 0
          };
        }
        
        agentStats[agent].count++;
        agentStats[agent].totalProcessingTime += entry.processingTime || 0;
        agentStats[agent].totalConfidence += entry.confidence || 0;
        agentStats[agent].totalTokensUsed += entry.tokensUsed || 0;
        agentStats[agent].totalCost += entry.cost || 0;
        if (entry.errorCount > 0) agentStats[agent].errors++;
      }
    }

    // Calculate averages
    for (const agent in agentStats) {
      const stats = agentStats[agent];
      stats.avgProcessingTime = stats.count > 0 ? stats.totalProcessingTime / stats.count : 0;
      stats.avgConfidence = stats.count > 0 ? stats.totalConfidence / stats.count : 0;
      stats.avgTokensUsed = stats.count > 0 ? stats.totalTokensUsed / stats.count : 0;
      stats.avgCost = stats.count > 0 ? stats.totalCost / stats.count : 0;
      stats.errorRate = stats.count > 0 ? stats.errors / stats.count : 0;
      stats.successRate = stats.count > 0 ? (stats.count - stats.errors) / stats.count : 0;
    }

    return agentStats;
  }

  /**
   * Clear session memory
   */
  clearSessionMemory(sessionId) {
    this.memoryStore.delete(sessionId);
    console.log(`[AI] Cleared memory for session ${sessionId}`);
  }

  // Helper functions for booking
  extractDestination(message) {
    const msg = message.toLowerCase();
    
    // Check if the message is a route name (e.g., "bucharest-vienna")
    if (msg.includes('-') && !msg.includes(' ')) {
      const routeParts = msg.split('-');
      if (routeParts.length === 2) {
        // Find the original route format in the message
        const routeMatch = message.match(/([A-Za-z]+)-([A-Za-z]+)/i);
        if (routeMatch) {
          return routeMatch[0];
        }
      }
    }
    
    // Fix regex by properly escaping Unicode characters
    const destinationRegex = /(?:la|spre|c[âă]tre|to)\s+([A-Za-z\s\-]+?)(?=\s+(?:pe|la|pentru|cu|și|,|\.|$))/i;
    const match = message.match(destinationRegex);
    
    if (match && match[1]) {
      return this.capitalize(match[1].trim());
    }
    
    // Fallback patterns
    const patterns = [
      /(?:bilet|rezervare)\s+(?:la|spre|c[âă]tre)\s+([A-Za-z\s\-]+)/i,
      /(?:vreau|doresc)\s+(?:să\s+)?(?:merg|călătoresc)\s+(?:la|spre|c[âă]tre)\s+([A-Za-z\s\-]+)/i,
      /(?:destinație|destinatie)\s*[:\-]?\s*([A-Za-z\s\-]+)/i
    ];
    
    for (const pattern of patterns) {
      const patternMatch = message.match(pattern);
      if (patternMatch && patternMatch[1]) {
        return this.capitalize(patternMatch[1].trim());
      }
    }
    
    return null;
  }

  extractDate(message) {
    const msg = message.toLowerCase();
    
    // Regex pentru diverse formate de dată
    const datePatterns = [
      /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, // DD/MM/YYYY, DD-MM-YYYY
      /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/, // YYYY/MM/DD, YYYY-MM-DD
      /(\d{1,2})\s+(?:ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\s+(\d{4})/i, // DD luna YYYY
      /(?:pe|la)\s+(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, // pe DD/MM/YYYY
      /(?:pe|la)\s+(\d{1,2})\s+(?:ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\s+(\d{4})/i // pe DD luna YYYY
    ];

    for (const pattern of datePatterns) {
      const match = msg.match(pattern);
      if (match) {
        // Converteste la format YYYY-MM-DD
        if (match.length === 4) {
          if (match[1].length === 4) {
            // Format YYYY-MM-DD
            return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
          } else {
            // Format DD-MM-YYYY
            return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
          }
        }
      }
    }

    // Cuvinte cheie pentru zile
    const dayKeywords = {
      'azi': new Date(),
      'mâine': new Date(Date.now() + 24 * 60 * 60 * 1000),
      'poimâine': new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      'săptămâna viitoare': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };

    for (const [keyword, date] of Object.entries(dayKeywords)) {
      if (msg.includes(keyword)) {
        return date.toISOString().split('T')[0];
      }
    }

    return null;
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}

// Utility to ensure language is always set
function ensureLanguage(lang) {
  return (lang && typeof lang === 'string' && lang.length === 2) ? lang : 'ro';
}

// Utility to normalize language
function getLanguage(state) {
  return state.language || state.lang || (state.preferences && state.preferences.language) || 'ro';
}

// Intent recognizer pentru închidere conversație
function detectEndConversationIntent(message, history) {
  const politeEndings = [
    /multumesc.*(zi buna|la revedere|drum bun|gata|terminat|pa|bye|goodbye|o zi frumoasa)/i,
    /(la revedere|pa|bye|goodbye|gata|terminat|o zi frumoasa|nu mai am nevoie|asta a fost tot)/i,
    /thanks.*(bye|goodbye|see you|done)/i
  ];
  if (typeof message !== 'string') return false;
  for (const pattern of politeEndings) {
    if (pattern.test(message)) return true;
  }
  // Dacă e doar "mulțumesc" după o acțiune finală
  if (/multumesc|thanks/i.test(message)) {
    const lastAgentMsg = history && history.length ? history[history.length-1].message : '';
    if (/rezervare|booking|confirmat|bilet|finalizat|done|completed|confirmed/i.test(lastAgentMsg)) {
      return true;
    }
  }
  return false;
}

// Timeout de sesiune (X minute)
const SESSION_TIMEOUT_MINUTES = 15;
function isSessionTimedOut(context) {
  if (!context.history || !context.history.length) return false;
  const lastMsg = context.history[context.history.length-1];
  if (!lastMsg.timestamp) return false;
  const now = Date.now();
  return (now - lastMsg.timestamp) > SESSION_TIMEOUT_MINUTES * 60 * 1000;
}

// TODO: Pentru butonul "Închide conversația" în UI, frontendul trebuie să trimită un mesaj special sau să seteze explicit conversationClosed în request.

// Export singleton instance
export const agentOrchestrator = new AgentOrchestrator(); 