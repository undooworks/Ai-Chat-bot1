# 📚 API Documentation - AI Chatbot

Documentație completă pentru API-ul sistemului de chatbot AI.

## 🔗 Base URL
```
http://localhost:3001
```

## 🔐 Autentificare
API-ul nu necesită autentificare pentru endpoint-urile publice. Pentru endpoint-urile de administrare, se folosește API key în header.

## 📋 Endpoints

### 🤖 Chat Endpoints

#### `POST /chat`
Endpoint principal pentru conversații cu chatbot-ul.

**Request:**
```http
POST /chat
Content-Type: application/json

{
  "message": "Vreau să mă duc la Viena",
  "sessionId": "user-123",
  "lang": "ro"
}
```

**Response:**
```json
{
  "reply": "Pentru a vă ajuta cu rezervarea, te rog să îmi spui destinația (de exemplu: \"vreau să mă duc la Viena\" sau \"bilet spre Budapesta\").",
  "language": "ro",
  "sessionData": {
    "step": "booking",
    "destination": "Viena",
    "date": null
  },
  "escalated": false
}
```

**Parametri:**
- `message` (string, required) - Mesajul utilizatorului
- `sessionId` (string, optional) - ID-ul sesiunii (se generează automat dacă nu este specificat)
- `lang` (string, optional) - Limba (se detectează automat dacă nu este specificată)

**Coduri de răspuns:**
- `200` - Succes
- `400` - Mesaj lipsă sau invalid
- `500` - Eroare internă

---

### 🌍 Language Endpoints

#### `GET /api/languages`
Returnează limbile suportate de sistem.

**Request:**
```http
GET /api/languages
```

**Response:**
```json
{
  "supported": ["ro", "en", "fr", "de"],
  "default": "ro"
}
```

#### `POST /api/language`
Setează limba pentru o sesiune specifică.

**Request:**
```http
POST /api/language
Content-Type: application/json

{
  "sessionId": "user-123",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "language": "en",
  "message": "Language changed successfully!"
}
```

**Parametri:**
- `sessionId` (string, required) - ID-ul sesiunii
- `language` (string, required) - Codul limbii (ro, en, fr, de)

#### `GET /api/translations/:lang`
Încarcă toate traducerile pentru o limbă specifică.

**Request:**
```http
GET /api/translations/en
```

**Response:**
```json
{
  "translations": {
    "greeting": "Welcome! How can we help you?",
    "booking_prompt": "I can help you book a ticket. Please specify the destination and date.",
    "support_prompt": "I can help you with support. Please describe your issue.",
    "input_placeholder": "Type your message...",
    "typing_indicator": "AI is typing...",
    "error_message": "Sorry, we encountered a problem. Please try again.",
    "connection_error": "Sorry, we encountered a connection problem. Please try again.",
    "welcome_message": "Welcome! I'm here to help you with ticket bookings and support. How can I help you?",
    "language_set": "Language changed successfully!",
    "booking_destination_prompt": "To help you with the booking, please tell me the destination (for example: \"I want to go to Vienna\" or \"ticket to Budapest\").",
    "booking_date_prompt": "Perfect! Now please tell me the travel date (for example: \"tomorrow\", \"December 15\", \"in 2 weeks\").",
    "booking_confirmation": "Your booking has been confirmed!",
    "support_issue_detection": "I understand you have a problem. Please tell me more details.",
    "support_details_prompt": "To help you quickly, please:",
    "support_contact_prompt": "I can help you contact the support department. Would you like me to do this now?",
    "fallback_message": "I don't understand. Please tell me if you want to book a ticket.",
    "invalid_destination": "We don't have direct routes to this destination. Available routes are:",
    "route_suggestion": "Please choose a destination from the list above.",
    "date_format_error": "Please specify a valid date.",
    "booking_success": "Booking was successful!",
    "booking_failed": "Sorry, the booking could not be completed. Please try again.",
    "support_success": "Your issue has been recorded. We will contact you soon.",
    "support_urgent": "Your issue has been marked as urgent. We will contact you immediately.",
    "human_escalation": "I'm transferring you to a human agent for personalized assistance.",
    "session_timeout": "Session has expired. Please start again.",
    "system_error": "A system error occurred. Please try again.",
    "unknown": "I don't understand. Please rephrase.",
    "lost_luggage": "You lost your luggage? Please tell me details (date, route, description).",
    "bus_delay": "The bus is delayed? Please tell me the route and scheduled time.",
    "booking_fail": "I couldn't complete the booking. Try again or contact support.",
    "help": "Available commands: /start, /help, /lang [language code]",
    "date_prompt": "For the date {date}, please also tell me the desired destination.",
    "destination_prompt": "For the destination {destination}, please also tell me the travel date.",
    "confirmation_prompt": "Please confirm your booking: {route} on {date}.",
    "booking_complete": "Booking completed! You will receive details by email.",
    "information_request": "I'm happy to help you with information. Please tell me what specific information you need (schedule, routes, prices, etc.).",
    "general_issue": "I understand you have a problem. Please tell me more details about how I can help you.",
    "support_fail": "Sorry, we encountered a technical problem. Please try again or contact our call center.",
    "telegram_welcome": "🚌 Welcome to the Bus Booking Bot!\n\nHow can I help you?\n• Book tickets\n• Support and information\n• Trip status\n\nWrite your message and I'll help you!",
    "telegram_help": "📋 Available commands:\n\n/start - Start conversation\n/help - Show this help\n/lang [ro/en/fr/de] - Change language\n/bookings - See your bookings\n/status - System status\n/info - Service information\n\n💡 Example messages:\n• \"I want to go to Vienna\"\n• \"Book ticket for tomorrow\"\n• \"I lost my luggage\"\n• \"The bus is delayed\"",
    "telegram_info": "ℹ️ Information about our services:\n\n🚌 Available routes:\n• Bucharest → Vienna\n• Bucharest → Budapest\n• Cluj-Napoca → Vienna\n\n💰 Prices:\n• Bucharest-Vienna: 150 RON\n• Bucharest-Budapest: 100 RON\n• Cluj-Vienna: 120 RON\n\n📞 Support:\n• For luggage problems\n• Information about delays\n• Refunds and changes\n\n💳 Payment methods:\n• Bank card\n• Bank transfer\n• On-board payment (with fee)",
    "booking_number": "Booking",
    "route": "Route",
    "date": "Date",
    "price": "Price",
    "status": "Status",
    "your_bookings": "📋 Your bookings",
    "no_bookings": "You don't have active bookings at the moment.",
    "booking_load_error": "Could not load bookings. Please try again.",
    "system_working": "System is working normally",
    "last_check": "Last check",
    "system_problem": "⚠️ The system seems to have problems. Please try again.",
    "status_check_error": "⚠️ Could not check system status."
  },
  "language": "en"
}
```

**Parametri:**
- `lang` (string, required) - Codul limbii (ro, en, fr, de)

---

### 📊 Data Endpoints

#### `GET /bookings/:sessionId`
Returnează rezervările pentru o sesiune specifică.

**Request:**
```http
GET /bookings/user-123
```

**Response:**
```json
{
  "bookings": [
    {
      "id": 1,
      "route": "Bucharest-Vienna",
      "departure_date": "2024-12-20",
      "price": 150,
      "status": "confirmed",
      "created_at": "2024-12-15T10:30:00Z"
    }
  ]
}
```

#### `GET /conversations/:sessionId`
Returnează istoricul conversațiilor pentru o sesiune.

**Request:**
```http
GET /conversations/user-123
```

**Response:**
```json
{
  "conversations": [
    {
      "id": 1,
      "agent": "GreetingAgent",
      "user_message": "Salut",
      "bot_reply": "Bun venit! Cu ce vă putem ajuta?",
      "timestamp": "2024-12-15T10:30:00Z"
    },
    {
      "id": 2,
      "agent": "BookingAgent",
      "user_message": "Vreau să mă duc la Viena",
      "bot_reply": "Pentru a vă ajuta cu rezervarea...",
      "timestamp": "2024-12-15T10:31:00Z"
    }
  ]
}
```

---

### 📈 Monitoring Endpoints

#### `GET /monitor`
Status sistem și statistici.

**Request:**
```http
GET /monitor
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-15T10:30:00Z",
  "stats": {
    "activeSessions": 5,
    "totalConversations": 150,
    "successRate": 0.95,
    "averageResponseTime": 1200,
    "fallbackCount": 3,
    "escalationCount": 1
  },
  "system": {
    "uptime": 3600,
    "memory": {
      "used": "45MB",
      "total": "512MB"
    },
    "database": {
      "size": "2.5MB",
      "connections": 3
    }
  }
}
```

#### `GET /logs`
Returnează log-urile recente ale sistemului.

**Request:**
```http
GET /logs?limit=50&level=info
```

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2024-12-15T10:30:00Z",
      "level": "info",
      "message": "Chat session started: user-123",
      "sessionId": "user-123"
    },
    {
      "timestamp": "2024-12-15T10:29:00Z",
      "level": "warn",
      "message": "Fallback agent triggered for session: user-456",
      "sessionId": "user-456"
    }
  ],
  "total": 150,
  "limit": 50
}
```

**Parametri:**
- `limit` (number, optional) - Numărul de log-uri (default: 100)
- `level` (string, optional) - Nivelul de log (error, warn, info, debug)
- `sessionId` (string, optional) - Filtrare după sesiune

#### `POST /logs/clear`
Șterge log-urile vechi.

**Request:**
```http
POST /logs/clear
Content-Type: application/json

{
  "olderThan": "7d"
}
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 1250,
  "message": "Logs older than 7 days have been cleared"
}
```

**Parametri:**
- `olderThan` (string, optional) - Șterge log-urile mai vechi de (ex: "7d", "24h", "30m")

---

### 🔧 System Endpoints

#### `GET /health`
Health check basic.

**Request:**
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-15T10:30:00Z"
}
```

#### `GET /ready`
Readiness check pentru deployment.

**Request:**
```http
GET /ready
```

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": "ok",
    "groq_api": "ok",
    "telegram_bot": "ok"
  },
  "timestamp": "2024-12-15T10:30:00Z"
}
```

---

## 🧪 Exemple de Utilizare

### Exemplu 1: Conversație de Rezervare
```bash
# 1. Salutare
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Salut", "sessionId": "test-1"}'

# 2. Rezervare bilet
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Vreau să mă duc la Viena", "sessionId": "test-1"}'

# 3. Specificare dată
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Mâine", "sessionId": "test-1"}'
```

### Exemplu 2: Schimbare Limbă
```bash
# Schimbă limba în engleză
curl -X POST http://localhost:3001/api/language \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-1", "language": "en"}'

# Continuă conversația în engleză
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I want to go to Vienna", "sessionId": "test-1"}'
```

### Exemplu 3: Monitorizare
```bash
# Verifică statusul sistemului
curl http://localhost:3001/monitor

# Vezi log-urile recente
curl "http://localhost:3001/logs?limit=10&level=error"

# Vezi rezervările pentru o sesiune
curl http://localhost:3001/bookings/test-1
```

---

## 🔒 Error Handling

### Coduri de Eroare
- `400` - Bad Request (parametri invalizi)
- `404` - Not Found (endpoint inexistent)
- `500` - Internal Server Error (eroare server)
- `503` - Service Unavailable (serviciu indisponibil)

### Format Erori
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "additional info"
  },
  "timestamp": "2024-12-15T10:30:00Z"
}
```

### Exemple de Erori
```json
{
  "error": "Message is required",
  "code": "MISSING_MESSAGE",
  "details": {
    "field": "message"
  }
}
```

```json
{
  "error": "Invalid language code",
  "code": "INVALID_LANGUAGE",
  "details": {
    "supported": ["ro", "en", "fr", "de"],
    "provided": "es"
  }
}
```

---

## 📊 Rate Limiting

API-ul implementează rate limiting pentru a preveni abuzul:
- **Chat endpoint**: 100 requests/minute per IP
- **Language endpoints**: 50 requests/minute per IP
- **Monitoring endpoints**: 20 requests/minute per IP

Când se depășește limita:
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

---

## 🔐 Securitate

### Best Practices
1. **Validează input-urile** - Toate mesajele sunt sanitizate
2. **Folosește HTTPS** - În production, folosește întotdeauna HTTPS
3. **Rate limiting** - Implementat pentru toate endpoint-urile
4. **Logging** - Toate accesurile sunt logate
5. **Session management** - Sesiunile sunt validate și curățate

### Headers Recomandate
```http
Content-Type: application/json
User-Agent: YourApp/1.0
Accept: application/json
```

---

## 📈 Monitoring și Alerting

### Metrici Disponibile
- **Throughput**: Numărul de request-uri pe minut
- **Response Time**: Timpul mediu de răspuns
- **Error Rate**: Procentul de erori
- **Active Sessions**: Numărul de sesiuni active
- **Fallback Rate**: Procentul de utilizare a fallback agent

### Health Checks
Implementează health checks pentru:
- Disponibilitatea bazei de date
- Conectivitatea la Groq API
- Statusul Telegram bot
- Utilizarea memoriei

---

**Versiune API:** 2.0.0  
**Ultima actualizare:** Decembrie 2024  
**Suport:** Pentru suport tehnic, creează un issue pe GitHub 