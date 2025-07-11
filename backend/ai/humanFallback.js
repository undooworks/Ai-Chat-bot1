import nodemailer from 'nodemailer';
import { WebSocketServer } from 'ws';

/**
 * Human Fallback System
 * Handles escalation from AI to human agents via multiple channels
 */
class HumanFallbackSystem {
    constructor(config = {}) {
        this.config = {
            telegram: config.telegram || {},
            whatsapp: config.whatatpp || {},
            email: config.email || {},
            webhook: config.webhook || {},
            escalationThreshold: config.escalationThreshold || 3,
            autoEscalate: config.autoEscalate || false,
            ...config
        };

        this.activeSessions = new Map();
        this.humanAgents = new Map();
        this.escalationQueue = [];
        this.isInitialized = false;
    }

    /**
     * Initialize all fallback channels
     */
    async init() {
        try {
            // Initialize Telegram
            // if (this.config.telegram.token) {
            //     await this.initTelegram();
            // }

            // Initialize WhatsApp (via API)
            // if (this.config.whatsapp.apiKey) {
            //     await this.initWhatsApp();
            // }

            // Initialize Email
            // if (this.config.email.host) {
            //     await this.initEmail();
            // }

            // Initialize WebSocket for real-time communication (optional)
            try {
                await this.initWebSocket();
            } catch (error) {
                console.warn('[HUMAN_FALLBACK] WebSocket initialization failed, continuing without WebSocket');
            }

            this.isInitialized = true;
            console.log('[HUMAN_FALLBACK] System initialized successfully');
        } catch (error) {
            console.error('[HUMAN_FALLBACK] Initialization failed:', error);
            // Don't throw error, just log and continue
            this.isInitialized = false;
        }
    }

    /**
     * Initialize Telegram bot for human agents
     */
    async initTelegram() {}

    /**
     * Initialize WhatsApp integration
     */
    async initWhatsApp() {}

    /**
     * Initialize email system
     */
    async initEmail() {}

    /**
     * Initialize WebSocket for real-time communication
     */
    async initWebSocket() {
        try {
            // Check if port is already in use
            const net = await import('net');
            const server = net.createServer();
            
            await new Promise((resolve, reject) => {
                server.listen(3003, () => {
                    server.close();
                    resolve();
                });
                
                server.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        console.warn('[HUMAN_FALLBACK] Port 3003 is in use, WebSocket server will not start');
                        resolve();
                    } else {
                        reject(err);
                    }
                });
            });
            
            // Only create WebSocket server if port is available
            this.wss = new WebSocketServer({ port: 3003 });
            
            this.wss.on('connection', (ws) => {
                console.log('[HUMAN_FALLBACK] WebSocket client connected');
                
                ws.on('message', (message) => {
                    try {
                        const data = JSON.parse(message);
                        this.handleWebSocketMessage(ws, data);
                    } catch (error) {
                        console.error('[HUMAN_FALLBACK] WebSocket message error:', error);
                    }
                });
                
                ws.on('close', () => {
                    console.log('[HUMAN_FALLBACK] WebSocket client disconnected');
                });
            });
            
            console.log('[HUMAN_FALLBACK] WebSocket server started on port 3003');
        } catch (error) {
            console.warn('[HUMAN_FALLBACK] WebSocket server failed to start:', error.message);
            // Don't throw error, continue without WebSocket
        }
    }

    /**
     * Check if escalation is needed
     */
    shouldEscalate(sessionId, message, aiResponse, context) {
        const session = this.activeSessions.get(sessionId) || {
            retryCount: 0,
            errorCount: 0,
            lastEscalation: null,
            messages: []
        };

        // Update session data
        session.messages.push({
            timestamp: new Date(),
            user: message,
            ai: aiResponse,
            context
        });

        // Check escalation criteria
        const criteria = {
            maxRetries: this.config.escalationThreshold,
            errorThreshold: 2,
            timeThreshold: 5 * 60 * 1000, // 5 minutes
            sentimentThreshold: -0.5, // Negative sentiment
            urgencyKeywords: ['urgent', 'emergency', 'help', 'broken', 'error']
        };

        // Check retry count
        if (session.retryCount >= criteria.maxRetries) {
            return { escalate: true, reason: 'max_retries' };
        }

        // Check error count
        if (session.errorCount >= criteria.errorThreshold) {
            return { escalate: true, reason: 'error_threshold' };
        }

        // Check for urgency keywords
        const urgencyFound = criteria.urgencyKeywords.some(keyword => 
            message.toLowerCase().includes(keyword)
        );
        if (urgencyFound) {
            return { escalate: true, reason: 'urgency_keywords' };
        }

        // Check sentiment (if available)
        if (context.sentiment && context.sentiment < criteria.sentimentThreshold) {
            return { escalate: true, reason: 'negative_sentiment' };
        }

        // Auto-escalate if enabled
        if (this.config.autoEscalate && session.messages.length > 10) {
            return { escalate: true, reason: 'auto_escalate' };
        }

        this.activeSessions.set(sessionId, session);
        return { escalate: false };
    }

    /**
     * Escalate to human agent
     */
    async escalateToHuman(sessionId, message, context, reason) {
        try {
            console.log(`[HUMAN_FALLBACK] Escalating session ${sessionId} to human agent. Reason: ${reason}`);

            // Create escalation ticket
            const escalation = {
                id: `ESC-${Date.now()}`,
                sessionId,
                timestamp: new Date(),
                reason,
                userMessage: message,
                context,
                status: 'pending',
                assignedAgent: null,
                channel: null
            };

            // Add to escalation queue
            this.escalationQueue.push(escalation);

            // Notify available human agents
            await this.notifyHumanAgents(escalation);

            // Send immediate response to user
            const immediateResponse = this.getImmediateResponse(reason);
            
            // Update session
            const session = this.activeSessions.get(sessionId) || {};
            session.lastEscalation = escalation;
            session.status = 'escalated';
            this.activeSessions.set(sessionId, escalation);

            return {
                success: true,
                escalationId: escalation.id,
                immediateResponse,
                estimatedWaitTime: this.getEstimatedWaitTime()
            };

        } catch (error) {
            console.error('[HUMAN_FALLBACK] Escalation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Notify human agents about new escalation
     */
    async notifyHumanAgents(escalation) {
        const notification = {
            type: 'escalation',
            escalation,
            priority: this.getPriority(escalation.reason),
            estimatedWaitTime: this.getEstimatedWaitTime()
        };

        // Notify via Telegram
        // if (this.telegramBot && this.config.telegram.agentChatIds) {
        //     for (const chatId of this.config.telegram.agentChatIds) {
        //         try {
        //             await this.telegramBot.sendMessage(chatId, this.formatTelegramNotification(notification));
        //         } catch (error) {
        //             console.error('[HUMAN_FALLBACK] Telegram notification failed:', error);
        //         }
        //     }
        // }

        // Notify via Email
        if (this.emailTransporter && this.config.email.agentEmails) {
            for (const email of this.config.email.agentEmails) {
                try {
                    await this.sendEmailNotification(email, notification);
                } catch (error) {
                    console.error('[HUMAN_FALLBACK] Email notification failed:', error);
                }
            }
        }

        // Notify via WebSocket
        if (this.wss) {
            this.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(notification));
                }
            });
        }
    }

    /**
     * Handle message from human agent
     */
    async handleHumanAgentMessage(channel, agentId, message) {
        try {
            // Find active escalation for this agent
            const escalation = this.escalationQueue.find(e => e.assignedAgent === agentId);
            if (!escalation) {
                return { success: false, error: 'No active escalation found' };
            }

            // Send message to user
            await this.sendMessageToUser(escalation.sessionId, message, channel);

            // Update escalation
            escalation.lastActivity = new Date();
            escalation.messages = escalation.messages || [];
            escalation.messages.push({
                timestamp: new Date(),
                agent: agentId,
                channel,
                message
            });

            return { success: true };

        } catch (error) {
            console.error('[HUMAN_FALLBACK] Error handling human agent message:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send message to user
     */
    async sendMessageToUser(sessionId, message, channel) {
        // This would integrate with your chat system
        // For now, we'll log the message
        console.log(`[HUMAN_FALLBACK] Sending to user ${sessionId}: ${message} (via ${channel})`);
        
        // In a real implementation, this would:
        // 1. Send message through the chat widget
        // 2. Update the conversation history
        // 3. Notify the user through their preferred channel
    }

    /**
     * Handle WebSocket messages
     */
    async handleWebSocketMessage(ws, message) {
        switch (message.type) {
            case 'agent_available':
                await this.handleAgentAvailable(ws, message);
                break;
            case 'agent_message':
                await this.handleHumanAgentMessage('websocket', message.agentId, message.message);
                break;
            case 'escalation_response':
                await this.handleEscalationResponse(message);
                break;
            default:
                console.warn('[HUMAN_FALLBACK] Unknown WebSocket message type:', message.type);
        }
    }

    /**
     * Handle agent available notification
     */
    async handleAgentAvailable(ws, message) {
        const agent = {
            id: message.agentId,
            name: message.name,
            skills: message.skills || [],
            availability: message.availability || 'available',
            ws
        };

        this.humanAgents.set(agent.id, agent);

        // Assign pending escalations
        const pendingEscalation = this.escalationQueue.find(e => e.status === 'pending');
        if (pendingEscalation) {
            await this.assignEscalation(pendingEscalation, agent);
        }
    }

    /**
     * Assign escalation to human agent
     */
    async assignEscalation(escalation, agent) {
        escalation.assignedAgent = agent.id;
        escalation.status = 'assigned';
        escalation.assignedAt = new Date();

        // Notify agent
        if (agent.ws && agent.ws.readyState === WebSocket.OPEN) {
            agent.ws.send(JSON.stringify({
                type: 'escalation_assigned',
                escalation
            }));
        }

        // Notify user
        await this.sendMessageToUser(escalation.sessionId, 
            `You've been connected to ${agent.name}. They'll be with you shortly.`, 
            'system'
        );
    }

    /**
     * Get immediate response for escalation
     */
    getImmediateResponse(reason) {
        const responses = {
            max_retries: "I'm having trouble understanding. Let me connect you to a human agent who can help better.",
            error_threshold: "I'm experiencing technical difficulties. A human agent will assist you shortly.",
            urgency_keywords: "I understand this is urgent. Let me connect you to a human agent immediately.",
            negative_sentiment: "I sense you're frustrated. Let me get a human agent to help you right away.",
            auto_escalate: "This conversation has been going on for a while. Let me connect you to a human agent for better assistance."
        };

        return responses[reason] || "I'm connecting you to a human agent who can help you better.";
    }

    /**
     * Get estimated wait time
     */
    getEstimatedWaitTime() {
        const activeAgents = Array.from(this.humanAgents.values())
            .filter(agent => agent.availability === 'available').length;
        
        const queueLength = this.escalationQueue.filter(e => e.status === 'pending').length;
        
        if (activeAgents === 0) return '5-10 minutes';
        if (queueLength === 0) return '1-2 minutes';
        if (queueLength <= activeAgents) return '2-3 minutes';
        return `${Math.ceil(queueLength / activeAgents)}-${Math.ceil(queueLength / activeAgents) + 2} minutes`;
    }

    /**
     * Get priority level
     */
    getPriority(reason) {
        const priorities = {
            urgency_keywords: 'high',
            negative_sentiment: 'medium',
            max_retries: 'medium',
            error_threshold: 'low',
            auto_escalate: 'low'
        };

        return priorities[reason] || 'medium';
    }

    /**
     * Format Telegram notification
     */
    formatTelegramNotification(notification) {
        const priorityEmoji = {
            high: '🔴',
            medium: '🟡',
            low: '🟢'
        };

        return `
${priorityEmoji[notification.priority]} *New Escalation*

*Session:* ${notification.escalation.sessionId}
*Reason:* ${notification.escalation.reason}
*Priority:* ${notification.priority}
*Wait Time:* ${notification.estimatedWaitTime}

*User Message:* ${notification.escalation.userMessage.substring(0, 100)}...

*Escalation ID:* ${notification.escalation.id}

Reply with /accept ${notification.escalation.id} to accept this escalation.
        `.trim();
    }

    /**
     * Send email notification
     */
    async sendEmailNotification(email, notification) {
        const mailOptions = {
            from: this.config.email.from,
            to: email,
            subject: `[${notification.priority.toUpperCase()}] New Escalation - ${notification.escalation.id}`,
            html: `
                <h2>New Escalation</h2>
                <p><strong>Session:</strong> ${notification.escalation.sessionId}</p>
                <p><strong>Reason:</strong> ${notification.escalation.reason}</p>
                <p><strong>Priority:</strong> ${notification.priority}</p>
                <p><strong>Estimated Wait:</strong> ${notification.estimatedWaitTime}</p>
                <p><strong>User Message:</strong> ${notification.escalation.userMessage}</p>
                <p><strong>Escalation ID:</strong> ${notification.escalation.id}</p>
            `
        };

        await this.emailTransporter.sendMail(mailOptions);
    }

    /**
     * Get system status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            activeSessions: this.activeSessions.size,
            escalationQueue: this.escalationQueue.length,
            humanAgents: this.humanAgents.size,
            availableAgents: Array.from(this.humanAgents.values())
                .filter(agent => agent.availability === 'available').length
        };
    }
}

export default HumanFallbackSystem; 