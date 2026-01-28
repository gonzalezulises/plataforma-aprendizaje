import express from 'express';
import crypto from 'crypto';
import { queryOne, queryAll, run } from '../config/database.js';
import { logAuditEvent, createRequestLogger, AUDIT_EVENTS } from '../utils/auditLogger.js';
// Feature #40: Sensitive operations log audit trail
// Feature #162: User deletion cascade
// Feature #230: Export student progress report - Reloaded 2026-01-26T02:23
// Feature #75: Profile updates are saved
// Feature #28: Account deletion requires email confirmation

const router = express.Router();

// Helper function to generate a secure random token
function generateDeletionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to send confirmation email (logs to console in dev mode)
function sendDeletionConfirmationEmail(email, token, userName) {
  const confirmUrl = `http://localhost:5173/confirm-deletion/${token}`;

  console.log('\n========================================');
  console.log('   ACCOUNT DELETION CONFIRMATION EMAIL');
  console.log('========================================');
  console.log(`To: ${email}`);
  console.log(`Subject: Confirma la eliminacion de tu cuenta`);
  console.log('');
  console.log(`Hola ${userName},`);
  console.log('');
  console.log('Has solicitado eliminar tu cuenta en cursos.rizo.ma.');
  console.log('Si no solicitaste esto, ignora este correo.');
  console.log('');
  console.log('Para confirmar la eliminacion de tu cuenta, haz clic en el siguiente enlace:');
  console.log(`  ${confirmUrl}`);
  console.log('');
  console.log('Este enlace expira en 24 horas.');
  console.log('');
  console.log('ADVERTENCIA: Esta accion es irreversible. Todos tus datos seran eliminados.');
  console.log('========================================\n');

  return { success: true, confirmUrl };
}

/**
 * GET /api/users/me
 * Get current user's profile including bio
 * Feature #75: Profile updates are saved
 */
router.get('/me', (req, res) => {
  const currentUser = req.session?.user;

  if (!req.session?.isAuthenticated || !currentUser) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  try {
    const user = queryOne(
      'SELECT id, email, name, avatar_url, role, bio, preferences, created_at, updated_at FROM users WHERE id = ?',
      [currentUser.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
        bio: user.bio || '',
        preferences: user.preferences ? JSON.parse(user.preferences) : {},
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (err) {
    console.error('[Users] Get profile error:', err);
    res.status(500).json({ success: false, error: 'Error al obtener el perfil' });
  }
});

/**
 * PUT /api/users/me
 * Update current user's profile (bio, name, avatar_url)
 * Feature #75: Profile updates are saved
 */
router.put('/me', (req, res) => {
  const currentUser = req.session?.user;

  if (!req.session?.isAuthenticated || !currentUser) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  try {
    const { bio, name, avatar_url } = req.body;
    const userId = currentUser.id;

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (bio !== undefined) {
      updates.push('bio = ?');
      params.push(bio);
    }

    if (name !== undefined && name.trim().length > 0) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      params.push(avatar_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No se proporcionaron campos para actualizar' });
    }

    // Add updated_at
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    console.log('[Users] Updating profile for user', userId, '- Fields:', updates.slice(0, -1).join(', '));

    run(query, params);

    // Get updated user data
    const updatedUser = queryOne(
      'SELECT id, email, name, avatar_url, role, bio, preferences, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    // Update session user data
    if (updatedUser) {
      req.session.user = {
        ...req.session.user,
        name: updatedUser.name,
        bio: updatedUser.bio,
        avatar_url: updatedUser.avatar_url
      };
    }

    console.log('[Users] Profile updated successfully for user', userId);

    // Feature #40: Log audit event for profile update
    logAuditEvent(userId, AUDIT_EVENTS.PROFILE_UPDATED, {
      action: 'Profile updated',
      updatedFields: updates.slice(0, -1).map(u => u.split(' = ')[0]),
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent']
    });

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatar_url: updatedUser.avatar_url,
        role: updatedUser.role,
        bio: updatedUser.bio || '',
        preferences: updatedUser.preferences ? JSON.parse(updatedUser.preferences) : {},
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at
      }
    });
  } catch (err) {
    console.error('[Users] Update profile error:', err);
    res.status(500).json({ success: false, error: 'Error al actualizar el perfil' });
  }
});

/**
 * GET /api/users/me/progress/export
 * Export current user's complete progress report
 * Feature #230: Export student progress report
 * NOTE: This route MUST be defined before /:id routes to avoid "me" being parsed as an ID
 */
router.get('/me/progress/export', (req, res) => {
  const currentUser = req.session?.user;

  if (!req.session?.isAuthenticated || !currentUser) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  try {
    const userId = currentUser.id;

    // Get user info
    const user = queryOne('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    // Get enrollments with course details
    const enrollments = queryAll(`
      SELECT
        e.id,
        e.course_id,
        e.enrolled_at,
        e.completed_at,
        e.progress_percent,
        e.last_accessed_at,
        c.title as course_title,
        c.category as course_category,
        c.level as course_level,
        c.duration_hours as course_duration_hours
      FROM enrollments e
      LEFT JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ?
      ORDER BY e.enrolled_at DESC
    `, [userId]);

    // Get quiz attempts with scores
    const quizAttempts = queryAll(`
      SELECT
        qa.id,
        qa.quiz_id,
        qa.score,
        qa.total_points,
        qa.passed,
        qa.attempt_number,
        qa.completed_at,
        qa.time_spent_seconds,
        q.title as quiz_title
      FROM quiz_attempts qa
      LEFT JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.user_id = ? AND qa.completed_at IS NOT NULL
      ORDER BY qa.completed_at DESC
    `, [String(userId)]);

    // Get challenge submissions (code challenges)
    const challengeSubmissions = queryAll(`
      SELECT
        cs.id,
        cs.challenge_id,
        cs.is_correct,
        cs.execution_time_ms,
        cs.attempt_number,
        cs.created_at,
        ch.title as challenge_title,
        ch.difficulty as challenge_difficulty
      FROM code_submissions cs
      LEFT JOIN challenges ch ON cs.challenge_id = ch.id
      WHERE cs.user_id = ?
      ORDER BY cs.created_at DESC
    `, [String(userId)]);

    // Get lesson progress
    const lessonProgress = queryAll(`
      SELECT
        lp.id,
        lp.lesson_id,
        lp.status,
        lp.completed_at,
        lp.time_spent_seconds,
        l.title as lesson_title,
        m.title as module_title,
        c.title as course_title
      FROM lesson_progress lp
      LEFT JOIN lessons l ON lp.lesson_id = l.id
      LEFT JOIN modules m ON l.module_id = m.id
      LEFT JOIN courses c ON m.course_id = c.id
      WHERE lp.user_id = ?
      ORDER BY lp.completed_at DESC
    `, [String(userId)]);

    // Get certificates
    const certificates = queryAll(`
      SELECT
        cert.id,
        cert.course_id,
        cert.issued_at,
        cert.verification_code,
        c.title as course_title
      FROM certificates cert
      LEFT JOIN courses c ON cert.course_id = c.id
      WHERE cert.user_id = ?
      ORDER BY cert.issued_at DESC
    `, [userId]);

    // Calculate summary statistics
    const totalCourses = enrollments.length;
    const completedCourses = enrollments.filter(e => e.completed_at !== null).length;
    const totalLessonsCompleted = lessonProgress.filter(lp => lp.status === 'completed').length;
    const totalQuizzesTaken = quizAttempts.length;
    const quizzesPassed = quizAttempts.filter(qa => qa.passed).length;
    const averageQuizScore = quizAttempts.length > 0
      ? Math.round(quizAttempts.reduce((sum, qa) => sum + qa.score, 0) / quizAttempts.length)
      : 0;
    const totalChallengesAttempted = challengeSubmissions.length;
    const challengesSolved = challengeSubmissions.filter(cs => cs.is_correct).length;

    // Generate export timestamp
    const exportTimestamp = new Date().toISOString();

    // Build the progress report
    const progressReport = {
      exportInfo: {
        generatedAt: exportTimestamp,
        format: 'JSON',
        version: '1.0'
      },
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        memberSince: user.created_at
      },
      summary: {
        totalCoursesEnrolled: totalCourses,
        completedCourses: completedCourses,
        completionRate: totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0,
        totalLessonsCompleted: totalLessonsCompleted,
        totalQuizzesTaken: totalQuizzesTaken,
        quizzesPassed: quizzesPassed,
        averageQuizScore: averageQuizScore,
        totalChallengesAttempted: totalChallengesAttempted,
        challengesSolved: challengesSolved,
        certificatesEarned: certificates.length
      },
      courses: enrollments.map(e => ({
        id: e.course_id,
        title: e.course_title,
        category: e.course_category,
        level: e.course_level,
        durationHours: e.course_duration_hours,
        enrolledAt: e.enrolled_at,
        completedAt: e.completed_at,
        progressPercent: e.progress_percent || 0,
        lastAccessedAt: e.last_accessed_at,
        status: e.completed_at ? 'Completado' : 'En progreso'
      })),
      quizScores: quizAttempts.map(qa => ({
        quizId: qa.quiz_id,
        quizTitle: qa.quiz_title,
        score: qa.score,
        totalPoints: qa.total_points,
        passed: qa.passed ? true : false,
        attemptNumber: qa.attempt_number,
        completedAt: qa.completed_at,
        timeSpentSeconds: qa.time_spent_seconds
      })),
      challengeScores: challengeSubmissions
        .filter(cs => cs.is_correct) // Only include successful completions
        .reduce((acc, cs) => {
          // Group by challenge, take only best attempt
          const existing = acc.find(c => c.challengeId === cs.challenge_id);
          if (!existing) {
            acc.push({
              challengeId: cs.challenge_id,
              challengeTitle: cs.challenge_title,
              difficulty: cs.challenge_difficulty,
              solved: true,
              bestExecutionTimeMs: cs.execution_time_ms,
              solvedAt: cs.created_at
            });
          }
          return acc;
        }, []),
      certificates: certificates.map(cert => ({
        courseId: cert.course_id,
        courseTitle: cert.course_title,
        issuedAt: cert.issued_at,
        verificationCode: cert.verification_code
      }))
    };

    // Set response headers for download
    const filename = `progreso-${user.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(progressReport);
  } catch (err) {
    console.error('[Users] Export progress error:', err);
    res.status(500).json({ success: false, error: 'Error al exportar el progreso' });
  }
});

/**
 * GET /api/users/:id
 * Get a user's profile by ID
 * Feature #22: Users can only view their own profile details
 * - Returns FULL profile (including email, preferences) if viewing own profile
 * - Returns PUBLIC profile only (name, avatar, bio, role) for other users
 */
router.get('/:id', (req, res) => {
  const requestedUserId = parseInt(req.params.id);
  const currentUser = req.session?.user;

  // Must be authenticated to view any profile
  if (!req.session?.isAuthenticated || !currentUser) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  try {
    const user = queryOne(
      'SELECT id, email, name, avatar_url, role, bio, preferences, created_at, updated_at FROM users WHERE id = ?',
      [requestedUserId]
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    // Check if user is viewing their own profile
    const isOwnProfile = currentUser.id === requestedUserId;

    if (isOwnProfile) {
      // Return full profile with private data
      console.log('[Users] User', currentUser.id, 'viewing their own profile');
      res.json({
        success: true,
        isOwnProfile: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          role: user.role,
          bio: user.bio || '',
          preferences: user.preferences ? JSON.parse(user.preferences) : {},
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      });
    } else {
      // Return public profile only - NO email or preferences
      console.log('[Users] User', currentUser.id, 'viewing profile of user', requestedUserId, '- returning public data only');
      res.json({
        success: true,
        isOwnProfile: false,
        user: {
          id: user.id,
          name: user.name,
          avatar_url: user.avatar_url,
          role: user.role,
          bio: user.bio || '',
          created_at: user.created_at
          // NOTE: email and preferences are INTENTIONALLY excluded for privacy
        }
      });
    }
  } catch (err) {
    console.error('[Users] Get user profile error:', err);
    res.status(500).json({ success: false, error: 'Error al obtener el perfil' });
  }
});

/**
 * POST /api/users/me/request-deletion
 * Request account deletion - sends confirmation email
 * Feature #28: Account deletion requires email confirmation
 */
router.post('/me/request-deletion', (req, res) => {
  const currentUser = req.session?.user;

  if (!req.session?.isAuthenticated || !currentUser) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  try {
    const userId = currentUser.id;
    const user = queryOne('SELECT id, email, name FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    // Check for existing pending request
    const existingRequest = queryOne(
      'SELECT id, expires_at FROM account_deletion_requests WHERE user_id = ? AND confirmed_at IS NULL',
      [userId]
    );

    const now = new Date();

    if (existingRequest) {
      const expiresAt = new Date(existingRequest.expires_at);
      if (expiresAt > now) {
        // Still valid, resend the email
        const token = queryOne('SELECT token FROM account_deletion_requests WHERE id = ?', [existingRequest.id]).token;
        sendDeletionConfirmationEmail(user.email, token, user.name);
        return res.json({
          success: true,
          message: 'Se ha reenviado el correo de confirmacion a tu email',
          emailSent: true
        });
      } else {
        // Expired, delete and create new
        run('DELETE FROM account_deletion_requests WHERE id = ?', [existingRequest.id]);
      }
    }

    // Generate new token and set expiration to 24 hours
    const token = generateDeletionToken();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Insert deletion request
    run(
      'INSERT INTO account_deletion_requests (user_id, token, email, requested_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      [userId, token, user.email, now.toISOString(), expiresAt]
    );

    // Send confirmation email (logs to console in dev mode)
    sendDeletionConfirmationEmail(user.email, token, user.name);

    console.log('[Users] Account deletion requested for user', userId, '- confirmation email sent');

    // Feature #40: Log audit event for deletion request
    logAuditEvent(userId, AUDIT_EVENTS.ACCOUNT_DELETION_REQUESTED, {
      action: 'Account deletion requested',
      email: user.email,
      expiresAt: expiresAt,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent']
    });

    res.json({
      success: true,
      message: 'Se ha enviado un correo de confirmacion a tu email',
      emailSent: true
    });
  } catch (err) {
    console.error('[Users] Request deletion error:', err);
    res.status(500).json({ success: false, error: 'Error al solicitar la eliminacion de la cuenta' });
  }
});

/**
 * GET /api/users/confirm-deletion/:token
 * Verify a deletion token is valid (used by frontend to show confirmation page)
 * Feature #28: Account deletion requires email confirmation
 */
router.get('/confirm-deletion/:token', (req, res) => {
  const { token } = req.params;

  try {
    const request = queryOne(
      'SELECT adr.*, u.name, u.email FROM account_deletion_requests adr JOIN users u ON adr.user_id = u.id WHERE adr.token = ?',
      [token]
    );

    if (!request) {
      return res.status(404).json({ success: false, error: 'Token de eliminacion no valido', valid: false });
    }

    if (request.confirmed_at) {
      return res.status(400).json({ success: false, error: 'Esta solicitud ya fue procesada', valid: false });
    }

    const now = new Date();
    const expiresAt = new Date(request.expires_at);

    if (expiresAt < now) {
      return res.status(400).json({ success: false, error: 'El enlace de confirmacion ha expirado', valid: false, expired: true });
    }

    res.json({
      success: true,
      valid: true,
      userName: request.name,
      userEmail: request.email,
      expiresAt: request.expires_at
    });
  } catch (err) {
    console.error('[Users] Verify deletion token error:', err);
    res.status(500).json({ success: false, error: 'Error al verificar el token' });
  }
});

/**
 * POST /api/users/confirm-deletion/:token
 * Confirm account deletion via email token - actually deletes the account
 * Feature #28: Account deletion requires email confirmation
 */
router.post('/confirm-deletion/:token', (req, res) => {
  const { token } = req.params;

  try {
    const request = queryOne(
      'SELECT adr.*, u.name, u.email FROM account_deletion_requests adr JOIN users u ON adr.user_id = u.id WHERE adr.token = ?',
      [token]
    );

    if (!request) {
      return res.status(404).json({ success: false, error: 'Token de eliminacion no valido' });
    }

    if (request.confirmed_at) {
      return res.status(400).json({ success: false, error: 'Esta solicitud ya fue procesada' });
    }

    const now = new Date();
    const expiresAt = new Date(request.expires_at);

    if (expiresAt < now) {
      return res.status(400).json({ success: false, error: 'El enlace de confirmacion ha expirado' });
    }

    const userId = request.user_id;
    const userEmail = request.email;
    const userName = request.name;

    console.log('[Users] Confirming account deletion for user', userId, '(', userEmail, ')');

    // Mark the request as confirmed
    run('UPDATE account_deletion_requests SET confirmed_at = ? WHERE token = ?', [now.toISOString(), token]);

    // Delete all user data (cascade delete)
    const deletedData = { userId, email: userEmail, deletedRecords: {} };

    // Delete code_submissions
    try {
      const subResult = run('DELETE FROM code_submissions WHERE user_id = ?', [String(userId)]);
      deletedData.deletedRecords.code_submissions = subResult.changes;
    } catch (e) { deletedData.deletedRecords.code_submissions = 0; }

    // Delete quiz_attempts
    try {
      const quizResult = run('DELETE FROM quiz_attempts WHERE user_id = ?', [String(userId)]);
      deletedData.deletedRecords.quiz_attempts = quizResult.changes;
    } catch (e) { deletedData.deletedRecords.quiz_attempts = 0; }

    // Delete project_submissions
    try {
      const projResult = run('DELETE FROM project_submissions WHERE user_id = ?', [String(userId)]);
      deletedData.deletedRecords.project_submissions = projResult.changes;
    } catch (e) { deletedData.deletedRecords.project_submissions = 0; }

    // Delete forum_replies first
    try {
      const repliesResult = run('DELETE FROM forum_replies WHERE user_id = ?', [String(userId)]);
      deletedData.deletedRecords.forum_replies = repliesResult.changes;
    } catch (e) { deletedData.deletedRecords.forum_replies = 0; }

    // Delete forum_threads
    try {
      const threadsResult = run('DELETE FROM forum_threads WHERE user_id = ?', [String(userId)]);
      deletedData.deletedRecords.forum_threads = threadsResult.changes;
    } catch (e) { deletedData.deletedRecords.forum_threads = 0; }

    // Delete enrollments
    try {
      deletedData.deletedRecords.enrollments = run('DELETE FROM enrollments WHERE user_id = ?', [userId]).changes;
    } catch (e) { deletedData.deletedRecords.enrollments = 0; }

    // Delete lesson progress
    try {
      deletedData.deletedRecords.lesson_progress = run('DELETE FROM lesson_progress WHERE user_id = ?', [String(userId)]).changes;
    } catch (e) { deletedData.deletedRecords.lesson_progress = 0; }

    // Delete video progress
    try {
      deletedData.deletedRecords.video_progress = run('DELETE FROM video_progress WHERE user_id = ?', [String(userId)]).changes;
    } catch (e) { deletedData.deletedRecords.video_progress = 0; }

    // Delete notifications
    try {
      deletedData.deletedRecords.notifications = run('DELETE FROM notifications WHERE user_id = ?', [String(userId)]).changes;
    } catch (e) { deletedData.deletedRecords.notifications = 0; }

    // Delete the deletion request
    run('DELETE FROM account_deletion_requests WHERE user_id = ?', [userId]);

    // Feature #40: Log audit event BEFORE deleting the user (so we have the record)
    logAuditEvent(userId, AUDIT_EVENTS.ACCOUNT_DELETION_CONFIRMED, {
      action: 'Account deletion confirmed via email',
      email: userEmail,
      userName: userName,
      deletedRecords: deletedData.deletedRecords,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent']
    });

    // Finally delete the user
    deletedData.deletedRecords.user = run('DELETE FROM users WHERE id = ?', [userId]).changes;
    console.log('[Users] Account deleted via email confirmation for user', userId);

    // Destroy current session if this was the logged-in user
    if (req.session?.user?.id === userId) {
      req.session.destroy(() => {});
    }

    res.json({
      success: true,
      message: 'Tu cuenta ha sido eliminada permanentemente',
      deletedData
    });
  } catch (err) {
    console.error('[Users] Confirm deletion error:', err);
    res.status(500).json({ success: false, error: 'Error al eliminar la cuenta' });
  }
});

/**
 * GET /api/users/me/deletion-status
 * Check if there's a pending deletion request for the current user
 * Feature #28: Account deletion requires email confirmation
 */
router.get('/me/deletion-status', (req, res) => {
  const currentUser = req.session?.user;

  if (!req.session?.isAuthenticated || !currentUser) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  try {
    const request = queryOne(
      'SELECT id, requested_at, expires_at FROM account_deletion_requests WHERE user_id = ? AND confirmed_at IS NULL',
      [currentUser.id]
    );

    if (!request) {
      return res.json({ success: true, hasPendingRequest: false });
    }

    const now = new Date();
    const expiresAt = new Date(request.expires_at);

    if (expiresAt < now) {
      // Expired, clean up
      run('DELETE FROM account_deletion_requests WHERE id = ?', [request.id]);
      return res.json({ success: true, hasPendingRequest: false });
    }

    res.json({
      success: true,
      hasPendingRequest: true,
      requestedAt: request.requested_at,
      expiresAt: request.expires_at
    });
  } catch (err) {
    console.error('[Users] Get deletion status error:', err);
    res.status(500).json({ success: false, error: 'Error al verificar estado de eliminacion' });
  }
});

/**
 * DELETE /api/users/me/cancel-deletion
 * Cancel a pending deletion request
 * Feature #28: Account deletion requires email confirmation
 */
router.delete('/me/cancel-deletion', (req, res) => {
  const currentUser = req.session?.user;

  if (!req.session?.isAuthenticated || !currentUser) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  try {
    const result = run(
      'DELETE FROM account_deletion_requests WHERE user_id = ? AND confirmed_at IS NULL',
      [currentUser.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'No hay solicitud de eliminacion pendiente' });
    }

    console.log('[Users] Deletion request cancelled for user', currentUser.id);

    // Feature #40: Log audit event for deletion cancellation
    logAuditEvent(currentUser.id, AUDIT_EVENTS.ACCOUNT_DELETION_CANCELLED, {
      action: 'Account deletion request cancelled',
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent']
    });

    res.json({
      success: true,
      message: 'La solicitud de eliminacion ha sido cancelada'
    });
  } catch (err) {
    console.error('[Users] Cancel deletion error:', err);
    res.status(500).json({ success: false, error: 'Error al cancelar la solicitud' });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user account and cascade to all related data
 * Feature #162: Deleting user removes their submissions
 * NOTE: This direct deletion is kept for admin use - regular users should use request-deletion
 */
router.delete('/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const currentUser = req.session?.user;

  console.log('[Users] Delete user request for ID:', userId, 'by user:', currentUser?.id);

  if (!req.session?.isAuthenticated || !currentUser) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  const isAdmin = currentUser.role === 'instructor_admin';
  const isSelf = currentUser.id === userId;

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ success: false, error: 'No tienes permiso para eliminar este usuario' });
  }

  try {
    const user = queryOne('SELECT id, email, name FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const deletedData = { userId: user.id, email: user.email, deletedRecords: {} };

    // Delete code_submissions - Feature #162: Deleting user removes their submissions
    const subResult = run('DELETE FROM code_submissions WHERE user_id = ?', [String(userId)]);
    deletedData.deletedRecords.code_submissions = subResult.changes;
    console.log('[Users] Deleted ' + subResult.changes + ' code submissions for user ' + userId);

    // Delete quiz_attempts - Feature #162
    try {
      const quizResult = run('DELETE FROM quiz_attempts WHERE user_id = ?', [String(userId)]);
      deletedData.deletedRecords.quiz_attempts = quizResult.changes;
      console.log('[Users] Deleted ' + quizResult.changes + ' quiz attempts for user ' + userId);
    } catch (e) {
      deletedData.deletedRecords.quiz_attempts = 0;
    }

    // Delete project_submissions - Feature #162
    try {
      const projResult = run('DELETE FROM project_submissions WHERE user_id = ?', [String(userId)]);
      deletedData.deletedRecords.project_submissions = projResult.changes;
      console.log('[Users] Deleted ' + projResult.changes + ' project submissions for user ' + userId);
    } catch (e) {
      deletedData.deletedRecords.project_submissions = 0;
    }

    // Delete forum_replies first (child table) - Feature #162
    try {
      const repliesResult = run('DELETE FROM forum_replies WHERE user_id = ?', [String(userId)]);
      deletedData.deletedRecords.forum_replies = repliesResult.changes;
      console.log('[Users] Deleted ' + repliesResult.changes + ' forum replies for user ' + userId);
    } catch (e) {
      deletedData.deletedRecords.forum_replies = 0;
    }

    // Delete forum_threads (parent table) - Feature #162
    try {
      const threadsResult = run('DELETE FROM forum_threads WHERE user_id = ?', [String(userId)]);
      deletedData.deletedRecords.forum_threads = threadsResult.changes;
      console.log('[Users] Deleted ' + threadsResult.changes + ' forum threads for user ' + userId);
    } catch (e) {
      deletedData.deletedRecords.forum_threads = 0;
    }

    // Delete enrollments
    deletedData.deletedRecords.enrollments = run('DELETE FROM enrollments WHERE user_id = ?', [userId]).changes;

    // Delete lesson progress
    deletedData.deletedRecords.lesson_progress = run('DELETE FROM lesson_progress WHERE user_id = ?', [String(userId)]).changes;

    // Delete video progress
    deletedData.deletedRecords.video_progress = run('DELETE FROM video_progress WHERE user_id = ?', [String(userId)]).changes;

    // Delete notifications
    deletedData.deletedRecords.notifications = run('DELETE FROM notifications WHERE user_id = ?', [String(userId)]).changes;

    // Feature #40: Log audit event BEFORE deleting the user
    logAuditEvent(currentUser.id, AUDIT_EVENTS.USER_DELETED, {
      action: 'User account deleted by admin',
      targetUserId: userId,
      targetEmail: user.email,
      isSelf: isSelf,
      deletedRecords: deletedData.deletedRecords,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent']
    });

    // Delete user
    deletedData.deletedRecords.user = run('DELETE FROM users WHERE id = ?', [userId]).changes;
    console.log('[Users] Deleted user ' + userId);

    if (isSelf) {
      req.session.destroy(function() {});
    }

    res.json({ success: true, message: 'Usuario y datos eliminados', deletedData });
  } catch (err) {
    console.error('[Users] Delete user error:', err);
    res.status(500).json({ success: false, error: 'Error al eliminar el usuario' });
  }
});

/**
 * GET /api/users/:id/submissions
 * Get submission count for a user (for testing/verification)
 */
router.get('/:id/submissions', (req, res) => {
  try {
    const count = queryOne('SELECT COUNT(*) as count FROM code_submissions WHERE user_id = ?', [String(req.params.id)]);
    res.json({ success: true, userId: parseInt(req.params.id), submissionsCount: count?.count || 0 });
  } catch (err) {
    console.error('[Users] Get submissions count error:', err);
    res.status(500).json({ success: false, error: 'Error al obtener submisiones' });
  }
});

/**
 * POST /api/users/admin/set-role
 * Admin endpoint to update user role
 * Requires admin secret key for security
 */
router.post('/admin/set-role', (req, res) => {
  const { email, role, adminKey } = req.body;

  // Verify admin key (use environment variable in production)
  const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'rizoma-admin-2024';
  if (adminKey !== ADMIN_KEY) {
    return res.status(403).json({ success: false, error: 'Invalid admin key' });
  }

  // Validate role
  const validRoles = ['student_free', 'student_premium', 'instructor', 'instructor_admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role', validRoles });
  }

  try {
    const user = queryOne('SELECT id, email, role FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    run('UPDATE users SET role = ?, updated_at = ? WHERE email = ?', [role, new Date().toISOString(), email]);

    console.log('[Admin] Updated role for', email, 'from', user.role, 'to', role);

    res.json({
      success: true,
      message: `Role updated to ${role}`,
      user: { email, oldRole: user.role, newRole: role }
    });
  } catch (err) {
    console.error('[Admin] Set role error:', err);
    res.status(500).json({ success: false, error: 'Error updating role' });
  }
});

export default router;
