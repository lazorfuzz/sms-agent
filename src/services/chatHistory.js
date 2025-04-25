import NodeCache from 'node-cache';
import { logger } from '../config/config.js';

const MAX_TURNS = 20; // 20 messages ~= 10 full exchanges

const chatLogs = new NodeCache({ 
  stdTTL: 24 * 60 * 60, // 24 hours in seconds
  checkperiod: 60 * 60  // Check for expired entries every hour
});

export function pushToLog(id, entry) {
  try {
    const log = chatLogs.get(id) || [];
    log.push(entry);
    if (log.length > MAX_TURNS) log.splice(0, log.length - MAX_TURNS);
    chatLogs.set(id, log);
  } catch (error) {
    logger.error('Error pushing to chat log', { error, id });
  }
}

export function buildHistory(id) {
  try {
    return chatLogs.get(id) ?? [];
  } catch (error) {
    logger.error('Error building chat history', { error, id });
    return [];
  }
} 