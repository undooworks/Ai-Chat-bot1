# �� AI Chatbot Backend - Documentație Tehnică

Backend-ul pentru sistemul de chatbot AI cu suport multi-limbă și integrare Telegram.

## 🏗️ Arhitectura Sistemului

### Componente Principale

#### 🤖 **AI Agents**
- **BookingAgent** - Gestionează rezervările cu Groq LLM
- **SupportAgent** - Detectează și rezolvă probleme clienți
- **FallbackAgent** - Răspunsuri de siguranță când alți agenți eșuează
- **MonitoringAgent** - Monitorizează conversațiile și escaladează la agent uman
- **GreetingAgent** - Gestionează salutările și rutarea inițială

#### 🌍 **Sistem Multi-limbă**
- Detecție automată de limbă din mesaje
- Suport pentru RO, EN, FR, DE
- Traduceri dinamice pentru toate elementele UI
- Persistența limbii în sesiune

#### 💾 **Persistență Date**
- **SQLite Database** - Sesiuni, conversații, rezervări
- **File Logging** - Logs detaliate cu rotație automată
- **Session Management** - Stare persistentă per utilizator

## 📁 Structura Codului

```
backend/
├── agents/                    # AI Agents
│   ├── bookingAgent.js       # Agent rezervări cu Groq LLM
│   ├── supportAgent.js       # Agent suport clienți
│   ├── fallbackAgent.js      # Agent fallback
│   ├── monitorAgent.js       # Agent monitorizare
│   └── greetingAgent.js      # Agent salutări
├── utils/                    # Utilități
│   └── i18n.js              # Sistem multi-limbă
├── locales/                  # Traduceri
│   ├── ro.json              # Română
│   ├── en.json              # Engleză
│   ├── fr.json              # Francuză
│   └── de.json              # Germană
├── public/                   # Interfață web
│   └── index.html           # Pagina principală
├── data/                     # Date și configurare
│   ├── bookings.json        # Rute disponibile
│   └── timetable.json       # Program curse
├── tests/                    # Teste unitare
├── logs/                     # Log-uri sistem
├── config/                   # Configurări
├── index.js                  # Server principal
├── database.js               # Baza de date SQLite
├── telegram-bot.js           # Bot Telegram
├── logger.js                 # Sistem logging
└── package.json              # Dependențe
```

## 🔧 Configurare și Instalare

### Dependențe
```json
{
  "express": "^4.18.2",
  "groq-sdk": "^0.3.0",
  "telegraf": "^4.15.6",
  "sqlite3": "^5.1.6",
  "node-fetch": "^3.3.2",
  "dotenv": "^16.3.1"
}
```

### Variabile de Mediu
```env
# Groq LLM API
GROQ_API_KEY=your_groq_api_key_here

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Server
PORT=3001
CHATBOT_URL=http://localhost:3001

# Database
DB_PATH=./data/chatbot.db

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/server.log
```

### Instalare
```bash
npm install
npm start
```

## 📚 API Documentation

### Endpoints Principale

#### `POST /chat`
Endpoint principal pentru conversații cu chatbot-ul.

**Request Body:**
```json
{
  "message": "string",        // Mesajul utilizatorului
  "sessionId": "string",      // ID-ul sesiunii (opțional)
  "lang": "string"           // Limba (opțional, se detectează automat)
}
```

**Response:**
```json
{
  "reply": "string",          // Răspunsul chatbot-ului
  "language": "string",       // Limba detectată/folosită
  "sessionData": {},          // Datele sesiunii
  "escalated": false          // Dacă a fost escaladat la agent uman
}
```

#### `GET /api/languages`
Returnează limbile suportate de sistem.

**Response:**
```json
{
  "supported": ["ro", "en", "fr", "de"],
  "default": "ro"
}
```

#### `POST /api/language`
Setează limba pentru o sesiune specifică.

**Request Body:**
```json
{
  "sessionId": "string",
  "language": "string"
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

#### `GET /api/translations/:lang`
Încarcă toate traducerile pentru o limbă specifică.

**Response:**
```json
{
  "translations": {
    "greeting": "Welcome!",
    "booking_prompt": "I can help you book a ticket...",
    // ... toate traducerile
  },
  "language": "en"
}
```

### Endpoints de Monitorizare

#### `GET /monitor`
Status sistem și statistici.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-15T10:30:00Z",
  "stats": {
    "activeSessions": 5,
    "totalConversations": 150,
    "successRate": 0.95
  }
}
```

#### `GET /logs`
Returnează log-urile recente ale sistemului.

#### `POST /logs/clear`
Șterge log-urile vechi.

### Endpoints de Date

#### `GET /bookings/:sessionId`
Returnează rezervările pentru o sesiune.

#### `GET /conversations/:sessionId`
Returnează istoricul conversațiilor pentru o sesiune.

## 🤖 Telegram Bot Integration

### Comenzi Disponibile
- `/start` - Începe conversația
- `/help` - Afișează ajutorul
- `/lang [ro/en/fr/de]` - Schimbă limba
- `/bookings` - Vezi rezervările
- `/status` - Status sistem
- `/info` - Informații servicii

### Configurare
1. Creează bot cu @BotFather
2. Obține token-ul
3. Adaugă în `.env`
4. Pornește serverul

## 🧪 Testare

### Teste Unitare
```bash
npm test
```

### Teste Manuale
```bash
# Test chat endpoint
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Vreau să mă duc la Viena", "sessionId": "test-1"}'

# Test language endpoint
curl -X POST http://localhost:3001/api/language \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-1", "language": "en"}'
```

### Testare Web Interface
1. Pornește serverul
2. Deschide `http://localhost:3001`
3. Testează quick actions și schimbarea limbii

## 🔍 Debugging și Logging

### Nivele de Log
- `error` - Erori critice
- `warn` - Avertismente
- `info` - Informații generale
- `debug` - Informații detaliate

### Log Files
- `logs/server.log` - Log principal
- Rotație automată la 10MB
- Păstrare ultimele 5 fișiere

### Debug Mode
```bash
LOG_LEVEL=debug npm start
```

## 🚀 Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Production Checklist
- [ ] Setează `NODE_ENV=production`
- [ ] Configurează HTTPS
- [ ] Setează log-uri pentru production
- [ ] Configurează backup pentru baza de date
- [ ] Testează toate endpoint-urile
- [ ] Verifică securitatea

## 🔒 Securitate

### Best Practices
- Validează toate input-urile
- Folosește HTTPS în production
- Limitează rate-ul de request-uri
- Loghează accesurile suspecte
- Actualizează dependențele regulat

### API Security
- Nu expune API keys în răspunsuri
- Validează session IDs
- Sanitizează mesajele utilizatorilor
- Implementează rate limiting

## 📊 Monitorizare și Metrici

### Metrici Disponibile
- Numărul de sesiuni active
- Rata de succes a rezervărilor
- Timpul de răspuns mediu
- Numărul de escaladări la agent uman
- Utilizarea pe limbi

### Health Checks
- `GET /health` - Status basic
- `GET /monitor` - Status detaliat
- `GET /ready` - Readiness check

## 🔧 Configurare Avansată

### Rute Disponibile
Editează `data/bookings.json`:
```json
{
  "routes": [
    {
      "id": "bucharest-vienna",
      "from": "Bucharest",
      "to": "Vienna",
      "price": 150,
      "duration": "12h",
      "departures": ["08:00", "20:00"]
    }
  ]
}
```

### Database Schema
```sql
-- Sesiuni
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  agent TEXT,
  step TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversații
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  agent TEXT,
  user_message TEXT,
  bot_reply TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rezervări
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  route TEXT,
  departure_date TEXT,
  price REAL,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🤝 Contribuții

### Guidelines
1. Folosește ES6+ syntax
2. Adaugă comentarii pentru funcții complexe
3. Scrie teste pentru funcționalități noi
4. Respectă structura de fișiere existentă
5. Documentează API changes

### Code Style
- Indentare: 2 spații
- Semicolon: da
- Quotes: single pentru strings
- Naming: camelCase pentru variabile, PascalCase pentru clase

---

**Versiune:** 2.0.0  
**Node.js:** 18+  
**Ultima actualizare:** Decembrie 2024