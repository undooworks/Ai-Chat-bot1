import 'dotenv/config';
import { ChatGroq } from "@langchain/groq";

console.log("=== TESTING LANGCHAIN GROQ ===");

// Test 1: Check if GROQ_API_KEY is available
console.log("🔑 GROQ_API_KEY available:", !!process.env.GROQ_API_KEY);

if (!process.env.GROQ_API_KEY) {
  console.log("❌ GROQ_API_KEY not found in environment variables");
  process.exit(1);
}

// Test 2: Initialize Groq LLM
try {
  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama3-8b-8192",
    temperature: 0.7,
    maxTokens: 1000,
  });
  
  console.log("✅ Groq LLM initialized successfully");
  
  // Test 3: Simple completion
  console.log("🧪 Testing simple completion...");
  const response = await llm.invoke("Say hello in Romanian");
  console.log("✅ Response received:", response.content);
  
} catch (error) {
  console.error("❌ Error with Groq:", error.message);
  process.exit(1);
}

console.log("=== LANGCHAIN TEST COMPLETE ==="); 