

(async () => {
  console.log('=== TESTING CHAT ENDPOINT ===');
  const url = 'http://localhost:3000/chat';
  const body = {
    message: 'Test persistență context din script Node',
    sessionId: 'test-node-script',
    lang: 'ro'
  };
  console.log('📤 Sending message:', body);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    console.log('✅ Response received:');
    console.log(data);
  } catch (err) {
    console.error('❌ Error testing chat endpoint:', err);
  }
})(); 