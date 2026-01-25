import express from 'express';
import { getDatabase, saveDatabase, queryAll, queryOne, run } from '../config/database.js';
import { emitThreadBroadcast } from '../utils/websocket-events.js';

const router = express.Router();

/**
 * Initialize forum tables
 */
export function initForumTables(db) {
  // Forum threads table
  db.run(`
    CREATE TABLE IF NOT EXISTS forum_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_resolved INTEGER NOT NULL DEFAULT 0,
      reply_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )
  `);

  // Forum replies table
  db.run(`
    CREATE TABLE IF NOT EXISTS forum_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      content TEXT NOT NULL,
      is_instructor_answer INTEGER NOT NULL DEFAULT 0,
      votes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE
    )
  `);

  // Reply votes table to track who voted
  db.run(`
    CREATE TABLE IF NOT EXISTS reply_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reply_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      vote_type TEXT NOT NULL DEFAULT 'upvote',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(reply_id, user_id),
      FOREIGN KEY (reply_id) REFERENCES forum_replies(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for faster lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_forum_threads_course ON forum_threads(course_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_forum_threads_user ON forum_threads(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_forum_replies_thread ON forum_replies(thread_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_reply_votes_reply ON reply_votes(reply_id)`);

  saveDatabase();
  console.log('Forum tables initialized');
}

/**
 * GET /api/forum/course/:courseId - Get all threads for a course
 */
router.get('/course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { resolved, sort = 'newest' } = req.query;

    let sql = `
      SELECT
        t.*,
        (SELECT COUNT(*) FROM forum_replies WHERE thread_id = t.id) as reply_count
      FROM forum_threads t
      WHERE t.course_id = ?
    `;
    const params = [courseId];

    // Filter by resolved status
    if (resolved !== undefined) {
      sql += ` AND t.is_resolved = ?`;
      params.push(resolved === 'true' ? 1 : 0);
    }

    // Sort order
    switch (sort) {
      case 'oldest':
        sql += ` ORDER BY t.created_at ASC`;
        break;
      case 'most_replies':
        sql += ` ORDER BY reply_count DESC, t.created_at DESC`;
        break;
      case 'unresolved':
        sql += ` ORDER BY t.is_resolved ASC, t.created_at DESC`;
        break;
      default: // newest
        sql += ` ORDER BY t.created_at DESC`;
    }

    const threads = queryAll(sql, params);

    res.json({
      success: true,
      threads,
      count: threads.length
    });
  } catch (error) {
    console.error('Error fetching forum threads:', error);
    res.status(500).json({ error: 'Failed to fetch forum threads' });
  }
});

/**
 * GET /api/forum/thread/:threadId - Get thread details with replies
 */
router.get('/thread/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;

    const thread = queryOne(`SELECT * FROM forum_threads WHERE id = ?`, [threadId]);

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const replies = queryAll(`
      SELECT r.*,
        (SELECT COUNT(*) FROM reply_votes WHERE reply_id = r.id AND vote_type = 'upvote') as upvotes
      FROM forum_replies r
      WHERE r.thread_id = ?
      ORDER BY r.is_instructor_answer DESC, r.votes DESC, r.created_at ASC
    `, [threadId]);

    res.json({
      success: true,
      thread,
      replies
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

/**
 * POST /api/forum/course/:courseId/thread - Create new thread
 */
router.post('/course/:courseId/thread', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, content, userId, userName } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Use session user or provided user
    const actualUserId = req.session?.user?.id || userId || 'anonymous';
    const actualUserName = req.session?.user?.name || userName || 'Usuario Anonimo';

    const now = new Date().toISOString();

    const result = run(`
      INSERT INTO forum_threads (course_id, user_id, user_name, title, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [courseId, actualUserId, actualUserName, title, content, now, now]);

    // Get the created thread
    const thread = queryOne(`SELECT * FROM forum_threads WHERE id = ?`, [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      thread,
      message: 'Thread created successfully'
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

/**
 * POST /api/forum/thread/:threadId/reply - Add reply to thread
 */
router.post('/thread/:threadId/reply', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { content, userId, userName, isInstructorAnswer = false } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Check thread exists
    const thread = queryOne(`SELECT * FROM forum_threads WHERE id = ?`, [threadId]);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const actualUserId = req.session?.user?.id || userId || 'anonymous';
    const actualUserName = req.session?.user?.name || userName || 'Usuario Anonimo';
    const isInstructor = isInstructorAnswer ? 1 : 0;

    const now = new Date().toISOString();

    const result = run(`
      INSERT INTO forum_replies (thread_id, user_id, user_name, content, is_instructor_answer, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [threadId, actualUserId, actualUserName, content, isInstructor, now, now]);

    // Update thread reply count and updated_at
    run(`
      UPDATE forum_threads
      SET reply_count = reply_count + 1, updated_at = ?
      WHERE id = ?
    `, [now, threadId]);

    // Get the created reply
    const reply = queryOne(`SELECT * FROM forum_replies WHERE id = ?`, [result.lastInsertRowid]);

    // Broadcast real-time update to all clients subscribed to this thread
    try {
      emitThreadBroadcast(threadId, {
        type: 'new_reply',
        threadId: parseInt(threadId),
        reply: reply
      });
    } catch (broadcastError) {
      console.error('WebSocket broadcast error:', broadcastError);
      // Don't fail the request if broadcast fails
    }

    res.status(201).json({
      success: true,
      reply,
      message: 'Reply added successfully'
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

/**
 * POST /api/forum/reply/:replyId/vote - Vote on a reply
 */
router.post('/reply/:replyId/vote', async (req, res) => {
  try {
    const { replyId } = req.params;
    const { userId, voteType = 'upvote' } = req.body;

    const actualUserId = req.session?.user?.id || userId || 'anonymous';

    // Check reply exists
    const reply = queryOne(`SELECT * FROM forum_replies WHERE id = ?`, [replyId]);
    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    // Check if user already voted
    const existingVote = queryOne(`
      SELECT * FROM reply_votes WHERE reply_id = ? AND user_id = ?
    `, [replyId, actualUserId]);

    const now = new Date().toISOString();

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Remove vote (toggle off)
        run(`DELETE FROM reply_votes WHERE id = ?`, [existingVote.id]);
        run(`UPDATE forum_replies SET votes = votes - 1 WHERE id = ?`, [replyId]);
        return res.json({ success: true, action: 'removed', message: 'Vote removed' });
      } else {
        // Change vote type (not commonly used, but supported)
        run(`UPDATE reply_votes SET vote_type = ? WHERE id = ?`, [voteType, existingVote.id]);
        return res.json({ success: true, action: 'changed', message: 'Vote changed' });
      }
    }

    // Add new vote
    run(`
      INSERT INTO reply_votes (reply_id, user_id, vote_type, created_at)
      VALUES (?, ?, ?, ?)
    `, [replyId, actualUserId, voteType, now]);

    run(`UPDATE forum_replies SET votes = votes + 1 WHERE id = ?`, [replyId]);

    // Get updated reply
    const updatedReply = queryOne(`SELECT * FROM forum_replies WHERE id = ?`, [replyId]);

    res.json({
      success: true,
      action: 'added',
      reply: updatedReply,
      message: 'Vote added successfully'
    });
  } catch (error) {
    console.error('Error voting on reply:', error);
    res.status(500).json({ error: 'Failed to vote on reply' });
  }
});

/**
 * PATCH /api/forum/thread/:threadId/resolve - Mark thread as resolved
 */
router.patch('/thread/:threadId/resolve', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { resolved = true } = req.body;

    const thread = queryOne(`SELECT * FROM forum_threads WHERE id = ?`, [threadId]);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const now = new Date().toISOString();
    run(`
      UPDATE forum_threads
      SET is_resolved = ?, updated_at = ?
      WHERE id = ?
    `, [resolved ? 1 : 0, now, threadId]);

    const updatedThread = queryOne(`SELECT * FROM forum_threads WHERE id = ?`, [threadId]);

    res.json({
      success: true,
      thread: updatedThread,
      message: resolved ? 'Thread marked as resolved' : 'Thread reopened'
    });
  } catch (error) {
    console.error('Error resolving thread:', error);
    res.status(500).json({ error: 'Failed to update thread status' });
  }
});

/**
 * DELETE /api/forum/thread/:threadId - Delete thread (admin/owner only)
 */
router.delete('/thread/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;

    const thread = queryOne(`SELECT * FROM forum_threads WHERE id = ?`, [threadId]);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Delete replies first (cascade should handle this but being explicit)
    run(`DELETE FROM forum_replies WHERE thread_id = ?`, [threadId]);
    run(`DELETE FROM forum_threads WHERE id = ?`, [threadId]);

    res.json({
      success: true,
      message: 'Thread deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting thread:', error);
    res.status(500).json({ error: 'Failed to delete thread' });
  }
});

/**
 * GET /api/forum/user/:userId/threads - Get threads by user
 */
router.get('/user/:userId/threads', async (req, res) => {
  try {
    const { userId } = req.params;

    const threads = queryAll(`
      SELECT t.*, c.title as course_title, c.slug as course_slug
      FROM forum_threads t
      LEFT JOIN courses c ON t.course_id = c.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      threads,
      count: threads.length
    });
  } catch (error) {
    console.error('Error fetching user threads:', error);
    res.status(500).json({ error: 'Failed to fetch user threads' });
  }
});

export default router;
