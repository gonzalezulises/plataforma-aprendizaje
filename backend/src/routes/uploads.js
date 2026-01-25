import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDatabase } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  // Allow common document and image types
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'text/markdown',
    'application/json',
    'text/javascript',
    'text/x-python',
    'application/x-python-code',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5 // Max 5 files at once
  }
});

// Helper to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
};

// Initialize uploads table
export const initUploadsTables = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      context TEXT,
      context_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
};

// Upload single file
router.post('/single', requireAuth, (req, res, next) => {
  const uploadSingle = upload.single('file');

  uploadSingle(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      let message = 'Error al subir el archivo';

      if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'El archivo excede el tamano maximo permitido (10MB)';
      } else if (err.code === 'LIMIT_FILE_COUNT') {
        message = 'Se ha excedido el numero maximo de archivos';
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        message = 'Campo de archivo inesperado';
      }

      return res.status(400).json({ error: message, code: err.code });
    } else if (err) {
      // Other errors (including file filter rejections)
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibio ningun archivo' });
    }

    try {
      const db = await getDatabase();
      const user = req.session?.user;
      const { context, context_id } = req.body;

      // Get user ID, fallback to 1 for development if not set
      const userId = user?.id || 1;

      // Save upload record to database
      const result = db.prepare(`
        INSERT INTO uploads (user_id, filename, original_name, mimetype, size, path, context, context_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path,
        context || null,
        context_id || null
      );

      res.status(201).json({
        success: true,
        upload: {
          id: result.lastInsertRowid,
          filename: req.file.filename,
          original_name: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: `/api/uploads/file/${req.file.filename}`
        }
      });
    } catch (error) {
      console.error('Error saving upload record:', error);
      // Delete the uploaded file if database save fails
      fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: 'Error al guardar el registro del archivo' });
    }
  });
});

// Upload multiple files
router.post('/multiple', requireAuth, (req, res, next) => {
  const uploadMultiple = upload.array('files', 5);

  uploadMultiple(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      let message = 'Error al subir los archivos';

      if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'Uno o mas archivos exceden el tamano maximo permitido (10MB)';
      } else if (err.code === 'LIMIT_FILE_COUNT') {
        message = 'Se ha excedido el numero maximo de archivos (5)';
      }

      return res.status(400).json({ error: message, code: err.code });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron archivos' });
    }

    try {
      const db = await getDatabase();
      const user = req.session?.user;
      const { context, context_id } = req.body;

      // Get user ID, fallback to 1 for development if not set
      const userId = user?.id || 1;

      const uploads = [];
      const insertStmt = db.prepare(`
        INSERT INTO uploads (user_id, filename, original_name, mimetype, size, path, context, context_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const file of req.files) {
        const result = insertStmt.run(
          userId,
          file.filename,
          file.originalname,
          file.mimetype,
          file.size,
          file.path,
          context || null,
          context_id || null
        );

        uploads.push({
          id: result.lastInsertRowid,
          filename: file.filename,
          original_name: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: `/api/uploads/file/${file.filename}`
        });
      }

      res.status(201).json({
        success: true,
        uploads: uploads,
        count: uploads.length
      });
    } catch (error) {
      console.error('Error saving upload records:', error);
      // Delete uploaded files if database save fails
      for (const file of req.files) {
        fs.unlink(file.path, () => {});
      }
      res.status(500).json({ error: 'Error al guardar los registros de archivos' });
    }
  });
});

// Get file by filename
router.get('/file/:filename', async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadsDir, filename);

  // Validate filename to prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Nombre de archivo invalido' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }

  res.sendFile(filePath);
});

// Get user's uploads
router.get('/my-uploads', requireAuth, async (req, res) => {
  try {
    const db = await getDatabase();
    const user = req.session.user;
    const { context, context_id, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT id, filename, original_name, mimetype, size, context, context_id, created_at
      FROM uploads
      WHERE user_id = ?
    `;
    const params = [user.id];

    if (context) {
      query += ' AND context = ?';
      params.push(context);
    }

    if (context_id) {
      query += ' AND context_id = ?';
      params.push(context_id);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const uploads = db.prepare(query).all(...params);

    const uploadsWithUrls = uploads.map(upload => ({
      ...upload,
      url: `/api/uploads/file/${upload.filename}`
    }));

    res.json({ uploads: uploadsWithUrls });
  } catch (error) {
    console.error('Error fetching uploads:', error);
    res.status(500).json({ error: 'Error al obtener los archivos' });
  }
});

// Delete upload
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDatabase();
    const user = req.session.user;
    const { id } = req.params;

    // Get upload record
    const upload = db.prepare(`
      SELECT * FROM uploads WHERE id = ? AND user_id = ?
    `).get(id, user.id);

    if (!upload) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Delete file from disk
    if (fs.existsSync(upload.path)) {
      fs.unlinkSync(upload.path);
    }

    // Delete database record
    db.prepare('DELETE FROM uploads WHERE id = ?').run(id);

    res.json({ success: true, message: 'Archivo eliminado' });
  } catch (error) {
    console.error('Error deleting upload:', error);
    res.status(500).json({ error: 'Error al eliminar el archivo' });
  }
});

// Test endpoint for simulating upload errors (DEV ONLY)
if (process.env.NODE_ENV !== 'production') {
  // Simulate network timeout during upload
  router.post('/test/timeout', requireAuth, (req, res) => {
    // Delay response for 35 seconds to trigger timeout
    setTimeout(() => {
      res.json({ success: true });
    }, 35000);
  });

  // Simulate server error during upload
  router.post('/test/error-500', requireAuth, (req, res) => {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error simulado del servidor durante la subida'
    });
  });

  // Simulate slow upload (for progress testing)
  router.post('/test/slow', requireAuth, upload.single('file'), async (req, res) => {
    // Wait 3 seconds before responding
    await new Promise(resolve => setTimeout(resolve, 3000));
    res.json({
      success: true,
      upload: {
        id: Date.now(),
        filename: req.file?.filename || 'test.txt',
        original_name: req.file?.originalname || 'test.txt',
        size: req.file?.size || 0
      }
    });
  });
}

export default router;

