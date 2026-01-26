import express from 'express';
import { queryOne, queryAll, run } from '../config/database.js';
import { executeCode } from '../utils/code-executor.js';
import { codeExecutionRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Feature #144: Lesson URLs check enrollment status

/**
 * GET /api/lessons/:id
 * Get a specific lesson with its content
 * Requires enrollment in the course (unless instructor/admin)
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?.id;
    const userRole = req.session?.user?.role;

    const lesson = queryOne(`
      SELECT
        l.*,
        m.title as module_title,
        m.course_id,
        c.title as course_title,
        c.slug as course_slug,
        c.is_premium as course_is_premium
      FROM lessons l
      LEFT JOIN modules m ON l.module_id = m.id
      LEFT JOIN courses c ON m.course_id = c.id
      WHERE l.id = ?
    `, [id]);

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Check enrollment status (unless instructor/admin)
    const isInstructorAdmin = userRole === 'instructor_admin';

    if (!isInstructorAdmin && lesson.course_id) {
      // User must be authenticated to access lessons
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          requiresEnrollment: true,
          courseSlug: lesson.course_slug,
          courseId: lesson.course_id
        });
      }

      // Feature #15: Block free users from accessing premium course content
      if (lesson.course_is_premium && userRole === 'student_free') {
        console.log(`[Lessons] Blocked free user ${userId} from accessing premium lesson ${id} in course ${lesson.course_id}`);
        return res.status(403).json({
          error: 'Premium content requires upgrade',
          requiresUpgrade: true,
          isPremiumContent: true,
          message: 'Este contenido es exclusivo para usuarios premium. Actualiza tu cuenta para desbloquear.',
          upgradeUrl: '/upgrade',
          courseSlug: lesson.course_slug,
          courseId: lesson.course_id,
          courseTitle: lesson.course_title
        });
      }

      // Check if user is enrolled in the course
      const enrollment = queryOne(`
        SELECT id FROM enrollments
        WHERE user_id = ? AND course_id = ?
      `, [userId, lesson.course_id]);

      if (!enrollment) {
        return res.status(403).json({
          error: 'Enrollment required',
          requiresEnrollment: true,
          courseSlug: lesson.course_slug,
          courseId: lesson.course_id,
          courseTitle: lesson.course_title
        });
      }
    }

    // Get lesson content
    const content = queryAll(`
      SELECT * FROM lesson_content
      WHERE lesson_id = ?
      ORDER BY order_index
    `, [id]);

    res.json({
      lesson: {
        ...lesson,
        content: content.map(c => ({
          ...c,
          content: JSON.parse(c.content || '{}')
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

/**
 * GET /api/lessons/:id/progress
 * Get lesson progress for current user
 */
router.get('/:id/progress', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';

    const progress = queryOne(`
      SELECT * FROM lesson_progress
      WHERE user_id = ? AND lesson_id = ?
    `, [userId, id]);

    if (progress) {
      res.json({
        status: progress.status,
        timeSpentSeconds: progress.time_spent_seconds,
        completedAt: progress.completed_at
      });
    } else {
      res.json({
        status: 'not_started',
        timeSpentSeconds: 0,
        completedAt: null
      });
    }
  } catch (error) {
    console.error('Error fetching lesson progress:', error);
    res.status(500).json({ error: 'Failed to fetch lesson progress' });
  }
});

/**
 * POST /api/lessons/:id/complete
 * Mark a lesson as complete
 */
router.post('/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';
    const now = new Date().toISOString();

    // Get lesson info to update course progress (optional - may not exist for sample lessons)
    const lesson = queryOne(`
      SELECT l.*, m.course_id, m.id as module_id
      FROM lessons l
      LEFT JOIN modules m ON l.module_id = m.id
      WHERE l.id = ?
    `, [id]);

    // Upsert lesson progress - works even if lesson doesn't exist in DB
    // This allows tracking progress for sample/mock lessons
    run(`
      INSERT INTO lesson_progress (user_id, lesson_id, status, completed_at, updated_at, created_at)
      VALUES (?, ?, 'completed', ?, ?, ?)
      ON CONFLICT(user_id, lesson_id)
      DO UPDATE SET
        status = 'completed',
        completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at),
        updated_at = excluded.updated_at
    `, [userId, id, now, now, now]);

    // Calculate and update course progress if enrolled (only if lesson exists in DB)
    if (lesson && lesson.course_id) {
      updateCourseProgress(userId, lesson.course_id);
    }

    // Get navigation info if lesson exists
    let navigation = { previous: null, next: null };
    if (lesson && lesson.module_id) {
      navigation = getNavigationInfo(id, lesson.module_id);
    }

    res.json({
      success: true,
      message: 'Lesson marked as complete',
      lessonId: id,
      completedAt: now,
      navigation
    });
  } catch (error) {
    console.error('Error completing lesson:', error);
    res.status(500).json({ error: 'Failed to complete lesson' });
  }
});

/**
 * POST /api/lessons/:id/start
 * Mark a lesson as in progress
 */
router.post('/:id/start', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';
    const now = new Date().toISOString();

    // Upsert lesson progress - only update if not already completed
    run(`
      INSERT INTO lesson_progress (user_id, lesson_id, status, updated_at, created_at)
      VALUES (?, ?, 'in_progress', ?, ?)
      ON CONFLICT(user_id, lesson_id)
      DO UPDATE SET
        status = CASE WHEN lesson_progress.status = 'completed' THEN 'completed' ELSE 'in_progress' END,
        updated_at = excluded.updated_at
    `, [userId, id, now, now]);

    res.json({
      success: true,
      message: 'Lesson started',
      lessonId: id
    });
  } catch (error) {
    console.error('Error starting lesson:', error);
    res.status(500).json({ error: 'Failed to start lesson' });
  }
});

/**
 * POST /api/lessons/:id/time
 * Update time spent on lesson
 */
router.post('/:id/time', (req, res) => {
  try {
    const { id } = req.params;
    const { seconds } = req.body;
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';
    const now = new Date().toISOString();

    if (typeof seconds !== 'number' || seconds < 0) {
      return res.status(400).json({ error: 'Invalid seconds value' });
    }

    run(`
      INSERT INTO lesson_progress (user_id, lesson_id, status, time_spent_seconds, updated_at, created_at)
      VALUES (?, ?, 'in_progress', ?, ?, ?)
      ON CONFLICT(user_id, lesson_id)
      DO UPDATE SET
        time_spent_seconds = lesson_progress.time_spent_seconds + excluded.time_spent_seconds,
        updated_at = excluded.updated_at
    `, [userId, id, seconds, now, now]);

    res.json({
      success: true,
      message: 'Time updated'
    });
  } catch (error) {
    console.error('Error updating lesson time:', error);
    res.status(500).json({ error: 'Failed to update lesson time' });
  }
});

/**
 * GET /api/lessons/:id/navigation
 * Get navigation info (previous and next lessons)
 */
router.get('/:id/navigation', (req, res) => {
  try {
    const { id } = req.params;

    const lesson = queryOne(`
      SELECT l.*, m.id as module_id
      FROM lessons l
      LEFT JOIN modules m ON l.module_id = m.id
      WHERE l.id = ?
    `, [id]);

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const navigation = getNavigationInfo(id, lesson.module_id);

    res.json(navigation);
  } catch (error) {
    console.error('Error fetching lesson navigation:', error);
    res.status(500).json({ error: 'Failed to fetch lesson navigation' });
  }
});

/**
 * Helper: Update course progress based on completed lessons
 */
function updateCourseProgress(userId, courseId) {
  try {
    // Count total lessons in course
    const totalLessons = queryOne(`
      SELECT COUNT(*) as count
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      WHERE m.course_id = ?
    `, [courseId]);

    // Count completed lessons
    const completedLessons = queryOne(`
      SELECT COUNT(*) as count
      FROM lesson_progress lp
      JOIN lessons l ON lp.lesson_id = l.id
      JOIN modules m ON l.module_id = m.id
      WHERE lp.user_id = ? AND m.course_id = ? AND lp.status = 'completed'
    `, [userId, courseId]);

    if (totalLessons && totalLessons.count > 0) {
      const progressPercent = Math.round((completedLessons.count / totalLessons.count) * 100);
      const now = new Date().toISOString();
      const completedAt = progressPercent >= 100 ? now : null;

      // Update enrollment progress
      run(`
        UPDATE enrollments
        SET progress_percent = ?, last_accessed_at = ?, completed_at = COALESCE(?, completed_at)
        WHERE user_id = ? AND course_id = ?
      `, [progressPercent, now, completedAt, userId, courseId]);
    }
  } catch (error) {
    console.error('Error updating course progress:', error);
  }
}

/**
 * Helper: Get navigation info for a lesson
 */
function getNavigationInfo(lessonId, moduleId) {
  try {
    // Get current lesson order
    const currentLesson = queryOne(`
      SELECT order_index FROM lessons WHERE id = ?
    `, [lessonId]);

    if (!currentLesson) {
      return { previous: null, next: null };
    }

    // Get previous lesson in same module
    let previous = queryOne(`
      SELECT id, title FROM lessons
      WHERE module_id = ? AND order_index < ?
      ORDER BY order_index DESC
      LIMIT 1
    `, [moduleId, currentLesson.order_index]);

    // Get next lesson in same module
    let next = queryOne(`
      SELECT id, title FROM lessons
      WHERE module_id = ? AND order_index > ?
      ORDER BY order_index ASC
      LIMIT 1
    `, [moduleId, currentLesson.order_index]);

    // If no previous in current module, check previous module
    if (!previous) {
      const prevModule = queryOne(`
        SELECT m.id FROM modules m
        JOIN modules current ON current.id = ?
        WHERE m.course_id = current.course_id AND m.order_index < current.order_index
        ORDER BY m.order_index DESC
        LIMIT 1
      `, [moduleId]);

      if (prevModule) {
        previous = queryOne(`
          SELECT id, title FROM lessons
          WHERE module_id = ?
          ORDER BY order_index DESC
          LIMIT 1
        `, [prevModule.id]);
      }
    }

    // If no next in current module, check next module
    if (!next) {
      const nextModule = queryOne(`
        SELECT m.id FROM modules m
        JOIN modules current ON current.id = ?
        WHERE m.course_id = current.course_id AND m.order_index > current.order_index
        ORDER BY m.order_index ASC
        LIMIT 1
      `, [moduleId]);

      if (nextModule) {
        next = queryOne(`
          SELECT id, title FROM lessons
          WHERE module_id = ?
          ORDER BY order_index ASC
          LIMIT 1
        `, [nextModule.id]);
      }
    }

    return {
      previous: previous ? { id: previous.id, title: previous.title } : null,
      next: next ? { id: next.id, title: next.title } : null
    };
  } catch (error) {
    console.error('Error getting navigation info:', error);
    return { previous: null, next: null };
  }
}

/**
 * POST /api/lessons/:id/execute
 * Execute code from a lesson's code block (Feature #126)
 * Feature #34: Rate limited to prevent abuse
 */
router.post('/:id/execute', codeExecutionRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, language = 'python' } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    // Execute code using the shared executeCode function from challenges
    const result = await executeCode(code, language, 30);

    res.json({
      output: result.output,
      error: result.error,
      timeout: result.timeout || false,
      timeout_message: result.timeout_message || null,
      memory_exceeded: result.memory_exceeded || false,
      memory_error_message: result.memory_error_message || null,
      syntax_error: result.syntax_error || false,
      syntax_error_info: result.syntax_error_info || null,
      execution_time_ms: result.execution_time_ms,
      success: !result.error && !result.timeout && !result.memory_exceeded && !result.syntax_error
    });
  } catch (error) {
    console.error('Error executing code:', error);
    res.status(500).json({ error: 'Failed to execute code' });
  }
});

export default router;
