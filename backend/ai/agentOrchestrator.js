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
import fs from 'fs';
import path from 'path';
import Redis from 'redis';
import { getUserContext, setUserContext } from './userMemory.js';
import { validateAgentResponse, generateErrorResponse } from './jsonSchemas/agentSchemas.js';
import { z } from 'zod';

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
    this.initializeLLM();
    await this.loadPrompts();
    await this.initializeAgents(); // Ensure agents are always re-initialized
    this.initializeGraph();
    console.log("[AI] Orchestrator initialized successfully");
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
   * Load prompts from YAML/JSON files
   */
  async loadPrompts() {
    try {
      const promptsDir = path.join(process.cwd(), 'backend', 'ai', 'prompts');
      
      // Load prompts for each agent
      const agentNames = ['greeting', 'booking', 'support', 'payment', 'fallback', 'router'];
      
      for (const agentName of agentNames) {
        const promptPath = path.join(promptsDir, `${agentName}Agent.yaml`);
        if (fs.existsSync(promptPath)) {
          const promptContent = fs.readFileSync(promptPath, 'utf8');
          this.prompts[agentName] = this.parsePrompt(promptContent);
        } else {
          // Use default prompts if files don't exist
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
          ["system", `You are a router agent. Analyze the user message and respond with exactly one word: greeting, booking, support, payment, or fallback.\n\nIf the user asks about time, weather, or general knowledge (e.g. 'cat e ceasul', 'care este vremea', 'cine este presedintele'), always respond with 'fallback'.\nIf the user asks about bus tickets, reservations, or schedules, respond with 'booking'.\nIf the user asks about problems, complaints, or support, respond with 'support'.\nIf the user asks about payment, respond with 'payment'.\nIf the user greets (e.g. 'buna', 'salut', 'hello'), respond with 'greeting'.\n\nExamples:\n- "Cât e ceasul?" → fallback\n- "Care este vremea?" → fallback\n- "Vreau să rezerv un bilet" → booking\n- "Am o problemă cu rezervarea" → support\n- "Cum plătesc?" → payment\n- "Bună!" → greeting`],
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
      // Definește contractul de state pentru LangGraph
      const stateSchema = z.object({
        message: z.string().optional(),
        language: z.string().optional(),
        history: z.array(z.object({
          timestamp: z.number().optional(),
          role: z.string(),
          message: z.string()
        })).optional(),
        sessionId: z.string().optional(),
        agent: z.string().optional(),
        response: z.any().optional(),
        preferences: z.any().optional(),
        bookingContext: z.any().optional(),
        supportContext: z.any().optional(),
        conversationClosed: z.boolean().optional()
      });

      this.graph = new StateGraph(stateSchema);

      // Add nodes
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

      // Compile the graph
      this.app = this.graph.compile();
      console.log("[AI] LangGraph initialized successfully");
    } catch (error) {
      console.error("[AI] Failed to initialize LangGraph:", error);
      this.app = null;
    }
  }

  /**
   * Router node - decides which agent to use
   */
  async routerNode(state) {
    console.log('[DEBUG][routerNode][IN]', JSON.stringify(state));
    try {
      let { message, language, history, sessionId } = state;
      if (!history) history = [];
      language = ensureLanguage(language);
      // Adaugă mesajul userului în history dacă nu există deja ca ultim mesaj
      if (!history.length || history[history.length - 1].role !== 'user' || history[history.length - 1].message !== message) {
        history = [...history, { timestamp: Date.now(), role: 'user', message }];
      }
      const inputVars = {
        message,
        history,
        sessionId,
        preferences: state.preferences || {},
        bookingContext: state.bookingContext || {},
        supportContext: state.supportContext || {},
        language: getLanguage(state)
      };
      console.log('[DEBUG][ROUTER][INPUT]', inputVars);
      const result = await this.routerAgent.invoke(inputVars);
      const agent = result.trim().toLowerCase();
      const out = { ...state, agent, message, language, history, sessionId };
      console.log('[DEBUG][routerNode][OUT]', JSON.stringify(out));
      return out;
    } catch (error) {
      console.error("[AI] Router error:", error);
      const out = { ...state, agent: "fallback", message: state.message, language: ensureLanguage(state.language), history: state.history, sessionId: state.sessionId };
      console.log('[DEBUG][routerNode][OUT]', JSON.stringify(out));
      return out;
    }
  }

  /**
   * Route to appropriate agent
   */
  routeToAgent(state) {
    const { agent } = state;
    
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
    language = ensureLanguage(language);
    const inputVars = {
      message,
      history,
      sessionId,
      preferences,
      bookingContext,
      supportContext,
      language: language || getLanguage(state)
    };
    console.log('[DEBUG][FALLBACK][INPUT]', inputVars);
    if (!this.fallbackAgent) {
      const response = this.getFallbackResponse(message, language);
      const out = { ...state, agent: 'fallback', response: { message: response, fallback: true, reason: 'Fallback triggered' }, history };
      console.log('[DEBUG][fallbackNode][OUT]', JSON.stringify(out));
      return out;
    }
    if (state.conversationClosed || isSessionTimedOut(state) || detectEndConversationIntent(message, history)) {
      state.conversationClosed = true;
      return {
        reply: 'Conversația a fost încheiată. Dacă ai nevoie de altceva, reîncepe o sesiune nouă.',
        agent: state.agent || 'fallback',
        language: getLanguage(state),
        sessionId: state.sessionId,
        error: false
      };
    }
    try {
      let result = await this.fallbackAgent.invoke(inputVars);
      result.fallback = true;
      if (!result.reason) result.reason = 'Fallback triggered';
      if (!result.message) result.message = this.getFallbackResponse(message, language);
      history = [...(history || []), { timestamp: Date.now(), role: 'agent', message: result.message }];
      const out = { ...state, agent: 'fallback', response: result, history };
      console.log('[DEBUG][fallbackNode][OUT]', JSON.stringify(out));
      return out;
    } catch (e) {
      const response = this.getFallbackResponse(message, language);
      const out = { ...state, agent: 'fallback', response: { message: response, fallback: true, reason: 'Fallback triggered' }, history };
      console.log('[DEBUG][fallbackNode][OUT]', JSON.stringify(out));
      return out;
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
    const { message, language, history, sessionId, agent, response } = state;
    // Always propagate language
    return { ...state, response, agent, history, language: ensureLanguage(language) };
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
      let context = await getUserContext(sessionId);
      console.log(`[DEBUG][PROCESS] Context after getUserContext:`, context);
      if (!context.history) context.history = [];
      language = ensureLanguage(language || context.language);

      // Use LangGraph if available
      if (this.app && this.llm) {
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
   * Get agent statistics
   */
  getStats() {
    return {
      totalSessions: this.memoryStore.size,
      llmModel: "llama3-8b-8192",
      provider: "Groq",
      tools: Object.keys(this.tools),
      agents: ["router", "booking", "support", "greeting", "fallback", "payment", "monitor"],
      graphActive: this.app !== null,
      promptsLoaded: Object.keys(this.prompts).length
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