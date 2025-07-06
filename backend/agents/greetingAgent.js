import { t } from '../utils/i18n.js';

export class GreetingAgent {
  constructor() {
    this.sessionState = {};
  }

  getOptions(lang = 'ro') {
    return [
      t('booking_option', lang),
      t('support_option', lang),
      t('info_option', lang),
      t('other_option', lang)
    ];
  }

  // Detectează dacă utilizatorul pare confuz sau are nevoie de ajutor
  isConfused(message) {
    const msg = message.toLowerCase();
    const confusionPatterns = [
      /(nu înțeleg|nu inteleg|nu știu|nu stiu|ce să fac|ce sa fac|help|ajutor)/i,
      /(unde|cum|ce|de ce|când|cand|how|what|where|when|why)/i,
      /(nu merge|nu funcționează|nu functioneaza|problemă|problema|issue|error)/i
    ];
    
    return confusionPatterns.some(pattern => pattern.test(msg));
  }

  // Detectează dacă utilizatorul vrea să schimbe subiectul
  wantsToChangeTopic(message) {
    const msg = message.toLowerCase();
    const changePatterns = [
      /(altceva|altă|alta|diferit|diferită|diferita|schimb|change)/i,
      /(nu|nu vreau|nu vrea|nu mai|stop|termina|end)/i
    ];
    
    return changePatterns.some(pattern => pattern.test(msg));
  }

  async handleMessage(message, sessionId = 'default', lang = 'ro') {
    if (!this.sessionState[sessionId]) {
      this.sessionState[sessionId] = { greeted: false, attempts: 0 };
    }
    const state = this.sessionState[sessionId];
    const msg = message.toLowerCase();
    
    // Primul mesaj - salut
    if (!state.greeted && /^(salut|buna|hello|bonjour|hallo|hi|hey)[!., ]*$/i.test(msg.trim())) {
      state.greeted = true;
      return `${t('welcome_message', lang)}\n1. ${t('booking_option', lang)}\n2. ${t('support_option', lang)}\n3. ${t('info_option', lang)}\n4. ${t('other_option', lang)}`;
    }
    
    // Detectează confuzia și oferă ajutor
    if (this.isConfused(message)) {
      state.attempts = (state.attempts || 0) + 1;
      
      if (state.attempts >= 3) {
        return t('confusion_help_detailed', lang);
      }
      
      return t('confusion_help', lang);
    }
    
    // Detectează dorința de a schimba subiectul
    if (this.wantsToChangeTopic(message)) {
      state.attempts = 0; // Reset attempts
      return `${t('topic_change', lang)}\n\n1. ${t('booking_option', lang)}\n2. ${t('support_option', lang)}\n3. ${t('info_option', lang)}\n4. ${t('other_option', lang)}`;
    }
    
    // Rutare normală
    if (msg.includes('rezervare') || msg.includes('bilet') || msg.includes('1') || msg.includes('booking') || msg.includes('ticket')) {
      state.next = 'booking';
      return t('booking_prompt', lang);
    }
    
    if (msg.includes('suport') || msg.includes('bagaj') || msg.includes('întârziere') || msg.includes('intarziere') || msg.includes('2') || msg.includes('support') || msg.includes('help')) {
      state.next = 'support';
      return t('support_prompt', lang);
    }
    
    if (msg.includes('informații') || msg.includes('servicii') || msg.includes('3') || msg.includes('info') || msg.includes('services')) {
      state.next = 'info';
      return t('services_info', lang);
    }
    
    if (msg.includes('altceva') || msg.includes('4') || msg.includes('other')) {
      state.next = 'fallback';
      return t('other_help', lang);
    }
    
    // Dacă nu se înțelege, returnează null pentru fallback
    return null;
  }

  getSessionState(sessionId = 'default') {
    return this.sessionState[sessionId] || {};
  }
} 