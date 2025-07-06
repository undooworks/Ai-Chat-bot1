import 'dotenv/config';
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

console.log("=== TESTING SIMPLE AGENTS WITH LANGCHAIN ===");

// Initialize Groq LLM
const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama3-8b-8192",
  temperature: 0.7,
  maxTokens: 1000,
});

// Create a simple greeting agent
const greetingPrompt = ChatPromptTemplate.fromTemplate(`
You are a friendly greeting agent for a transport company.
You welcome users and provide general information about services.

User message: {message}
User language: {language}

Provide warm, welcoming responses. Offer to help with bookings, support, or general information.
Always respond in the user's language ({language}).
`);

const greetingAgent = RunnableSequence.from([
  greetingPrompt,
  llm,
  new StringOutputParser(),
]);

// Test the agent
async function testAgent() {
  try {
    console.log("🧪 Testing greeting agent...");
    
    const response = await greetingAgent.invoke({
      message: "Salut",
      language: "ro"
    });
    
    console.log("✅ Agent response:", response);
    
  } catch (error) {
    console.error("❌ Error with agent:", error.message);
  }
}

testAgent(); 