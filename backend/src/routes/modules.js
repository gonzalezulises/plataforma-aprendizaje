import express from 'express';
import { queryAll, queryOne } from '../config/database.js';

const router = express.Router();

/**
 * GET /api/modules/:courseId/progress
 * Get module-level progress for a course (Feature #246)
 * Returns progress for each module showing completed/total lessons
 */
router.get('/:courseId/progress', (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get all modules for the course
    const modules = queryAll(
      'SELECT * FROM modules WHERE course_id = ? ORDER BY order_index',
      [courseId]
    );

    // Calculate progress for each module
    const moduleProgress = modules.map(module => {
      // Get all lessons in this module
      const lessons = queryAll(
        'SELECT id FROM lessons WHERE module_id = ?',
        [module.id]
      );

      const totalLessons = lessons.length;
      let completedLessons = 0;

      if (totalLessons > 0) {
        const lessonIds = lessons.map(l => l.id);
        const placeholders = lessonIds.map(() => '?').join(',');

        const completedCount = queryOne(`
          SELECT COUNT(*) as count
          FROM lesson_progress
          WHERE user_id = ? AND lesson_id IN (${placeholders}) AND status = 'completed'
        `, [userId, ...lessonIds]);

        completedLessons = completedCount?.count || 0;
      }

      return {
        moduleId: module.id,
        title: module.title,
        completedLessons,
        totalLessons,
        progressPercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
      };
    });

    res.json({ moduleProgress });
  } catch (error) {
    console.error('Error fetching module progress:', error);
    res.status(500).json({ error: 'Failed to fetch module progress' });
  }
});

export default router;
