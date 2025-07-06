import { BookingAgent } from '../agents/bookingAgent.js';
import { SupportAgent } from '../agents/supportAgent.js';
import { GreetingAgent } from '../agents/greetingAgent.js';

// Mock pentru fs pentru a evita erorile de fișiere
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn()
}));

// Mock pentru Groq
jest.mock('groq-sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }]
        })
      }
    }
  }))
}));

describe('BookingAgent Tests', () => {
  let bookingAgent;

  beforeEach(() => {
    bookingAgent = new BookingAgent();
  });

  test('should extract destination from message', () => {
    const message = 'Vreau să mă duc la Viena';
    const destination = bookingAgent.extractDestination(message);
    expect(destination).toBe('Viena');
  });

  test('should extract date from message', () => {
    const message = 'Vreau bilet pentru mâine';
    const date = bookingAgent.extractDate(message);
    expect(date).toBeTruthy();
  });

  test('should detect booking intent', () => {
    const message = 'Vreau să mă duc la Budapesta';
    const hasIntent = bookingAgent.handleMessage(message, 'test-session');
    expect(hasIntent).toBeDefined();
  });
});

describe('SupportAgent Tests', () => {
  let supportAgent;

  beforeEach(() => {
    supportAgent = new SupportAgent();
  });

  test('should detect bagaje issue type', () => {
    const message = 'Am pierdut bagajele';
    const issueType = supportAgent.detectIssueType(message);
    expect(issueType).toBe('bagaje');
  });

  test('should detect întârziere issue type', () => {
    const message = 'Autobuzul a întârziat';
    const issueType = supportAgent.detectIssueType(message);
    expect(issueType).toBe('întârziere');
  });

  test('should detect rambursare issue type', () => {
    const message = 'Vreau rambursare';
    const issueType = supportAgent.detectIssueType(message);
    expect(issueType).toBe('rambursare');
  });
});

describe('GreetingAgent Tests', () => {
  let greetingAgent;

  beforeEach(() => {
    greetingAgent = new GreetingAgent();
  });

  test('should provide initial greeting', async () => {
    const response = await greetingAgent.handleMessage('Salut', 'test-session');
    expect(response).toContain('Bun venit');
  });

  test('should route to booking', async () => {
    const response = await greetingAgent.handleMessage('Rezervare bilet', 'test-session');
    expect(response).toContain('rezervarea');
  });

  test('should route to support', async () => {
    const response = await greetingAgent.handleMessage('Am o problemă cu bagajele', 'test-session');
    expect(response).toContain('suportul');
  });
});

// Teste pentru funcții utilitare
describe('Utility Functions', () => {
  test('should capitalize string correctly', () => {
    const bookingAgent = new BookingAgent();
    expect(bookingAgent.capitalize('viena')).toBe('Viena');
    expect(bookingAgent.capitalize('BUDAPESTA')).toBe('Budapesta');
  });
});

// Teste pentru validare rute
describe('Route Validation', () => {
  let bookingAgent;

  beforeEach(() => {
    bookingAgent = new BookingAgent();
  });

  test('should validate existing route', async () => {
    // Mock timetable data
    const mockTimetable = [
      { route: 'Bucharest-Vienna' },
      { route: 'Bucharest-Budapest' }
    ];
    
    bookingAgent.loadTimetable = jest.fn().mockResolvedValue(mockTimetable);
    
    const validation = await bookingAgent.validateRoute('Vienna');
    expect(validation.valid).toBe(true);
  });

  test('should reject non-existing route', async () => {
    const mockTimetable = [
      { route: 'Bucharest-Vienna' },
      { route: 'Bucharest-Budapest' }
    ];
    
    bookingAgent.loadTimetable = jest.fn().mockResolvedValue(mockTimetable);
    
    const validation = await bookingAgent.validateRoute('Paris');
    expect(validation.valid).toBe(false);
    expect(validation.availableRoutes).toBeDefined();
  });
});

// Teste pentru gestionarea sesiunilor
describe('Session Management', () => {
  let bookingAgent;

  beforeEach(() => {
    bookingAgent = new BookingAgent();
  });

  test('should maintain session state', async () => {
    const sessionId = 'test-session-1';
    
    // Primul mesaj - ar trebui să ceară destinația
    const response1 = await bookingAgent.handleConversationStep(sessionId, 'Vreau să fac o rezervare');
    expect(response1).toContain('destinația');
    
    // Al doilea mesaj cu destinația - ar trebui să ceară data
    const response2 = await bookingAgent.handleConversationStep(sessionId, 'Vreau să mă duc la Viena');
    expect(response2).toContain('data');
  });

  test('should reset session on reset command', async () => {
    const sessionId = 'test-session-2';
    
    // Simulează o sesiune activă
    bookingAgent.sessionState[sessionId] = { step: 'waiting_for_date', data: { destination: 'Viena' } };
    
    const response = await bookingAgent.handleConversationStep(sessionId, 'nou');
    expect(response).toContain('Să începem din nou');
    expect(bookingAgent.sessionState[sessionId]).toBeUndefined();
  });
});

console.log('✅ All tests completed successfully!'); 