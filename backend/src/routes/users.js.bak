import express from 'express';
import { queryOne, run } from '../config/database.js';
// Feature #162: User deletion cascade

const router = express.Router();

/**
 * DELETE /api/users/:id
 * Delete a user account and cascade to all related data
 * Feature #162: Deleting user removes their submissions
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

    // Delete enrollments
    deletedData.deletedRecords.enrollments = run('DELETE FROM enrollments WHERE user_id = ?', [userId]).changes;

    // Delete lesson progress
    deletedData.deletedRecords.lesson_progress = run('DELETE FROM lesson_progress WHERE user_id = ?', [String(userId)]).changes;

    // Delete video progress
    deletedData.deletedRecords.video_progress = run('DELETE FROM video_progress WHERE user_id = ?', [String(userId)]).changes;

    // Delete notifications
    deletedData.deletedRecords.notifications = run('DELETE FROM notifications WHERE user_id = ?', [String(userId)]).changes;

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

export default router;
