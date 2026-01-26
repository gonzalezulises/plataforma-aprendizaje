/**
 * Email Service Utility
 *
 * In development mode, emails are logged to the console instead of being sent.
 * This allows testing email-dependent flows without external email services.
 *
 * Feature #201: Email notification for new feedback
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Log an email to the console (development mode)
 * In production, this would integrate with a real email service
 */
function logEmail(to, subject, body, options = {}) {
  const timestamp = new Date().toISOString();
  const separator = '='.repeat(60);

  console.log('\n' + separator);
  console.log('[EMAIL SERVICE] Email notification logged');
  console.log(separator);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  if (options.replyTo) {
    console.log(`Reply-To: ${options.replyTo}`);
  }
  console.log('-'.repeat(60));
  console.log('Body:');
  console.log(body);
  console.log(separator + '\n');

  return {
    success: true,
    logged: true,
    timestamp,
    to,
    subject
  };
}

/**
 * Send an email notification
 * In development, logs to console. In production, would send via email service.
 *
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body (plain text or HTML)
 * @param {Object} options - Additional options (replyTo, etc.)
 * @returns {Object} Result object with success status
 */
export function sendEmail(to, subject, body, options = {}) {
  if (isDevelopment) {
    return logEmail(to, subject, body, options);
  }

  // In production, this would integrate with a real email service
  // For now, always log since we're in development
  return logEmail(to, subject, body, options);
}

/**
 * Send feedback notification email
 * Called when an instructor provides feedback on a student's submission
 *
 * @param {Object} params - Email parameters
 * @param {string} params.studentEmail - Student's email address
 * @param {string} params.studentName - Student's name
 * @param {string} params.courseName - Course name
 * @param {string} params.projectName - Project/assignment name
 * @param {number} params.score - Score received (optional)
 * @param {number} params.maxScore - Maximum possible score (optional)
 * @param {string} params.feedbackLink - Direct link to view feedback
 * @param {string} params.instructorName - Instructor's name (optional)
 */
export function sendFeedbackNotificationEmail({
  studentEmail,
  studentName,
  courseName,
  projectName,
  score,
  maxScore,
  feedbackLink,
  instructorName
}) {
  const subject = `Nueva retroalimentacion disponible - ${projectName || 'Tu entrega'}`;

  const scoreText = (score !== undefined && maxScore !== undefined)
    ? `Puntuacion: ${score}/${maxScore}\n\n`
    : '';

  const instructorText = instructorName
    ? `Tu instructor ${instructorName} ha revisado tu trabajo.`
    : 'Tu instructor ha revisado tu trabajo.';

  const body = `
Hola ${studentName || 'Estudiante'},

${instructorText}

Curso: ${courseName || 'N/A'}
Entrega: ${projectName || 'N/A'}
${scoreText}
Has recibido nueva retroalimentacion sobre tu entrega.
Por favor revisa los comentarios del instructor para mejorar tu trabajo.

Ver retroalimentacion: ${feedbackLink}

---
Este es un correo automatico de la Plataforma de Aprendizaje.
Si tienes alguna pregunta, responde directamente a este correo o contacta a tu instructor.
  `.trim();

  return sendEmail(studentEmail, subject, body);
}

/**
 * Check if user has email notifications enabled for a specific type
 *
 * @param {Object} userPreferences - User's notification preferences JSON
 * @param {string} notificationType - Type of notification (e.g., 'email_feedback_received')
 * @returns {boolean} Whether the notification type is enabled
 */
export function isEmailNotificationEnabled(userPreferences, notificationType) {
  if (!userPreferences) return true; // Default to enabled

  try {
    const prefs = typeof userPreferences === 'string'
      ? JSON.parse(userPreferences)
      : userPreferences;

    // Check nested notifications object
    if (prefs.notifications && typeof prefs.notifications[notificationType] === 'boolean') {
      return prefs.notifications[notificationType];
    }

    // Default to enabled if preference not set
    return true;
  } catch (e) {
    console.error('[EmailService] Error parsing user preferences:', e);
    return true; // Default to enabled on error
  }
}

export default {
  sendEmail,
  sendFeedbackNotificationEmail,
  isEmailNotificationEnabled
};
