export default {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // WhatsApp configuration
    whatsapp: {
        sessionPath: 'auth_info',
        reconnectInterval: 3000,
        maxReconnectAttempts: 10
    },

    // API configuration
    api: {
        rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
        rateLimitMaxRequests: 100
    }
};