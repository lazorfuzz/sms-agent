import OpenAI from 'openai';
import { config, logger } from '../config/config.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export async function getAIResponse(history, userMessage) {
  const promptMessages = [
    { role: 'system', content: 'You are SamanthaAI, an SMS-friendly assistant.' },
    ...history,
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: promptMessages
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('OpenAI API error', { error });
    return 'Sorry, something went wrong 🤖';
  }
} 