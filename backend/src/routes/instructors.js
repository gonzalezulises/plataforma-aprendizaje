import express from 'express';
import { queryAll, queryOne } from '../config/database.js';

const router = express.Router();

/**
 * Feature #244: Public instructor profile API
 * GET /api/instructors/:id - Get instructor information and their courses
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Get instructor info (must be an instructor_admin)
    const instructor = queryOne(
      `SELECT id, name, avatar_url, bio, created_at
       FROM users
       WHERE id = ? AND role = 'instructor_admin'`,
      [id]
    );

    if (!instructor) {
      // Also check if they're just a regular user who has courses
      const userWithCourses = queryOne(
        `SELECT DISTINCT u.id, u.name, u.avatar_url, u.bio, u.created_at
         FROM users u
         JOIN courses c ON c.instructor_id = u.id
         WHERE u.id = ? AND c.is_published = 1`,
        [id]
      );

      if (!userWithCourses) {
        return res.status(404).json({ error: 'Instructor no encontrado' });
      }

      // Use the user with courses as the instructor
      const courses = queryAll(
        `SELECT id, title, slug, description, category, level,
                is_premium, duration_hours, thumbnail_url, created_at
         FROM courses
         WHERE instructor_id = ? AND is_published = 1
         ORDER BY created_at DESC`,
        [id]
      );

      return res.json({
        instructor: userWithCourses,
        courses
      });
    }

    // Get instructor's published courses
    const courses = queryAll(
      `SELECT id, title, slug, description, category, level,
              is_premium, duration_hours, thumbnail_url, created_at
       FROM courses
       WHERE instructor_id = ? AND is_published = 1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      instructor,
      courses
    });
  } catch (error) {
    console.error('Error fetching instructor:', error);
    res.status(500).json({ error: 'Error al obtener el instructor' });
  }
});

export default router;
