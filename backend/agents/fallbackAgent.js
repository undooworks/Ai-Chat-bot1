// import Telegraf only if needed, and with try/catch to avoid blocking backend
// let Telegraf;
// try {
//   Telegraf = (await import('telegraf')).Telegraf;
// } catch (e) {
//   console.warn('[fallbackAgent] Telegraf not available, Telegram fallback disabled.');
//   Telegraf = null;
// }
let Telegraf = null; // Disabled for now
import Groq from 'groq-sdk';
import { t, detectLanguage, getSupportedLanguages } from '../utils/i18n.js';

// Placeholders - replace with real values or .env usage
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'YOUR_TELEGRAM_CHAT_ID';

// let bot;
// if (TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN') {
//   bot = new Telegraf(TELEGRAM_BOT_TOKEN);
// }

function getGroqClient() {
  if (process.env.GROQ_API_KEY) {
    return new Groq({ apiKey: process.env.GROQ_API_KEY });
  } else {
    throw new Error('No Groq API key found');
  }
}

export class FallbackAgent {
  constructor() {
    console.log('[FALLBACK] FallbackAgent constructor called');
    this.memory = [];
    this.conversationHistory = [];
    this.fallbackLevel = 0; // 0 = AI, 1 = Contextual, 2 = Generic
    this.maxRetries = 3;
    this.retryCount = 0;
    
    try {
      this.groq = getGroqClient();
      console.log('[FALLBACK] Groq client initialized:', !!this.groq);
    } catch (error) {
      console.error('[FALLBACK] Failed to initialize Groq:', error);
      this.groq = null;
    }
  }

  // Detectează tipul de întrebare pentru a oferi răspunsuri mai relevante
  detectQuestionType(message) {
    const msg = message.toLowerCase();
    
    // Întrebări generale despre transport
    if (/(program|orar|schedule|rute|route|destina|destination|preț|pret|price|cost|bilet|ticket|rezervare|booking)/i.test(msg)) {
      return 'transport_info';
    }
    
    // Întrebări despre vreme/timp
    if (/(vreme|weather|temperatură|temperatura|plouă|ploua|ninge|snow|cald|rece|frig)/i.test(msg)) {
      return 'weather';
    }
    
    // Întrebări despre vârstă/timp
    if (/(câți|cati|cat|ani|vârstă|varsta|age|old|young|lună|luna|moon|soare|sun|stele|stars)/i.test(msg)) {
      return 'general_knowledge';
    }
    
    // Întrebări despre știri/politică
    if (/(ziar|news|știri|stiri|politică|politica|sport|fotbal|tenis)/i.test(msg)) {
      return 'news';
    }
    
    // Întrebări despre servicii
    if (/(wifi|internet|toaletă|toaleta|wc|restaurant|cafea|mâncare|mancare|snack|ac|air|conditioning)/i.test(msg)) {
      return 'services';
    }

    // Întrebări despre companie
    if (/(companie|company|firmă|firma|angajați|angajati|employees|istoric|history|despre|about)/i.test(msg)) {
      return 'company_info';
    }

    // Întrebări despre siguranță
    if (/(siguranță|siguranta|safety|asigurare|insurance|poliță|polita|policy)/i.test(msg)) {
      return 'safety';
    }
    
    return 'general';
  }

  // Oferă răspunsuri contextuale pentru diferite tipuri de întrebări
  getContextualResponse(message, questionType, lang = 'ro') {
    const responses = {
      'transport_info': {
        'ro': [
          "🚌 Pentru informații despre program, rute și prețuri:\n\n1️⃣ Verificați site-ul nostru oficial\n2️⃣ Contactați call center-ul: 0800 123 456\n3️⃣ Folosiți aplicația mobilă\n\nVă pot ajuta cu o rezervare sau cu alte servicii de transport?",
          "📅 Informațiile despre transport sunt disponibile pe site-ul nostru. Vă pot ajuta cu o rezervare sau cu alte servicii specifice?",
          "🎫 Pentru program și prețuri, verificați site-ul nostru. Vă pot ajuta cu o rezervare sau cu alte întrebări despre transport?"
        ],
        'en': [
          "🚌 For schedule, routes and pricing information:\n\n1️⃣ Check our official website\n2️⃣ Contact call center: 0800 123 456\n3️⃣ Use our mobile app\n\nCan I help you with a booking or other transport services?",
          "📅 Transport information is available on our website. Can I help you with a booking or other specific services?",
          "🎫 For schedule and prices, check our website. Can I help you with a booking or other transport questions?"
        ]
      },
      'weather': {
        'ro': [
          "🌤️ Pentru informații despre vreme, vă recomand să verificați un site meteorologic. Vă pot ajuta cu întrebări despre transport sau serviciile noastre?",
          "🌡️ Informațiile despre vreme nu sunt în domeniul nostru de expertiză. Vă pot ajuta cu întrebări despre transport sau serviciile noastre?",
          "⛈️ Pentru vreme, verificați un site meteorologic. Vă pot ajuta cu întrebări despre transport sau serviciile noastre?"
        ],
        'en': [
          "🌤️ For weather information, I recommend checking a weather website. Can I help you with transport questions or our services?",
          "🌡️ Weather information is not in our area of expertise. Can I help you with transport questions or our services?",
          "⛈️ For weather, check a weather website. Can I help you with transport questions or our services?"
        ]
      },
      'services': {
        'ro': [
          "🚌 Serviciile disponibile în autobuze includ:\n\n✅ WiFi gratuit\n✅ Toalete\n✅ A/C\n✅ Priză pentru încărcare\n✅ Snack-uri și băuturi\n\nVă pot ajuta cu o rezervare sau alte întrebări despre servicii?",
          "💺 Autobuzele noastre sunt echipate cu WiFi, toalete, A/C și prize. Vă pot ajuta cu o rezervare sau alte întrebări?",
          "🔌 Serviciile includ WiFi, toalete, A/C și prize. Vă pot ajuta cu o rezervare sau alte întrebări despre servicii?"
        ],
        'en': [
          "🚌 Services available on buses include:\n\n✅ Free WiFi\n✅ Toilets\n✅ A/C\n✅ Power outlets\n✅ Snacks and drinks\n\nCan I help you with a booking or other service questions?",
          "💺 Our buses are equipped with WiFi, toilets, A/C and power outlets. Can I help you with a booking or other questions?",
          "🔌 Services include WiFi, toilets, A/C and power outlets. Can I help you with a booking or other service questions?"
        ]
      },
      'company_info': {
        'ro': [
          "🏢 Suntem o companie de transport cu peste 20 de ani de experiență în România și Europa. Vă pot ajuta cu întrebări despre serviciile noastre de transport?",
          "📈 Suntem lideri în transportul cu autobuz în România. Vă pot ajuta cu o rezervare sau informații despre serviciile noastre?",
          "🌟 Servim milioane de pasageri anual. Vă pot ajuta cu întrebări despre transport sau serviciile noastre?"
        ],
        'en': [
          "🏢 We are a transport company with over 20 years of experience in Romania and Europe. Can I help you with questions about our transport services?",
          "📈 We are leaders in bus transport in Romania. Can I help you with a booking or information about our services?",
          "🌟 We serve millions of passengers annually. Can I help you with transport questions or our services?"
        ]
      },
      'safety': {
        'ro': [
          "🛡️ Siguranța pasagerilor este prioritatea noastră. Toate autobuzele sunt asigurate și respectă standardele europene. Vă pot ajuta cu o rezervare?",
          "✅ Respectăm toate normele de siguranță europene. Vă pot ajuta cu întrebări despre transport sau serviciile noastre?",
          "🔒 Siguranța este garantată prin asigurări complete. Vă pot ajuta cu o rezervare sau alte întrebări?"
        ],
        'en': [
          "🛡️ Passenger safety is our priority. All buses are insured and meet European standards. Can I help you with a booking?",
          "✅ We comply with all European safety standards. Can I help you with transport questions or our services?",
          "🔒 Safety is guaranteed through comprehensive insurance. Can I help you with a booking or other questions?"
        ]
      },
      'general': {
        'ro': [
          "🤖 Înțeleg întrebarea, dar sunt specializat în servicii de transport. Vă pot ajuta cu:\n\n1️⃣ Rezervări bilete\n2️⃣ Informații despre program și rute\n3️⃣ Suport pentru probleme cu transportul\n4️⃣ Informații despre serviciile noastre\n\nCu ce vă pot ajuta?",
          "🚌 Sunt aici să vă ajut cu serviciile noastre de transport. Vă pot ajuta cu o rezervare, informații despre program sau alte servicii?",
          "💼 Sunt specializat în servicii de transport. Vă pot ajuta cu rezervări, informații despre program, suport sau alte servicii?"
        ],
        'en': [
          "🤖 I understand the question, but I'm specialized in transport services. I can help you with:\n\n1️⃣ Ticket bookings\n2️⃣ Schedule and route information\n3️⃣ Support for transport issues\n4️⃣ Information about our services\n\nHow can I help you?",
          "🚌 I'm here to help you with our transport services. Can I help you with a booking, schedule information or other services?",
          "💼 I'm specialized in transport services. I can help you with bookings, schedule information, support or other services?"
        ]
      }
    };

    const typeResponses = responses[questionType] || responses['general'];
    const langResponses = typeResponses[lang] || typeResponses['ro'];
    return langResponses[Math.floor(Math.random() * langResponses.length)];
  }

  // Fallback level 1: AI cu context îmbunătățit
  async getAIResponse(message, context = {}) {
    if (!this.groq) {
      throw new Error('Groq client not available');
    }

    const { lang = 'ro', sessionId } = context;
    const questionType = this.detectQuestionType(message);
    
    // Construiește contextul pentru AI
    const conversationContext = this.conversationHistory
      .slice(-5) // Ultimele 5 mesaje
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `You are a helpful customer service agent for a bus transport company. 
    
Company context:
- We operate bus routes across Romania and Europe
- We offer booking services, route information, and customer support
- We have mobile apps and website for self-service
- We provide WiFi, toilets, A/C, and power outlets on buses

User context:
- Language: ${lang}
- Question type: ${questionType}
- Previous conversation: ${conversationContext}

Guidelines:
- Always respond in ${lang === 'ro' ? 'Romanian' : 'English'}
- Be helpful and professional
- Redirect to our transport services when appropriate
- Keep responses concise but informative
- Use emojis sparingly but effectively
- If the question is not transport-related, politely redirect to our services`;

    const userPrompt = `User message: "${message}"

Please provide a helpful response that:
1. Addresses the user's question appropriately
2. Redirects to our transport services when relevant
3. Maintains a professional and friendly tone
4. Uses the language specified (${lang})`;

    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: 'llama3-8b-8192',
        temperature: 0.7,
        max_tokens: 300
      });

      const response = chatCompletion.choices[0].message.content;
      
      // Salvează în istoric
      this.conversationHistory.push(
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: response, timestamp: new Date() }
      );

      // Limitează istoricul
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      return response;
    } catch (error) {
      console.error('[FALLBACK] AI response error:', error);
      throw error;
    }
  }

  // Fallback level 2: Răspuns contextual
  getContextualFallback(message, context = {}) {
    const { lang = 'ro' } = context;
    const questionType = this.detectQuestionType(message);
    return this.getContextualResponse(message, questionType, lang);
  }

  // Fallback level 3: Răspuns generic
  getGenericFallback(lang = 'ro') {
    const responses = {
      'ro': [
        "Îmi pare rău, dar nu am putut procesa întrebarea. Vă pot ajuta cu rezervări, informații despre program sau suport tehnic?",
        "Nu am înțeles întrebarea. Vă pot ajuta cu serviciile noastre de transport?",
        "Îmi pare rău pentru confuzie. Vă pot ajuta cu o rezervare sau informații despre transport?"
      ],
      'en': [
        "I'm sorry, but I couldn't process the question. Can I help you with bookings, schedule information or technical support?",
        "I didn't understand the question. Can I help you with our transport services?",
        "I'm sorry for the confusion. Can I help you with a booking or transport information?"
      ]
    };

    const langResponses = responses[lang] || responses['ro'];
    return langResponses[Math.floor(Math.random() * langResponses.length)];
  }

  async handleMessage(message, context = {}) {
    console.log('[FALLBACK] handleMessage called with:', { message, context });
    
    const { lang = 'ro', sessionId } = context;
    const detectedLang = detectLanguage(message);
    const finalLang = lang || detectedLang;

    try {
      // Încearcă AI fallback (nivel 1)
      if (this.groq && this.retryCount < this.maxRetries) {
        console.log('[FALLBACK] Attempting AI response...');
        const aiResponse = await this.getAIResponse(message, { lang: finalLang, sessionId });
        this.retryCount = 0; // Reset retry count on success
        return aiResponse;
      }
    } catch (aiError) {
      console.error('[FALLBACK] AI fallback failed:', aiError);
      this.retryCount++;
    }

    // Fallback contextual (nivel 2)
    try {
      console.log('[FALLBACK] Using contextual fallback...');
      const contextualResponse = this.getContextualFallback(message, { lang: finalLang });
      this.retryCount = 0;
      return contextualResponse;
    } catch (contextError) {
      console.error('[FALLBACK] Contextual fallback failed:', contextError);
    }

    // Fallback generic (nivel 3)
    console.log('[FALLBACK] Using generic fallback...');
    return this.getGenericFallback(finalLang);
  }

  // Metodă pentru resetarea stării
  resetState() {
    this.retryCount = 0;
    this.fallbackLevel = 0;
  }

  // Metodă pentru obținerea statisticilor
  getStats() {
    return {
      totalRequests: this.memory.length,
      aiSuccessRate: this.memory.filter(m => m.aiUsed).length / this.memory.length,
      averageResponseTime: this.memory.reduce((acc, m) => acc + (m.responseTime || 0), 0) / this.memory.length
    };
  }
} 