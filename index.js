import 'dotenv/config';
import express from 'express';
import { initWhatsApp, getWhatsAppInstance } from './src/bot/whatsapp.js';
import routes from './src/api/routes.js';
import logger from './src/utils/logger.js';
import config from './src/config/config.js';

const app = express();

// Middleware
// app.use(cors()); // Cors removed as it was not imported/installed
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve frontend

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// API Routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        message: 'WhatsApp Channel Bot API',
        version: '1.0.0'
    });
});

// Error handling
app.use((err, req, res, next) => {
    logger.error('Error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// Start server
const startServer = async () => {
    try {
        // Initialize WhatsApp connection
        logger.info('Initializing WhatsApp connection...');
        await initWhatsApp();

        // Start Express server
        app.listen(config.port, () => {
            logger.info(`Server running on port ${config.port}`);
            logger.info(`Environment: ${config.nodeEnv}`);
            logger.info('\nAPI Endpoints:');
            logger.info(`  GET  http://localhost:${config.port}/api/status`);
            logger.info(`  GET  http://localhost:${config.port}/api/channels`);
            logger.info(`  POST http://localhost:${config.port}/api/send`);
            logger.info(`  POST http://localhost:${config.port}/api/send-image`);
            logger.info('\nScan the QR code above to connect WhatsApp');
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Shutting down gracefully...');
    process.exit(0);
});

// Start the application
startServer();