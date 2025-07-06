import fetch from 'node-fetch';

console.log("=== TESTING CHAT LOGS ===");

const BASE_URL = 'http://localhost:3001';

async function testChatMessages() {
  const testMessages = [
    { message: "Salut", expected: "greeting" },
    { message: "Vreau să fac o rezervare", expected: "booking" },
    { message: "Am o problemă cu bagajul", expected: "support" },
    { message: "Care este programul?", expected: "booking" },
    { message: "Mulțumesc", expected: "greeting" },
  ];

  for (const testCase of testMessages) {
    try {
      console.log(`\n📝 Testing: "${testCase.message}"`);
      
      const response = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testCase.message,
          sessionId: "test-logs-" + Date.now(),
          lang: "ro"
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      console.log(`✅ Agent: ${result.agent}`);
      console.log(`📄 Response: ${result.reply.substring(0, 80)}...`);
      
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
  
  console.log("\n📊 Checking chat logs...");
  
  try {
    const logsResponse = await fetch(`${BASE_URL}/chat-logs?limit=10`);
    const logsData = await logsResponse.json();
    
    console.log(`📈 Total logs: ${logsData.total}`);
    console.log(`📊 Stats:`, logsData.stats);
    
    if (logsData.logs.length > 0) {
      console.log("\n📝 Recent chat logs:");
      logsData.logs.slice(-3).forEach((log, index) => {
        console.log(`${index + 1}. [${log.timestamp}] ${log.agent} | "${log.userMessage}" -> "${log.aiResponse.substring(0, 50)}..."`);
      });
    }
    
  } catch (error) {
    console.error(`❌ Error getting logs: ${error.message}`);
  }
}

// Wait for server to be ready
setTimeout(testChatMessages, 2000); 