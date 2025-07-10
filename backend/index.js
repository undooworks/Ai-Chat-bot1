import 'dotenv/config';
console.log('=== SERVER STARTED AND LOG FUNCTIONEAZĂ ===');
import express from 'express';
import { BookingAgent } from './agents/bookingAgent.js';
import { SupportAgent } from './agents/supportAgent.js';
import { FallbackAgent } from './agents/fallbackAgent.js';
import { MonitoringAgent } from './agents/monitorAgent.js';
import { GreetingAgent } from './agents/greetingAgent.js';
import database from './database.js';
import { langChainIntegration } from './ai/langchainIntegration.js';
import { chatLogger } from './chatLogger.js';
import { learningSystem } from './ai/learningSystem.js';
import TelegramBot from './telegram-bot.js';
import logger from './logger.js';
import { t, detectLanguage, getSupportedLanguages, isValidLanguage } from './utils/i18n.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import os from 'os';
import net from 'net';
import { agentOrchestrator } from './ai/agentOrchestrator.js';
import { userMemorySystem } from './ai/userMemory.js';
import HumanFallbackSystem from './ai/humanFallback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pornește Redis automat pe Windows dacă nu e deja activ
if (os.platform() === 'win32') {
  const redisPath = 'C:/Users/Andu/Desktop/Chatbot/redis/redis-server.exe';
  const client = new net.Socket();
  client.connect(6379, '127.0.0.1', function() {
    client.destroy(); // Redis e deja pornit
  });
  client.on('error', function() {
    // Redis nu e pornit, îl pornim
    const redisProc = spawn(redisPath, [], { detached: true, stdio: 'ignore' });
    redisProc.unref();
    console.log('Redis server started automat din app.');
  });
}

const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(process.cwd(), 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Serve the dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

let bookingAgent, supportAgent, fallbackAgent, monitorAgent, greetingAgent;
let telegramBot;
const sessionState = {};

// Initialize human fallback system
const humanFallbackSystem = new HumanFallbackSystem({
    telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN,
        agentChatIds: process.env.TELEGRAM_AGENT_CHAT_IDS?.split(',') || []
    },
    whatsapp: {
        apiKey: process.env.WHATSAPP_API_KEY
    },
    email: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM,
        agentEmails: process.env.EMAIL_AGENT_EMAILS?.split(',') || []
    },
    webhook: {
        port: process.env.WEBHOOK_PORT || 3002
    },
    escalationThreshold: 3,
    autoEscalate: true
});

// Inițializează baza de date
async function initializeDatabase() {
  try {
    await database.init();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Continuă fără baza de date pentru compatibilitate
  }
}

// Inițializează botul Telegram
async function initializeTelegramBot() {
  try {
    telegramBot = new TelegramBot();
    // await telegramBot.start();
    console.log('Telegram bot initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Telegram bot:', error);
    // Continuă fără botul Telegram pentru compatibilitate
  }
}

// Inițializează orchestratorul și pornește serverul doar după ce totul e gata
async function startServer() {
  try {
    console.log('[STARTUP] Initializing AI system...');
    await userMemorySystem.init();
    await agentOrchestrator.init();
    await initializeDatabase();
    await initializeTelegramBot();
    
    // Initialize human fallback system
    await humanFallbackSystem.init();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 AI System Status: ${agentOrchestrator.getStats().graphActive ? 'LangGraph Active' : 'Direct Routing'}`);
      console.log(`💾 Memory System: ${userMemorySystem.useRedis ? 'Redis + SQLite' : 'SQLite Only'}`);
      console.log(`👥 Human Fallback: ${humanFallbackSystem.getStatus().availableAgents} agents available`);
    });
  } catch (error) {
    console.error('[STARTUP] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

function getBookingAgent() {
  if (!bookingAgent) bookingAgent = new BookingAgent();
  return bookingAgent;
}
function getSupportAgent() {
  if (!supportAgent) supportAgent = new SupportAgent();
  return supportAgent;
}
function getFallbackAgent() {
  if (!fallbackAgent) fallbackAgent = new FallbackAgent();
  return fallbackAgent;
}
function getMonitorAgent() {
  if (!monitorAgent) monitorAgent = new MonitoringAgent();
  return monitorAgent;
}
function getGreetingAgent() {
  if (!greetingAgent) greetingAgent = new GreetingAgent();
  return greetingAgent;
}

app.post('/chat', async (req, res) => {
  console.log('=== [DEBUG] /chat endpoint primit ===', req.body);
  const { message, sessionId = 'default', lang } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  let userLanguage = lang;
  if (!userLanguage || !isValidLanguage(userLanguage)) {
    userLanguage = detectLanguage(message);
  }
  logRequest({ sessionId, message, lang: userLanguage });

  try {
    // Folosește direct orchestratorul cu persistență
    const aiResult = await agentOrchestrator.processMessage(message, sessionId, userLanguage);
    res.json({
      reply: aiResult.reply,
      language: aiResult.language,
      agent: aiResult.agent,
      sessionId,
      error: aiResult.error || false
    });
  } catch (error) {
    logError(error);
    chatLogger.logError(sessionId, message, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint pentru istoricul conversațiilor
app.get('/conversations/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = database.getConversationHistory(sessionId, 50);
    res.json({ history });
  } catch (error) {
    console.error('Error getting conversation history:', error);
    res.status(500).json({ error: 'Failed to get conversation history' });
  }
});

// Endpoint pentru bookings
app.get('/bookings/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const bookingAgent = getBookingAgent();
    const bookings = await bookingAgent.getBookingHistory(sessionId);
    res.json({ bookings });
  } catch (error) {
    console.error('Error getting bookings:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// Endpoint pentru a face o rezervare
app.post('/bookings', async (req, res) => {
  try {
    const { busNumber, passenger, sessionId } = req.body;
    if (!busNumber || !sessionId) {
      return res.status(400).json({ error: 'Bus number and session ID are required' });
    }

    // Trimite notificare prin email pentru rezervare
    // emailService.sendBookingNotification({
    //   booking: { id: `BK${Date.now()}`, busNumber },
    //   passenger: passenger || `Passenger-${sessionId}`,
    //   sessionId
    // });
    
    const bookingAgent = getBookingAgent();
    const result = await bookingAgent.reserveSeat(busNumber, passenger, sessionId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error making booking:', error);
    res.status(500).json({ error: 'Failed to make booking' });
  }
});

// Debug endpoint pentru user context
app.get('/api/debug/user-context/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`[DEBUG] Getting user context for session: ${sessionId}`);
    
    const context = await userMemorySystem.getUserContext(sessionId);
    const history = await userMemorySystem.getConversationHistory(sessionId, 10);
    const preferences = await userMemorySystem.getUserPreferences(sessionId);
    const bookings = await userMemorySystem.getBookingHistory(sessionId);
    const stats = await userMemorySystem.getStats();
    
    res.json({
      sessionId,
      context,
      history,
      preferences,
      bookings,
      memoryStats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DEBUG] Error getting user context:', error);
    res.status(500).json({ 
      error: 'Failed to get user context',
      details: error.message,
      sessionId: req.params.sessionId
    });
  }
});

// Debug endpoint pentru AI system status
app.get('/api/debug/ai-status', async (req, res) => {
  try {
    const aiStats = agentOrchestrator.getStats();
    const memoryStats = await userMemorySystem.getStats();
    
    res.json({
      ai: aiStats,
      memory: memoryStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DEBUG] Error getting AI status:', error);
    res.status(500).json({ 
      error: 'Failed to get AI status',
      details: error.message
    });
  }
});

// Debug endpoint pentru router agent
app.post('/api/debug/router', async (req, res) => {
  try {
    const { message, lang = 'ro' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const routerResult = await agentOrchestrator.routerAgent.invoke({
      message,
      language: lang
    });
    
    res.json({
      message,
      routerDecision: routerResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DEBUG] Router error:', error);
    res.status(500).json({ 
      error: 'Router failed',
      details: error.message
    });
  }
});

// Debug endpoint pentru agent test
app.post('/api/debug/agent/:agentName', async (req, res) => {
  try {
    const { agentName } = req.params;
    const { message, lang = 'ro' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    let agent;
    switch (agentName) {
      case 'greeting':
        agent = agentOrchestrator.greetingAgent;
        break;
      case 'booking':
        agent = agentOrchestrator.bookingAgent;
        break;
      case 'support':
        agent = agentOrchestrator.supportAgent;
        break;
      case 'fallback':
        agent = agentOrchestrator.fallbackAgent;
        break;
      default:
        return res.status(400).json({ error: 'Invalid agent name' });
    }
    
    if (!agent) {
      return res.status(500).json({ error: 'Agent not available' });
    }
    
    const result = await agent.invoke({
      message,
      language: lang
    });
    
    res.json({
      agent: agentName,
      message,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[DEBUG] ${req.params.agentName} agent error:`, error);
    res.status(500).json({ 
      error: 'Agent failed',
      details: error.message
    });
  }
});

// Endpoint pentru a anula o rezervare
app.delete('/bookings/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const bookingAgent = getBookingAgent();
    const result = await bookingAgent.cancelBooking(bookingId, sessionId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Endpoint pentru a vedea logurile chat-urilor
app.get('/chat-logs', async (req, res) => {
  try {
    const { date, sessionId, limit = 50 } = req.query;
    
    let logs;
    if (sessionId) {
      logs = chatLogger.getSessionLogs(sessionId);
    } else if (date) {
      logs = chatLogger.getChatLogs(new Date(date));
    } else {
      logs = chatLogger.getAllChatLogs();
    }
    
    // Limit results
    logs = logs.slice(-parseInt(limit));
    
    const stats = chatLogger.getStats();
    
    res.json({
      logs,
      stats,
      total: logs.length
    });
  } catch (error) {
    console.error('Error getting chat logs:', error);
    res.status(500).json({ error: 'Failed to get chat logs' });
  }
});

// Endpoint pentru a vedea statisticile chat-urilor
app.get('/chat-stats', async (req, res) => {
  try {
    const stats = chatLogger.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting chat stats:', error);
    res.status(500).json({ error: 'Failed to get chat stats' });
  }
});

// Endpoint pentru learning system
app.get('/learning-report', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const report = await learningSystem.analyzeChatLogs(parseInt(days));
    res.json(report);
  } catch (error) {
    console.error('Error getting learning report:', error);
    res.status(500).json({ error: 'Failed to get learning report' });
  }
});

// Endpoint pentru KPI-uri
app.get('/kpis', async (req, res) => {
  try {
    const chatStats = chatLogger.getStats();
    const learningReport = await learningSystem.analyzeChatLogs(7);
    
    const kpis = {
      chat: chatStats,
      learning: learningReport?.stats || {},
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '0.2.0',
        timestamp: new Date().toISOString()
      }
    };
    
    res.json(kpis);
  } catch (error) {
    console.error('Error getting KPIs:', error);
    res.status(500).json({ error: 'Failed to get KPIs' });
  }
});

// Endpoint pentru a verifica disponibilitatea
app.get('/availability', async (req, res) => {
  try {
    const { route, date } = req.query;
    if (!route || !date) {
      return res.status(400).json({ error: 'Route and date are required' });
    }
    
    const bookingAgent = getBookingAgent();
    const availableTrips = await bookingAgent.checkAvailability(route, date);
    res.json({ availableTrips });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Endpoint pentru rute disponibile
app.get('/routes', async (req, res) => {
  try {
    const bookingAgent = getBookingAgent();
    const timetable = await bookingAgent.loadTimetable();
    const routes = [...new Set(timetable.map(trip => trip.route))];
    res.json({ routes });
  } catch (error) {
    console.error('Error getting routes:', error);
    res.status(500).json({ error: 'Failed to get routes' });
  }
});

// Endpoint pentru statistici
app.get('/stats', async (req, res) => {
  try {
    const stats = database.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Endpoint pentru KPIs
app.get('/api/kpis', async (req, res) => {
  try {
    const stats = database.getStats();
    const langChainStats = langChainIntegration.getStats();
    
    const kpis = {
      totalConversations: stats.totalConversations || 0,
      totalBookings: stats.totalBookings || 0,
      totalSupportTickets: stats.totalSupportTickets || 0,
      averageResponseTime: stats.averageResponseTime || 0,
      successRate: stats.successRate || 0,
      activeSessions: stats.activeSessions || 0,
      languageDistribution: stats.languageDistribution || {},
      agentPerformance: stats.agentPerformance || {},
      langChain: langChainStats,
      timestamp: new Date().toISOString()
    };
    res.json(kpis);
  } catch (error) {
    console.error('Error getting KPIs:', error);
    res.status(500).json({ 
      error: 'Failed to get KPIs',
      totalConversations: 0,
      totalBookings: 0,
      totalSupportTickets: 0,
      averageResponseTime: 0,
      successRate: 0,
      activeSessions: 0,
      languageDistribution: {},
      agentPerformance: {},
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pentru status
app.get('/api/status', async (req, res) => {
  try {
    res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      services: {
        database: 'connected',
        telegram: telegramBot ? 'active' : 'inactive',
        agents: {
          booking: !!bookingAgent,
          support: !!supportAgent,
          fallback: !!fallbackAgent,
          greeting: !!greetingAgent,
          monitoring: !!monitorAgent
        },
        langChain: langChainIntegration.getStats()
      }
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Endpoint pentru LangChain health check
app.get('/api/ai/health', async (req, res) => {
  try {
    const health = await langChainIntegration.healthCheck();
    res.json(health);
  } catch (error) {
    console.error('Error checking AI health:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      reason: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pentru LangChain stats
app.get('/api/ai/stats', async (req, res) => {
  try {
    const stats = langChainIntegration.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting AI stats:', error);
    res.status(500).json({ error: 'Failed to get AI stats' });
  }
});

// Endpoint pentru clearing session memory
app.delete('/api/ai/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    langChainIntegration.clearSessionMemory(sessionId);
    res.json({ 
      success: true, 
      message: `Memory cleared for session ${sessionId}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing session memory:', error);
    res.status(500).json({ error: 'Failed to clear session memory' });
  }
});

app.get('/monitor', (req, res) => {
  const monitorAgent = getMonitorAgent();
  if (monitorAgent) {
    res.json(monitorAgent.healthCheck());
  } else {
    res.json({ 
      status: 'Monitoring unavailable',
      message: 'Monitor agent is not available',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pentru loguri
app.get('/logs/:level?', async (req, res) => {
  try {
    const { level = 'info' } = req.params;
    const { limit = 50 } = req.query;
    const logs = await logger.getLogs(level, parseInt(limit));
    res.json({ logs, level, count: logs.length });
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Endpoint pentru cleanup loguri
app.post('/logs/cleanup', async (req, res) => {
  try {
    const { daysOld = 7 } = req.body;
    await logger.cleanupOldLogs(daysOld);
    res.json({ message: `Cleaned up logs older than ${daysOld} days` });
  } catch (error) {
    console.error('Error cleaning up logs:', error);
    res.status(500).json({ error: 'Failed to cleanup logs' });
  }
});

// API endpoint to get supported languages
app.get('/api/languages', (req, res) => {
  res.json({
    supported: getSupportedLanguages(),
    default: 'ro'
  });
});

// API endpoint to set language for a session
app.post('/api/language', async (req, res) => {
  const { sessionId, language } = req.body;
  
  if (!isValidLanguage(language)) {
    return res.status(400).json({ 
      error: 'Invalid language code',
      supported: getSupportedLanguages()
    });
  }
  
  try {
    // Update session language in database
    const dbSession = database.getSession(sessionId);
    if (dbSession) {
      dbSession.data = { ...dbSession.data, language };
      database.saveSession(sessionId, dbSession.agent, dbSession.step, dbSession.data);
    }
    
    // Update local session state
    if (sessionState[sessionId]) {
      sessionState[sessionId].language = language;
    }
    
    res.json({ 
      success: true, 
      language,
      message: t('language_set', language)
    });
  } catch (error) {
    console.error('Failed to update language:', error);
    res.status(500).json({ error: 'Failed to update language' });
  }
});

// API endpoint to get translations for a language
app.get('/api/translations/:lang', (req, res) => {
  const { lang } = req.params;
  
  if (!isValidLanguage(lang)) {
    return res.status(400).json({ 
      error: 'Invalid language code',
      supported: getSupportedLanguages()
    });
  }
  
  try {
    const filePath = path.join(__dirname, 'locales', `${lang}.json`);
    console.log('Loading translations from:', filePath);
    console.log('File exists:', fs.existsSync(filePath));
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    console.log('File content length:', fileContent.length);
    
    const translations = JSON.parse(fileContent);
    console.log('Translations loaded successfully');
    
    res.json({ translations, language: lang });
  } catch (error) {
    console.error('Failed to load translations:', error);
    res.status(500).json({ error: 'Failed to load translations', details: error.message });
  }
});

// Endpoint pentru rapoarte
app.get('/api/reports/daily', async (req, res) => {
  try {
    const stats = await database.getStats();
    const reportData = {
      totalConversations: stats.totalConversations || 0,
      totalBookings: stats.totalBookings || 0,
      totalSupport: stats.totalSupport || 0,
      totalFallbacks: stats.totalFallbacks || 0,
      averageResponseTime: stats.averageResponseTime || 0,
      topAgents: stats.topAgents || [],
      errors: stats.errors || [],
      date: new Date().toLocaleDateString()
    };

    // Salvează raportul local
    // await emailService.saveReportLocally(reportData, 'daily');

    res.json({
      success: true,
      report: reportData,
      message: 'Daily report generated successfully'
    });
  } catch (error) {
    console.error('Error generating daily report:', error);
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
});

// Endpoint pentru status email
app.get('/api/email/status', (req, res) => {
  // res.json(emailService.getStatus());
});

// Widget endpoints
app.get('/widget', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'widget.html'));
});

app.get('/widget.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'public', 'widget.js'));
});

// Widget API endpoints
app.post('/api/widget/chat', async (req, res) => {
    const { message, sessionId, lang = 'en' } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    try {
        // Process message through AI
        const aiResult = await agentOrchestrator.processMessage(message, sessionId, lang);
        
        // Check if escalation is needed
        const escalationCheck = humanFallbackSystem.shouldEscalate(
            sessionId, 
            message, 
            aiResult.reply, 
            { language: lang, sessionId }
        );

        if (escalationCheck.escalate) {
            // Escalate to human
            const escalation = await humanFallbackSystem.escalateToHuman(
                sessionId, 
                message, 
                { language: lang, sessionId }, 
                escalationCheck.reason
            );

            res.json({
                reply: escalation.immediateResponse,
                escalation: {
                    id: escalation.escalationId,
                    estimatedWait: escalation.estimatedWaitTime,
                    status: 'pending'
                },
                language: lang,
                sessionId,
                error: false
            });
        } else {
            // Return AI response
            res.json({
                reply: aiResult.reply,
                language: aiResult.language,
                agent: aiResult.agent,
                sessionId,
                error: aiResult.error || false
            });
        }
    } catch (error) {
        console.error('[WIDGET] Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            reply: 'Sorry, I\'m having trouble. Please try again.'
        });
    }
});

// Human agent endpoints
app.post('/api/human/available', async (req, res) => {
    try {
        const { agentId, name, skills, availability } = req.body;
        
        // This would be called when a human agent becomes available
        // For now, we'll just acknowledge it
        res.json({ success: true, message: 'Agent availability updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update agent availability' });
    }
});

app.post('/api/human/message', async (req, res) => {
    try {
        const { sessionId, message, agentId, channel } = req.body;
        
        const result = await humanFallbackSystem.handleHumanAgentMessage(
            channel || 'api',
            agentId,
            message
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Human fallback status
app.get('/api/human/status', (req, res) => {
    res.json(humanFallbackSystem.getStatus());
});

// === FUNCȚII UTILE FLUX INDUSTRIAL ===
function isGreeting(msg) {
  return /^(salut|buna|hello|bonjour|hallo|hi|hey)[!., ]*$/i.test(msg.trim());
}
function isBooking(msg) {
  return /\b(rezervare|bilet|vreau sa merg|vreau să merg|vreau sa plec|vreau să plec|vreau bilet|book|reservation|ticket)\b/i.test(msg);
}
function isSupport(msg) {
  return /\b(suport|bagaj|pierdut|intarziere|întârziere|ajutor|help|support|lost|delay|problem)\b/i.test(msg);
}
function logRequest(data) {
  console.log('[REQUEST]', JSON.stringify(data));
}
function logError(error) {
  console.error('[ERROR]', error && error.stack ? error.stack : error);
}
function getGenericFallbackReply(lang) {
  const replies = {
    ro: "Îmi pare rău, nu am înțeles. Vă pot ajuta cu rezervări sau suport.",
    en: "Sorry, I did not understand. I can help you with bookings or support.",
    fr: "Désolé, je n'ai pas compris. Je peux vous aider avec des réservations ou du support.",
    de: "Entschuldigung, ich habe nicht verstanden. Ich kann Ihnen mit Buchungen oder Support helfen."
  };
  return replies[lang] || replies['ro'];
}
function shouldEscalate(sessionId, message, reply) {
  // Escaladează dacă mesajul conține cuvinte critice sau dacă fallback-ul a fost folosit de 3 ori la rând
  const critical = /(copil|urgent|ajutor|help|danger|pericol|sos)/i;
  if (critical.test(message)) return true;
  // TODO: Poți adăuga logică de numărare fallback-uri consecutive
  return false;
}
function sendTelegramAlert(sessionId, message, context) {
  // Placeholder: loghează alertă, poți integra cu TelegramBot dacă ai token și chatId
  console.log(`[ESCALATION] Session ${sessionId} escalated! Message: ${message} | Context: ${JSON.stringify(context)}`);
}

// Endpoint de debug pentru context user
app.get('/api/debug/user-context/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const context = await userMemorySystem.getUserContext(sessionId);
    res.json({ context });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user context', details: error.message });
  }
}); 