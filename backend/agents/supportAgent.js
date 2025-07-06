import Groq from 'groq-sdk';
import { t, detectLanguage, getLocalizedPrompt } from '../utils/i18n.js';

function getGroqClient() {
  if (process.env.GROQ_API_KEY) {
    return new Groq({ apiKey: process.env.GROQ_API_KEY });
  } else {
    throw new Error('No Groq API key found');
  }
}

export class SupportAgent {
  constructor() {
    this.memory = [];
    this.groq = getGroqClient();
    this.sessionState = {}; // Pentru a ține minte starea conversației per session
  }

  // Detectează tipul de problemă folosind AI cu suport multi-limbă
  async detectIssueType(message, sessionId) {
    const state = this.sessionState[sessionId] || { step: 'initial', issueType: null, data: {}, context: [], language: 'ro' };
    
    // Detectează limba din mesaj
    const detectedLang = detectLanguage(message);
    state.language = detectedLang;
    
    const prompt = getLocalizedPrompt(`You are an AI assistant that classifies customer support issues for a bus company. 

Current conversation context:
- Session step: ${state.step}
- Previous issue type: ${state.issueType || 'none'}
- Previous context: ${state.context.join(', ') || 'none'}

User message: "${message}"

Classify the issue type from these categories:
1. "copil_pierdut" - Lost child, missing family member, urgent child-related issues
2. "urgent" - Emergency situations, safety issues, immediate help needed
3. "bagaje" - Lost luggage, missing items, baggage problems
4. "întârziere" - Bus delays, schedule issues, timing problems
5. "rambursare" - Refunds, money back, cancellation refunds
6. "schimbare_bilet" - Ticket changes, modifications, rescheduling
7. "reclamatie" - Complaints, dissatisfaction, service issues
8. "informații" - General information requests, schedules, routes, prices
9. "general" - Other issues, unclear problems, general inquiries
10. "off_topic" - Questions not related to bus services

Respond with ONLY the category name (e.g., "bagaje", "urgent", etc.) and nothing else.`, detectedLang);

    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a precise issue classification AI. Respond with only the category name.' },
          { role: 'user', content: prompt }
        ],
        model: 'llama3-8b-8192',
        temperature: 0.1,
        max_tokens: 20
      });
      
      const issueType = chatCompletion.choices[0].message.content.trim().toLowerCase();
      console.log(`AI detected issue type: ${issueType} for message: "${message}" in language: ${detectedLang}`);
      return { issueType, language: detectedLang };
    } catch (error) {
      console.error('Error detecting issue type with AI:', error);
      // Fallback to regex patterns
      return { issueType: this.detectIssueTypeFallback(message), language: detectedLang };
    }
  }

  // Fallback regex-based detection
  detectIssueTypeFallback(message) {
    const msg = message.toLowerCase();
    
    // PROBLEME CRITICE - verifică mai întâi
    if (/(copil|bebeluș|bebelus|fiu|fiică|fiica|nepot|nepoată|nepoata|familie|familia mea|mama|tata|părinte|parinte)/i.test(msg)) {
      return 'copil_pierdut';
    }
    
    if (/(urgent|emergență|emergenta|ajutor|help|sos|salvați|salvati|pericol|danger)/i.test(msg)) {
      return 'urgent';
    }
    
    const issuePatterns = {
      'bagaje': /(bagaj|bagaje|valiz|valize|obiect|obiecte|pierdut|pierdute|lăsat|lăsate|uitat|uitate|palărie|palarie|geantă|geanta|rucsac)/i,
      'întârziere': /(întârziere|intarziere|întârziat|intarziat|târziu|târzie|program|orar|schedule|delay|autobuz|bus)/i,
      'rambursare': /(ramburs|rambursare|bani|banii|refund|return|retur|anulare|anulat|cancel)/i,
      'schimbare_bilet': /(schimb|schimbare|modific|modificare|bilet|ticket|change|modify)/i,
      'reclamatie': /(reclama|reclamație|reclamat|plângere|plangere|nemulțumit|nemultumit|problem|issue|complaint)/i,
      'informații': /(informa|informații|info|program|orar|schedule|rute|route|destina|destination|preț|pret|price)/i
    };

    for (const [issueType, pattern] of Object.entries(issuePatterns)) {
      if (pattern.test(msg)) {
        return issueType;
      }
    }

    return 'general';
  }

  // Generează răspuns folosind AI cu suport multi-limbă
  async generateResponse(message, sessionId, issueType, step) {
    const state = this.sessionState[sessionId] || { step: 'initial', issueType: null, data: {}, context: [], language: 'ro' };
    
    const prompt = getLocalizedPrompt(`You are a helpful, empathetic customer support agent for a bus company. 

Current conversation state:
- Session step: ${step}
- Issue type: ${issueType}
- Previous context: ${state.context.join(', ') || 'none'}
- User message: "${message}"

Generate a helpful, empathetic response that:
1. Acknowledges the user's issue
2. Asks for relevant details if needed
3. Provides appropriate guidance
4. Maintains a professional but warm tone
5. Is specific to the issue type and conversation step

For critical issues (copil_pierdut, urgent), be very clear about immediate actions needed.
For other issues, be helpful and guide the user through the resolution process.

Respond naturally and conversationally.`, state.language);

    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a helpful, empathetic customer support agent for a bus company.' },
          { role: 'user', content: prompt }
        ],
        model: 'llama3-8b-8192',
        temperature: 0.7,
        max_tokens: 300
      });
      
      const response = chatCompletion.choices[0].message.content.trim();
      console.log(`AI generated response for ${issueType}/${step} in ${state.language}: "${response}"`);
      return response;
    } catch (error) {
      console.error('Error generating response with AI:', error);
      return this.generateResponseFallback(message, issueType, step, state.language);
    }
  }

  // Fallback response generation cu suport multi-limbă
  generateResponseFallback(message, issueType, step, language) {
    const responses = {
      copil_pierdut: t('lost_child_urgent', language),
      urgent: t('urgent_issue', language),
      bagaje: t('lost_luggage', language),
      întârziere: t('bus_delay', language),
      rambursare: t('refund_request', language),
      schimbare_bilet: t('ticket_change', language),
      reclamatie: t('complaint', language),
      informații: t('information_request', language),
      general: t('general_issue', language)
    };

    return responses[issueType] || responses.general;
  }

  // Gestionează pașii multipli pentru fiecare tip de problemă
  async handleConversationStep(sessionId, message) {
    if (!this.sessionState[sessionId]) {
      this.sessionState[sessionId] = { step: 'initial', issueType: null, data: {}, context: [], language: 'ro' };
    }

    const state = this.sessionState[sessionId];
    
    // Detectează tipul de problemă folosind AI
    const { issueType, language } = await this.detectIssueType(message, sessionId);
    
    // Actualizează starea
    if (state.step === 'initial') {
      state.issueType = issueType;
      state.step = 'gathering_details';
    }
    
    // Adaugă context pentru următoarele interacțiuni
    state.context.push(message);
    if (state.context.length > 5) {
      state.context.shift(); // Păstrează doar ultimele 5 mesaje
    }

    console.log(`SupportAgent Session [${sessionId}]:`, {
      step: state.step,
      issueType,
      message
    });

    // Generează răspuns folosind AI
    const response = await this.generateResponse(message, sessionId, issueType, state.step);
    
    // Actualizează starea pentru următorul pas
    if (state.step === 'gathering_details') {
      state.data.details = message;
      state.step = 'providing_solution';
    } else if (state.step === 'providing_solution') {
      state.step = 'finalizing';
    }

    // Reset pentru probleme noi
    if (message.toLowerCase().includes('nou') || message.toLowerCase().includes('altă') || 
        message.toLowerCase().includes('reset') || message.toLowerCase().includes('altă problemă')) {
      delete this.sessionState[sessionId];
      return 'Să începem din nou! Te rog să îmi spui cu ce vă pot ajuta.';
    }

    return response;
  }

  async handleMessage(message, sessionId = 'default') {
    try {
      // Folosește noua logică de conversație cu AI și suport multi-limbă
      const response = await this.handleConversationStep(sessionId, message);
      
      // Salvează în memorie
      this.memory.push({ 
        message, 
        response, 
        time: new Date().toISOString(),
        sessionId 
      });
      
      return response;
    } catch (error) {
      console.error('SupportAgent error:', error);
      
      // Fallback cu LLM pentru cazuri complexe
      const state = this.sessionState[sessionId] || { language: 'ro' };
      const detectedLang = detectLanguage(message);
      const prompt = getLocalizedPrompt(`You are a helpful, empathetic customer support agent for a bus company. The user message is: ${message}. Help them with their support issue.`, detectedLang);
      
      try {
        const chatCompletion = await this.groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a helpful, empathetic customer support agent for a bus company.' },
            { role: 'user', content: prompt }
          ],
          model: 'llama3-8b-8192',
        });
        const response = chatCompletion.choices[0].message.content;
        this.memory.push({ message, response, time: new Date().toISOString() });
        return response;
      } catch (llmError) {
        console.error('LLM fallback error:', llmError);
        return t('support_fail', detectedLang);
      }
    }
  }
} 