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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // 1. Pre-procesare
  let userLanguage = lang;
  if (!userLanguage || !isValidLanguage(userLanguage)) {
    userLanguage = detectLanguage(message);
  }
  logRequest({ sessionId, message, lang: userLanguage });

  try {
    // 2. LangChain AI Orchestration (NEW)
    console.log('[AI] Processing with LangChain orchestrator...');
    const aiResult = await langChainIntegration.processMessage(message, sessionId, userLanguage);
    
    if (aiResult.success) {
      console.log(`[AI] LangChain response from ${aiResult.agent} agent:`, aiResult.reply);
      
      // 3. Persistență
      database.saveSession(sessionId, aiResult.agent, 'active', { 
        language: aiResult.language,
        confidence: aiResult.confidence,
        orchestrator: 'langchain'
      });
      database.saveConversation(sessionId, aiResult.agent, message, aiResult.reply);
      
      // 4. Escaladare dacă e necesar
      if (shouldEscalate(sessionId, message, aiResult.reply)) {
        sendTelegramAlert(sessionId, message, { 
          agent: aiResult.agent, 
          reply: aiResult.reply,
          confidence: aiResult.confidence 
        });
      }
      
      // 5. Log chat conversation
      chatLogger.logChat(sessionId, message, aiResult.reply, aiResult.agent, aiResult.language);
      
      // 6. Returnezi răspunsul AI
      res.json({ 
        reply: aiResult.reply, 
        language: aiResult.language,
        agent: aiResult.agent,
        confidence: aiResult.confidence,
        metadata: aiResult.metadata
      });
    } else {
      // Fallback la sistemul vechi dacă LangChain eșuează
      console.log('[AI] LangChain failed, using legacy system...');
      const msg = message.toLowerCase();
      let reply = '', agent = '', isFallback = false;
      
      if (isGreeting(msg)) {
        console.log('[ROUTING] GreetingAgent (legacy)');
        const greetingAgent = getGreetingAgent();
        reply = await greetingAgent.handleMessage(message, sessionId, userLanguage);
        agent = 'GreetingAgent';
        if (reply === null) {
          console.log('[ROUTING] GreetingAgent returned null, continue to FallbackAgent');
          const fallbackAgent = getFallbackAgent();
          try {
            reply = await fallbackAgent.handleMessage(message, { sessionId, lang: userLanguage });
            agent = 'FallbackAgent';
            isFallback = true;
          } catch (err) {
            logError(err);
            reply = getGenericFallbackReply(userLanguage);
            agent = 'FallbackAgent';
            isFallback = true;
          }
        }
      } else if (isBooking(msg)) {
        console.log('[ROUTING] BookingAgent (legacy)');
        const bookingAgent = getBookingAgent();
        reply = await bookingAgent.handleMessage(message, sessionId);
        agent = 'BookingAgent';
      } else if (isSupport(msg)) {
        console.log('[ROUTING] SupportAgent (legacy)');
        const supportAgent = getSupportAgent();
        reply = await supportAgent.handleMessage(message, sessionId);
        agent = 'SupportAgent';
      } else {
        console.log('[ROUTING] FallbackAgent (legacy)');
        const fallbackAgent = getFallbackAgent();
        try {
          reply = await fallbackAgent.handleMessage(message, { sessionId, lang: userLanguage });
          agent = 'FallbackAgent';
          isFallback = true;
        } catch (err) {
          logError(err);
          reply = getGenericFallbackReply(userLanguage);
          agent = 'FallbackAgent';
          isFallback = true;
        }
      }
      
      // Persistență pentru sistemul legacy
      database.saveSession(sessionId, agent, 'active', { 
        language: userLanguage,
        orchestrator: 'legacy'
      });
      database.saveConversation(sessionId, agent, message, reply);
      
      if (shouldEscalate(sessionId, message, reply)) {
        sendTelegramAlert(sessionId, message, { agent, reply });
      }
      
      // Log chat conversation for legacy system
      chatLogger.logChat(sessionId, message, reply, agent, userLanguage);
      
      res.json({ 
        reply, 
        language: userLanguage,
        agent,
        orchestrator: 'legacy'
      });
    }
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

const PORT = process.env.PORT || 3000;

// Inițializează baza de date și botul Telegram înainte de a porni serverul
async function initializeServices() {
  try {
    await initializeDatabase();
    await initializeTelegramBot();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Telegram bot: ${telegramBot ? 'Active' : 'Not configured'}`);
      console.log(`💾 Database: ${database.db ? 'Connected' : 'Not available'}`);
    });
  } catch (error) {
    console.error('Failed to start services:', error);
    // Pornește serverul fără serviciile opționale pentru compatibilitate
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (limited functionality)`);
    });
  }
}

initializeServices(); 