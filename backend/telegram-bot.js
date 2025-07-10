import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import { t, detectLanguage, getSupportedLanguages } from './utils/i18n.js';

class TelegramBot {
  constructor() {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.warn('TELEGRAM_BOT_TOKEN not found in environment variables');
      return;
    }

    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.chatbotUrl = process.env.CHATBOT_URL || 'http://localhost:3001';
    this.setupHandlers();
  }

  setupHandlers() {
    // Handler pentru mesaje text
    this.bot.on('text', async (ctx) => {
      try {
        const message = ctx.message.text;
        const userId = ctx.from.id.toString();
        const userLanguage = detectLanguage(message);
        
        console.log(`Telegram message from ${userId}: ${message} (lang: ${userLanguage})`);

        // Trimite mesajul către chatbot cu limba detectată
        const response = await fetch(`${this.chatbotUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message,
            sessionId: `telegram_${userId}`,
            lang: userLanguage
          })
        });

        if (response.ok) {
          const data = await response.json();
          await ctx.reply(data.reply);
        } else {
          await ctx.reply(t('error_message', userLanguage));
        }
      } catch (error) {
        console.error('Telegram bot error:', error);
        const userLanguage = detectLanguage(ctx.message?.text || '');
        await ctx.reply(t('connection_error', userLanguage));
      }
    });

    // Handler pentru comanda /start
    this.bot.start(async (ctx) => {
      const userLanguage = detectLanguage(ctx.message?.text || '');
      const welcomeMessage = t('telegram_welcome', userLanguage);
      
      await ctx.reply(welcomeMessage);
    });

    // Handler pentru comanda /help
    this.bot.help(async (ctx) => {
      const userLanguage = detectLanguage(ctx.message?.text || '');
      const helpMessage = t('telegram_help', userLanguage);
      
      await ctx.reply(helpMessage);
    });

    // Handler pentru comanda /lang
    this.bot.command('lang', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const userLanguage = args[1] || 'ro';
      
      if (!['ro', 'en', 'fr', 'de'].includes(userLanguage)) {
        const supportedLangs = getSupportedLanguages().join(', ');
        await ctx.reply(`❌ Limba nu este suportată. Limbi disponibile: ${supportedLangs}`);
        return;
      }

      try {
        const userId = ctx.from.id.toString();
        const sessionId = `telegram_${userId}`;
        
        // Actualizează limba în sesiune
        await fetch(`${this.chatbotUrl}/api/language`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, language: userLanguage })
        });

        await ctx.reply(t('language_set', userLanguage));
      } catch (error) {
        console.error('Error setting language:', error);
        await ctx.reply(t('error_message', userLanguage));
      }
    });

    // Handler pentru comanda /bookings
    this.bot.command('bookings', async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        const sessionId = `telegram_${userId}`;
        const userLanguage = detectLanguage(ctx.message?.text || '');
        
        const response = await fetch(`${this.chatbotUrl}/bookings/${sessionId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.bookings && data.bookings.length > 0) {
            const bookingsList = data.bookings.map(booking => 
              `🎫 ${t('booking_number', userLanguage)} #${booking.id}\n` +
              `${t('route', userLanguage)}: ${booking.route}\n` +
              `${t('date', userLanguage)}: ${booking.departure_date}\n` +
              `${t('price', userLanguage)}: ${booking.price} RON\n` +
              `${t('status', userLanguage)}: ${booking.status}\n`
            ).join('\n');
            
            await ctx.reply(`${t('your_bookings', userLanguage)}:\n\n${bookingsList}`);
          } else {
            await ctx.reply(t('no_bookings', userLanguage));
          }
        } else {
          await ctx.reply(t('booking_load_error', userLanguage));
        }
      } catch (error) {
        console.error('Error getting bookings:', error);
        const userLanguage = detectLanguage(ctx.message?.text || '');
        await ctx.reply(t('error_message', userLanguage));
      }
    });

    // Handler pentru comanda /status
    this.bot.command('status', async (ctx) => {
      try {
        const userLanguage = detectLanguage(ctx.message?.text || '');
        const response = await fetch(`${this.chatbotUrl}/monitor`);
        
        if (response.ok) {
          const data = await response.json();
          const statusMessage = `🟢 ${t('system_working', userLanguage)}!\n\n` +
            `${t('status', userLanguage)}: ${data.status}\n` +
            `${t('last_check', userLanguage)}: ${data.timestamp || 'N/A'}`;
          
          await ctx.reply(statusMessage);
        } else {
          await ctx.reply(t('system_problem', userLanguage));
        }
      } catch (error) {
        console.error('Error checking status:', error);
        const userLanguage = detectLanguage(ctx.message?.text || '');
        await ctx.reply(t('status_check_error', userLanguage));
      }
    });

    // Handler pentru comanda /info
    this.bot.command('info', async (ctx) => {
      const userLanguage = detectLanguage(ctx.message?.text || '');
      const infoMessage = t('telegram_info', userLanguage);
      
      await ctx.reply(infoMessage);
    });

    // Handler pentru comanda /admin
    this.bot.command('admin', async (ctx) => {
      const userId = ctx.from.id.toString();
      const userLanguage = detectLanguage(ctx.message?.text || '');
      // Logare acces admin
      console.log(`[ADMIN] Acces admin de la user ${userId}`);
      await ctx.reply('🔒 Acces admin: dashboard-ul este disponibil doar din interfața web.');
    });

    // Handler pentru comanda /stats
    this.bot.command('stats', async (ctx) => {
      const userId = ctx.from.id.toString();
      const userLanguage = detectLanguage(ctx.message?.text || '');
      // Logare acces stats
      console.log(`[ADMIN] Stats request de la user ${userId}`);
      // Exemplu sumar statistici (de extins cu date reale)
      await ctx.reply('📊 Statistici: Număr sesiuni, fallback rate, utilizatori activi (de extins).');
    });

    // Handler pentru comanda /logs
    this.bot.command('logs', async (ctx) => {
      const userId = ctx.from.id.toString();
      const userLanguage = detectLanguage(ctx.message?.text || '');
      // Logare acces logs
      console.log(`[ADMIN] Logs request de la user ${userId}`);
      await ctx.reply('📝 Logurile detaliate sunt disponibile doar din dashboard-ul admin.');
    });

    // Handler pentru erori
    this.bot.catch((err, ctx) => {
      console.error('Telegram bot error:', err);
      const userLanguage = detectLanguage(ctx.message?.text || '');
      ctx.reply(t('error_message', userLanguage));
    });
  }

  async start() {
    if (!this.bot) {
      console.warn('Telegram bot not initialized - missing TELEGRAM_BOT_TOKEN');
      return;
    }

    try {
      await this.bot.launch();
      console.log('Telegram bot started successfully');
      
      // Graceful stop
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    } catch (error) {
      console.error('Failed to start Telegram bot:', error);
    }
  }

  async stop() {
    if (this.bot) {
      await this.bot.stop();
      console.log('Telegram bot stopped');
    }
  }
}

export default TelegramBot; 