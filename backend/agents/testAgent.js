import fetch from 'node-fetch';

const TEST_MESSAGES = [
  'Cât e biletul până la Viena?',
  'Vreau să rezerv un loc la Budapesta',
  'Mi-am pierdut bagajul',
  'Autobuzul meu întârzie',
  'Aș dori să anulez biletul',
  'Am o plângere',
  'Ce opțiuni de refund am?',
  'Salut, am nevoie de ajutor',
  'Vreau să schimb data călătoriei',
  'Ce rute aveți disponibile?'
];

export async function runTests(apiUrl = 'http://localhost:3001/chat') {
  const logs = [];
  for (const message of TEST_MESSAGES) {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    logs.push({ message, reply: data.reply });
    console.log(`[TestAgent] User: ${message}\nBot: ${data.reply}\n`);
  }
  return logs;
} 