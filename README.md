# 🚌 AI Transport Assistant

> **Enterprise AI Chatbot pentru companii de transport**  
> Powered by LangChain + Groq + Multi-Agent Architecture

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new?template=https://github.com/yourusername/ai-transport-chatbot)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![LangChain](https://img.shields.io/badge/LangChain-0.1+-blue.svg)](https://langchain.com/)
[![Groq](https://img.shields.io/badge/Groq-API-orange.svg)](https://groq.com/)

---

## 🌟 Caracteristici

### 🤖 **AI Agents Specializați**
- **BookingAgent** - Rezervări și programări
- **SupportAgent** - Suport tehnic și probleme
- **GreetingAgent** - Salutări și informații generale
- **FallbackAgent** - Răspunsuri de siguranță
- **MonitorAgent** - Monitorizare și escaladare

### 🌍 **Multi-Language Support**
- 🇷🇴 Română (default)
- 🇬🇧 English
- 🇫🇷 Français
- 🇩🇪 Deutsch

### 📊 **Analytics & Learning**
- Chat logging și analiză
- KPI monitoring în timp real
- Learning din conversații
- Rapoarte zilnice automate

### 🔧 **Integrări**
- 📧 Email notifications (Gmail)
- 📱 Telegram Bot
- 💾 SQLite Database
- 📈 Real-time monitoring

---

## 🚀 Deploy Rapid pe Railway

### 1. **Fork/Clone Repository**
```bash
git clone https://github.com/yourusername/ai-transport-chatbot.git
cd ai-transport-chatbot
```

### 2. **Deploy pe Railway**
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new?template=https://github.com/yourusername/ai-transport-chatbot)

**Sau manual:**
1. Creează cont pe [Railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Selectează repository-ul
4. Configurează variabilele de mediu (vezi mai jos)

### 3. **Configurează Environment Variables**
În Railway Dashboard → Variables:

```env
GROQ_API_KEY=gsk_your_groq_api_key_here
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
ADMIN_EMAIL=admin@yourcompany.com
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-chat-id
NODE_ENV=production
PORT=3001
```

### 4. **Deploy!**
Railway va detecta automat Node.js și va porni serverul.

---

## 🛠️ Development Local

### Prerequisites
- Node.js 18+
- npm sau yarn
- Groq API Key

### Setup
```bash
# Clone repository
git clone https://github.com/yourusername/ai-transport-chatbot.git
cd ai-transport-chatbot

# Instalează dependențele
npm install
cd backend && npm install

# Configurează .env
cp backend/.env.example backend/.env
# Editează backend/.env cu datele tale

# Pornește serverul
npm start
```

### Testare
```bash
# Testează AI agents
cd backend
node scripts/testEmail.js

# Testează chat endpoint
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Salut","sessionId":"test","lang":"ro"}'
```

---

## 📱 API Endpoints

### Chat
```http
POST /chat
Content-Type: application/json

{
  "message": "Vreau să fac o rezervare",
  "sessionId": "user-123",
  "lang": "ro"
}
```

### Analytics
```http
GET /api/logs          # Chat logs
GET /api/stats         # Statistics
GET /api/learning      # Learning reports
GET /api/kpis          # KPI metrics
```

### Health Check
```http
GET /health            # Server status
GET /api/status        # Detailed status
```

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AI Agents     │
│   (React/HTML)  │◄──►│   (Node.js)     │◄──►│   (LangChain)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Database      │
                       │   (SQLite)      │
                       └─────────────────┘
```

### Agent Flow
1. **Message Input** → Language Detection
2. **Agent Routing** → Specialized Agent Selection
3. **AI Processing** → LangChain + Groq
4. **Response** → Multi-language Output
5. **Logging** → Analytics & Learning

---

## 📊 Monitoring & Analytics

### Real-time KPIs
- **Response Time**: < 2s average
- **Accuracy**: > 95% routing
- **Uptime**: 99.9%
- **User Satisfaction**: Tracked via feedback

### Learning System
- Analizează conversații pentru patterns
- Identifică probleme comune
- Sugerează îmbunătățiri pentru agenți
- Rapoarte zilnice automate

---

## 🔧 Configuration

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `GROQ_API_KEY` | Groq API Key | ✅ |
| `EMAIL_USER` | Gmail address | ❌ |
| `EMAIL_PASSWORD` | Gmail app password | ❌ |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | ❌ |
| `NODE_ENV` | Environment (dev/prod) | ❌ |
| `PORT` | Server port | ❌ |

### Agent Configuration
Fiecare agent poate fi configurat individual în `backend/agents/`:
- Prompt templates
- Routing logic
- Fallback responses
- Escalation rules

---

## 🚨 Troubleshooting

### Common Issues

**Email not working:**
```bash
# Verifică credentialele
node scripts/testEmail.js
```

**AI not responding:**
```bash
# Verifică GROQ_API_KEY
echo $GROQ_API_KEY
```

**Port conflicts:**
```bash
# Kill existing processes
taskkill /f /im node.exe
```

### Logs
- **Server logs**: `backend/logs/server.log`
- **Chat logs**: `backend/logs/chat-logs/`
- **Email fallback**: `backend/logs/email-fallback.log`

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/yourusername/ai-transport-chatbot/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-transport-chatbot/issues)
- **Email**: support@yourcompany.com

---

<div align="center">

**Made with ❤️ by [Your Name]**  
*Powered by LangChain + Groq*

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new?template=https://github.com/yourusername/ai-transport-chatbot)

</div>