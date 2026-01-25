import express from 'express';
import { queryAll, queryOne, run, getDatabase, saveDatabase } from '../config/database.js';
import crypto from 'crypto';

const router = express.Router();

/**
 * Initialize certificates table
 */
export function initCertificatesTables(db) {
  // Certificates table - stores issued certificates
  db.run(`
    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      course_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      course_title TEXT NOT NULL,
      issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      verification_code TEXT NOT NULL UNIQUE,
      certificate_url TEXT,
      UNIQUE(user_id, course_id)
    )
  `);

  // Create indexes for faster lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_certificates_course ON certificates(course_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_certificates_verification ON certificates(verification_code)`);

  saveDatabase();
  console.log('Certificates tables initialized');
}

/**
 * Generate a unique verification code
 */
function generateVerificationCode() {
  return crypto.randomBytes(12).toString('hex').toUpperCase();
}

/**
 * Middleware to check if user is authenticated
 */
function requireAuth(req, res, next) {
  // Check session first
  if (req.session && req.session.user) {
    return next();
  }

  // Fallback: check for userId in body or query (for development)
  const userId = req.body?.userId || req.query?.userId;
  if (userId) {
    req.session = req.session || {};
    req.session.user = { id: userId, name: 'Test User' };
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
}

/**
 * GET /api/certificates
 * Get all certificates for the current user
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;

    const certificates = queryAll(`
      SELECT
        c.*,
        co.slug as course_slug,
        co.thumbnail_url as course_thumbnail,
        co.category as course_category,
        co.level as course_level
      FROM certificates c
      LEFT JOIN courses co ON c.course_id = co.id
      WHERE c.user_id = ?
      ORDER BY c.issued_at DESC
    `, [userId]);

    res.json({
      certificates: certificates.map(cert => ({
        id: cert.id,
        userId: cert.user_id,
        courseId: cert.course_id,
        userName: cert.user_name,
        courseTitle: cert.course_title,
        courseSlug: cert.course_slug,
        courseThumbnail: cert.course_thumbnail,
        courseCategory: cert.course_category,
        courseLevel: cert.course_level,
        issuedAt: cert.issued_at,
        verificationCode: cert.verification_code,
        certificateUrl: cert.certificate_url
      })),
      count: certificates.length
    });
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

/**
 * GET /api/certificates/course/:courseId
 * Get certificate for a specific course (for current user)
 */
router.get('/course/:courseId', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const courseId = req.params.courseId;

    const certificate = queryOne(`
      SELECT
        c.*,
        co.slug as course_slug,
        co.thumbnail_url as course_thumbnail
      FROM certificates c
      LEFT JOIN courses co ON c.course_id = co.id
      WHERE c.user_id = ? AND c.course_id = ?
    `, [userId, courseId]);

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    res.json({
      certificate: {
        id: certificate.id,
        userId: certificate.user_id,
        courseId: certificate.course_id,
        userName: certificate.user_name,
        courseTitle: certificate.course_title,
        courseSlug: certificate.course_slug,
        courseThumbnail: certificate.course_thumbnail,
        issuedAt: certificate.issued_at,
        verificationCode: certificate.verification_code,
        certificateUrl: certificate.certificate_url
      }
    });
  } catch (error) {
    console.error('Error fetching certificate:', error);
    res.status(500).json({ error: 'Failed to fetch certificate' });
  }
});

/**
 * GET /api/certificates/verify/:code
 * Verify a certificate by its verification code (public endpoint)
 */
router.get('/verify/:code', (req, res) => {
  try {
    const code = req.params.code;

    const certificate = queryOne(`
      SELECT
        c.*,
        co.slug as course_slug,
        co.category as course_category,
        co.level as course_level,
        co.duration_hours as course_duration
      FROM certificates c
      LEFT JOIN courses co ON c.course_id = co.id
      WHERE c.verification_code = ?
    `, [code]);

    if (!certificate) {
      return res.status(404).json({
        valid: false,
        error: 'Certificate not found or invalid verification code'
      });
    }

    res.json({
      valid: true,
      certificate: {
        userName: certificate.user_name,
        courseTitle: certificate.course_title,
        courseCategory: certificate.course_category,
        courseLevel: certificate.course_level,
        courseDuration: certificate.course_duration,
        issuedAt: certificate.issued_at,
        verificationCode: certificate.verification_code
      }
    });
  } catch (error) {
    console.error('Error verifying certificate:', error);
    res.status(500).json({ error: 'Failed to verify certificate' });
  }
});

/**
 * POST /api/certificates/issue/:courseId
 * Issue a certificate for a completed course
 */
router.post('/issue/:courseId', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const userName = req.session.user.name || req.body.userName || 'Unknown User';
    const courseId = req.params.courseId;

    // Check if course exists
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if user is enrolled and has completed the course
    const enrollment = queryOne(
      'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (!enrollment) {
      return res.status(400).json({ error: 'User is not enrolled in this course' });
    }

    // For now, allow issuing if progress is 100% OR if completed_at is set
    // In a real app, you'd also check quizzes, projects, etc.
    if (enrollment.progress_percent < 100 && !enrollment.completed_at) {
      return res.status(400).json({
        error: 'Course not completed',
        progress: enrollment.progress_percent
      });
    }

    // Check if certificate already exists
    const existing = queryOne(
      'SELECT * FROM certificates WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (existing) {
      return res.json({
        message: 'Certificate already issued',
        certificate: {
          id: existing.id,
          verificationCode: existing.verification_code,
          issuedAt: existing.issued_at
        }
      });
    }

    // Generate verification code and issue certificate
    const verificationCode = generateVerificationCode();
    const now = new Date().toISOString();

    const result = run(`
      INSERT INTO certificates (user_id, course_id, user_name, course_title, issued_at, verification_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, courseId, userName, course.title, now, verificationCode]);

    res.status(201).json({
      message: 'Certificate issued successfully',
      certificate: {
        id: result.lastInsertRowid,
        userId,
        courseId: parseInt(courseId),
        userName,
        courseTitle: course.title,
        issuedAt: now,
        verificationCode
      }
    });
  } catch (error) {
    console.error('Error issuing certificate:', error);
    res.status(500).json({ error: 'Failed to issue certificate' });
  }
});

/**
 * GET /api/certificates/:id/pdf
 * Generate/download certificate as PDF
 */
router.get('/:id/pdf', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const certId = req.params.id;

    const certificate = queryOne(`
      SELECT
        c.*,
        co.category as course_category,
        co.level as course_level,
        co.duration_hours as course_duration
      FROM certificates c
      LEFT JOIN courses co ON c.course_id = co.id
      WHERE c.id = ? AND c.user_id = ?
    `, [certId, userId]);

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Generate a simple HTML certificate that can be printed/saved as PDF
    const issuedDate = new Date(certificate.issued_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Certificado - ${certificate.course_title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', sans-serif;
      background: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .certificate {
      width: 900px;
      background: white;
      border: 3px solid #2563eb;
      border-radius: 12px;
      padding: 3rem;
      position: relative;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }

    .certificate::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      border: 2px solid #dbeafe;
      border-radius: 8px;
      pointer-events: none;
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 0.5rem;
    }

    .title {
      font-family: 'Playfair Display', serif;
      font-size: 2.5rem;
      color: #1e293b;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: #64748b;
      font-size: 1.1rem;
    }

    .content {
      text-align: center;
      margin: 3rem 0;
    }

    .recipient {
      font-family: 'Playfair Display', serif;
      font-size: 2rem;
      color: #2563eb;
      margin: 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #dbeafe;
      display: inline-block;
    }

    .course-name {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1e293b;
      margin: 1.5rem 0;
    }

    .description {
      color: #475569;
      font-size: 1rem;
      line-height: 1.6;
      max-width: 600px;
      margin: 0 auto;
    }

    .details {
      display: flex;
      justify-content: center;
      gap: 3rem;
      margin: 2rem 0;
      color: #64748b;
    }

    .detail-item {
      text-align: center;
    }

    .detail-label {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .detail-value {
      font-weight: 600;
      color: #1e293b;
      margin-top: 0.25rem;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #e2e8f0;
    }

    .verification {
      text-align: left;
    }

    .verification-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }

    .verification-code {
      font-family: monospace;
      font-size: 0.9rem;
      color: #2563eb;
      background: #f1f5f9;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      margin-top: 0.25rem;
    }

    .signature {
      text-align: right;
    }

    .signature-line {
      width: 150px;
      border-bottom: 1px solid #1e293b;
      margin-bottom: 0.5rem;
      margin-left: auto;
    }

    .signature-name {
      font-size: 0.9rem;
      font-weight: 500;
      color: #1e293b;
    }

    .signature-title {
      font-size: 0.8rem;
      color: #64748b;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }
      .certificate {
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="logo">cursos.rizo.ma</div>
      <h1 class="title">Certificado de Finalizacion</h1>
      <p class="subtitle">Este certificado se otorga a</p>
    </div>

    <div class="content">
      <div class="recipient">${certificate.user_name}</div>

      <p class="description">
        Por haber completado satisfactoriamente todos los modulos, lecciones y evaluaciones del curso
      </p>

      <div class="course-name">${certificate.course_title}</div>

      <div class="details">
        <div class="detail-item">
          <div class="detail-label">Categoria</div>
          <div class="detail-value">${certificate.course_category || 'General'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Nivel</div>
          <div class="detail-value">${certificate.course_level || 'Principiante'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Duracion</div>
          <div class="detail-value">${certificate.course_duration || 20} horas</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Fecha</div>
          <div class="detail-value">${issuedDate}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="verification">
        <div class="verification-label">Codigo de Verificacion</div>
        <div class="verification-code">${certificate.verification_code}</div>
      </div>
      <div class="signature">
        <div class="signature-line"></div>
        <div class="signature-name">Plataforma de Aprendizaje</div>
        <div class="signature-title">cursos.rizo.ma</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="certificado-${certificate.verification_code}.html"`);
    res.send(html);
  } catch (error) {
    console.error('Error generating certificate PDF:', error);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

/**
 * Check if user can get certificate for a course
 */
router.get('/check/:courseId', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const courseId = req.params.courseId;

    // Check enrollment
    const enrollment = queryOne(
      'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (!enrollment) {
      return res.json({
        eligible: false,
        reason: 'Not enrolled in this course',
        hasCertificate: false
      });
    }

    // Check if certificate already issued
    const existing = queryOne(
      'SELECT * FROM certificates WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (existing) {
      return res.json({
        eligible: true,
        hasCertificate: true,
        certificate: {
          id: existing.id,
          verificationCode: existing.verification_code,
          issuedAt: existing.issued_at
        }
      });
    }

    // Check completion status
    const isComplete = enrollment.progress_percent >= 100 || enrollment.completed_at;

    res.json({
      eligible: isComplete,
      hasCertificate: false,
      progress: enrollment.progress_percent,
      reason: isComplete ? 'Ready for certificate' : 'Course not completed yet'
    });
  } catch (error) {
    console.error('Error checking certificate eligibility:', error);
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

export default router;
