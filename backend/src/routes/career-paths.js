import express from 'express';
import { getDatabase, saveDatabase, queryAll, queryOne, run } from '../config/database.js';

const router = express.Router();

/**
 * Initialize career paths tables
 */
export function initCareerPathsTables(db) {
  // Career paths table - defines available career paths
  db.run(`
    CREATE TABLE IF NOT EXISTS career_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT DEFAULT 'briefcase',
      color TEXT DEFAULT '#2563EB',
      course_ids TEXT NOT NULL DEFAULT '[]',
      order_index INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User career path progress - tracks user enrollment and progress in career paths
  db.run(`
    CREATE TABLE IF NOT EXISTS user_career_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      career_path_id INTEGER NOT NULL,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      progress_percent REAL NOT NULL DEFAULT 0,
      current_course_index INTEGER NOT NULL DEFAULT 0,
      courses_completed TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, career_path_id),
      FOREIGN KEY (career_path_id) REFERENCES career_paths(id) ON DELETE CASCADE
    )
  `);

  // Career path completion badges
  db.run(`
    CREATE TABLE IF NOT EXISTS career_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      career_path_id INTEGER NOT NULL,
      badge_name TEXT NOT NULL,
      badge_icon TEXT NOT NULL DEFAULT 'trophy',
      earned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, career_path_id)
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_career_progress_user ON user_career_progress(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_career_progress_path ON user_career_progress(career_path_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_career_badges_user ON career_badges(user_id)`);

  // Seed sample career paths
  seedCareerPaths(db);

  console.log('Career paths tables initialized');
}

/**
 * Seed sample career paths for development
 */
function seedCareerPaths(db) {
  const samplePaths = [
    {
      name: 'Data Scientist',
      slug: 'data-scientist',
      description: 'Domina el analisis de datos, machine learning y visualizacion para convertirte en un cientifico de datos profesional.',
      icon: 'chart-bar',
      color: '#10B981',
      course_slugs: ['python-fundamentos', 'sql-desde-cero', 'data-science-python', 'machine-learning-basico'],
      order_index: 1
    },
    {
      name: 'Python Developer',
      slug: 'python-developer',
      description: 'Aprende Python desde cero hasta nivel avanzado con proyectos practicos y mejores practicas.',
      icon: 'code',
      color: '#3B82F6',
      course_slugs: ['python-fundamentos', 'data-science-python'],
      order_index: 2
    },
    {
      name: 'Web3 Developer',
      slug: 'web3-developer',
      description: 'Desarrolla aplicaciones descentralizadas y smart contracts en la blockchain.',
      icon: 'cube',
      color: '#8B5CF6',
      course_slugs: ['python-fundamentos', 'web3-solidity'],
      order_index: 3
    }
  ];

  const now = new Date().toISOString();

  for (const path of samplePaths) {
    // Check if career path already exists
    const stmt = db.prepare('SELECT id FROM career_paths WHERE slug = ?');
    stmt.bind([path.slug]);
    const exists = stmt.step();
    stmt.free();

    if (!exists) {
      // Get course IDs from slugs
      const courseIds = [];
      for (const slug of path.course_slugs) {
        const courseStmt = db.prepare('SELECT id FROM courses WHERE slug = ?');
        courseStmt.bind([slug]);
        if (courseStmt.step()) {
          const row = courseStmt.getAsObject();
          courseIds.push(row.id);
        }
        courseStmt.free();
      }

      db.run(`
        INSERT INTO career_paths (name, slug, description, icon, color, course_ids, order_index, is_published, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `, [
        path.name,
        path.slug,
        path.description,
        path.icon,
        path.color,
        JSON.stringify(courseIds),
        path.order_index,
        now,
        now
      ]);
      console.log(`Created sample career path: ${path.name}`);
    }
  }
  saveDatabase();
}

// Helper: Get user from session or header
function getUser(req) {
  // Check session first
  if (req.session && req.session.user) {
    return req.session.user;
  }
  // Check x-user-id header (for development/testing)
  const userId = req.headers['x-user-id'];
  if (userId) {
    return { id: parseInt(userId) };
  }
  return null;
}

// Helper: Enrich career path with course details and progress
async function enrichCareerPath(careerPath, userId = null) {
  const courseIds = JSON.parse(careerPath.course_ids || '[]');

  // Get course details
  const courses = [];
  for (const courseId of courseIds) {
    const course = queryOne('SELECT id, title, slug, description, category, level, is_premium, duration_hours, thumbnail_url FROM courses WHERE id = ?', [courseId]);
    if (course) {
      // Check if user is enrolled and their progress
      if (userId) {
        const enrollment = queryOne('SELECT progress_percent, completed_at FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId]);
        course.enrolled = !!enrollment;
        course.progress = enrollment?.progress_percent || 0;
        course.completed = !!enrollment?.completed_at;
      } else {
        course.enrolled = false;
        course.progress = 0;
        course.completed = false;
      }
      courses.push(course);
    }
  }

  // Get user's progress in this career path
  let userProgress = null;
  if (userId) {
    userProgress = queryOne('SELECT * FROM user_career_progress WHERE user_id = ? AND career_path_id = ?', [userId, careerPath.id]);

    // Check if user has earned the badge
    const badge = queryOne('SELECT * FROM career_badges WHERE user_id = ? AND career_path_id = ?', [userId, careerPath.id]);
    careerPath.badge_earned = !!badge;
    careerPath.badge = badge;
  }

  return {
    ...careerPath,
    courses,
    total_courses: courses.length,
    total_hours: courses.reduce((sum, c) => sum + (c.duration_hours || 0), 0),
    user_progress: userProgress
  };
}

/**
 * GET /api/career-paths
 * List all available career paths
 */
router.get('/', async (req, res) => {
  try {
    const user = getUser(req);
    const paths = queryAll('SELECT * FROM career_paths WHERE is_published = 1 ORDER BY order_index ASC');

    const enrichedPaths = [];
    for (const path of paths) {
      const enriched = await enrichCareerPath(path, user?.id);
      enrichedPaths.push(enriched);
    }

    res.json({ career_paths: enrichedPaths });
  } catch (error) {
    console.error('Error listing career paths:', error);
    res.status(500).json({ error: 'Failed to list career paths' });
  }
});

/**
 * PUT /api/career-paths/:slug/update-courses
 * Admin endpoint to update courses in a career path (for testing)
 * NOTE: This route MUST be defined before /:slug to avoid conflicts
 */
router.put('/:slug/update-courses', async (req, res) => {
  try {
    const { slug } = req.params;
    const { course_ids } = req.body;

    console.log('[CareerPaths] PUT /:slug/update-courses called for slug:', slug);

    if (!course_ids || !Array.isArray(course_ids)) {
      return res.status(400).json({ error: 'course_ids array is required' });
    }

    const careerPath = queryOne('SELECT * FROM career_paths WHERE slug = ?', [slug]);
    if (!careerPath) {
      return res.status(404).json({ error: 'Career path not found' });
    }

    const now = new Date().toISOString();
    run(`
      UPDATE career_paths
      SET course_ids = ?, updated_at = ?
      WHERE slug = ?
    `, [JSON.stringify(course_ids), now, slug]);

    const updated = queryOne('SELECT * FROM career_paths WHERE slug = ?', [slug]);
    const enriched = await enrichCareerPath(updated);

    res.json({
      message: 'Career path courses updated',
      career_path: enriched
    });
  } catch (error) {
    console.error('Error updating career path courses:', error);
    res.status(500).json({ error: 'Failed to update career path courses' });
  }
});

/**
 * GET /api/career-paths/:slug
 * Get a specific career path by slug
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const user = getUser(req);

    const careerPath = queryOne('SELECT * FROM career_paths WHERE slug = ?', [slug]);
    if (!careerPath) {
      return res.status(404).json({ error: 'Career path not found' });
    }

    const enriched = await enrichCareerPath(careerPath, user?.id);
    res.json(enriched);
  } catch (error) {
    console.error('Error getting career path:', error);
    res.status(500).json({ error: 'Failed to get career path' });
  }
});

/**
 * POST /api/career-paths/:slug/start
 * Start a career path (enroll user)
 */
router.post('/:slug/start', async (req, res) => {
  try {
    const { slug } = req.params;
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const careerPath = queryOne('SELECT * FROM career_paths WHERE slug = ?', [slug]);
    if (!careerPath) {
      return res.status(404).json({ error: 'Career path not found' });
    }

    // Check if already enrolled
    const existing = queryOne('SELECT * FROM user_career_progress WHERE user_id = ? AND career_path_id = ?', [user.id, careerPath.id]);
    if (existing) {
      return res.status(400).json({ error: 'Already enrolled in this career path', progress: existing });
    }

    // Create career path progress
    const now = new Date().toISOString();
    run(`
      INSERT INTO user_career_progress (user_id, career_path_id, started_at, progress_percent, current_course_index, courses_completed, updated_at)
      VALUES (?, ?, ?, 0, 0, '[]', ?)
    `, [user.id, careerPath.id, now, now]);

    // Optionally auto-enroll in the first course
    const courseIds = JSON.parse(careerPath.course_ids || '[]');
    if (courseIds.length > 0) {
      const firstCourseId = courseIds[0];
      const existingEnrollment = queryOne('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?', [user.id, firstCourseId]);
      if (!existingEnrollment) {
        run(`
          INSERT INTO enrollments (user_id, course_id, enrolled_at, progress_percent)
          VALUES (?, ?, ?, 0)
        `, [user.id, firstCourseId, now]);
      }
    }

    const enriched = await enrichCareerPath(careerPath, user.id);
    res.status(201).json({
      message: 'Career path started successfully',
      career_path: enriched
    });
  } catch (error) {
    console.error('Error starting career path:', error);
    res.status(500).json({ error: 'Failed to start career path' });
  }
});

/**
 * GET /api/career-paths/:slug/progress
 * Get user's progress in a career path
 */
router.get('/:slug/progress', async (req, res) => {
  try {
    const { slug } = req.params;
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const careerPath = queryOne('SELECT * FROM career_paths WHERE slug = ?', [slug]);
    if (!careerPath) {
      return res.status(404).json({ error: 'Career path not found' });
    }

    const progress = queryOne('SELECT * FROM user_career_progress WHERE user_id = ? AND career_path_id = ?', [user.id, careerPath.id]);
    if (!progress) {
      return res.status(404).json({ error: 'Not enrolled in this career path' });
    }

    const enriched = await enrichCareerPath(careerPath, user.id);
    res.json(enriched);
  } catch (error) {
    console.error('Error getting career path progress:', error);
    res.status(500).json({ error: 'Failed to get career path progress' });
  }
});

/**
 * POST /api/career-paths/:slug/complete-course
 * Mark a course as completed in the career path and update progress
 */
router.post('/:slug/complete-course', async (req, res) => {
  try {
    const { slug } = req.params;
    const { course_id } = req.body;
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const careerPath = queryOne('SELECT * FROM career_paths WHERE slug = ?', [slug]);
    if (!careerPath) {
      return res.status(404).json({ error: 'Career path not found' });
    }

    const progress = queryOne('SELECT * FROM user_career_progress WHERE user_id = ? AND career_path_id = ?', [user.id, careerPath.id]);
    if (!progress) {
      return res.status(404).json({ error: 'Not enrolled in this career path' });
    }

    const courseIds = JSON.parse(careerPath.course_ids || '[]');
    if (!courseIds.includes(course_id)) {
      return res.status(400).json({ error: 'Course is not part of this career path' });
    }

    // Update courses_completed
    const coursesCompleted = JSON.parse(progress.courses_completed || '[]');
    if (!coursesCompleted.includes(course_id)) {
      coursesCompleted.push(course_id);
    }

    // Calculate new progress percentage
    const progressPercent = (coursesCompleted.length / courseIds.length) * 100;

    // Find current course index (next uncompleted course)
    let currentCourseIndex = 0;
    for (let i = 0; i < courseIds.length; i++) {
      if (!coursesCompleted.includes(courseIds[i])) {
        currentCourseIndex = i;
        break;
      }
      currentCourseIndex = i + 1;
    }

    const now = new Date().toISOString();
    const isComplete = coursesCompleted.length === courseIds.length;

    // Update progress
    run(`
      UPDATE user_career_progress
      SET courses_completed = ?, progress_percent = ?, current_course_index = ?, completed_at = ?, updated_at = ?
      WHERE user_id = ? AND career_path_id = ?
    `, [
      JSON.stringify(coursesCompleted),
      progressPercent,
      currentCourseIndex,
      isComplete ? now : null,
      now,
      user.id,
      careerPath.id
    ]);

    // If career path is complete, award badge
    let badge = null;
    if (isComplete) {
      const existingBadge = queryOne('SELECT * FROM career_badges WHERE user_id = ? AND career_path_id = ?', [user.id, careerPath.id]);
      if (!existingBadge) {
        run(`
          INSERT INTO career_badges (user_id, career_path_id, badge_name, badge_icon, earned_at)
          VALUES (?, ?, ?, ?, ?)
        `, [user.id, careerPath.id, `${careerPath.name} Completado`, 'trophy', now]);

        badge = {
          badge_name: `${careerPath.name} Completado`,
          badge_icon: 'trophy',
          earned_at: now
        };

        // Create notification for badge earned
        run(`
          INSERT INTO notifications (user_id, type, title, message, content, is_read, created_at)
          VALUES (?, 'badge_earned', ?, ?, ?, 0, ?)
        `, [
          user.id,
          'Has completado una ruta de carrera!',
          `Felicidades! Has completado la ruta "${careerPath.name}" y has ganado una insignia.`,
          JSON.stringify({ career_path_id: careerPath.id, badge_name: badge.badge_name }),
          now
        ]);
      }
    }

    const enriched = await enrichCareerPath(careerPath, user.id);
    res.json({
      message: isComplete ? 'Career path completed! Badge earned!' : 'Course progress updated',
      career_path: enriched,
      badge: badge,
      is_complete: isComplete
    });
  } catch (error) {
    console.error('Error completing course in career path:', error);
    res.status(500).json({ error: 'Failed to update career path progress' });
  }
});

/**
 * POST /api/career-paths/:slug/sync-progress
 * Sync career path progress with course enrollments
 * This recalculates progress based on actual course completions
 */
router.post('/:slug/sync-progress', async (req, res) => {
  try {
    const { slug } = req.params;
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const careerPath = queryOne('SELECT * FROM career_paths WHERE slug = ?', [slug]);
    if (!careerPath) {
      return res.status(404).json({ error: 'Career path not found' });
    }

    let progress = queryOne('SELECT * FROM user_career_progress WHERE user_id = ? AND career_path_id = ?', [user.id, careerPath.id]);
    if (!progress) {
      return res.status(404).json({ error: 'Not enrolled in this career path' });
    }

    const courseIds = JSON.parse(careerPath.course_ids || '[]');
    const coursesCompleted = [];

    // Check which courses are actually completed
    for (const courseId of courseIds) {
      const enrollment = queryOne('SELECT completed_at FROM enrollments WHERE user_id = ? AND course_id = ? AND completed_at IS NOT NULL', [user.id, courseId]);
      if (enrollment) {
        coursesCompleted.push(courseId);
      }
    }

    // Calculate new progress
    const progressPercent = courseIds.length > 0 ? (coursesCompleted.length / courseIds.length) * 100 : 0;

    // Find current course index
    let currentCourseIndex = 0;
    for (let i = 0; i < courseIds.length; i++) {
      if (!coursesCompleted.includes(courseIds[i])) {
        currentCourseIndex = i;
        break;
      }
      currentCourseIndex = i + 1;
    }

    const now = new Date().toISOString();
    const isComplete = coursesCompleted.length === courseIds.length && courseIds.length > 0;

    // Update progress
    run(`
      UPDATE user_career_progress
      SET courses_completed = ?, progress_percent = ?, current_course_index = ?, completed_at = ?, updated_at = ?
      WHERE user_id = ? AND career_path_id = ?
    `, [
      JSON.stringify(coursesCompleted),
      progressPercent,
      currentCourseIndex,
      isComplete ? now : null,
      now,
      user.id,
      careerPath.id
    ]);

    // Award badge if complete and not already awarded
    let badge = null;
    if (isComplete) {
      const existingBadge = queryOne('SELECT * FROM career_badges WHERE user_id = ? AND career_path_id = ?', [user.id, careerPath.id]);
      if (!existingBadge) {
        run(`
          INSERT INTO career_badges (user_id, career_path_id, badge_name, badge_icon, earned_at)
          VALUES (?, ?, ?, ?, ?)
        `, [user.id, careerPath.id, `${careerPath.name} Completado`, 'trophy', now]);

        badge = {
          badge_name: `${careerPath.name} Completado`,
          badge_icon: 'trophy',
          earned_at: now
        };
      }
    }

    const enriched = await enrichCareerPath(careerPath, user.id);
    res.json({
      message: 'Progress synced successfully',
      career_path: enriched,
      badge: badge,
      is_complete: isComplete
    });
  } catch (error) {
    console.error('Error syncing career path progress:', error);
    res.status(500).json({ error: 'Failed to sync career path progress' });
  }
});

/**
 * GET /api/career-paths/user/enrolled
 * Get all career paths the user is enrolled in
 */
router.get('/user/enrolled', async (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const progressRecords = queryAll(`
      SELECT cp.*, ucp.started_at, ucp.completed_at, ucp.progress_percent, ucp.current_course_index, ucp.courses_completed
      FROM career_paths cp
      JOIN user_career_progress ucp ON cp.id = ucp.career_path_id
      WHERE ucp.user_id = ?
      ORDER BY ucp.started_at DESC
    `, [user.id]);

    const enrolledPaths = [];
    for (const record of progressRecords) {
      const enriched = await enrichCareerPath(record, user.id);
      enrolledPaths.push(enriched);
    }

    res.json({ career_paths: enrolledPaths });
  } catch (error) {
    console.error('Error getting enrolled career paths:', error);
    res.status(500).json({ error: 'Failed to get enrolled career paths' });
  }
});

/**
 * GET /api/career-paths/user/badges
 * Get all career path badges earned by user
 */
router.get('/user/badges', async (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const badges = queryAll(`
      SELECT cb.*, cp.name as career_path_name, cp.slug as career_path_slug, cp.color
      FROM career_badges cb
      JOIN career_paths cp ON cb.career_path_id = cp.id
      WHERE cb.user_id = ?
      ORDER BY cb.earned_at DESC
    `, [user.id]);

    res.json({ badges });
  } catch (error) {
    console.error('Error getting career badges:', error);
    res.status(500).json({ error: 'Failed to get career badges' });
  }
});

export default router;
