import dotenv from 'dotenv';
dotenv.config();
import Groq from 'groq-sdk';
import { FallbackAgent } from './agents/fallbackAgent.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// API key should be set in .env file
if (!process.env.GROQ_API_KEY) {
  console.error('GROQ_API_KEY not found in environment variables');
  process.exit(1);
}

async function testGroq() {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Spune-mi o glumă scurtă.' }
      ],
      model: 'llama3-8b-8192',
    });
    console.log('GROQ RESPONSE:', chatCompletion.choices[0].message.content);
  } catch (err) {
    console.error('GROQ ERROR:', err);
  }
}

async function testFallback() {
  const agent = new FallbackAgent();
  const message = 'Ce părere ai despre stele?';
  const response = await agent.handleMessage(message, { sessionId: 'test-fallback-direct', lang: 'ro' });
  console.log('FALLBACK AGENT RESPONSE:', response);
}

testGroq();
testFallback(); 