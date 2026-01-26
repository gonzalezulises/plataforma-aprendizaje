import express from 'express';
import { queryAll, queryOne, run } from '../config/database.js';

const router = express.Router();

/**
 * Middleware to check if user is authenticated
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * GET /api/enrollments
 * Get all enrollments for the current user
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get enrollments with course details
    const enrollments = queryAll(`
      SELECT
        e.id,
        e.user_id,
        e.course_id,
        e.enrolled_at,
        e.completed_at,
        e.progress_percent,
        e.last_accessed_at,
        c.title as course_title,
        c.slug as course_slug,
        c.description as course_description,
        c.category as course_category,
        c.level as course_level,
        c.is_premium as course_is_premium,
        c.thumbnail_url as course_thumbnail_url,
        c.duration_hours as course_duration_hours
      FROM enrollments e
      LEFT JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ?
      ORDER BY e.last_accessed_at DESC, e.enrolled_at DESC
    `, [userId]);

    res.json({
      enrollments: enrollments.map(e => ({
        id: e.id,
        enrolledAt: e.enrolled_at,
        completedAt: e.completed_at,
        progressPercent: e.progress_percent,
        lastAccessedAt: e.last_accessed_at,
        course: {
          id: e.course_id,
          title: e.course_title,
          slug: e.course_slug,
          description: e.course_description,
          category: e.course_category,
          level: e.course_level,
          isPremium: !!e.course_is_premium,
          thumbnailUrl: e.course_thumbnail_url,
          durationHours: e.course_duration_hours
        }
      })),
      count: enrollments.length
    });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

/**
 * GET /api/enrollments/:courseId
 * Get specific enrollment for a course
 */
router.get('/:courseId', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const courseId = req.params.courseId;

    const enrollment = queryOne(`
      SELECT
        e.*,
        c.title as course_title,
        c.slug as course_slug
      FROM enrollments e
      LEFT JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ? AND e.course_id = ?
    `, [userId, courseId]);

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json({ enrollment });
  } catch (error) {
    console.error('Error fetching enrollment:', error);
    res.status(500).json({ error: 'Failed to fetch enrollment' });
  }
});

/**
 * POST /api/enrollments
 * Enroll current user in a course
 * Feature #15: Free users cannot access premium content
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // Check if course exists
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Feature #15: Block free users from enrolling in premium courses
    if (course.is_premium && userRole === 'student_free') {
      console.log(`[Enrollments] Blocked free user ${userId} from enrolling in premium course ${courseId}`);
      return res.status(403).json({
        error: 'Premium course requires upgrade',
        requiresUpgrade: true,
        message: 'Este curso es premium. Actualiza tu cuenta para acceder a contenido exclusivo.',
        upgradeUrl: '/upgrade'
      });
    }

    // Check if already enrolled
    const existing = queryOne(
      'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );
    if (existing) {
      return res.status(409).json({ error: 'Already enrolled in this course' });
    }

    // Create enrollment
    const now = new Date().toISOString();
    const result = run(`
      INSERT INTO enrollments (user_id, course_id, enrolled_at, last_accessed_at)
      VALUES (?, ?, ?, ?)
    `, [userId, courseId, now, now]);

    res.status(201).json({
      message: 'Enrolled successfully',
      enrollment: {
        id: result.lastInsertRowid,
        userId,
        courseId,
        enrolledAt: now
      }
    });
  } catch (error) {
    console.error('Error enrolling in course:', error);
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
});

/**
 * DELETE /api/enrollments/:courseId
 * Unenroll from a course
 */
router.delete('/:courseId', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const courseId = req.params.courseId;

    const result = run(
      'DELETE FROM enrollments WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json({ message: 'Unenrolled successfully' });
  } catch (error) {
    console.error('Error unenrolling:', error);
    res.status(500).json({ error: 'Failed to unenroll' });
  }
});

/**
 * PATCH /api/enrollments/:courseId/progress
 * Update enrollment progress
 */
router.patch('/:courseId/progress', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const courseId = req.params.courseId;
    const { progressPercent } = req.body;

    if (progressPercent === undefined || progressPercent < 0 || progressPercent > 100) {
      return res.status(400).json({ error: 'Valid progressPercent (0-100) is required' });
    }

    const now = new Date().toISOString();
    const completedAt = progressPercent >= 100 ? now : null;

    const result = run(`
      UPDATE enrollments
      SET progress_percent = ?, last_accessed_at = ?, completed_at = COALESCE(?, completed_at)
      WHERE user_id = ? AND course_id = ?
    `, [progressPercent, now, completedAt, userId, courseId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json({
      message: 'Progress updated',
      progressPercent,
      completedAt
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

export default router;
