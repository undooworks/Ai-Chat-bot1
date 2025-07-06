import express from 'express';
import path from 'path';

const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(process.cwd(), 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// Simple chat endpoint
app.post('/chat', (req, res) => {
  const { message } = req.body;
  res.json({ 
    reply: `Test response: ${message}`,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📄 Frontend: http://localhost:${PORT}`);
  console.log(`🔧 Test API: http://localhost:${PORT}/test`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
}); 