import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

/**
 * JSON Schema Validation for AI Agent Responses
 * 
 * This module provides comprehensive validation for all agent responses
 * to ensure they follow the expected structure and contain valid data.
 */

// Base schema for common fields
const baseSchema = {
  type: "object",
  properties: {
    message: { type: "string", minLength: 1 },
    suggestions: { 
      type: "array", 
      items: { type: "string" },
      maxItems: 5
    }
  },
  required: ["message"]
};

// Router Agent Schema
const routerAgentSchema = {
  type: "string",
  enum: ["greeting", "booking", "support", "payment", "fallback"]
};

// Greeting Agent Schema
const greetingAgentSchema = {
  ...baseSchema,
  properties: {
    ...baseSchema.properties,
    agent: { 
      type: ["string", "null"],
      enum: ["booking", "support", null]
    }
  }
};

// Booking Agent Schema
const bookingAgentSchema = {
  ...baseSchema,
  properties: {
    ...baseSchema.properties,
    status: {
      type: "string",
      enum: ["suggest", "booked", "unavailable", "need_info"]
    },
    booking: {
      type: "object",
      properties: {
        destination: { type: "string", minLength: 1 },
        date: { 
          type: "string", 
          pattern: "^\\d{4}-\\d{2}-\\d{2}$"
        },
        passengers: { 
          type: "integer", 
          minimum: 1, 
          maximum: 10 
        },
        price: { 
          type: "number", 
          minimum: 0 
        },
        departureTime: { 
          type: "string", 
          pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
        }
      },
      required: ["destination", "date", "passengers"]
    }
  },
  required: ["message", "status"]
};

// Support Agent Schema
const supportAgentSchema = {
  ...baseSchema,
  properties: {
    ...baseSchema.properties,
    escalate: { type: "boolean" },
    issueType: {
      type: "string",
      enum: ["booking", "luggage", "delay", "payment", "technical", "general"]
    },
    ticketId: { 
      type: ["string", "null"],
      pattern: "^TKT\\d{6}$"
    },
    priority: {
      type: "string",
      enum: ["low", "medium", "high", "urgent"]
    },
    nextSteps: {
      type: "array",
      items: { type: "string" },
      maxItems: 5
    }
  },
  required: ["message", "escalate", "issueType"]
};

// Payment Agent Schema
const paymentAgentSchema = {
  ...baseSchema,
  properties: {
    ...baseSchema.properties,
    status: {
      type: "string",
      enum: ["initiated", "processing", "completed", "failed", "need_info"]
    },
    payment: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["card", "transfer", "paypal", "cash"]
        },
        amount: { 
          type: "number", 
          minimum: 0 
        },
        currency: { 
          type: "string", 
          enum: ["RON", "EUR", "USD"] 
        },
        bookingId: { type: "string", minLength: 1 }
      },
      required: ["method", "amount", "currency"]
    },
    nextSteps: {
      type: "array",
      items: { type: "string" },
      maxItems: 5
    },
    secureUrl: { 
      type: ["string", "null"],
      format: "uri"
    }
  },
  required: ["message", "status"]
};

// Fallback Agent Schema
const fallbackAgentSchema = {
  ...baseSchema,
  properties: {
    ...baseSchema.properties,
    fallback: { type: "boolean", const: true },
    reason: { type: "string", minLength: 1 },
    escalate: { type: "boolean" },
    escalationReason: { type: ["string", "null"] }
  },
  required: ["message", "fallback", "reason"]
};

// Compile schemas
const compiledSchemas = {
  routerAgent: ajv.compile(routerAgentSchema),
  greetingAgent: ajv.compile(greetingAgentSchema),
  bookingAgent: ajv.compile(bookingAgentSchema),
  supportAgent: ajv.compile(supportAgentSchema),
  paymentAgent: ajv.compile(paymentAgentSchema),
  fallbackAgent: ajv.compile(fallbackAgentSchema)
};

/**
 * Validate agent response against its schema
 * @param {string} agentName - Name of the agent
 * @param {string|object} response - Response to validate
 * @returns {object} Validation result
 */
export function validateAgentResponse(agentName, response) {
  try {
    // Parse response if it's a string
    let parsedResponse = response;
    if (typeof response === 'string') {
      try {
        parsedResponse = JSON.parse(response);
      } catch (parseError) {
        return {
          valid: false,
          errors: [`Failed to parse JSON: ${parseError.message}`],
          original: response
        };
      }
    }

    // Get the appropriate schema
    const schema = compiledSchemas[agentName];
    if (!schema) {
      return {
        valid: false,
        errors: [`Unknown agent: ${agentName}`],
        original: response
      };
    }

    // Validate
    const isValid = schema(parsedResponse);
    
    if (isValid) {
      return {
        valid: true,
        data: parsedResponse,
        original: response
      };
    } else {
      return {
        valid: false,
        errors: schema.errors.map(err => `${err.instancePath} ${err.message}`),
        original: response
      };
    }
  } catch (error) {
    return {
      valid: false,
      errors: [`Validation error: ${error.message}`],
      original: response
    };
  }
}

/**
 * Generate error response when validation fails
 * @param {string} agentName - Name of the agent
 * @param {array} errors - Validation errors
 * @param {string} language - User language
 * @returns {object} Error response
 */
export function generateErrorResponse(agentName, errors, language = 'ro') {
  const errorMessages = {
    ro: {
      greeting: "Îmi pare rău, am întâmpinat o problemă tehnica. Vă pot ajuta cu rezervări sau suport?",
      booking: "Îmi pare rău, nu am putut procesa cererea de rezervare. Vă rog să încercați din nou sau să contactați suportul.",
      support: "Îmi pare rău, am întâmpinat o problemă. Vă rog să contactați suportul direct.",
      payment: "Îmi pare rău, am întâmpinat o problemă cu procesarea plății. Vă rog să încercați din nou.",
      fallback: "Îmi pare rău, am întâmpinat o problemă tehnica. Cum vă pot ajuta?"
    },
    en: {
      greeting: "I'm sorry, I encountered a technical issue. Can I help you with bookings or support?",
      booking: "I'm sorry, I couldn't process your booking request. Please try again or contact support.",
      support: "I'm sorry, I encountered an issue. Please contact support directly.",
      payment: "I'm sorry, I encountered an issue with payment processing. Please try again.",
      fallback: "I'm sorry, I encountered a technical issue. How can I help you?"
    },
    fr: {
      greeting: "Je suis désolé, j'ai rencontré un problème technique. Puis-je vous aider avec les réservations ou le support?",
      booking: "Je suis désolé, je n'ai pas pu traiter votre demande de réservation. Veuillez réessayer ou contacter le support.",
      support: "Je suis désolé, j'ai rencontré un problème. Veuillez contacter le support directement.",
      payment: "Je suis désolé, j'ai rencontré un problème avec le traitement du paiement. Veuillez réessayer.",
      fallback: "Je suis désolé, j'ai rencontré un problème technique. Comment puis-je vous aider?"
    },
    de: {
      greeting: "Es tut mir leid, ich habe ein technisches Problem. Kann ich Ihnen bei Buchungen oder Support helfen?",
      booking: "Es tut mir leid, ich konnte Ihre Buchungsanfrage nicht verarbeiten. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.",
      support: "Es tut mir leid, ich habe ein Problem. Bitte kontaktieren Sie den Support direkt.",
      payment: "Es tut mir leid, ich habe ein Problem bei der Zahlungsverarbeitung. Bitte versuchen Sie es erneut.",
      fallback: "Es tut mir leid, ich habe ein technisches Problem. Wie kann ich Ihnen helfen?"
    }
  };

  const messages = errorMessages[language] || errorMessages.ro;
  const message = messages[agentName] || messages.fallback;

  return {
    valid: false,
    message,
    errors,
    agent: "fallback",
    escalate: true,
    escalationReason: `Validation failed for ${agentName}: ${errors.join(', ')}`
  };
}

/**
 * Sanitize and clean agent response
 * @param {string} response - Raw response from agent
 * @returns {string} Cleaned response
 */
export function sanitizeResponse(response) {
  if (typeof response !== 'string') {
    return JSON.stringify(response);
  }

  // Remove markdown formatting
  let cleaned = response
    .replace(/```json\s*/g, '')
    .replace(/```\s*$/g, '')
    .trim();

  // Ensure it's valid JSON
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch (error) {
    // If not valid JSON, try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        JSON.parse(jsonMatch[0]);
        return jsonMatch[0];
      } catch (e) {
        // Return as plain text if JSON extraction fails
        return JSON.stringify({ message: cleaned });
      }
    }
    
    // Return as plain text wrapped in JSON
    return JSON.stringify({ message: cleaned });
  }
}

/**
 * Get schema for a specific agent
 * @param {string} agentName - Name of the agent
 * @returns {object|null} Schema object or null if not found
 */
export function getAgentSchema(agentName) {
  const schemas = {
    routerAgent: routerAgentSchema,
    greetingAgent: greetingAgentSchema,
    bookingAgent: bookingAgentSchema,
    supportAgent: supportAgentSchema,
    paymentAgent: paymentAgentSchema,
    fallbackAgent: fallbackAgentSchema
  };
  
  return schemas[agentName] || null;
}

/**
 * Validate all schemas on startup
 */
export function validateSchemas() {
  const results = {};
  
  for (const [agentName, schema] of Object.entries(compiledSchemas)) {
    try {
      // Test with a valid response
      const testResponse = getTestResponse(agentName);
      const isValid = schema(testResponse);
      
      results[agentName] = {
        valid: isValid,
        errors: isValid ? [] : schema.errors.map(err => err.message)
      };
    } catch (error) {
      results[agentName] = {
        valid: false,
        errors: [error.message]
      };
    }
  }
  
  return results;
}

/**
 * Get test response for schema validation
 * @param {string} agentName - Name of the agent
 * @returns {object} Test response
 */
function getTestResponse(agentName) {
  const testResponses = {
    routerAgent: "booking",
    greetingAgent: {
      agent: "booking",
      message: "Bună! Cum vă pot ajuta cu rezervările?",
      suggestions: ["Rezervare bilet", "Verificare orar"]
    },
    bookingAgent: {
      status: "suggest",
      message: "Vă pot ajuta cu rezervarea. Care este destinația?",
      booking: {
        destination: "Budapest",
        date: "2024-01-15",
        passengers: 2,
        price: 150,
        departureTime: "08:00"
      },
      suggestions: ["Budapest", "Vienna", "Prague"]
    },
    supportAgent: {
      escalate: false,
      message: "Vă pot ajuta cu această problemă.",
      issueType: "booking",
      ticketId: null,
      priority: "medium",
      nextSteps: ["Verificare rezervare", "Contact suport"]
    },
    paymentAgent: {
      status: "initiated",
      message: "Să procesăm plata.",
      payment: {
        method: "card",
        amount: 150,
        currency: "RON",
        bookingId: "BK123456"
      },
      nextSteps: ["Introducere card", "Confirmare plată"],
      secureUrl: "https://payment.example.com/checkout"
    },
    fallbackAgent: {
      fallback: true,
      message: "Vă pot ajuta cu informații generale.",
      reason: "General inquiry",
      escalate: false,
      escalationReason: null,
      suggestions: ["Rezervări", "Suport"]
    }
  };
  
  return testResponses[agentName] || {};
}

// Export schemas for reference
export {
  routerAgentSchema,
  greetingAgentSchema,
  bookingAgentSchema,
  supportAgentSchema,
  paymentAgentSchema,
  fallbackAgentSchema
}; 