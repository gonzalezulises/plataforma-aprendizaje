/**
 * Audit Logger Utility
 * Feature #40: Sensitive operations log audit trail
 *
 * Logs critical actions to the analytics_events table for security auditing.
 * Records user ID, event type, metadata, and timestamp.
 */

import { run } from '../config/database.js';

// Audit event types for sensitive operations
export const AUDIT_EVENTS = {
  // Account-related events
  PROFILE_UPDATED: 'audit:profile_updated',
  ACCOUNT_DELETION_REQUESTED: 'audit:account_deletion_requested',
  ACCOUNT_DELETION_CONFIRMED: 'audit:account_deletion_confirmed',
  ACCOUNT_DELETION_CANCELLED: 'audit:account_deletion_cancelled',
  USER_DELETED: 'audit:user_deleted',

  // Course management events
  COURSE_CREATED: 'audit:course_created',
  COURSE_UPDATED: 'audit:course_updated',
  COURSE_DELETED: 'audit:course_deleted',

  // Module management events
  MODULE_CREATED: 'audit:module_created',
  MODULE_UPDATED: 'audit:module_updated',
  MODULE_DELETED: 'audit:module_deleted',

  // Lesson management events
  LESSON_CREATED: 'audit:lesson_created',
  LESSON_UPDATED: 'audit:lesson_updated',
  LESSON_DELETED: 'audit:lesson_deleted',

  // Authentication events
  LOGIN_SUCCESS: 'audit:login_success',
  LOGOUT: 'audit:logout',
  SESSION_EXPIRED: 'audit:session_expired',

  // Premium/payment events
  UPGRADE_TO_PREMIUM: 'audit:upgrade_to_premium',
  PAYMENT_COMPLETED: 'audit:payment_completed',

  // Feedback/submission events
  FEEDBACK_CREATED: 'audit:feedback_created',
  FEEDBACK_UPDATED: 'audit:feedback_updated',

  // Forum moderation events
  FORUM_THREAD_DELETED: 'audit:forum_thread_deleted',
  FORUM_REPLY_DELETED: 'audit:forum_reply_deleted',
  FORUM_THREAD_EDITED: 'audit:forum_thread_edited',
  FORUM_REPLY_EDITED: 'audit:forum_reply_edited',

  // Webinar events
  WEBINAR_CREATED: 'audit:webinar_created',
  WEBINAR_UPDATED: 'audit:webinar_updated',
  WEBINAR_DELETED: 'audit:webinar_deleted',

  // Certificate events
  CERTIFICATE_ISSUED: 'audit:certificate_issued',

  // Role changes
  USER_ROLE_CHANGED: 'audit:user_role_changed'
};

/**
 * Log an audit event to the analytics_events table
 *
 * @param {number} userId - The ID of the user performing the action (or being affected)
 * @param {string} eventType - The type of audit event (use AUDIT_EVENTS constants)
 * @param {object} metadata - Additional details about the event
 * @param {string} [metadata.ip] - IP address of the request
 * @param {string} [metadata.userAgent] - User agent of the request
 * @param {number} [metadata.targetUserId] - ID of user being affected (for admin actions)
 * @param {number} [metadata.courseId] - Related course ID
 * @param {number} [metadata.moduleId] - Related module ID
 * @param {number} [metadata.lessonId] - Related lesson ID
 * @param {string} [metadata.action] - Description of the action
 * @param {object} [metadata.before] - State before the action
 * @param {object} [metadata.after] - State after the action
 * @returns {object} Result with success status and event ID
 */
export function logAuditEvent(userId, eventType, metadata = {}) {
  try {
    const now = new Date().toISOString();

    // Add timestamp to metadata
    const auditMetadata = {
      ...metadata,
      timestamp: now,
      isAuditEvent: true
    };

    // Insert into analytics_events table
    const result = run(
      `INSERT INTO analytics_events (user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?)`,
      [userId, eventType, JSON.stringify(auditMetadata), now]
    );

    console.log(`[AUDIT] ${eventType} - User ${userId} - ${metadata.action || 'Action performed'}`);

    return { success: true, eventId: result.lastInsertRowid };
  } catch (error) {
    console.error('[AUDIT] Failed to log audit event:', error);
    // Don't throw - audit logging should not break the main operation
    return { success: false, error: error.message };
  }
}

/**
 * Create an audit logger middleware that can be attached to express requests
 * Extracts IP and user agent automatically
 *
 * @param {object} req - Express request object
 * @returns {function} Logger function with request context
 */
export function createRequestLogger(req) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const userAgent = req.headers?.['user-agent'] || 'unknown';
  const userId = req.session?.user?.id;

  return function log(eventType, additionalMetadata = {}) {
    if (!userId) {
      console.warn('[AUDIT] Cannot log event without authenticated user');
      return { success: false, error: 'No authenticated user' };
    }

    return logAuditEvent(userId, eventType, {
      ip,
      userAgent,
      ...additionalMetadata
    });
  };
}

/**
 * Helper to get audit trail for a specific user
 * (For admin/instructor use)
 *
 * @param {number} userId - User ID to get audit trail for
 * @param {number} limit - Maximum number of events to return
 * @returns {array} Array of audit events
 */
export function getAuditTrail(userId, limit = 100) {
  const { queryAll } = require('../config/database.js');

  try {
    const events = queryAll(
      `SELECT * FROM analytics_events
       WHERE user_id = ? AND event_type LIKE 'audit:%'
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );

    return events.map(e => ({
      ...e,
      metadata: e.metadata ? JSON.parse(e.metadata) : {}
    }));
  } catch (error) {
    console.error('[AUDIT] Failed to get audit trail:', error);
    return [];
  }
}

export default {
  logAuditEvent,
  createRequestLogger,
  getAuditTrail,
  AUDIT_EVENTS
};
