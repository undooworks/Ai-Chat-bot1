import { simpleAgentOrchestrator } from './ai/simpleAgentOrchestrator.js';

console.log("=== TESTING SIMPLE AGENT ORCHESTRATOR ===");

// Wait for initialization
setTimeout(async () => {
  console.log("🧪 Testing simple orchestrator...");
  
  const testCases = [
    { message: "Salut", expected: "greeting" },
    { message: "Vreau să fac o rezervare", expected: "booking" },
    { message: "Am o problemă cu bagajul", expected: "support" },
    { message: "Care este programul?", expected: "booking" },
    { message: "Cum faci?", expected: "greeting" },
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n📝 Testing: "${testCase.message}"`);
      
      const result = await simpleAgentOrchestrator.processMessage(
        testCase.message,
        "test-session",
        "ro"
      );
      
      console.log(`✅ Agent: ${result.agent}`);
      console.log(`📄 Response: ${result.reply.substring(0, 100)}...`);
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
  
  console.log("\n📊 System stats:", simpleAgentOrchestrator.getStats());
  console.log("=== TEST COMPLETE ===");
  
}, 2000); 