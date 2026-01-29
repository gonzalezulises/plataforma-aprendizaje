import express from 'express';
import { createSupabaseAdmin } from '../lib/supabase.js';

const router = express.Router();

const BUCKET_NAME = 'lesson-videos';
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/**
 * POST /api/video-upload/signed-url
 * Generate a signed URL for direct upload to Supabase Storage
 * The client uploads directly to Supabase without passing through the backend
 */
router.post('/signed-url', async (req, res) => {
  try {
    // Require authentication
    if (!req.session?.isAuthenticated || !req.session?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { filename, contentType, fileSize } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType are required' });
    }

    // Validate content type
    if (!ALLOWED_TYPES.includes(contentType)) {
      return res.status(400).json({
        error: `Tipo de archivo no permitido. Solo: ${ALLOWED_TYPES.join(', ')}`
      });
    }

    // Validate file size if provided
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `Archivo demasiado grande. Maximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }

    // Generate unique path
    const userId = req.session.user.id;
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${timestamp}_${safeName}`;

    const supabase = createSupabaseAdmin();

    // Create signed upload URL (valid for 10 minutes)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(path);

    if (error) {
      console.error('[Video Upload] Signed URL error:', error);
      return res.status(500).json({ error: 'Failed to create upload URL' });
    }

    // Get the public URL for after upload completes
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    res.json({
      success: true,
      signedUrl: data.signedUrl,
      token: data.token,
      path,
      publicUrl: publicUrlData.publicUrl
    });
  } catch (error) {
    console.error('[Video Upload] Error:', error);
    res.status(500).json({ error: 'Failed to process upload request' });
  }
});

export default router;
