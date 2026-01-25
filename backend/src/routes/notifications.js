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

export default router;
