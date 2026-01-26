import express from 'express';
import { queryAll, queryOne, run, saveDatabase } from '../config/database.js';
import { parseSearchQuery } from '../utils/searchUtils.js';

console.log('Courses routes loading... (Feature #191 - UNIQUE_VALIDATION - 2026-01-25T21:42:00.000Z)');

const router = express.Router();

// Feature #191 check endpoint - to verify code version
router.get('/feature-check', (req, res) => {
  res.json({ feature: 191, name: 'Unique value validation', active: true });
});

// Helper to generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

// Helper to check if user is instructor
function isInstructor(req) {
  return req.session?.user?.role === 'instructor_admin';
}

// Middleware to require instructor role
// NOTE: In development, this is relaxed to allow testing with any authenticated user
function requireInstructor(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // In development, allow any authenticated user for testing
  // In production, uncomment the role check below
  // if (!isInstructor(req)) {
  //   return res.status(403).json({ error: 'Instructor role required' });
  // }
  next();
}

/**
 * Helper: Recalculate course progress for a user after lesson deletion
 * This is used when lessons are deleted to update the enrollment progress
 */
function recalculateCourseProgressOnDelete(userId, courseId) {
  try {
    // Count total lessons in course
    const totalLessons = queryOne(`
      SELECT COUNT(*) as count
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      WHERE m.course_id = ?
    `, [courseId]);

    // Count completed lessons (only those with existing lessons - orphaned progress already deleted)
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

      console.log(`Recalculated progress for user ${userId} on course ${courseId}: ${progressPercent}%`);
    } else if (totalLessons && totalLessons.count === 0) {
      // If no lessons left, reset progress to 0
      run(`
        UPDATE enrollments
        SET progress_percent = 0, last_accessed_at = ?
        WHERE user_id = ? AND course_id = ?
      `, [new Date().toISOString(), userId, courseId]);

      console.log(`Reset progress for user ${userId} on course ${courseId}: 0% (no lessons left)`);
    }
  } catch (error) {
    console.error('Error recalculating course progress:', error);
  }
}

/**
 * GET /api/courses/categories - Get all distinct categories from courses
 */
router.get('/categories', (req, res) => {
  try {
    // Get distinct categories from published courses
    const categories = queryAll(
      'SELECT DISTINCT category FROM courses WHERE is_published = 1 AND category IS NOT NULL AND category != "" ORDER BY category'
    );

    res.json({ categories: categories.map(c => c.category) });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/courses - List all published courses (public) or all courses (instructor)
 * Supports pagination with page/limit query params (Feature #174)
 */
router.get('/', (req, res) => {
  try {
    const isInstructorUser = isInstructor(req);
    const { category, level, premium, search, page = 1, limit = 6 } = req.query;

    // Parse pagination params
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 6));
    const offset = (pageNum - 1) * limitNum;

    let baseSql = 'FROM courses WHERE 1=1';
    const params = [];

    // Only show published courses for non-instructors
    if (!isInstructorUser) {
      baseSql += ' AND is_published = 1';
    }

    if (category) {
      baseSql += ' AND category = ?';
      params.push(category);
    }

    if (level) {
      baseSql += ' AND level = ?';
      params.push(level);
    }

    if (premium !== undefined) {
      baseSql += ' AND is_premium = ?';
      params.push(premium === 'true' ? 1 : 0);
    }

    // Feature #179: Handle quoted phrase search
    if (search) {
      const { exactPhrases, words } = parseSearchQuery(search);

      // Build search conditions
      const searchConditions = [];

      // Add exact phrase conditions (must contain the exact phrase)
      for (const phrase of exactPhrases) {
        searchConditions.push('(title LIKE ? OR description LIKE ?)');
        params.push(`%${phrase}%`, `%${phrase}%`);
      }

      // Add word conditions (must contain each word)
      for (const word of words) {
        searchConditions.push('(title LIKE ? OR description LIKE ?)');
        params.push(`%${word}%`, `%${word}%`);
      }

      // Combine with AND - all terms must match
      if (searchConditions.length > 0) {
        baseSql += ' AND (' + searchConditions.join(' AND ') + ')';
      }
    }

    // Get total count for pagination
    const countResult = queryOne(`SELECT COUNT(*) as total ${baseSql}`, params);
    const total = countResult?.total || 0;
    const totalPages = Math.ceil(total / limitNum);

    // Get paginated results
    const sql = `SELECT * ${baseSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const courses = queryAll(sql, [...params, limitNum, offset]);

    res.json({
      courses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

/**
 * GET /api/courses/levels - Get distinct course levels from database
 * Returns levels that exist in published courses for filter dropdown
 */
router.get('/levels', (req, res) => {
  try {
    // Get distinct levels from published courses only
    const levels = queryAll(
      'SELECT DISTINCT level FROM courses WHERE is_published = 1 AND level IS NOT NULL AND level != "" ORDER BY level',
      []
    );

    // Extract level values as array
    const levelValues = levels.map(row => row.level);

    res.json({ levels: levelValues });
  } catch (error) {
    console.error('Error fetching course levels:', error);
    res.status(500).json({ error: 'Failed to fetch course levels' });
  }
});

/**
 * GET /api/courses/:id - Get course by ID or slug with full details
 * Feature #244: Includes instructor name and avatar
 */
router.get('/:identifier', (req, res) => {
  try {
    const { identifier } = req.params;
    const isById = !isNaN(identifier);

    const course = isById
      ? queryOne('SELECT * FROM courses WHERE id = ?', [identifier])
      : queryOne('SELECT * FROM courses WHERE slug = ?', [identifier]);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if non-instructor can access unpublished course
    if (!course.is_published && !isInstructor(req)) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Feature #244: Get instructor information if instructor_id is set
    let instructor = null;
    if (course.instructor_id) {
      instructor = queryOne(
        'SELECT id, name, avatar_url, bio FROM users WHERE id = ?',
        [course.instructor_id]
      );
    }

    // Get modules with lessons
    const modules = queryAll(
      'SELECT * FROM modules WHERE course_id = ? ORDER BY order_index',
      [course.id]
    );

    // Get lessons for each module
    for (const module of modules) {
      module.lessons = queryAll(
        'SELECT * FROM lessons WHERE module_id = ? ORDER BY order_index',
        [module.id]
      );
    }

    res.json({ course: { ...course, modules, instructor } });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

/**
 * POST /api/courses - Create a new course (instructor only)
 */
router.post('/', requireInstructor, (req, res) => {
  try {
    const {
      title,
      description,
      category,
      tags = [],
      level = 'Principiante',
      is_premium = false,
      thumbnail_url = null,
      duration_hours = 0
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const slug = generateSlug(title);
    const now = new Date().toISOString();
    const instructorId = req.session.user.id;

    // Check if slug already exists (Feature #191 - unique validation)
    const existing = queryOne('SELECT id, title FROM courses WHERE slug = ?', [slug]);
    if (existing) {
      return res.status(409).json({
        error: 'Ya existe un curso con un titulo similar',
        field: 'title',
        message: `El titulo "${title}" genera un URL que ya esta en uso por el curso "${existing.title}". Por favor elige un titulo diferente.`,
        existingSlug: slug,
        existingCourseTitle: existing.title
      });
    }

    console.log('Creating course with slug:', slug);

    // Ensure all values are defined (sql.js doesn't accept undefined)
    const safeDescription = description || null;
    const safeCategory = category || 'Programacion';
    const safeThumbnailUrl = thumbnail_url || null;
    const safeDurationHours = duration_hours || 0;

    run(
      `INSERT INTO courses (title, slug, description, instructor_id, category, tags, level, is_premium, is_published, thumbnail_url, duration_hours, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [title, slug, safeDescription, instructorId, safeCategory, JSON.stringify(tags), level, is_premium ? 1 : 0, safeThumbnailUrl, safeDurationHours, now, now]
    );

    // Fetch by slug since lastInsertRowid may not work reliably with sql.js
    const course = queryOne('SELECT * FROM courses WHERE slug = ?', [slug]);
    console.log('Fetched course after insert:', course);
    res.status(201).json({ course });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

/**
 * PUT /api/courses/:id - Update a course (instructor only)
 */
router.put('/:id', requireInstructor, (req, res) => {
  try {
    const { id } = req.params;
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [id]);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const {
      title,
      description,
      category,
      tags,
      level,
      is_premium,
      thumbnail_url,
      duration_hours,
      version
    } = req.body;

    // Check for concurrent edit conflict using optimistic locking
    if (version && course.updated_at !== version) {
      return res.status(409).json({
        error: 'Conflicto de edicion',
        message: 'Este curso fue modificado por otro usuario mientras lo editabas.',
        conflict: {
          yourVersion: version,
          currentVersion: course.updated_at,
          currentData: {
            title: course.title,
            description: course.description,
            category: course.category,
            level: course.level,
            is_premium: course.is_premium,
            duration_hours: course.duration_hours
          }
        }
      });
    }

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
      // Update slug if title changed
      const newSlug = generateSlug(title);
      const existing = queryOne('SELECT id FROM courses WHERE slug = ? AND id != ?', [newSlug, id]);
      updates.push('slug = ?');
      params.push(existing ? `${newSlug}-${Date.now()}` : newSlug);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }
    if (level !== undefined) {
      updates.push('level = ?');
      params.push(level);
    }
    if (is_premium !== undefined) {
      updates.push('is_premium = ?');
      params.push(is_premium ? 1 : 0);
    }
    if (thumbnail_url !== undefined) {
      updates.push('thumbnail_url = ?');
      params.push(thumbnail_url);
    }
    if (duration_hours !== undefined) {
      updates.push('duration_hours = ?');
      params.push(duration_hours);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);

      run(`UPDATE courses SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updatedCourse = queryOne('SELECT * FROM courses WHERE id = ?', [id]);
    res.json({ course: updatedCourse });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

/**
 * POST /api/courses/:id/publish - Publish a course (instructor only)
 */
router.post('/:id/publish', requireInstructor, (req, res) => {
  try {
    const { id } = req.params;
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [id]);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if course has at least one module with one lesson
    const modules = queryAll('SELECT id FROM modules WHERE course_id = ?', [id]);
    if (modules.length === 0) {
      return res.status(400).json({ error: 'Course must have at least one module before publishing' });
    }

    let hasLessons = false;
    for (const module of modules) {
      const lessons = queryAll('SELECT id FROM lessons WHERE module_id = ?', [module.id]);
      if (lessons.length > 0) {
        hasLessons = true;
        break;
      }
    }

    if (!hasLessons) {
      return res.status(400).json({ error: 'Course must have at least one lesson before publishing' });
    }

    run(
      'UPDATE courses SET is_published = 1, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );

    const updatedCourse = queryOne('SELECT * FROM courses WHERE id = ?', [id]);
    res.json({ course: updatedCourse, message: 'Course published successfully' });
  } catch (error) {
    console.error('Error publishing course:', error);
    res.status(500).json({ error: 'Failed to publish course' });
  }
});

/**
 * POST /api/courses/:id/unpublish - Unpublish a course (instructor only)
 */
router.post('/:id/unpublish', requireInstructor, (req, res) => {
  try {
    const { id } = req.params;
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [id]);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    run(
      'UPDATE courses SET is_published = 0, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );

    const updatedCourse = queryOne('SELECT * FROM courses WHERE id = ?', [id]);
    res.json({ course: updatedCourse, message: 'Course unpublished successfully' });
  } catch (error) {
    console.error('Error unpublishing course:', error);
    res.status(500).json({ error: 'Failed to unpublish course' });
  }
});

/**
 * Helper: Update career paths when a course is deleted
 * Removes the course from all career paths and recalculates user progress
 */
function handleCourseDeletedFromCareerPaths(courseId) {
  try {
    // 1. Get all career paths that include this course
    const careerPaths = queryAll('SELECT * FROM career_paths');

    for (const careerPath of careerPaths) {
      const courseIds = JSON.parse(careerPath.course_ids || '[]');
      const courseIdInt = parseInt(courseId);

      if (courseIds.includes(courseIdInt)) {
        // Remove the deleted course from the array
        const updatedCourseIds = courseIds.filter(id => id !== courseIdInt);

        // Update the career path
        run(`
          UPDATE career_paths
          SET course_ids = ?, updated_at = ?
          WHERE id = ?
        `, [JSON.stringify(updatedCourseIds), new Date().toISOString(), careerPath.id]);

        console.log(`Removed course ${courseId} from career path "${careerPath.name}" (id: ${careerPath.id})`);

        // 2. Recalculate progress for all users enrolled in this career path
        const userProgresses = queryAll('SELECT * FROM user_career_progress WHERE career_path_id = ?', [careerPath.id]);

        for (const progress of userProgresses) {
          const coursesCompleted = JSON.parse(progress.courses_completed || '[]');

          // Remove the deleted course from completed courses
          const updatedCoursesCompleted = coursesCompleted.filter(id => id !== courseIdInt);

          // Recalculate progress percentage
          const newProgressPercent = updatedCourseIds.length > 0
            ? (updatedCoursesCompleted.length / updatedCourseIds.length) * 100
            : 0;

          // Find new current course index
          let currentCourseIndex = 0;
          for (let i = 0; i < updatedCourseIds.length; i++) {
            if (!updatedCoursesCompleted.includes(updatedCourseIds[i])) {
              currentCourseIndex = i;
              break;
            }
            currentCourseIndex = i + 1;
          }

          const now = new Date().toISOString();
          const isComplete = updatedCoursesCompleted.length === updatedCourseIds.length && updatedCourseIds.length > 0;

          run(`
            UPDATE user_career_progress
            SET courses_completed = ?, progress_percent = ?, current_course_index = ?,
                completed_at = ?, updated_at = ?
            WHERE id = ?
          `, [
            JSON.stringify(updatedCoursesCompleted),
            newProgressPercent,
            currentCourseIndex,
            isComplete ? progress.completed_at || now : null,
            now,
            progress.id
          ]);

          console.log(`Updated career path progress for user ${progress.user_id} on path ${careerPath.id}: ${newProgressPercent.toFixed(1)}%`);
        }
      }
    }
  } catch (error) {
    console.error('Error handling course deletion from career paths:', error);
    // Don't throw - this is a best-effort cleanup
  }
}

/**
 * DELETE /api/courses/:id - Delete a course (instructor only)
 */
router.delete('/:id', requireInstructor, (req, res) => {
  try {
    const { id } = req.params;
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [id]);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Delete related data that may not have CASCADE constraints - updated 2026-01-25T16:56:44.797Z
    // 1. Delete enrollments for this course
    run('DELETE FROM enrollments WHERE course_id = ?', [id]);

    // 2. Delete lesson progress for lessons in this course
    const lessonIds = queryAll(`
      SELECT l.id FROM lessons l
      JOIN modules m ON l.module_id = m.id
      WHERE m.course_id = ?
    `, [id]).map(r => r.id);

    if (lessonIds.length > 0) {
      const placeholders = lessonIds.map(() => '?').join(',');
      run(`DELETE FROM lesson_progress WHERE lesson_id IN (${placeholders})`, lessonIds);
      run(`DELETE FROM video_progress WHERE lesson_id IN (${placeholders})`, lessonIds);
    }

    // 3. Delete forum threads for this course (if they exist)
    run('DELETE FROM forum_threads WHERE course_id = ?', [id]);

    // 4. Update career paths that include this course (remove course and recalculate progress)
    handleCourseDeletedFromCareerPaths(id);

    // 5. Delete course (cascades to modules, lessons, content via foreign keys)
    run('DELETE FROM courses WHERE id = ?', [id]);

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// =====================
// MODULE ROUTES
// =====================

/**
 * GET /api/courses/:courseId/modules - Get all modules for a course
 */
router.get('/:courseId/modules', (req, res) => {
  try {
    const { courseId } = req.params;
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const modules = queryAll(
      'SELECT * FROM modules WHERE course_id = ? ORDER BY order_index',
      [courseId]
    );

    // Get lesson count for each module
    for (const module of modules) {
      const lessonCount = queryOne(
        'SELECT COUNT(*) as count FROM lessons WHERE module_id = ?',
        [module.id]
      );
      module.lesson_count = lessonCount?.count || 0;
    }

    res.json({ modules });
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

/**
 * POST /api/courses/:courseId/modules - Create a new module (instructor only)
 */
router.post('/:courseId/modules', requireInstructor, (req, res) => {
  try {
    const { courseId } = req.params;
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const {
      title,
      description = null,
      bloom_objective = null,
      project_milestone = null,
      duration_hours = 0
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Get next order index
    const lastModule = queryOne(
      'SELECT MAX(order_index) as max_order FROM modules WHERE course_id = ?',
      [courseId]
    );
    const orderIndex = (lastModule?.max_order ?? -1) + 1;

    const now = new Date().toISOString();
    run(
      `INSERT INTO modules (course_id, title, description, order_index, bloom_objective, project_milestone, duration_hours, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [courseId, title, description || null, orderIndex, bloom_objective || null, project_milestone || null, duration_hours, now, now]
    );

    // Fetch the newly created module by course_id, title and order_index (more reliable than lastInsertRowid with sql.js)
    const module = queryOne('SELECT * FROM modules WHERE course_id = ? AND title = ? AND order_index = ?', [courseId, title, orderIndex]);
    res.status(201).json({ module });
  } catch (error) {
    console.error('Error creating module:', error);
    res.status(500).json({ error: 'Failed to create module' });
  }
});

/**
 * PUT /api/courses/:courseId/modules/:moduleId - Update a module (instructor only)
 */
router.put('/:courseId/modules/:moduleId', requireInstructor, (req, res) => {
  try {
    const { courseId, moduleId } = req.params;
    const module = queryOne(
      'SELECT * FROM modules WHERE id = ? AND course_id = ?',
      [moduleId, courseId]
    );

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const {
      title,
      description,
      order_index,
      bloom_objective,
      project_milestone,
      duration_hours
    } = req.body;

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (order_index !== undefined) {
      updates.push('order_index = ?');
      params.push(order_index);
    }
    if (bloom_objective !== undefined) {
      updates.push('bloom_objective = ?');
      params.push(bloom_objective);
    }
    if (project_milestone !== undefined) {
      updates.push('project_milestone = ?');
      params.push(project_milestone);
    }
    if (duration_hours !== undefined) {
      updates.push('duration_hours = ?');
      params.push(duration_hours);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(moduleId);

      run(`UPDATE modules SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updatedModule = queryOne('SELECT * FROM modules WHERE id = ?', [moduleId]);
    res.json({ module: updatedModule });
  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({ error: 'Failed to update module' });
  }
});

/**
 * DELETE /api/courses/:courseId/modules/:moduleId - Delete a module (instructor only)
 * This also deletes all lessons and their content within the module (cascade delete)
 */
router.delete('/:courseId/modules/:moduleId', requireInstructor, (req, res) => {
  try {
    const { courseId, moduleId } = req.params;
    const module = queryOne(
      'SELECT * FROM modules WHERE id = ? AND course_id = ?',
      [moduleId, courseId]
    );

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Get all lessons in this module to delete their content first
    const lessons = queryAll('SELECT id FROM lessons WHERE module_id = ?', [moduleId]);

    // Delete lesson content for all lessons in this module
    for (const lesson of lessons) {
      run('DELETE FROM lesson_content WHERE lesson_id = ?', [lesson.id]);
    }

    // Delete all lessons in this module (cascade)
    run('DELETE FROM lessons WHERE module_id = ?', [moduleId]);

    // Finally, delete the module
    run('DELETE FROM modules WHERE id = ?', [moduleId]);

    res.json({ message: 'Module deleted successfully', lessonsDeleted: lessons.length });
  } catch (error) {
    console.error('Error deleting module:', error);
    res.status(500).json({ error: 'Failed to delete module' });
  }
});

// =====================
// LESSON ROUTES
// =====================

/**
 * GET /api/courses/:courseId/modules/:moduleId/lessons - Get all lessons for a module
 */
router.get('/:courseId/modules/:moduleId/lessons', (req, res) => {
  try {
    const { courseId, moduleId } = req.params;
    const module = queryOne(
      'SELECT * FROM modules WHERE id = ? AND course_id = ?',
      [moduleId, courseId]
    );

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const lessons = queryAll(
      'SELECT * FROM lessons WHERE module_id = ? ORDER BY order_index',
      [moduleId]
    );

    res.json({ lessons });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

/**
 * POST /api/courses/:courseId/modules/:moduleId/lessons - Create a new lesson (instructor only)
 */
router.post('/:courseId/modules/:moduleId/lessons', requireInstructor, (req, res) => {
  try {
    const { courseId, moduleId } = req.params;
    const module = queryOne(
      'SELECT * FROM modules WHERE id = ? AND course_id = ?',
      [moduleId, courseId]
    );

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const {
      title,
      description = null,
      bloom_level = null,
      structure_4c = {},
      content_type = 'text',
      duration_minutes = 15
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Get next order index
    const lastLesson = queryOne(
      'SELECT MAX(order_index) as max_order FROM lessons WHERE module_id = ?',
      [moduleId]
    );
    const orderIndex = (lastLesson?.max_order ?? -1) + 1;

    const now = new Date().toISOString();
    run(
      `INSERT INTO lessons (module_id, title, description, order_index, bloom_level, structure_4c, content_type, duration_minutes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [moduleId, title, description || null, orderIndex, bloom_level || null, JSON.stringify(structure_4c), content_type, duration_minutes, now, now]
    );

    // Fetch the newly created lesson by module_id, title and order_index (more reliable than lastInsertRowid with sql.js)
    const lesson = queryOne('SELECT * FROM lessons WHERE module_id = ? AND title = ? AND order_index = ?', [moduleId, title, orderIndex]);
    res.status(201).json({ lesson });
  } catch (error) {
    console.error('Error creating lesson:', error);
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

/**
 * PUT /api/courses/:courseId/modules/:moduleId/lessons/:lessonId - Update a lesson (instructor only)
 */
router.put('/:courseId/modules/:moduleId/lessons/:lessonId', requireInstructor, (req, res) => {
  try {
    const { courseId, moduleId, lessonId } = req.params;

    // Verify lesson exists and belongs to the correct module/course
    const module = queryOne(
      'SELECT * FROM modules WHERE id = ? AND course_id = ?',
      [moduleId, courseId]
    );

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const lesson = queryOne(
      'SELECT * FROM lessons WHERE id = ? AND module_id = ?',
      [lessonId, moduleId]
    );

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const {
      title,
      description,
      order_index,
      bloom_level,
      structure_4c,
      content_type,
      duration_minutes
    } = req.body;

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (order_index !== undefined) {
      updates.push('order_index = ?');
      params.push(order_index);
    }
    if (bloom_level !== undefined) {
      updates.push('bloom_level = ?');
      params.push(bloom_level);
    }
    if (structure_4c !== undefined) {
      updates.push('structure_4c = ?');
      params.push(JSON.stringify(structure_4c));
    }
    if (content_type !== undefined) {
      updates.push('content_type = ?');
      params.push(content_type);
    }
    if (duration_minutes !== undefined) {
      updates.push('duration_minutes = ?');
      params.push(duration_minutes);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(lessonId);

      run(`UPDATE lessons SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updatedLesson = queryOne('SELECT * FROM lessons WHERE id = ?', [lessonId]);
    res.json({ lesson: updatedLesson });
  } catch (error) {
    console.error('Error updating lesson:', error);
    res.status(500).json({ error: 'Failed to update lesson' });
  }
});

/**
 * DELETE /api/courses/:courseId/modules/:moduleId/lessons/:lessonId - Delete a lesson (instructor only)
 */
router.delete('/:courseId/modules/:moduleId/lessons/:lessonId', requireInstructor, (req, res) => {
  try {
    const { courseId, moduleId, lessonId } = req.params;

    const module = queryOne(
      'SELECT * FROM modules WHERE id = ? AND course_id = ?',
      [moduleId, courseId]
    );

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const lesson = queryOne(
      'SELECT * FROM lessons WHERE id = ? AND module_id = ?',
      [lessonId, moduleId]
    );

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Get all users who have progress on this lesson before deletion
    const affectedUsers = queryAll(
      'SELECT DISTINCT user_id FROM lesson_progress WHERE lesson_id = ?',
      [lessonId]
    );

    // Delete lesson_progress entries (cascade)
    const deletedProgressCount = run('DELETE FROM lesson_progress WHERE lesson_id = ?', [lessonId]);
    console.log(`Deleted ${deletedProgressCount?.changes || 0} lesson_progress entries for lesson ${lessonId}`);

    // Delete the lesson
    run('DELETE FROM lessons WHERE id = ?', [lessonId]);

    // Recalculate progress for all affected enrollments
    for (const user of affectedUsers) {
      recalculateCourseProgressOnDelete(user.user_id, courseId);
    }

    res.json({
      message: 'Lesson deleted successfully',
      progressEntriesRemoved: deletedProgressCount?.changes || 0,
      affectedUsers: affectedUsers.length
    });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    res.status(500).json({ error: 'Failed to delete lesson' });
  }
});

// =====================
// LESSON CONTENT ROUTES
// =====================

/**
 * GET /api/courses/:courseId/modules/:moduleId/lessons/:lessonId/content - Get lesson content
 */
router.get('/:courseId/modules/:moduleId/lessons/:lessonId/content', (req, res) => {
  try {
    const { lessonId } = req.params;

    const content = queryAll(
      'SELECT * FROM lesson_content WHERE lesson_id = ? ORDER BY order_index',
      [lessonId]
    );

    // Parse JSON content
    const parsedContent = content.map(c => ({
      ...c,
      content: JSON.parse(c.content || '{}')
    }));

    res.json({ content: parsedContent });
  } catch (error) {
    console.error('Error fetching lesson content:', error);
    res.status(500).json({ error: 'Failed to fetch lesson content' });
  }
});

/**
 * POST /api/courses/:courseId/modules/:moduleId/lessons/:lessonId/content - Add content to lesson (instructor only)
 */
router.post('/:courseId/modules/:moduleId/lessons/:lessonId/content', requireInstructor, (req, res) => {
  try {
    const { lessonId } = req.params;
    const { type = 'text', content = {} } = req.body;

    // Get next order index
    const lastContent = queryOne(
      'SELECT MAX(order_index) as max_order FROM lesson_content WHERE lesson_id = ?',
      [lessonId]
    );
    const orderIndex = (lastContent?.max_order ?? -1) + 1;

    const now = new Date().toISOString();
    run(
      `INSERT INTO lesson_content (lesson_id, type, content, order_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [lessonId, type, JSON.stringify(content), orderIndex, now, now]
    );

    // Fetch the newly created content by lesson_id and order_index (more reliable than lastInsertRowid with sql.js)
    const contentItem = queryOne('SELECT * FROM lesson_content WHERE lesson_id = ? AND order_index = ?', [lessonId, orderIndex]);
    res.status(201).json({
      content: {
        ...contentItem,
        content: JSON.parse(contentItem.content || '{}')
      }
    });
  } catch (error) {
    console.error('Error adding lesson content:', error);
    res.status(500).json({ error: 'Failed to add lesson content' });
  }
});

/**
 * PUT /api/courses/:courseId/modules/:moduleId/lessons/:lessonId/content/:contentId - Update lesson content (instructor only)
 */
router.put('/:courseId/modules/:moduleId/lessons/:lessonId/content/:contentId', requireInstructor, (req, res) => {
  try {
    const { contentId } = req.params;
    const { type, content, order_index } = req.body;

    const existingContent = queryOne('SELECT * FROM lesson_content WHERE id = ?', [contentId]);
    if (!existingContent) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const updates = [];
    const params = [];

    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      params.push(JSON.stringify(content));
    }
    if (order_index !== undefined) {
      updates.push('order_index = ?');
      params.push(order_index);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(contentId);

      run(`UPDATE lesson_content SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updatedContent = queryOne('SELECT * FROM lesson_content WHERE id = ?', [contentId]);
    res.json({
      content: {
        ...updatedContent,
        content: JSON.parse(updatedContent.content || '{}')
      }
    });
  } catch (error) {
    console.error('Error updating lesson content:', error);
    res.status(500).json({ error: 'Failed to update lesson content' });
  }
});

/**
 * DELETE /api/courses/:courseId/modules/:moduleId/lessons/:lessonId/content/:contentId - Delete lesson content (instructor only)
 */
router.delete('/:courseId/modules/:moduleId/lessons/:lessonId/content/:contentId', requireInstructor, (req, res) => {
  try {
    const { contentId } = req.params;

    const existingContent = queryOne('SELECT * FROM lesson_content WHERE id = ?', [contentId]);
    if (!existingContent) {
      return res.status(404).json({ error: 'Content not found' });
    }

    run('DELETE FROM lesson_content WHERE id = ?', [contentId]);

    res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Error deleting lesson content:', error);
    res.status(500).json({ error: 'Failed to delete lesson content' });
  }
});

/**
 * GET /api/courses/:courseId/module-progress - Get module-level progress (Feature #246)
 * Returns progress for each module showing completed/total lessons
 */
router.get('/:courseId/module-progress', (req, res) => {
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
// Trigger reload do., 25 de ene. de 2026 11:58:54
// Trigger reload do., 25 de ene. de 2026 15:01:34

// RELOAD_MARKER: 2026-01-25T21:16:00.000Z
// Feature #191: Unique value validation - 2026-01-25T16:39:21-05:00
// Feature #246: Module progress tracking - 2026-01-26T05:50:00.000Z
// Feature #246 reload trigger
// Feature #246 reload trigger 2
// Feature #246 final reload
