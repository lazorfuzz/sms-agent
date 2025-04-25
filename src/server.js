import express from 'express';
import bodyParser from 'body-parser';
import { config, logger } from './config/config.js';
import { handleSMS } from './routes/sms.js';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Routes
app.post('/sms', handleSMS);

// Start server
const server = app.listen(config.port, () => {
  logger.info(`🚀 SamanthaAI listening on :${config.port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}); 