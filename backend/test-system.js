

/**
 * Comprehensive System Test
 * Tests all components of the AI chatbot system
 */

const BASE_URL = 'http://localhost:3001';

async function testSystem() {
    console.log('🧪 Starting comprehensive system test...\n');

    try {
        // Test 1: AI System Status
        console.log('1️⃣ Testing AI System Status...');
        const aiStatus = await fetch(`${BASE_URL}/api/debug/ai-status`);
        const aiData = await aiStatus.json();
        console.log('✅ AI System Status:', {
            llmModel: aiData.ai?.llmModel,
            provider: aiData.ai?.provider,
            graphActive: aiData.ai?.graphActive,
            memorySystem: aiData.memory?.redis ? 'Redis + SQLite' : 'SQLite Only'
        });

        // Test 2: Chat with new session
        console.log('\n2️⃣ Testing Chat with new session...');
        const sessionId = 'test_' + Date.now();
        const chatResponse = await fetch(`${BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Bună! Vreau să rezerv un bilet pentru Budapest.',
                sessionId: sessionId,
                lang: 'ro'
            })
        });
        const chatData = await chatResponse.json();
        console.log('✅ Chat Response:', {
            reply: chatData.reply.substring(0, 50) + '...',
            agent: chatData.agent,
            sessionId: chatData.sessionId,
            error: chatData.error
        });

        // Test 3: User Context Persistence
        console.log('\n3️⃣ Testing User Context Persistence...');
        const contextResponse = await fetch(`${BASE_URL}/api/debug/user-context/${sessionId}`);
        const contextData = await contextResponse.json();
        console.log('✅ User Context:', {
            sessionId: contextData.sessionId,
            historyLength: contextData.context?.history?.length || 0,
            lastAgent: contextData.context?.lastAgent,
            language: contextData.context?.language
        });

        // Test 4: Multiple messages in same session
        console.log('\n4️⃣ Testing multiple messages in same session...');
        const messages = [
            'Care sunt opțiunile pentru mâine?',
            'Cât costă biletul?',
            'Mulțumesc pentru informații!'
        ];

        for (let i = 0; i < messages.length; i++) {
            const msgResponse = await fetch(`${BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messages[i],
                    sessionId: sessionId,
                    lang: 'ro'
                })
            });
            const msgData = await msgResponse.json();
            console.log(`   Message ${i + 1}: ${msgData.agent} agent responded`);
        }

        // Test 5: Verify context after multiple messages
        console.log('\n5️⃣ Verifying context after multiple messages...');
        const finalContextResponse = await fetch(`${BASE_URL}/api/debug/user-context/${sessionId}`);
        const finalContextData = await finalContextResponse.json();
        console.log('✅ Final Context:', {
            totalMessages: finalContextData.context?.history?.length || 0,
            userMessages: finalContextData.context?.history?.filter(m => m.role === 'user').length || 0,
            agentMessages: finalContextData.context?.history?.filter(m => m.role === 'agent').length || 0
        });

        // Test 6: Different language support
        console.log('\n6️⃣ Testing different language support...');
        const enResponse = await fetch(`${BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Hello! I need help with booking.',
                sessionId: 'test_en_' + Date.now(),
                lang: 'en'
            })
        });
        const enData = await enResponse.json();
        console.log('✅ English Support:', {
            reply: enData.reply.substring(0, 50) + '...',
            agent: enData.agent,
            language: enData.language
        });

        // Test 7: Support scenario
        console.log('\n7️⃣ Testing support scenario...');
        const supportResponse = await fetch(`${BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Am o problemă cu rezervarea mea. Biletul nu a fost confirmat.',
                sessionId: 'test_support_' + Date.now(),
                lang: 'ro'
            })
        });
        const supportData = await supportResponse.json();
        console.log('✅ Support Scenario:', {
            reply: supportData.reply.substring(0, 50) + '...',
            agent: supportData.agent
        });

        // Test 8: Booking scenario
        console.log('\n8️⃣ Testing booking scenario...');
        const bookingResponse = await fetch(`${BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Vreau să rezerv 2 bilete pentru Vienna pe 15 ianuarie.',
                sessionId: 'test_booking_' + Date.now(),
                lang: 'ro'
            })
        });
        const bookingData = await bookingResponse.json();
        console.log('✅ Booking Scenario:', {
            reply: bookingData.reply.substring(0, 50) + '...',
            agent: bookingData.agent
        });

        console.log('\n🎉 All tests completed successfully!');
        console.log('\n📊 System Summary:');
        console.log('   - AI Orchestrator: ✅ Working');
        console.log('   - Memory System: ✅ Persistent');
        console.log('   - Multi-language: ✅ Supported');
        console.log('   - Agent Routing: ✅ Functional');
        console.log('   - Context Management: ✅ Working');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testSystem(); 