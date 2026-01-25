import express from 'express';
import { queryOne, queryAll, run } from '../config/database.js';

const router = express.Router();

/**
 * GET /api/video-progress/:lessonId/:videoId
 * Get video progress for a specific video in a lesson
 */
router.get('/:lessonId/:videoId', (req, res) => {
  try {
    const { lessonId, videoId } = req.params;

    // Get user ID from session or use anonymous ID
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';

    const row = queryOne(`
      SELECT saved_time, duration, completed, updated_at
      FROM video_progress
      WHERE user_id = ? AND lesson_id = ? AND video_id = ?
    `, [userId, lessonId, videoId]);

    if (row) {
      res.json({
        success: true,
        data: {
          currentTime: row.saved_time,
          duration: row.duration,
          completed: row.completed === 1,
          updatedAt: row.updated_at
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          currentTime: 0,
          duration: 0,
          completed: false,
          updatedAt: null
        }
      });
    }
  } catch (error) {
    console.error('Error getting video progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get video progress'
    });
  }
});

/**
 * POST /api/video-progress/:lessonId/:videoId
 * Save video progress for a specific video in a lesson
 */
router.post('/:lessonId/:videoId', (req, res) => {
  try {
    const { lessonId, videoId } = req.params;
    const { currentTime, duration, completed } = req.body;

    // Get user ID from session or use anonymous ID
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';

    // Validate inputs
    if (typeof currentTime !== 'number' || currentTime < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid currentTime value'
      });
    }

    const now = new Date().toISOString();

    // Upsert video progress
    run(`
      INSERT INTO video_progress (user_id, lesson_id, video_id, saved_time, duration, completed, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, lesson_id, video_id)
      DO UPDATE SET
        saved_time = excluded.saved_time,
        duration = excluded.duration,
        completed = excluded.completed,
        updated_at = excluded.updated_at
    `, [
      userId,
      lessonId,
      videoId,
      currentTime,
      duration || 0,
      completed ? 1 : 0,
      now,
      now
    ]);

    res.json({
      success: true,
      message: 'Video progress saved',
      data: {
        userId,
        lessonId,
        videoId,
        currentTime,
        duration,
        completed,
        updatedAt: now
      }
    });
  } catch (error) {
    console.error('Error saving video progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save video progress'
    });
  }
});

/**
 * GET /api/video-progress/:lessonId
 * Get all video progress for a lesson
 */
router.get('/:lessonId', (req, res) => {
  try {
    const { lessonId } = req.params;

    // Get user ID from session or use anonymous ID
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';

    const results = queryAll(`
      SELECT video_id, saved_time, duration, completed, updated_at
      FROM video_progress
      WHERE user_id = ? AND lesson_id = ?
    `, [userId, lessonId]);

    res.json({
      success: true,
      data: results.map(row => ({
        videoId: row.video_id,
        currentTime: row.saved_time,
        duration: row.duration,
        completed: row.completed === 1,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    console.error('Error getting lesson video progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get lesson video progress'
    });
  }
});

export default router;
