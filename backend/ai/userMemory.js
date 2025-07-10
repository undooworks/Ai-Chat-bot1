import Redis from 'redis';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

/**
 * User Memory System - Production Ready
 * 
 * This module provides persistent memory for user conversations and context.
 * It uses Redis as primary storage with SQLite as fallback.
 * 
 * Features:
 * - Session-based conversation history
 * - User preferences and settings
 * - Booking history and context
 * - Language preferences
 * - Agent interaction history
 * - Fallback to SQLite when Redis is unavailable
 */

class UserMemorySystem {
  constructor() {
    this.redis = null;
    this.db = null;
    this.useRedis = false;
    this.initialized = false;
    this.memoryDir = path.join(process.cwd(), 'backend', 'data', 'memory');
  }

  /**
   * Initialize the memory system
   */
  async init() {
    try {
      // Ensure memory directory exists
      if (!fs.existsSync(this.memoryDir)) {
        fs.mkdirSync(this.memoryDir, { recursive: true });
      }

      // Try to connect to Redis first
      await this.initRedis();
      
      // Initialize SQLite as fallback
      await this.initSQLite();
      
      this.initialized = true;
      console.log('[MEMORY] System initialized successfully');
    } catch (error) {
      console.error('[MEMORY] Failed to initialize:', error);
      // Continue with SQLite only
      await this.initSQLite();
      this.initialized = true;
    }
  }

  /**
   * Initialize Redis connection
   */
  async initRedis() {
    try {
      if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
        console.log('[MEMORY] Redis not configured, using SQLite only');
        return;
      }

      const redisConfig = {
        url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.log('[MEMORY] Redis connection refused, falling back to SQLite');
            return null;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      };

      this.redis = Redis.createClient(redisConfig);
      
      this.redis.on('error', (err) => {
        console.error('[MEMORY] Redis error:', err);
        this.useRedis = false;
      });

      this.redis.on('connect', () => {
        console.log('[MEMORY] Connected to Redis');
        this.useRedis = true;
      });

      await this.redis.connect();
      
      // Test connection
      await this.redis.ping();
      console.log('[MEMORY] Redis connection successful');
      
    } catch (error) {
      console.error('[MEMORY] Redis initialization failed:', error);
      this.useRedis = false;
    }
  }

  /**
   * Initialize SQLite database
   */
  async initSQLite() {
    try {
      const dbPath = path.join(this.memoryDir, 'user_memory.db');
      
      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Create tables if they don't exist
      await this.createTables();
      
      console.log('[MEMORY] SQLite database initialized');
    } catch (error) {
      console.error('[MEMORY] SQLite initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create necessary tables
   */
  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS user_contexts (
        session_id TEXT PRIMARY KEY,
        context_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS conversation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        agent_name TEXT,
        FOREIGN KEY (session_id) REFERENCES user_contexts (session_id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS user_preferences (
        session_id TEXT PRIMARY KEY,
        language TEXT DEFAULT 'ro',
        theme TEXT DEFAULT 'light',
        notifications BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS booking_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        booking_id TEXT NOT NULL,
        destination TEXT NOT NULL,
        date TEXT NOT NULL,
        passengers INTEGER NOT NULL,
        price REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES user_contexts (session_id)
      )`
    ];

    for (const table of tables) {
      await this.db.exec(table);
    }
  }

  /**
   * Get user context from memory
   */
  async getUserContext(sessionId) {
    try {
      if (!this.initialized) {
        console.warn('[MEMORY] System not initialized');
        return this.getDefaultContext();
      }

      // Try Redis first
      if (this.useRedis && this.redis) {
        try {
          const context = await this.redis.get(`user:${sessionId}:context`);
          if (context) {
            const parsed = JSON.parse(context);
            console.log(`[MEMORY] Retrieved context from Redis for session ${sessionId}`);
            return parsed;
          }
        } catch (redisError) {
          console.error('[MEMORY] Redis get error:', redisError);
        }
      }

      // Fallback to SQLite
      if (this.db) {
        try {
          const row = await this.db.get(
            'SELECT context_data FROM user_contexts WHERE session_id = ?',
            [sessionId]
          );

          if (row) {
            const context = JSON.parse(row.context_data);
            console.log(`[MEMORY] Retrieved context from SQLite for session ${sessionId}`);
            return context;
          }
        } catch (sqliteError) {
          console.error('[MEMORY] SQLite get error:', sqliteError);
        }
      }

      // Return default context if nothing found
      return this.getDefaultContext();
      
    } catch (error) {
      console.error('[MEMORY] Error getting user context:', error);
      return this.getDefaultContext();
    }
  }

  /**
   * Set user context in memory
   */
  async setUserContext(sessionId, context) {
    try {
      if (!this.initialized) {
        console.warn('[MEMORY] System not initialized');
        return false;
      }

      const contextData = JSON.stringify(context);
      let success = false;

      // Try Redis first
      if (this.useRedis && this.redis) {
        try {
          await this.redis.set(`user:${sessionId}:context`, contextData, 'EX', 86400); // 24 hours
          console.log(`[MEMORY] Stored context in Redis for session ${sessionId}`);
          success = true;
        } catch (redisError) {
          console.error('[MEMORY] Redis set error:', redisError);
        }
      }

      // Always store in SQLite as backup
      if (this.db) {
        try {
          await this.db.run(
            `INSERT OR REPLACE INTO user_contexts (session_id, context_data, updated_at) 
             VALUES (?, ?, CURRENT_TIMESTAMP)`,
            [sessionId, contextData]
          );
          console.log(`[MEMORY] Stored context in SQLite for session ${sessionId}`);
          success = true;
        } catch (sqliteError) {
          console.error('[MEMORY] SQLite set error:', sqliteError);
        }
      }

      return success;
      
    } catch (error) {
      console.error('[MEMORY] Error setting user context:', error);
      return false;
    }
  }

  /**
   * Add message to conversation history
   */
  async addMessage(sessionId, role, message, agentName = null) {
    try {
      if (!this.initialized) {
        console.warn('[MEMORY] System not initialized');
        return false;
      }

      // Store in SQLite
      if (this.db) {
        try {
          await this.db.run(
            'INSERT INTO conversation_history (session_id, role, message, agent_name) VALUES (?, ?, ?, ?)',
            [sessionId, role, message, agentName]
          );
        } catch (sqliteError) {
          console.error('[MEMORY] SQLite add message error:', sqliteError);
        }
      }

      // Store in Redis if available
      if (this.useRedis && this.redis) {
        try {
          const messageData = JSON.stringify({
            role,
            message,
            agentName,
            timestamp: new Date().toISOString()
          });
          
          await this.redis.lpush(`user:${sessionId}:messages`, messageData);
          await this.redis.ltrim(`user:${sessionId}:messages`, 0, 99); // Keep last 100 messages
        } catch (redisError) {
          console.error('[MEMORY] Redis add message error:', redisError);
        }
      }

      return true;
      
    } catch (error) {
      console.error('[MEMORY] Error adding message:', error);
      return false;
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(sessionId, limit = 20) {
    try {
      if (!this.initialized) {
        return [];
      }

      // Try Redis first
      if (this.useRedis && this.redis) {
        try {
          const messages = await this.redis.lrange(`user:${sessionId}:messages`, 0, limit - 1);
          return messages.map(msg => JSON.parse(msg)).reverse();
        } catch (redisError) {
          console.error('[MEMORY] Redis get history error:', redisError);
        }
      }

      // Fallback to SQLite
      if (this.db) {
        try {
          const rows = await this.db.all(
            'SELECT role, message, agent_name, timestamp FROM conversation_history WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?',
            [sessionId, limit]
          );
          return rows.reverse();
        } catch (sqliteError) {
          console.error('[MEMORY] SQLite get history error:', sqliteError);
        }
      }

      return [];
      
    } catch (error) {
      console.error('[MEMORY] Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Set user preferences
   */
  async setUserPreferences(sessionId, preferences) {
    try {
      if (!this.initialized) {
        return false;
      }

      // Store in SQLite
      if (this.db) {
        try {
          await this.db.run(
            `INSERT OR REPLACE INTO user_preferences 
             (session_id, language, theme, notifications, updated_at) 
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [sessionId, preferences.language || 'ro', preferences.theme || 'light', preferences.notifications !== false ? 1 : 0]
          );
        } catch (sqliteError) {
          console.error('[MEMORY] SQLite set preferences error:', sqliteError);
        }
      }

      // Store in Redis if available
      if (this.useRedis && this.redis) {
        try {
          await this.redis.set(`user:${sessionId}:preferences`, JSON.stringify(preferences), 'EX', 86400);
        } catch (redisError) {
          console.error('[MEMORY] Redis set preferences error:', redisError);
        }
      }

      return true;
      
    } catch (error) {
      console.error('[MEMORY] Error setting user preferences:', error);
      return false;
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(sessionId) {
    try {
      if (!this.initialized) {
        return this.getDefaultPreferences();
      }

      // Try Redis first
      if (this.useRedis && this.redis) {
        try {
          const preferences = await this.redis.get(`user:${sessionId}:preferences`);
          if (preferences) {
            return JSON.parse(preferences);
          }
        } catch (redisError) {
          console.error('[MEMORY] Redis get preferences error:', redisError);
        }
      }

      // Fallback to SQLite
      if (this.db) {
        try {
          const row = await this.db.get(
            'SELECT language, theme, notifications FROM user_preferences WHERE session_id = ?',
            [sessionId]
          );

          if (row) {
            return {
              language: row.language,
              theme: row.theme,
              notifications: row.notifications === 1
            };
          }
        } catch (sqliteError) {
          console.error('[MEMORY] SQLite get preferences error:', sqliteError);
        }
      }

      return this.getDefaultPreferences();
      
    } catch (error) {
      console.error('[MEMORY] Error getting user preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Add booking to history
   */
  async addBooking(sessionId, bookingData) {
    try {
      if (!this.initialized) {
        return false;
      }

      if (this.db) {
        try {
          await this.db.run(
            `INSERT INTO booking_history 
             (session_id, booking_id, destination, date, passengers, price, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              sessionId,
              bookingData.bookingId,
              bookingData.destination,
              bookingData.date,
              bookingData.passengers,
              bookingData.price,
              bookingData.status || 'pending'
            ]
          );
        } catch (sqliteError) {
          console.error('[MEMORY] SQLite add booking error:', sqliteError);
        }
      }

      return true;
      
    } catch (error) {
      console.error('[MEMORY] Error adding booking:', error);
      return false;
    }
  }

  /**
   * Get booking history
   */
  async getBookingHistory(sessionId) {
    try {
      if (!this.initialized) {
        return [];
      }

      if (this.db) {
        try {
          const rows = await this.db.all(
            'SELECT * FROM booking_history WHERE session_id = ? ORDER BY created_at DESC',
            [sessionId]
          );
          return rows;
        } catch (sqliteError) {
          console.error('[MEMORY] SQLite get booking history error:', sqliteError);
        }
      }

      return [];
      
    } catch (error) {
      console.error('[MEMORY] Error getting booking history:', error);
      return [];
    }
  }

  /**
   * Clear session data
   */
  async clearSession(sessionId) {
    try {
      if (!this.initialized) {
        return false;
      }

      // Clear from Redis
      if (this.useRedis && this.redis) {
        try {
          await this.redis.del(`user:${sessionId}:context`);
          await this.redis.del(`user:${sessionId}:messages`);
          await this.redis.del(`user:${sessionId}:preferences`);
        } catch (redisError) {
          console.error('[MEMORY] Redis clear session error:', redisError);
        }
      }

      // Clear from SQLite
      if (this.db) {
        try {
          await this.db.run('DELETE FROM user_contexts WHERE session_id = ?', [sessionId]);
          await this.db.run('DELETE FROM conversation_history WHERE session_id = ?', [sessionId]);
          await this.db.run('DELETE FROM user_preferences WHERE session_id = ?', [sessionId]);
          await this.db.run('DELETE FROM booking_history WHERE session_id = ?', [sessionId]);
        } catch (sqliteError) {
          console.error('[MEMORY] SQLite clear session error:', sqliteError);
        }
      }

      return true;
      
    } catch (error) {
      console.error('[MEMORY] Error clearing session:', error);
      return false;
    }
  }

  /**
   * Get system statistics
   */
  async getStats() {
    try {
      if (!this.initialized) {
        return { error: 'System not initialized' };
      }

      const stats = {
        redis: this.useRedis,
        sqlite: !!this.db,
        sessions: 0,
        messages: 0,
        bookings: 0
      };

      if (this.db) {
        try {
          const sessionCount = await this.db.get('SELECT COUNT(*) as count FROM user_contexts');
          const messageCount = await this.db.get('SELECT COUNT(*) as count FROM conversation_history');
          const bookingCount = await this.db.get('SELECT COUNT(*) as count FROM booking_history');

          stats.sessions = sessionCount?.count || 0;
          stats.messages = messageCount?.count || 0;
          stats.bookings = bookingCount?.count || 0;
        } catch (sqliteError) {
          console.error('[MEMORY] SQLite stats error:', sqliteError);
        }
      }

      return stats;
      
    } catch (error) {
      console.error('[MEMORY] Error getting stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Get default context
   */
  getDefaultContext() {
    return {
      history: [],
      lastAgent: null,
      language: 'ro',
      preferences: this.getDefaultPreferences(),
      bookingContext: null,
      supportContext: null
    };
  }

  /**
   * Get default preferences
   */
  getDefaultPreferences() {
    return {
      language: 'ro',
      theme: 'light',
      notifications: true
    };
  }

  /**
   * Close connections
   */
  async close() {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      if (this.db) {
        await this.db.close();
      }
      console.log('[MEMORY] Connections closed');
    } catch (error) {
      console.error('[MEMORY] Error closing connections:', error);
    }
  }
}

// Create singleton instance
const userMemorySystem = new UserMemorySystem();

// Export functions for backward compatibility
export async function getUserContext(sessionId) {
  return await userMemorySystem.getUserContext(sessionId);
}

export async function setUserContext(sessionId, context) {
  return await userMemorySystem.setUserContext(sessionId, context);
}

// Export additional functions
export async function addMessage(sessionId, role, message, agentName) {
  return await userMemorySystem.addMessage(sessionId, role, message, agentName);
}

export async function getConversationHistory(sessionId, limit) {
  return await userMemorySystem.getConversationHistory(sessionId, limit);
}

export async function setUserPreferences(sessionId, preferences) {
  return await userMemorySystem.setUserPreferences(sessionId, preferences);
}

export async function getUserPreferences(sessionId) {
  return await userMemorySystem.getUserPreferences(sessionId);
}

export async function addBooking(sessionId, bookingData) {
  return await userMemorySystem.addBooking(sessionId, bookingData);
}

export async function getBookingHistory(sessionId) {
  return await userMemorySystem.getBookingHistory(sessionId);
}

export async function clearSession(sessionId) {
  return await userMemorySystem.clearSession(sessionId);
}

export async function getStats() {
  return await userMemorySystem.getStats();
}

// Export the system instance
export { userMemorySystem }; 