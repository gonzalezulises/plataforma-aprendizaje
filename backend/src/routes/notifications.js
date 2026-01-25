import express from 'express';
import { queryAll, queryOne, run, getDatabase, saveDatabase } from '../config/database.js';

const router = express.Router();

// Ensure notifications table exists
function ensureNotificationsTable() {
  try {
    const db = getDatabase();

    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        content TEXT DEFAULT '{}',
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read)`);

    saveDatabase();
    console.log('Notifications table initialized');
  } catch (error) {
    console.error('Error initializing notifications table:', error);
  }
}

// Initialize tables when module loads
setTimeout(ensureNotificationsTable, 1200);

/**
 * Get all notifications for the current user
 */
router.get('/', (req, res) => {
  try {
    const userId = req.session?.user?.id || 'test-user';
    const notifications = queryAll(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    // Parse content JSON
    const parsed = notifications.map(n => ({
      ...n,
      content: JSON.parse(n.content || '{}')
    }));

    res.json({ notifications: parsed });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * Get unread notifications count
 */
router.get('/unread/count', (req, res) => {
  try {
    const userId = req.session?.user?.id || 'test-user';
    const result = queryOne(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    res.json({ count: result?.count || 0 });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * Mark a notification as read
 */
router.put('/:id/read', (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.session?.user?.id || 'test-user';

    // Verify the notification belongs to this user
    const notification = queryOne(
      `SELECT * FROM notifications WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [notificationId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * Mark all notifications as read for current user
 */
router.put('/read-all', (req, res) => {
  try {
    const userId = req.session?.user?.id || 'test-user';

    run(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * Create a new notification (for testing and internal use)
 */
router.post('/create', (req, res) => {
  try {
    const userId = req.session?.user?.id || 'test-user';
    const { type, title, message, content } = req.body;

    if (!type || !title) {
      return res.status(400).json({ error: 'type and title are required' });
    }

    const result = run(
      `INSERT INTO notifications (user_id, type, title, message, content, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`,
      [userId, type, title, message || '', JSON.stringify(content || {})]
    );

    res.status(201).json({
      success: true,
      notification: {
        id: result.lastInsertRowid,
        user_id: userId,
        type,
        title,
        message,
        content: content || {},
        is_read: 0
      }
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

/**
 * Delete a notification
 */
router.delete('/:id', (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.session?.user?.id || 'test-user';

    // Verify the notification belongs to this user
    const notification = queryOne(
      `SELECT * FROM notifications WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    run(`DELETE FROM notifications WHERE id = ?`, [notificationId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * Default notification preferences for new users (Feature #175)
 * Email notifications are ON by default as per sensible defaults
 */
function getDefaultNotificationPreferences() {
  return {
    notifications: {
      email_new_course: true,
      email_enrollment_confirmed: true,
      email_feedback_received: true,
      email_webinar_reminder: true,
      email_weekly_progress: true,
      email_forum_replies: true
    }
  };
}

/**
 * GET /api/notifications/preferences
 * Get notification preferences for the current user (Feature #175)
 */
router.get('/preferences', (req, res) => {
  try {
    if (!req.session?.isAuthenticated || !req.session?.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = req.session.user.id;
    const user = queryOne('SELECT preferences FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Parse existing preferences or use defaults
    let preferences = {};
    try {
      preferences = user.preferences ? JSON.parse(user.preferences) : {};
    } catch (e) {
      preferences = {};
    }

    // If no notification preferences exist, return defaults
    if (!preferences.notifications) {
      preferences = getDefaultNotificationPreferences();
    }

    console.log('[Notifications] Getting preferences for user', userId, ':', preferences);
    res.json({ success: true, preferences: preferences.notifications });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Error al obtener preferencias de notificacion' });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update notification preferences for the current user (Feature #175)
 */
router.put('/preferences', (req, res) => {
  try {
    if (!req.session?.isAuthenticated || !req.session?.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = req.session.user.id;
    const newNotificationPrefs = req.body;

    const validKeys = [
      'email_new_course',
      'email_enrollment_confirmed',
      'email_feedback_received',
      'email_webinar_reminder',
      'email_weekly_progress',
      'email_forum_replies'
    ];

    const user = queryOne('SELECT preferences FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    let existingPrefs = {};
    try {
      existingPrefs = user.preferences ? JSON.parse(user.preferences) : {};
    } catch (e) {
      existingPrefs = {};
    }

    const defaults = getDefaultNotificationPreferences().notifications;
    const updatedNotifications = { ...defaults };

    for (const key of validKeys) {
      if (typeof newNotificationPrefs[key] === 'boolean') {
        updatedNotifications[key] = newNotificationPrefs[key];
      }
    }

    existingPrefs.notifications = updatedNotifications;
    const preferencesJson = JSON.stringify(existingPrefs);

    run('UPDATE users SET preferences = ?, updated_at = datetime("now") WHERE id = ?',
      [preferencesJson, userId]);

    console.log('[Notifications] Updated preferences for user', userId, ':', updatedNotifications);
    res.json({
      success: true,
      message: 'Preferencias actualizadas',
      preferences: updatedNotifications
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Error al actualizar preferencias de notificacion' });
  }
});

/**
 * POST /api/notifications/init-defaults
 * Initialize default notification preferences for a user (Feature #175)
 */
router.post('/init-defaults', (req, res) => {
  try {
    if (!req.session?.isAuthenticated || !req.session?.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = req.session.user.id;
    const user = queryOne('SELECT preferences FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    let existingPrefs = {};
    try {
      existingPrefs = user.preferences ? JSON.parse(user.preferences) : {};
    } catch (e) {
      existingPrefs = {};
    }

    if (!existingPrefs.notifications) {
      existingPrefs.notifications = getDefaultNotificationPreferences().notifications;
      const preferencesJson = JSON.stringify(existingPrefs);

      run('UPDATE users SET preferences = ?, updated_at = datetime("now") WHERE id = ?',
        [preferencesJson, userId]);

      console.log('[Notifications] Initialized default preferences for user', userId);
      res.json({
        success: true,
        message: 'Preferencias por defecto inicializadas',
        preferences: existingPrefs.notifications,
        initialized: true
      });
    } else {
      res.json({
        success: true,
        message: 'Preferencias ya existen',
        preferences: existingPrefs.notifications,
        initialized: false
      });
    }
  } catch (error) {
    console.error('Error initializing notification preferences:', error);
    res.status(500).json({ error: 'Error al inicializar preferencias' });
  }
});

// Export for use by other modules
export { getDefaultNotificationPreferences };

export default router;
