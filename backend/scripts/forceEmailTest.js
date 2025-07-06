import { emailService } from '../utils/emailService.js';
import dotenv from 'dotenv';

// Încarcă variabilele de mediu
dotenv.config();

console.log('🧪 Forcing Email Test...\n');

// Verifică variabilele de mediu
console.log('Environment variables:');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET');
console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL ? 'SET' : 'NOT SET');
console.log('');

// Test 1: Status serviciu
console.log('1. Email service status:');
const status = emailService.getStatus();
console.log(status);
console.log('');

// Test 2: Încearcă să trimiți un email de test
console.log('2. Attempting to send test email...');
try {
    const testData = {
        date: new Date().toLocaleDateString(),
        totalConversations: 150,
        totalBookings: 25,
        totalSupport: 10,
        totalFallbacks: 5,
        averageResponseTime: 1200,
        topAgents: [
            { name: 'booking', count: 15 },
            { name: 'support', count: 8 },
            { name: 'greeting', count: 12 }
        ],
        errors: [
            { type: 'LangChain', message: 'agent_scratchpad missing' },
            { type: 'Email', message: 'SMTP connection failed' }
        ]
    };

    const result = await emailService.sendDailyReport(testData);
    console.log('✅ Email test completed successfully!');
    console.log('Result:', result);
    
} catch (error) {
    console.log('❌ Email test failed:');
    console.error(error);
}

// Test 3: Forțează fallback
console.log('\n3. Testing fallback email...');
try {
    await emailService.sendFallbackEmail(
        'test@example.com',
        'Test Fallback Email',
        'This is a test fallback email content'
    );
    console.log('✅ Fallback email test completed!');
} catch (error) {
    console.log('❌ Fallback email test failed:');
    console.error(error);
}

console.log('\n�� Test completed!'); 