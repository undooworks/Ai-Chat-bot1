

async function testMessage(message, sessionId = 'test-session') {
  try {
    console.log(`\n=== TESTING: "${message}" ===`);
    console.log(`Session ID: ${sessionId}`);
    
    const response = await fetch('http://localhost:3001/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        sessionId: sessionId
      })
    });

    const data = await response.json();
    console.log('Response:', data.reply);
    console.log('Status:', response.status);
    
    return data;
  } catch (error) {
    console.error('Error testing message:', error.message);
    return null;
  }
}

async function runTest() {
  console.log('Starting Stuttgart test...');
  
  // Test 1: Primul mesaj - ar trebui să primească greeting
  await testMessage('vreau să mă duc la stutgart', 'test-stutgart-1');
  
  // Test 2: După greeting, încerc din nou
  await testMessage('vreau să mă duc la stutgart', 'test-stutgart-1');
  
  // Test 3: Cu un session nou, dar cu cuvinte cheie
  await testMessage('rezervare bilet stutgart', 'test-stutgart-2');
  
  // Test 4: Cu un session nou, direct cu intenția
  await testMessage('vreau să mă duc la stutgart', 'test-stutgart-3');
}

runTest().catch(console.error); 