import express from 'express';
import { queryOne, queryAll, run, getDatabase, saveDatabase } from '../config/database.js';

const router = express.Router();

// Feature #74: Initialize lesson comments tables
export function initLessonCommentsTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      parent_id INTEGER,
      votes INTEGER NOT NULL DEFAULT 0,
      is_instructor_answer INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson ON lesson_comments(lesson_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lesson_comments_user ON lesson_comments(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lesson_comments_parent ON lesson_comments(parent_id)`);
  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_comment_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(comment_id, user_id)
    )
  `);
  saveDatabase();
  console.log('[Lesson Comments] Tables initialized');
}

/**
 * GET /api/lesson-comments/:lessonId
 * Get all comments for a lesson
 */
router.get('/:lessonId', (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.session?.user?.id;

    // Get all comments for this lesson with author info
    const comments = queryAll(`
      SELECT
        lc.*,
        u.name as author_name,
        u.avatar_url as author_avatar,
        u.role as author_role
      FROM lesson_comments lc
      LEFT JOIN users u ON lc.user_id = u.id
      WHERE lc.lesson_id = ?
      ORDER BY lc.is_instructor_answer DESC, lc.votes DESC, lc.created_at DESC
    `, [lessonId]);

    // Check if user has voted on each comment
    const commentsWithVotes = comments.map(comment => {
      let userVoted = false;
      if (userId) {
        const vote = queryOne(`
          SELECT id FROM lesson_comment_votes
          WHERE comment_id = ? AND user_id = ?
        `, [comment.id, userId]);
        userVoted = !!vote;
      }
      return {
        ...comment,
        userVoted
      };
    });

    res.json({ comments: commentsWithVotes });
  } catch (error) {
    console.error('Error fetching lesson comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

/**
 * POST /api/lesson-comments/:lessonId
 * Add a new comment to a lesson
 */
router.post('/:lessonId', (req, res) => {
  try {
    const { lessonId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const now = new Date().toISOString();
    const result = run(`
      INSERT INTO lesson_comments (lesson_id, user_id, content, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [lessonId, userId, content.trim(), parentId || null, now, now]);

    // Get the created comment with author info
    const comment = queryOne(`
      SELECT
        lc.*,
        u.name as author_name,
        u.avatar_url as author_avatar,
        u.role as author_role
      FROM lesson_comments lc
      LEFT JOIN users u ON lc.user_id = u.id
      WHERE lc.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      comment: {
        ...comment,
        userVoted: false
      }
    });
  } catch (error) {
    console.error('Error creating lesson comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

/**
 * PUT /api/lesson-comments/:lessonId/:commentId
 * Update a comment
 */
router.put('/:lessonId/:commentId', (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if comment exists and belongs to user
    const comment = queryOne(`
      SELECT * FROM lesson_comments WHERE id = ?
    `, [commentId]);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const now = new Date().toISOString();
    run(`
      UPDATE lesson_comments
      SET content = ?, updated_at = ?
      WHERE id = ?
    `, [content.trim(), now, commentId]);

    res.json({ success: true, message: 'Comment updated' });
  } catch (error) {
    console.error('Error updating lesson comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

/**
 * DELETE /api/lesson-comments/:lessonId/:commentId
 * Delete a comment
 */
router.delete('/:lessonId/:commentId', (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.session?.user?.id;
    const userRole = req.session?.user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if comment exists
    const comment = queryOne(`
      SELECT * FROM lesson_comments WHERE id = ?
    `, [commentId]);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Allow deletion if user owns the comment or is admin
    const isAdmin = userRole === 'instructor_admin';
    if (comment.user_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Delete any votes on this comment first
    run(`DELETE FROM lesson_comment_votes WHERE comment_id = ?`, [commentId]);

    // Delete the comment
    run(`DELETE FROM lesson_comments WHERE id = ?`, [commentId]);

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting lesson comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

/**
 * POST /api/lesson-comments/:lessonId/:commentId/vote
 * Vote on a comment
 */
router.post('/:lessonId/:commentId/vote', (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if comment exists
    const comment = queryOne(`
      SELECT * FROM lesson_comments WHERE id = ?
    `, [commentId]);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user already voted
    const existingVote = queryOne(`
      SELECT id FROM lesson_comment_votes
      WHERE comment_id = ? AND user_id = ?
    `, [commentId, userId]);

    if (existingVote) {
      // Remove vote
      run(`DELETE FROM lesson_comment_votes WHERE id = ?`, [existingVote.id]);
      run(`UPDATE lesson_comments SET votes = votes - 1 WHERE id = ?`, [commentId]);

      const updatedComment = queryOne(`SELECT votes FROM lesson_comments WHERE id = ?`, [commentId]);
      res.json({ success: true, voted: false, votes: updatedComment.votes });
    } else {
      // Add vote
      const now = new Date().toISOString();
      run(`
        INSERT INTO lesson_comment_votes (comment_id, user_id, created_at)
        VALUES (?, ?, ?)
      `, [commentId, userId, now]);
      run(`UPDATE lesson_comments SET votes = votes + 1 WHERE id = ?`, [commentId]);

      const updatedComment = queryOne(`SELECT votes FROM lesson_comments WHERE id = ?`, [commentId]);
      res.json({ success: true, voted: true, votes: updatedComment.votes });
    }
  } catch (error) {
    console.error('Error voting on lesson comment:', error);
    res.status(500).json({ error: 'Failed to vote on comment' });
  }
});

/**
 * POST /api/lesson-comments/:lessonId/:commentId/instructor-answer
 * Mark a comment as instructor answer (instructors only)
 */
router.post('/:lessonId/:commentId/instructor-answer', (req, res) => {
  try {
    const { commentId } = req.params;
    const userRole = req.session?.user?.role;

    if (userRole !== 'instructor_admin') {
      return res.status(403).json({ error: 'Only instructors can mark instructor answers' });
    }

    // Check if comment exists
    const comment = queryOne(`
      SELECT * FROM lesson_comments WHERE id = ?
    `, [commentId]);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Toggle instructor answer status
    const newStatus = comment.is_instructor_answer ? 0 : 1;
    run(`
      UPDATE lesson_comments
      SET is_instructor_answer = ?
      WHERE id = ?
    `, [newStatus, commentId]);

    res.json({ success: true, isInstructorAnswer: !!newStatus });
  } catch (error) {
    console.error('Error marking instructor answer:', error);
    res.status(500).json({ error: 'Failed to mark instructor answer' });
  }
});

export default router;
