import dotenv from 'dotenv';
dotenv.config();
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY);
console.log('PORT:', process.env.PORT);
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN);
console.log('All env:', process.env); 