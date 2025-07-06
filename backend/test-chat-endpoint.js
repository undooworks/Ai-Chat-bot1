import fetch from 'node-fetch';

console.log("=== TESTING CHAT ENDPOINT ===");

const BASE_URL = 'http://localhost:3001';

async function testChatEndpoint() {
  try {
    console.log("🧪 Testing chat endpoint...");
    
    const testMessage = {
      message: "Salut, vreau să fac o rezervare",
      sessionId: "test-chat-" + Date.now(),
      lang: "ro"
    };

    console.log("📤 Sending message:", testMessage);

    const response = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log("✅ Response received:");
    console.log("📄 Reply:", result.reply);
    console.log("🤖 Agent:", result.agent);
    console.log("🌍 Language:", result.language);
    console.log("✅ Success:", result.success);
    
    if (result.metadata) {
      console.log("📊 Metadata:", result.metadata);
    }

  } catch (error) {
    console.error("❌ Error testing chat endpoint:", error.message);
  }
}

// Wait a bit for server to be ready
setTimeout(testChatEndpoint, 3000); 