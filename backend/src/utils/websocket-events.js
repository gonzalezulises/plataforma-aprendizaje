/**
 * WebSocket Event Bus
 * Allows routes to broadcast messages without importing the WebSocket server directly.
 * This avoids circular dependency issues.
 */

import { EventEmitter } from 'events';

// Create a global event emitter for WebSocket broadcasts
export const wsEventBus = new EventEmitter();

// Event types
export const WS_EVENTS = {
  FORUM_NEW_REPLY: 'forum:new_reply',
  FORUM_THREAD_RESOLVED: 'forum:thread_resolved',
  FORUM_VOTE_UPDATED: 'forum:vote_updated',
  NOTIFICATION_NEW: 'notification:new',
  BATCH_CONTENT_PROGRESS: 'batch_content_progress',
  BATCH_CONTENT_COMPLETE: 'batch_content_complete'
};

/**
 * Emit a broadcast event for a specific thread
 * @param {string|number} threadId - The thread ID to broadcast to
 * @param {object} message - The message to broadcast
 */
export function emitThreadBroadcast(threadId, message) {
  wsEventBus.emit('broadcast:thread', { threadId, message });
}

/**
 * Emit a broadcast event to all connected clients
 * @param {object} message - The message to broadcast
 */
export function emitGlobalBroadcast(message) {
  wsEventBus.emit('broadcast:global', message);
}
