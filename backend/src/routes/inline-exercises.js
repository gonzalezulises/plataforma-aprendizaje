import express from 'express';
import { queryOne, queryAll, run } from '../config/database.js';

const router = express.Router();

/**
 * Initialize the inline_exercise_progress table.
 * Called from index.js during startup.
 */
export function initInlineExerciseTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS inline_exercise_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      lesson_id INTEGER NOT NULL,
      exercise_index INTEGER NOT NULL,
      exercise_type TEXT NOT NULL DEFAULT 'code',
      status TEXT NOT NULL DEFAULT 'attempted',
      answer TEXT,
      is_correct INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 1,
      score REAL DEFAULT 0,
      max_score REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, lesson_id, exercise_index)
    );
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_inline_progress_user_lesson
    ON inline_exercise_progress(user_id, lesson_id);
  `);

  console.log('[Inline Exercises] Tables initialized');
}

/**
 * GET /api/inline-exercises/:lessonId/progress
 * Get progress for all exercises in a lesson for the current user.
 */
router.get('/:lessonId/progress', async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.session?.user?.id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const progress = queryAll(
      'SELECT exercise_index, exercise_type, status, answer, is_correct, attempts, score, max_score, updated_at FROM inline_exercise_progress WHERE user_id = ? AND lesson_id = ?',
      [userId, lessonId]
    );

    // Build a map: exercise_index -> progress
    const progressMap = {};
    for (const p of progress) {
      progressMap[p.exercise_index] = {
        exerciseIndex: p.exercise_index,
        exerciseType: p.exercise_type,
        status: p.status,
        answer: p.answer,
        isCorrect: !!p.is_correct,
        attempts: p.attempts,
        score: p.score,
        maxScore: p.max_score,
        updatedAt: p.updated_at
      };
    }

    // Calculate summary stats
    const total = progress.length;
    const completed = progress.filter(p => p.status === 'completed' || p.is_correct).length;
    const attempted = progress.filter(p => p.attempts > 0).length;

    res.json({
      progress: progressMap,
      summary: {
        total,
        completed,
        attempted,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('[Inline Exercises] Error fetching progress:', error);
    res.status(500).json({ error: 'Error al obtener progreso' });
  }
});

/**
 * POST /api/inline-exercises/:lessonId/progress
 * Save progress for a specific exercise in a lesson.
 *
 * Body: { exerciseIndex, exerciseType, status, answer, isCorrect, score, maxScore }
 */
router.post('/:lessonId/progress', async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.session?.user?.id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const {
      exerciseIndex,
      exerciseType = 'code',
      status = 'attempted',
      answer = null,
      isCorrect = false,
      score = 0,
      maxScore = 0
    } = req.body;

    if (exerciseIndex === undefined || exerciseIndex === null) {
      return res.status(400).json({ error: 'exerciseIndex es requerido' });
    }

    // Check if progress exists
    const existing = queryOne(
      'SELECT id, attempts FROM inline_exercise_progress WHERE user_id = ? AND lesson_id = ? AND exercise_index = ?',
      [userId, lessonId, exerciseIndex]
    );

    if (existing) {
      // Update existing progress
      run(
        `UPDATE inline_exercise_progress
         SET status = ?, answer = ?, is_correct = ?, attempts = attempts + 1,
             score = CASE WHEN ? > score THEN ? ELSE score END,
             max_score = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, answer, isCorrect ? 1 : 0, score, score, maxScore, existing.id]
      );
    } else {
      // Insert new progress
      run(
        `INSERT INTO inline_exercise_progress (user_id, lesson_id, exercise_index, exercise_type, status, answer, is_correct, attempts, score, max_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [userId, lessonId, exerciseIndex, exerciseType, status, answer, isCorrect ? 1 : 0, score, maxScore]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Inline Exercises] Error saving progress:', error);
    res.status(500).json({ error: 'Error al guardar progreso' });
  }
});

/**
 * GET /api/inline-exercises/:lessonId/summary
 * Get summary of exercise completion for a lesson.
 */
router.get('/:lessonId/summary', async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.session?.user?.id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const summary = queryOne(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' OR is_correct = 1 THEN 1 ELSE 0 END) as completed,
        SUM(attempts) as total_attempts,
        SUM(score) as total_score,
        SUM(max_score) as total_max_score
      FROM inline_exercise_progress
      WHERE user_id = ? AND lesson_id = ?`,
      [userId, lessonId]
    );

    res.json({
      total: summary?.total || 0,
      completed: summary?.completed || 0,
      totalAttempts: summary?.total_attempts || 0,
      totalScore: summary?.total_score || 0,
      totalMaxScore: summary?.total_max_score || 0,
      completionRate: summary?.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0
    });
  } catch (error) {
    console.error('[Inline Exercises] Error fetching summary:', error);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

export default router;
