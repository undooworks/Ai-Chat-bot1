// Multi-language support configuration
export const languages = {
  ro: {
    name: 'Română',
    greeting: 'Bun venit! Cu ce vă putem ajuta?',
    booking: 'Rezervare bilet',
    support: 'Suport (bagaje pierdute, întârziere, etc.)',
    other: 'Altceva',
    chooseOption: 'Vă rog să alegeți: 1. Rezervare bilet  2. Suport (bagaje, întârziere, etc.)',
    destinationPrompt: 'Pentru a vă ajuta cu rezervarea, te rog să îmi spui destinația (de exemplu: "vreau să mă duc la Viena" sau "bilet spre Budapesta").',
    datePrompt: 'Te rog să îmi spui data călătoriei (de exemplu: "mâine", "15/07/2024", "pe 20 iulie 2024").',
    noRoutes: 'Nu avem rute directe către {destination}. Rutele disponibile sunt:\n{availableRoutes}\n\nTe rog să alegeți o destinație din lista de mai sus.',
    noTrips: 'Nu avem curse disponibile către {destination} pe data {date}. Te rog să încercați o altă dată sau o altă destinație.',
    bookingComplete: 'Rezervare confirmată! 🎉\n\nDetalii rezervare:\n- Rută: {route}\n- Autobuz: {busNumber}\n- Plecare: {departure}\n- Preț: {price} RON\n- Număr loc: {seatNumber}\n\nVă mulțumim pentru rezervare!',
    supportPrompt: 'Vă pot ajuta cu suportul. Descrieți problema dvs.',
    error: 'A apărut o eroare. Încercați din nou.',
    notUnderstood: 'Nu înțeleg. Te rog să îmi spui dacă vrei să faci o rezervare de bilet.'
  },
  en: {
    name: 'English',
    greeting: 'Welcome! How can we help you?',
    booking: 'Book ticket',
    support: 'Support (lost luggage, delays, etc.)',
    other: 'Other',
    chooseOption: 'Please choose: 1. Book ticket  2. Support (luggage, delays, etc.)',
    destinationPrompt: 'To help you with the booking, please tell me the destination (e.g., "I want to go to Vienna" or "ticket to Budapest").',
    datePrompt: 'Please tell me the travel date (e.g., "tomorrow", "15/07/2024", "on July 20, 2024").',
    noRoutes: 'We don\'t have direct routes to {destination}. Available routes are:\n{availableRoutes}\n\nPlease choose a destination from the list above.',
    noTrips: 'We don\'t have available trips to {destination} on {date}. Please try another date or destination.',
    bookingComplete: 'Booking confirmed! 🎉\n\nBooking details:\n- Route: {route}\n- Bus: {busNumber}\n- Departure: {departure}\n- Price: {price} RON\n- Seat number: {seatNumber}\n\nThank you for your booking!',
    supportPrompt: 'I can help you with support. Describe your problem.',
    error: 'An error occurred. Please try again.',
    notUnderstood: 'I don\'t understand. Please tell me if you want to book a ticket.'
  },
  fr: {
    name: 'Français',
    greeting: 'Bienvenue! Comment pouvons-nous vous aider?',
    booking: 'Réserver un billet',
    support: 'Support (bagages perdus, retards, etc.)',
    other: 'Autre',
    chooseOption: 'Veuillez choisir: 1. Réserver un billet  2. Support (bagages, retards, etc.)',
    destinationPrompt: 'Pour vous aider avec la réservation, veuillez me dire la destination (ex: "je veux aller à Vienne" ou "billet pour Budapest").',
    datePrompt: 'Veuillez me dire la date de voyage (ex: "demain", "15/07/2024", "le 20 juillet 2024").',
    noRoutes: 'Nous n\'avons pas de routes directes vers {destination}. Les routes disponibles sont:\n{availableRoutes}\n\nVeuillez choisir une destination dans la liste ci-dessus.',
    noTrips: 'Nous n\'avons pas de voyages disponibles vers {destination} le {date}. Veuillez essayer une autre date ou destination.',
    bookingComplete: 'Réservation confirmée! 🎉\n\nDétails de la réservation:\n- Route: {route}\n- Bus: {busNumber}\n- Départ: {departure}\n- Prix: {price} RON\n- Numéro de siège: {seatNumber}\n\nMerci pour votre réservation!',
    supportPrompt: 'Je peux vous aider avec le support. Décrivez votre problème.',
    error: 'Une erreur s\'est produite. Veuillez réessayer.',
    notUnderstood: 'Je ne comprends pas. Veuillez me dire si vous voulez réserver un billet.'
  },
  de: {
    name: 'Deutsch',
    greeting: 'Willkommen! Wie können wir Ihnen helfen?',
    booking: 'Ticket buchen',
    support: 'Support (verlorenes Gepäck, Verspätungen, etc.)',
    other: 'Andere',
    chooseOption: 'Bitte wählen Sie: 1. Ticket buchen  2. Support (Gepäck, Verspätungen, etc.)',
    destinationPrompt: 'Um Ihnen bei der Buchung zu helfen, teilen Sie mir bitte das Ziel mit (z.B. "Ich möchte nach Wien" oder "Ticket nach Budapest").',
    datePrompt: 'Bitte teilen Sie mir das Reisedatum mit (z.B. "morgen", "15.07.2024", "am 20. Juli 2024").',
    noRoutes: 'Wir haben keine direkten Routen nach {destination}. Verfügbare Routen sind:\n{availableRoutes}\n\nBitte wählen Sie ein Ziel aus der obigen Liste.',
    noTrips: 'Wir haben keine verfügbaren Fahrten nach {destination} am {date}. Bitte versuchen Sie ein anderes Datum oder Ziel.',
    bookingComplete: 'Buchung bestätigt! 🎉\n\nBuchungsdetails:\n- Route: {route}\n- Bus: {busNumber}\n- Abfahrt: {departure}\n- Preis: {price} RON\n- Sitznummer: {seatNumber}\n\nVielen Dank für Ihre Buchung!',
    supportPrompt: 'Ich kann Ihnen beim Support helfen. Beschreiben Sie Ihr Problem.',
    error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    notUnderstood: 'Ich verstehe nicht. Bitte sagen Sie mir, ob Sie ein Ticket buchen möchten.'
  }
};

// Language detection function
export function detectLanguage(message) {
  const msg = message.toLowerCase();
  
  // Simple language detection based on common words
  const languagePatterns = {
    en: /\b(the|and|for|with|you|are|have|this|that|will|can|help|book|ticket|support)\b/i,
    fr: /\b(le|la|les|et|pour|avec|vous|êtes|avez|ceci|cela|peut|aider|réserver|billet|support)\b/i,
    de: /\b(der|die|das|und|für|mit|sie|sind|haben|dies|das|kann|helfen|buchen|ticket|support)\b/i,
    ro: /\b(și|pentru|cu|vă|sunteți|aveți|acest|acela|poate|ajuta|rezerva|bilet|suport)\b/i
  };

  for (const [lang, pattern] of Object.entries(languagePatterns)) {
    if (pattern.test(msg)) {
      return lang;
    }
  }

  // Default to Romanian if no pattern matches
  return 'ro';
}

// Get localized message
export function getLocalizedMessage(lang, key, params = {}) {
  const language = languages[lang] || languages.ro;
  let message = language[key] || key;
  
  // Replace parameters in the message
  for (const [param, value] of Object.entries(params)) {
    message = message.replace(`{${param}}`, value);
  }
  
  return message;
} 