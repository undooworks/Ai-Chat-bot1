import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'data', 'chatbot.db');

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    try {
      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Creează tabelele dacă nu există
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async createTables() {
    // Tabel pentru sesiuni
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        agent_type TEXT NOT NULL,
        step TEXT NOT NULL,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabel pentru bookings
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        bus_number TEXT NOT NULL,
        passenger TEXT NOT NULL,
        route TEXT NOT NULL,
        departure_date TEXT NOT NULL,
        price REAL NOT NULL,
        status TEXT DEFAULT 'confirmed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (session_id)
      )
    `);

    // Tabel pentru conversații
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        message TEXT NOT NULL,
        response TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (session_id)
      )
    `);

    // Indexuri pentru performanță
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions (agent_type);
      CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings (session_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations (session_id);
    `);
  }

  // Gestionare sesiuni
  async saveSession(sessionId, agentType, step, data = {}) {
    try {
      const dataJson = JSON.stringify(data);
      await this.db.run(`
        INSERT OR REPLACE INTO sessions (session_id, agent_type, step, data, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [sessionId, agentType, step, dataJson]);
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  }

  async getSession(sessionId) {
    try {
      const row = await this.db.get(`
        SELECT * FROM sessions WHERE session_id = ?
      `, [sessionId]);
      
      if (row) {
        return {
          ...row,
          data: JSON.parse(row.data || '{}')
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  }

  async deleteSession(sessionId) {
    try {
      await this.db.run(`
        DELETE FROM sessions WHERE session_id = ?
      `, [sessionId]);
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  // Gestionare bookings
  async saveBooking(sessionId, busNumber, passenger, route, departureDate, price) {
    try {
      const result = await this.db.run(`
        INSERT INTO bookings (session_id, bus_number, passenger, route, departure_date, price)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [sessionId, busNumber, passenger, route, departureDate, price]);
      
      return result.lastID;
    } catch (error) {
      console.error('Error saving booking:', error);
      throw error;
    }
  }

  async getBookings(sessionId) {
    try {
      const rows = await this.db.all(`
        SELECT * FROM bookings WHERE session_id = ? ORDER BY created_at DESC
      `, [sessionId]);
      
      return rows;
    } catch (error) {
      console.error('Error getting bookings:', error);
      throw error;
    }
  }

  async updateBookingStatus(bookingId, status) {
    try {
      await this.db.run(`
        UPDATE bookings SET status = ? WHERE id = ?
      `, [status, bookingId]);
    } catch (error) {
      console.error('Error updating booking status:', error);
      throw error;
    }
  }

  // Gestionare conversații
  async saveConversation(sessionId, agentType, message, response) {
    try {
      await this.db.run(`
        INSERT INTO conversations (session_id, agent_type, message, response)
        VALUES (?, ?, ?, ?)
      `, [sessionId, agentType, message, response]);
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }
  }

  async getConversationHistory(sessionId, limit = 10) {
    try {
      const rows = await this.db.all(`
        SELECT * FROM conversations 
        WHERE session_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [sessionId, limit]);
      
      return rows.reverse(); // Returnează în ordine cronologică
    } catch (error) {
      console.error('Error getting conversation history:', error);
      throw error;
    }
  }

  // Statistici
  async getStats() {
    try {
      const stats = await this.db.get(`
        SELECT 
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(*) as total_conversations,
          COUNT(DISTINCT CASE WHEN agent_type = 'BookingAgent' THEN session_id END) as booking_sessions,
          COUNT(DISTINCT CASE WHEN agent_type = 'SupportAgent' THEN session_id END) as support_sessions
        FROM conversations
      `);
      
      const bookingStats = await this.db.get(`
        SELECT 
          COUNT(*) as total_bookings,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
          AVG(price) as avg_price
        FROM bookings
      `);
      
      return { ...stats, ...bookingStats };
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }

  // Cleanup sesiuni vechi (opțional)
  async cleanupOldSessions(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      await this.db.run(`
        DELETE FROM sessions 
        WHERE updated_at < ?
      `, [cutoffDate.toISOString()]);
      
      console.log(`Cleaned up sessions older than ${daysOld} days`);
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      throw error;
    }
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

// Singleton instance
const database = new Database();

export default database; 