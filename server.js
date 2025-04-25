// server.js  –  multi-turn edition
import express from 'express';
import bodyParser from 'body-parser';
import twilio from 'twilio';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';
import winston from 'winston';

dotenv.config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

/* ---- ENV ---- */
const {
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER, OPENAI_API_KEY,
  PORT = 3000
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER || !OPENAI_API_KEY) {
  logger.error('Missing required environment variables');
  process.exit(1);
}

/* ---- SDK clients ---- */
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const openai       = new OpenAI({ apiKey: OPENAI_API_KEY });

/* ---- Simple in-memory history ---- */
const chatLogs = new NodeCache({ 
  stdTTL: 24 * 60 * 60, // 24 hours in seconds
  checkperiod: 60 * 60  // Check for expired entries every hour
});
const MAX_TURNS = 20;           // 20 messages ~= 10 full exchanges

function pushToLog(id, entry) {
  try {
    const log = chatLogs.get(id) || [];
    log.push(entry);
    if (log.length > MAX_TURNS) log.splice(0, log.length - MAX_TURNS);
    chatLogs.set(id, log);
  } catch (error) {
    logger.error('Error pushing to chat log', { error, id });
  }
}

function buildHistory(id) {
  try {
    return chatLogs.get(id) ?? [];
  } catch (error) {
    logger.error('Error building chat history', { error, id });
    return [];
  }
}

/* ---- Express setup ---- */
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/sms', async (req, res) => {
  try {
    const {
      Body = '', From, To,
      ConversationSid, GroupSid
    } = req.body;

    if (!From || !To) {
      logger.warn('Missing required fields in request', { From, To });
      return res.status(400).type('text/xml').send('<Response></Response>');
    }

    const isGroup  = Boolean(ConversationSid || GroupSid);
    const chatId   = isGroup ? (ConversationSid || GroupSid) : From;
    const prefixRe = /^samanthaai[:,]?\s*/i;

    /* 1. Should we engage? */
    if (isGroup && !prefixRe.test(Body)) {
      return res.type('text/xml').send('<Response></Response>');
    }

    /* 2. Current user message */
    const userMsg = (isGroup ? Body.replace(prefixRe, '') : Body).trim() || 'Hello!';
    logger.info('Processing message', { chatId, userMsg });

    /* 3. Compose full context */
    const history = buildHistory(chatId);
    const promptMessages = [
      { role: 'system', content: 'You are SamanthaAI, an SMS-friendly assistant.' },
      ...history,
      { role: 'user',   content: userMsg }
    ];

    /* 4. Ask OpenAI */
    let aiText = 'Sorry, something went wrong 🤖';
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: promptMessages
      });
      aiText = resp.choices[0].message.content.trim();
    } catch (error) {
      logger.error('OpenAI API error', { error });
    }

    /* 5. Persist both sides of the exchange */
    pushToLog(chatId, { role: 'user', content: userMsg });
    pushToLog(chatId, { role: 'assistant', content: aiText });

    /* 6. Send SMS reply */
    try {
      await twilioClient.messages.create({
        from: TWILIO_PHONE_NUMBER || To,
        to:   From,
        body: aiText
      });
      logger.info('Message sent successfully', { to: From });
    } catch (error) {
      logger.error('Twilio send error', { error, to: From });
    }

    /* 7. Ack Twilio */
    res.type('text/xml').send('<Response></Response>');
  } catch (error) {
    logger.error('Unexpected error in /sms endpoint', { error });
    res.status(500).type('text/xml').send('<Response></Response>');
  }
});

const server = app.listen(PORT, () => {
  logger.info(`🚀 SamanthaAI listening on :${PORT}`);
});

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