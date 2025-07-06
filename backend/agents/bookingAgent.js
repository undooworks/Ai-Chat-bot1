import fs from 'fs/promises';
import path from 'path';
import Groq from 'groq-sdk';
import { detectLanguage, getLocalizedMessage, languages } from '../config/languages.js';
import { t, getLocalizedPrompt } from '../utils/i18n.js';

const timetablePath = path.resolve('data', 'timetable.json');
const bookingsPath = path.resolve('data', 'bookings.json');

function getGroqClient() {
  if (process.env.GROQ_API_KEY) {
    return new Groq({ apiKey: process.env.GROQ_API_KEY });
  } else {
    throw new Error('No Groq API key found');
  }
}

export class BookingAgent {
  constructor() {
    this.memory = [];
    this.groq = getGroqClient();
    this.sessionState = {}; // Pentru a ține minte starea conversației per session
    this.initializeCalendar(); // Inițializează calendarul fictiv
  }

  // Inițializează un calendar fictiv cu curse pentru următoarele 30 de zile
  async initializeCalendar() {
    try {
      const existingTimetable = await this.loadTimetable();
      if (existingTimetable.length > 0) {
        console.log('Calendar already initialized');
        return;
      }

      const routes = [
        { route: 'Bucharest-Vienna', duration: 12, basePrice: 150 },
        { route: 'Bucharest-Budapest', duration: 9, basePrice: 100 },
        { route: 'Cluj-Napoca-Vienna', duration: 12, basePrice: 120 },
        { route: 'Bucharest-Paris', duration: 24, basePrice: 200 },
        { route: 'Bucharest-Rome', duration: 20, basePrice: 180 },
        { route: 'Bucharest-Berlin', duration: 18, basePrice: 160 },
        { route: 'Cluj-Napoca-Budapest', duration: 8, basePrice: 80 },
        { route: 'Timisoara-Vienna', duration: 10, basePrice: 110 }
      ];

      const timetable = [];
      const today = new Date();

      for (let day = 0; day < 30; day++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + day);

        routes.forEach((route, index) => {
          // Adaugă 2-4 curse pe zi pentru fiecare rută
          const tripsPerDay = Math.floor(Math.random() * 3) + 2;
          
          for (let trip = 0; trip < tripsPerDay; trip++) {
            const departureHour = 6 + (trip * 4) + Math.floor(Math.random() * 2);
            const departureTime = new Date(currentDate);
            departureTime.setHours(departureHour, 0, 0, 0);

            const arrivalTime = new Date(departureTime);
            arrivalTime.setHours(departureTime.getHours() + route.duration);

            const seatsAvailable = Math.floor(Math.random() * 40) + 5;
            const priceVariation = (Math.random() - 0.5) * 20; // ±10 EUR variație
            const finalPrice = Math.round(route.basePrice + priceVariation);

            timetable.push({
              route: route.route,
              departure: departureTime.toISOString(),
              arrival: arrivalTime.toISOString(),
              bus_number: `${route.route.split('-')[0].substring(0, 2).toUpperCase()}${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
              seats_total: 50,
              seats_available: seatsAvailable,
              price: finalPrice,
              day_of_week: departureTime.toLocaleDateString('en-US', { weekday: 'long' }),
              date_formatted: departureTime.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })
            });
          }
        });
      }

      await fs.writeFile(timetablePath, JSON.stringify(timetable, null, 2));
      console.log('Calendar initialized with', timetable.length, 'trips');
    } catch (error) {
      console.error('Error initializing calendar:', error);
    }
  }

  async loadTimetable() {
    try {
      const data = await fs.readFile(timetablePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading timetable:', error);
      return [];
    }
  }

  async checkAvailability(route, date) {
    const timetable = await this.loadTimetable();
    const targetDate = new Date(date);
    
    return timetable.filter(trip => {
      const tripDate = new Date(trip.departure);
      const isSameDate = tripDate.toDateString() === targetDate.toDateString();
      const routeMatch = trip.route.toLowerCase().includes(route.toLowerCase()) ||
                        route.toLowerCase().includes(trip.route.toLowerCase());
      
      return isSameDate && routeMatch && trip.seats_available > 0;
    }).sort((a, b) => new Date(a.departure) - new Date(b.departure));
  }

  async reserveSeat(busNumber, passenger, sessionId) {
    try {
      const timetable = await this.loadTimetable();
      const trip = timetable.find(t => t.bus_number === busNumber);
      
      if (!trip) {
        return { success: false, message: 'Trip not found.' };
      }
      
      if (trip.seats_available < 1) {
        return { success: false, message: 'No seats available for this trip.' };
      }

      // Actualizează numărul de locuri disponibile
      trip.seats_available -= 1;
      await fs.writeFile(timetablePath, JSON.stringify(timetable, null, 2));

      // Salvează rezervarea
      let bookings = [];
      try {
        const bookingsData = await fs.readFile(bookingsPath, 'utf-8');
        bookings = JSON.parse(bookingsData);
      } catch (error) {
        bookings = [];
      }

      const booking = {
        id: `BK${Date.now()}`,
        busNumber,
        passenger: passenger || `Passenger-${sessionId}`,
        sessionId,
        trip: {
          route: trip.route,
          departure: trip.departure,
          arrival: trip.arrival,
          price: trip.price
        },
        bookingTime: new Date().toISOString(),
        status: 'confirmed'
      };

      bookings.push(booking);
      await fs.writeFile(bookingsPath, JSON.stringify(bookings, null, 2));

      return { 
        success: true, 
        message: 'Seat reserved successfully!', 
        booking,
        trip 
      };
    } catch (error) {
      console.error('Error reserving seat:', error);
      return { success: false, message: 'Error processing reservation.' };
    }
  }

  async getBookingHistory(sessionId) {
    try {
      const bookingsData = await fs.readFile(bookingsPath, 'utf-8');
      const bookings = JSON.parse(bookingsData);
      return bookings.filter(booking => booking.sessionId === sessionId);
    } catch (error) {
      console.error('Error getting booking history:', error);
      return [];
    }
  }

  async cancelBooking(bookingId, sessionId) {
    try {
      const bookingsData = await fs.readFile(bookingsPath, 'utf-8');
      let bookings = JSON.parse(bookingsData);
      
      const bookingIndex = bookings.findIndex(b => b.id === bookingId && b.sessionId === sessionId);
      if (bookingIndex === -1) {
        return { success: false, message: 'Booking not found.' };
      }

      const booking = bookings[bookingIndex];
      
      // Restore seat to timetable
      const timetable = await this.loadTimetable();
      const trip = timetable.find(t => t.bus_number === booking.busNumber);
      if (trip) {
        trip.seats_available += 1;
        await fs.writeFile(timetablePath, JSON.stringify(timetable, null, 2));
      }

      // Remove booking
      bookings.splice(bookingIndex, 1);
      await fs.writeFile(bookingsPath, JSON.stringify(bookings, null, 2));

      return { success: true, message: 'Booking cancelled successfully.' };
    } catch (error) {
      console.error('Error cancelling booking:', error);
      return { success: false, message: 'Error cancelling booking.' };
    }
  }

  // Extrage destinația din mesaj
  extractDestination(message) {
    const msg = message.toLowerCase();
    
    // Check if the message is a route name (e.g., "bucharest-vienna")
    if (msg.includes('-') && !msg.includes(' ')) {
      const routeParts = msg.split('-');
      if (routeParts.length === 2) {
        return this.capitalize(routeParts[1]); // Return the destination part
      }
    }
    
    // Regex pentru a găsi destinații după "la", "spre", "către"
    const destinationPatterns = [
      /(?:la|spre|către|to)\s+([a-zăâîșț\- ]+)/i,
      /(?:vreau\s+(?:s[ăa]\s+)?(?:merg|plec|m[ăa]\s+duc|bilet|rezervare|rezerv)\s*(?:la|spre)?\s*)([a-zăâîșț\- ]+)/i,
      /(?:bilet|rezervare)\s+([a-zăâîșț\- ]+)/i,
      /^([a-zăâîșț\- ]+)$/i  // Dacă mesajul este doar o destinație
    ];

    for (const pattern of destinationPatterns) {
      const match = msg.match(pattern);
      if (match && match[1]) {
        const destination = match[1].trim();
        // Filtrează cuvinte care nu sunt destinații
        const stopWords = ['vreau', 'să', 'merg', 'plec', 'mă', 'duc', 'bilet', 'rezervare', 'rezerv', 'la', 'spre', 'către', 'to', 'și', 'cu', 'pentru', 'nu', 'da', 'ok', 'bine', 'perfect'];
        if (!stopWords.includes(destination) && destination.length > 2) {
          return this.capitalize(destination);
        }
      }
    }
    return null;
  }

  // Extrage data din mesaj
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

  // Mapare pentru numele orașelor în română la engleză
  getCityMapping() {
    return {
      'bucuresti': 'bucharest',
      'bucureșt': 'bucharest',
      'viena': 'vienna',
      'budapest': 'budapest',
      'cluj': 'cluj',
      'cluj-napoca': 'cluj-napoca',
      'napoca': 'cluj-napoca',
      'timisoara': 'timisoara',
      'timis': 'timisoara',
      'brasov': 'brasov',
      'brasov': 'brasov',
      'iasi': 'iasi',
      'constanta': 'constanta',
      'galati': 'galati',
      'craiova': 'craiova',
      'ploiesti': 'ploiesti',
      'oradea': 'oradea',
      'braila': 'braila',
      'arad': 'arad',
      'pitesti': 'pitesti',
      'sibiu': 'sibiu',
      'bacau': 'bacau',
      'targu mures': 'targu mures',
      'targu-mures': 'targu mures',
      'baia mare': 'baia mare',
      'buzau': 'buzau',
      'botosani': 'botosani',
      'satu mare': 'satu mare',
      'ramnicu valcea': 'ramnicu valcea',
      'suceava': 'suceava',
      'piatra neamt': 'piatra neamt',
      'drobeta turnu severin': 'drobeta turnu severin',
      'targu jiu': 'targu jiu',
      'targu-jiu': 'targu jiu',
      'focsani': 'focsani',
      'targoviste': 'targoviste',
      'calarasi': 'calarasi',
      'alba iulia': 'alba iulia',
      'giurgiu': 'giurgiu',
      'deva': 'deva',
      'hunedoara': 'hunedoara',
      'zalau': 'zalau',
      'slobozia': 'slobozia',
      'alexandria': 'alexandria',
      'targu secuiesc': 'targu secuiesc',
      'mangalia': 'mangalia',
      'medgidia': 'medgidia',
      'techirghiol': 'techirghiol',
      'eforie': 'eforie',
      'eforie nord': 'eforie nord',
      'eforie sud': 'eforie sud',
      'mamaia': 'mamaia',
      'neptun': 'neptun',
      'jupiter': 'jupiter',
      'saturn': 'saturn',
      'venus': 'venus',
      'aurora': 'aurora',
      'olimp': 'olimp',
      'cap aurora': 'cap aurora',
      'costinesti': 'costinesti',
      'vama veche': 'vama veche',
      '2 mai': '2 mai',
      'doi mai': '2 mai',
      'paris': 'paris',
      'roma': 'rome',
      'berlin': 'berlin',
      'londra': 'london',
      'madrid': 'madrid',
      'barcelona': 'barcelona',
      'amsterdam': 'amsterdam',
      'bruxelles': 'brussels',
      'frankfurt': 'frankfurt',
      'münchen': 'munich',
      'munchen': 'munich',
      'zürich': 'zurich',
      'zurich': 'zurich',
      'milano': 'milan',
      'milan': 'milan',
      'napoli': 'naples',
      'naples': 'naples',
      'venezia': 'venice',
      'venice': 'venice',
      'florenta': 'florence',
      'florence': 'florence',
      'pisa': 'pisa',
      'genova': 'genoa',
      'genoa': 'genoa',
      'torino': 'turin',
      'turin': 'turin',
      'bologna': 'bologna',
      'palermo': 'palermo',
      'catania': 'catania',
      'bari': 'bari',
      'taranto': 'taranto',
      'messina': 'messina',
      'siracusa': 'syracuse',
      'ragusa': 'ragusa',
      'agrigento': 'agrigento',
      'trapani': 'trapani',
      'caltanissetta': 'caltanissetta',
      'enna': 'enna',
      'caltagirone': 'caltagirone',
      'modica': 'modica',
      'noto': 'noto',
      'scicli': 'scicli',
      'comiso': 'comiso',
      'victoria': 'victoria',
      'victoria': 'victoria'
    };
  }

  // Validează dacă există rute pentru destinația dată
  async validateRoute(destination) {
    const timetable = await this.loadTimetable();
    const availableRoutes = [...new Set(timetable.map(trip => trip.route))];
    const cityMapping = this.getCityMapping();
    
    // Normalize destination for better matching
    const normalizedDestination = destination.toLowerCase()
      .replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i')
      .replace(/ș/g, 's').replace(/ț/g, 't');
    
    // Check if we have a direct mapping
    const mappedCity = cityMapping[normalizedDestination];
    if (mappedCity) {
      const matchingRoutes = availableRoutes.filter(route => 
        route.toLowerCase().includes(mappedCity.toLowerCase())
      );
      if (matchingRoutes.length > 0) {
        return { valid: true, routes: matchingRoutes };
      }
    }
    
    // Also check if the destination is already in English format
    const directMatch = availableRoutes.filter(route => 
      route.toLowerCase().includes(normalizedDestination)
    );
    if (directMatch.length > 0) {
      return { valid: true, routes: directMatch };
    }
    
    // Caută rute care conțin destinația
    const matchingRoutes = availableRoutes.filter(route => {
      const normalizedRoute = route.toLowerCase()
        .replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i')
        .replace(/ș/g, 's').replace(/ț/g, 't');
      
      return normalizedRoute.includes(normalizedDestination) || 
             normalizedDestination.includes(normalizedRoute.split('-')[0].trim()) ||
             normalizedDestination.includes(normalizedRoute.split('-')[1].trim());
    });

    if (matchingRoutes.length > 0) {
      return { valid: true, routes: matchingRoutes };
    }

    // Sugerează rute alternative
    return { 
      valid: false, 
      availableRoutes: availableRoutes,
      suggestions: availableRoutes.slice(0, 5) // Primele 5 rute ca sugestii
    };
  }

  async extractSlotsWithLLM(message, lang) {
    // Enhanced prompt for better slot extraction
    const prompt = `Extract travel information from this message: "${message}"

Available routes: Bucharest-Vienna, Bucharest-Budapest, Cluj-Napoca-Vienna, Bucharest-Paris, Bucharest-Rome, Bucharest-Berlin, Cluj-Napoca-Budapest, Timisoara-Vienna

Reply in JSON format only:
{
  "destination": "extracted destination or null",
  "date": "extracted date in YYYY-MM-DD format or null",
  "intent": "booking, inquiry, help, cancel, history, or other",
  "action": "reserve, check, cancel, view, or other"
}

Examples:
- "vreau să merg la Viena" → {"destination": "Vienna", "date": null, "intent": "booking", "action": "reserve"}
- "mâine la București" → {"destination": "Bucharest", "date": "tomorrow", "intent": "booking", "action": "reserve"}
- "ce rute aveți?" → {"destination": null, "date": null, "intent": "inquiry", "action": "check"}
- "anulez rezervarea" → {"destination": null, "date": null, "intent": "cancel", "action": "cancel"}
- "istoricul meu" → {"destination": null, "date": null, "intent": "history", "action": "view"}`;

    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          { 
            role: 'system', 
            content: `You are a travel assistant. Extract destination and date from user messages. Reply ONLY with valid JSON. Language: ${languages[lang]?.name || 'English'}` 
          },
          { role: 'user', content: prompt }
        ],
        model: 'llama3-8b-8192',
        temperature: 0.1,
        max_tokens: 150
      });
      
      const response = chatCompletion.choices[0].message.content;
      console.log('LLM slot extraction response:', response);
      
      // Try to parse JSON response
      const json = JSON.parse(response);
      
      // Process date if it's a relative date
      if (json.date && typeof json.date === 'string') {
        if (json.date.toLowerCase() === 'tomorrow' || json.date.toLowerCase() === 'mâine') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          json.date = tomorrow.toISOString().split('T')[0];
        } else if (json.date.toLowerCase() === 'today' || json.date.toLowerCase() === 'azi') {
          json.date = new Date().toISOString().split('T')[0];
        }
      }
      
      return { 
        destination: json.destination, 
        date: json.date,
        intent: json.intent || 'booking',
        action: json.action || 'reserve'
      };
    } catch (error) {
      console.error('LLM slot extraction error:', error);
      return { destination: null, date: null, intent: 'booking', action: 'reserve' };
    }
  }

  async generateReplyWithLLM(context, lang) {
    // Create a more detailed prompt based on the context
    let systemPrompt = `You are a helpful travel booking assistant for a bus company. You speak ${languages[lang]?.name || 'English'}. `;
    let userPrompt = '';
    
    switch (context.step) {
      case 'help_requested':
        systemPrompt += 'The user is asking for help or clarification. Be helpful and guide them through the booking process.';
        userPrompt = `The user said: "${context.message}". They seem to need help. Please provide clear guidance on how to make a booking, check routes, or manage reservations.`;
        break;
        
      case 'waiting_for_destination':
        systemPrompt += 'The user needs to specify a destination. Help them choose from available routes.';
        userPrompt = `The user said: "${context.message}". We need to know their destination. Available routes are: Bucharest-Vienna, Bucharest-Budapest, Cluj-Napoca-Vienna, Bucharest-Paris, Bucharest-Rome, Bucharest-Berlin, Cluj-Napoca-Budapest, Timisoara-Vienna. Please help them choose.`;
        break;
        
      case 'waiting_for_date':
        systemPrompt += 'The user has specified a destination but needs to provide a travel date.';
        userPrompt = `The user said: "${context.message}". They want to go to ${context.destination}. Please ask for their preferred travel date.`;
        break;
        
      case 'showing_options':
        systemPrompt += 'Show available trips and help the user make a selection.';
        userPrompt = `Available trips for ${context.destination} on ${context.date}: ${JSON.stringify(context.availableTrips)}. Help the user choose a trip by mentioning the bus number, departure time, and price.`;
        break;
        
      case 'no_trips':
        systemPrompt += 'No trips are available for the requested destination and date. Suggest alternatives.';
        userPrompt = `No trips available for ${context.destination} on ${context.date}. Please suggest alternative dates or destinations.`;
        break;

      case 'booking_confirmed':
        systemPrompt += 'The booking has been confirmed. Provide booking details and next steps.';
        userPrompt = `Booking confirmed: ${JSON.stringify(context.booking)}. Please provide booking details and next steps.`;
        break;

      case 'booking_cancelled':
        systemPrompt += 'The booking has been cancelled. Confirm the cancellation.';
        userPrompt = `Booking cancelled successfully. Please confirm the cancellation.`;
        break;

      case 'showing_history':
        systemPrompt += 'Show the user their booking history.';
        userPrompt = `Booking history: ${JSON.stringify(context.bookings)}. Please show the user their booking history.`;
        break;
        
      default:
        systemPrompt += 'Help the user with their booking request.';
        userPrompt = `The user said: "${context.message}". Context: ${JSON.stringify(context)}. Please help them with their booking.`;
    }
    
    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: 'llama3-8b-8192',
        temperature: 0.7,
        max_tokens: 400
      });
      
      return chatCompletion.choices[0].message.content;
    } catch (error) {
      console.error('LLM generation error:', error);
      // Fallback response
      return t('booking_fail', lang);
    }
  }

  async handleConversationStep(sessionId, message, extractedData = {}) {
    if (!this.sessionState[sessionId]) {
      this.sessionState[sessionId] = { step: 'initial', data: {} };
    }
    const state = this.sessionState[sessionId];
    const lang = detectLanguage(message);
    
    console.log('BookingAgent processing message:', message, 'for session:', sessionId);
    
    // Use LLM to extract slots
    const slots = await this.extractSlotsWithLLM(message, lang);
    console.log('LLM extracted slots:', slots);
    
    const destination = extractedData.destination || slots.destination;
    const date = extractedData.date || slots.date;
    const intent = slots.intent;
    const action = slots.action;
    
    // Save to state
    if (destination) state.data.destination = destination;
    if (date) state.data.date = date;
    
    // Enhanced booking flow logic with better AI integration
    let context = {
      step: state.step,
      destination: state.data.destination,
      date: state.data.date,
      message: message,
      previousStep: state.step,
      intent: intent,
      action: action
    };
    
    // Handle different intents
    if (intent === 'history' || action === 'view') {
      const bookings = await this.getBookingHistory(sessionId);
      context.bookings = bookings;
      context.step = 'showing_history';
      state.step = 'showing_history';
    } else if (intent === 'cancel' || action === 'cancel') {
      // Extract booking ID from message or use the last booking
      const bookings = await this.getBookingHistory(sessionId);
      if (bookings.length > 0) {
        const lastBooking = bookings[bookings.length - 1];
        const result = await this.cancelBooking(lastBooking.id, sessionId);
        context.cancellationResult = result;
        context.step = 'booking_cancelled';
        state.step = 'booking_cancelled';
      } else {
        context.step = 'no_bookings_to_cancel';
        state.step = 'no_bookings_to_cancel';
      }
    } else if (intent === 'inquiry' || action === 'check') {
      // Show available routes
      const timetable = await this.loadTimetable();
      const routes = [...new Set(timetable.map(trip => trip.route))];
      context.availableRoutes = routes;
      context.step = 'showing_routes';
      state.step = 'showing_routes';
    } else {
      // Check if user is asking for help or clarification
      const helpKeywords = ['ajutor', 'help', 'nu înțeleg', 'nu inteleg', 'ce fac', 'cum', 'what', 'how'];
      const isAskingForHelp = helpKeywords.some(keyword => message.toLowerCase().includes(keyword));
      
      if (isAskingForHelp) {
        context.step = 'help_requested';
        context.helpType = 'general';
      } else if (state.data.destination && state.data.date) {
        // Both destination and date are present, check availability
        const availableTrips = await this.checkAvailability(state.data.destination, state.data.date);
        if (availableTrips.length > 0) {
          context.availableTrips = availableTrips;
          context.step = 'showing_options';
          state.step = 'showing_options';
        } else {
          context.noTrips = true;
          context.step = 'no_trips';
          state.step = 'no_trips';
        }
      } else if (state.data.destination && !state.data.date) {
        context.step = 'waiting_for_date';
        state.step = 'waiting_for_date';
      } else if (!state.data.destination) {
        context.step = 'waiting_for_destination';
        state.step = 'waiting_for_destination';
      }
    }
    
    // Generate intelligent reply with LLM
    const reply = await this.generateReplyWithLLM(context, lang);
    console.log('Generated AI reply:', reply);
    
    return reply;
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
      console.error('BookingAgent error:', error);
      
      // Fallback cu LLM pentru cazuri complexe
      const state = this.sessionState[sessionId] || { language: 'ro' };
      const detectedLang = detectLanguage(message);
      const prompt = getLocalizedPrompt(`You are a helpful, empathetic booking agent for a bus company. The user message is: ${message}. Help them with their booking request.`, detectedLang);
      
      try {
        const chatCompletion = await this.groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a helpful, empathetic booking agent for a bus company.' },
            { role: 'user', content: prompt }
          ],
          model: 'llama3-8b-8192',
        });
        const response = chatCompletion.choices[0].message.content;
        this.memory.push({ message, response, time: new Date().toISOString() });
        return response;
      } catch (llmError) {
        console.error('LLM fallback error:', llmError);
        return t('booking_fail', detectedLang);
      }
    }
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
} 