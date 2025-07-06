import 'dotenv/config';
import { SupportAgent } from './agents/supportAgent.js';
import { FallbackAgent } from './agents/fallbackAgent.js';
import { GreetingAgent } from './agents/greetingAgent.js';

async function testImprovements() {
  console.log('=== TESTING IMPROVED AGENTS ===\n');
  
  const supportAgent = new SupportAgent();
  const fallbackAgent = new FallbackAgent();
  const greetingAgent = new GreetingAgent();
  
  // Test 1: Critical issue detection
  console.log('🧪 TEST 1: Critical Issue Detection');
  console.log('Input: "mi am pierdut copilul"');
  const criticalResponse = await supportAgent.handleMessage('mi am pierdut copilul', 'test-critical');
  console.log('Response:', criticalResponse);
  console.log('\n---\n');
  
  // Test 2: Off-topic handling during support conversation
  console.log('🧪 TEST 2: Off-topic Handling');
  console.log('Input: "cati ani are luna?" (during support conversation)');
  const offTopicResponse = await supportAgent.handleMessage('cati ani are luna?', 'test-offtopic');
  console.log('Response:', offTopicResponse);
  console.log('\n---\n');
  
  // Test 3: Fallback agent improvements
  console.log('🧪 TEST 3: Improved Fallback Agent');
  console.log('Input: "cati ani are luna?"');
  const fallbackResponse = await fallbackAgent.handleMessage('cati ani are luna?', { sessionId: 'test-fallback' });
  console.log('Response:', fallbackResponse);
  console.log('\n---\n');
  
  // Test 4: Greeting agent confusion handling
  console.log('🧪 TEST 4: Greeting Agent Confusion Handling');
  console.log('Input: "nu inteleg"');
  const confusionResponse = await greetingAgent.handleMessage('nu inteleg', 'test-confusion');
  console.log('Response:', confusionResponse);
  console.log('\n---\n');
  
  // Test 5: Weather question in fallback
  console.log('🧪 TEST 5: Weather Question in Fallback');
  console.log('Input: "ploua afara?"');
  const weatherResponse = await fallbackAgent.handleMessage('ploua afara?', { sessionId: 'test-weather' });
  console.log('Response:', weatherResponse);
  console.log('\n---\n');
  
  // Test 6: Service information request
  console.log('🧪 TEST 6: Service Information Request');
  console.log('Input: "aveti wifi in autobuz?"');
  const serviceResponse = await fallbackAgent.handleMessage('aveti wifi in autobuz?', { sessionId: 'test-service' });
  console.log('Response:', serviceResponse);
  console.log('\n=== TESTING COMPLETE ===');
}

// Run tests
testImprovements().catch(console.error); 