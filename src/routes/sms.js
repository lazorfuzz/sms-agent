import { logger } from '../config/config.js';
import { buildHistory, pushToLog } from '../services/chatHistory.js';
import { getAIResponse } from '../services/aiService.js';
import { sendSMS } from '../services/twilioService.js';

export async function handleSMS(req, res) {
  try {
    const {
      Body = '',
      From,
      To,
      ConversationSid,
      GroupSid
    } = req.body;

    if (!From || !To) {
      logger.warn('Missing required fields in request', { From, To });
      return res.status(400).type('text/xml').send('<Response></Response>');
    }

    const isGroup = Boolean(ConversationSid || GroupSid);
    const chatId = isGroup ? (ConversationSid || GroupSid) : From;
    const prefixRe = /^samanthaai[:,]?\s*/i;

    // Check if we should engage in group chats
    if (isGroup && !prefixRe.test(Body)) {
      return res.type('text/xml').send('<Response></Response>');
    }

    // Process user message
    const userMsg = (isGroup ? Body.replace(prefixRe, '') : Body).trim() || 'Hello!';
    logger.info('Processing message', { chatId, userMsg });

    // Get chat history and AI response
    const history = buildHistory(chatId);
    const aiText = await getAIResponse(history, userMsg);

    // Update chat history
    pushToLog(chatId, { role: 'user', content: userMsg });
    pushToLog(chatId, { role: 'assistant', content: aiText });

    // Send response
    await sendSMS(From, aiText);

    // Acknowledge Twilio
    res.type('text/xml').send('<Response></Response>');
  } catch (error) {
    logger.error('Unexpected error in /sms endpoint', { error });
    res.status(500).type('text/xml').send('<Response></Response>');
  }
} 