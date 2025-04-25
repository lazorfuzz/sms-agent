import twilio from 'twilio';
import { config, logger } from '../config/config.js';

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

export async function sendSMS(to, body) {
  try {
    await twilioClient.messages.create({
      from: config.twilio.phoneNumber,
      to,
      body
    });
    logger.info('Message sent successfully', { to });
  } catch (error) {
    logger.error('Twilio send error', { error, to });
    throw error;
  }
} 