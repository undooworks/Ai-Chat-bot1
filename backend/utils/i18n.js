import fs from 'fs';
import path from 'path';

// Supported languages
const SUPPORTED_LANGUAGES = ['ro', 'en', 'fr', 'de'];
const DEFAULT_LANGUAGE = 'ro';

// Cache for loaded translations
const translations = {};

/**
 * Load translations for a specific language
 * @param {string} lang - Language code (ro, en, fr, de)
 * @returns {Object} Translation object
 */
function loadTranslations(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    lang = DEFAULT_LANGUAGE;
  }

  if (translations[lang]) {
    return translations[lang];
  }

  try {
    const filePath = path.join(process.cwd(), 'locales', `${lang}.json`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    translations[lang] = JSON.parse(fileContent);
    console.log(`Loaded translations for language: ${lang}`);
    return translations[lang];
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error);
    // Fallback to default language
    if (lang !== DEFAULT_LANGUAGE) {
      return loadTranslations(DEFAULT_LANGUAGE);
    }
    return {};
  }
}

/**
 * Detect language from message content
 * @param {string} message - User message
 * @returns {string} Detected language code
 */
function detectLanguage(message) {
  if (!message) return DEFAULT_LANGUAGE;

  const msg = message.toLowerCase();
  
  // Romanian patterns
  const roPatterns = [
    /\b(salut|bună|merci|mulțumesc|vă rog|te rog|vreau|doresc|ajutor|suport)\b/i,
    /\b(rezervare|bilet|autobuz|stație|destinație|călătorie)\b/i,
    /\b(bagaje|valiză|pierdut|întârziere|problemă|ajutor)\b/i
  ];

  // English patterns
  const enPatterns = [
    /\b(hello|hi|thanks|please|want|need|help|support)\b/i,
    /\b(booking|ticket|bus|station|destination|travel)\b/i,
    /\b(luggage|bag|lost|delay|problem|assistance)\b/i
  ];

  // French patterns
  const frPatterns = [
    /\b(bonjour|salut|merci|s'il vous plaît|vouloir|avoir besoin|aide|support)\b/i,
    /\b(réservation|billet|bus|gare|destination|voyage)\b/i,
    /\b(bagages|valise|perdu|retard|problème|assistance)\b/i
  ];

  // German patterns
  const dePatterns = [
    /\b(hallo|danke|bitte|wollen|brauchen|hilfe|support)\b/i,
    /\b(buchung|ticket|bus|bahnhof|ziel|reise)\b/i,
    /\b(gepäck|koffer|verloren|verspätung|problem|hilfe)\b/i
  ];

  // Count matches for each language
  const scores = {
    ro: roPatterns.filter(pattern => pattern.test(msg)).length,
    en: enPatterns.filter(pattern => pattern.test(msg)).length,
    fr: frPatterns.filter(pattern => pattern.test(msg)).length,
    de: dePatterns.filter(pattern => pattern.test(msg)).length
  };

  // Return language with highest score, or default
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return DEFAULT_LANGUAGE;

  const detectedLang = Object.keys(scores).find(lang => scores[lang] === maxScore);
  return detectedLang || DEFAULT_LANGUAGE;
}

/**
 * Get translated string
 * @param {string} key - Translation key
 * @param {string} lang - Language code
 * @param {Object} params - Parameters for string interpolation
 * @returns {string} Translated string
 */
function t(key, lang = DEFAULT_LANGUAGE, params = {}) {
  const translations = loadTranslations(lang);
  let text = translations[key] || key;

  // Simple parameter interpolation: {param}
  if (params && typeof params === 'object') {
    Object.keys(params).forEach(param => {
      const regex = new RegExp(`\\{${param}\\}`, 'g');
      text = text.replace(regex, params[param]);
    });
  }

  return text;
}

/**
 * Get language-specific AI prompt
 * @param {string} basePrompt - Base prompt in English
 * @param {string} lang - Language code
 * @returns {string} Language-specific prompt
 */
function getLocalizedPrompt(basePrompt, lang = DEFAULT_LANGUAGE) {
  const langInstructions = {
    ro: 'Răspunde în română.',
    en: 'Respond in English.',
    fr: 'Répondez en français.',
    de: 'Antworten Sie auf Deutsch.'
  };

  const instruction = langInstructions[lang] || langInstructions[DEFAULT_LANGUAGE];
  return `${basePrompt}\n\n${instruction}`;
}

/**
 * Validate language code
 * @param {string} lang - Language code to validate
 * @returns {boolean} True if valid
 */
function isValidLanguage(lang) {
  return SUPPORTED_LANGUAGES.includes(lang);
}

/**
 * Get all supported languages
 * @returns {Array} Array of supported language codes
 */
function getSupportedLanguages() {
  return [...SUPPORTED_LANGUAGES];
}

export {
  t,
  detectLanguage,
  getLocalizedPrompt,
  isValidLanguage,
  getSupportedLanguages,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
}; 