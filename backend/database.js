import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'data', 'chatbot.db');

class ChatDatabase {
  constructor() {
    this.db = null;
  }

  async init() {
    try {
      this.db = new Database(dbPath);

      // Creează tabelele dacă nu există
      this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  createTables() {
    // Tabel pentru sesiuni
    this.db.exec(`
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
    this.db.exec(`
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
    this.db.exec(`
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
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions (agent_type);
      CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings (session_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations (session_id);
    `);
  }

  // Gestionare sesiuni
  saveSession(sessionId, agentType, step, data = {}) {
    try {
      const dataJson = JSON.stringify(data);
      this.db.prepare(`
        INSERT OR REPLACE INTO sessions (session_id, agent_type, step, data, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(sessionId, agentType, step, dataJson);
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  }

  getSession(sessionId) {
    try {
      const row = this.db.prepare(`
        SELECT * FROM sessions WHERE session_id = ?
      `).get(sessionId);
      
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

  deleteSession(sessionId) {
    try {
      this.db.prepare(`
        DELETE FROM sessions WHERE session_id = ?
      `).run(sessionId);
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  // Gestionare bookings
  saveBooking(sessionId, busNumber, passenger, route, departureDate, price) {
    try {
      const result = this.db.prepare(`
        INSERT INTO bookings (session_id, bus_number, passenger, route, departure_date, price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sessionId, busNumber, passenger, route, departureDate, price);
      
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error saving booking:', error);
      throw error;
    }
  }

  getBookings(sessionId) {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM bookings WHERE session_id = ? ORDER BY created_at DESC
      `).all(sessionId);
      
      return rows;
    } catch (error) {
      console.error('Error getting bookings:', error);
      throw error;
    }
  }

  updateBookingStatus(bookingId, status) {
    try {
      this.db.prepare(`
        UPDATE bookings SET status = ? WHERE id = ?
      `).run(status, bookingId);
    } catch (error) {
      console.error('Error updating booking status:', error);
      throw error;
    }
  }

  // Gestionare conversații
  saveConversation(sessionId, agentType, message, response) {
    try {
      this.db.prepare(`
        INSERT INTO conversations (session_id, agent_type, message, response)
        VALUES (?, ?, ?, ?)
      `).run(sessionId, agentType, message, response);
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }
  }

  getConversationHistory(sessionId, limit = 10) {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM conversations 
        WHERE session_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `).all(sessionId, limit);
      
      return rows.reverse(); // Returnează în ordine cronologică
    } catch (error) {
      console.error('Error getting conversation history:', error);
      throw error;
    }
  }

  // Statistici
  getStats() {
    try {
      const stats = this.db.prepare(`
        SELECT 
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(*) as total_conversations,
          COUNT(DISTINCT CASE WHEN agent_type = 'BookingAgent' THEN session_id END) as booking_sessions,
          COUNT(DISTINCT CASE WHEN agent_type = 'SupportAgent' THEN session_id END) as support_sessions
        FROM conversations
      `).get();
      
      const bookingStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_bookings,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
          AVG(price) as avg_price
        FROM bookings
      `).get();
      
      return { ...stats, ...bookingStats };
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }

  // Cleanup sesiuni vechi (opțional)
  cleanupOldSessions(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      this.db.prepare(`
        DELETE FROM sessions 
        WHERE updated_at < ?
      `).run(cutoffDate.toISOString());
      
      console.log(`Cleaned up sessions older than ${daysOld} days`);
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      throw error;
    }
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

// Singleton instance
const database = new ChatDatabase();

export default database; 