import express from 'express';
import { queryOne, queryAll, run } from '../config/database.js';

const router = express.Router();

/**
 * POST /api/quizzes/import
 * Import quiz questions from CSV file
 *
 * Expected CSV format:
 * question,option1,option2,option3,option4,correct_answer,explanation,points
 */
router.post('/', (req, res) => {
  try {
    const { lessonId, quizTitle, csvData, timeLimitMinutes, maxAttempts, passingScore } = req.body;
    const now = new Date().toISOString();

    // Verify user is an instructor
    if (req.session?.user?.role !== 'instructor_admin') {
      return res.status(403).json({ error: 'Solo los instructores pueden importar preguntas' });
    }

    if (!quizTitle || !csvData) {
      return res.status(400).json({ error: 'Se requiere titulo del quiz y datos CSV' });
    }

    // Parse CSV
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({ error: 'El CSV debe tener al menos una fila de encabezado y una pregunta' });
    }

    // Parse header row
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    // Validate required headers
    const requiredHeaders = ['question', 'option1', 'option2', 'correct_answer'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        error: 'Faltan columnas requeridas: ' + missingHeaders.join(', '),
        expectedHeaders: 'question,option1,option2,option3,option4,correct_answer,explanation,points'
      });
    }

    // Create the quiz
    const result = run(`
      INSERT INTO quizzes (lesson_id, title, description, time_limit_minutes, max_attempts, passing_score, show_correct_answers, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      lessonId || null,
      quizTitle,
      'Quiz importado el ' + new Date().toLocaleDateString('es-ES'),
      timeLimitMinutes || 15,
      maxAttempts || 0,
      passingScore || 70,
      1,
      now,
      now
    ]);

    const quizId = result.lastInsertRowid;
    const importedQuestions = [];
    const errors = [];

    // Parse and insert each question
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = parseCSVLine(line);
        const rowData = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        // Build options array
        const options = [];
        for (let j = 1; j <= 4; j++) {
          const opt = rowData['option' + j];
          if (opt && opt.trim()) {
            options.push(opt.trim());
          }
        }

        // Validate question data
        if (!rowData.question || !rowData.question.trim()) {
          errors.push({ row: i + 1, error: 'Pregunta vacia' });
          continue;
        }

        if (options.length < 2) {
          errors.push({ row: i + 1, error: 'Se requieren al menos 2 opciones' });
          continue;
        }

        const correctAnswer = rowData.correct_answer ? rowData.correct_answer.trim() : '';
        if (!correctAnswer) {
          errors.push({ row: i + 1, error: 'Falta respuesta correcta' });
          continue;
        }

        // Validate correct answer is one of the options
        if (!options.includes(correctAnswer)) {
          errors.push({
            row: i + 1,
            error: 'La respuesta "' + correctAnswer + '" no coincide con ninguna opcion'
          });
          continue;
        }

        const points = parseInt(rowData.points) || 1;
        const explanation = rowData.explanation || '';

        // Insert the question
        run(`
          INSERT INTO quiz_questions (quiz_id, type, question, options, correct_answer, explanation, points, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          quizId,
          'multiple_choice',
          rowData.question.trim(),
          JSON.stringify(options),
          correctAnswer,
          explanation,
          points,
          i - 1
        ]);

        importedQuestions.push({
          question: rowData.question.trim(),
          options,
          correctAnswer,
          points
        });

      } catch (parseError) {
        errors.push({ row: i + 1, error: 'Error de formato: ' + parseError.message });
      }
    }

    // If no questions were imported successfully, delete the quiz
    if (importedQuestions.length === 0) {
      run('DELETE FROM quizzes WHERE id = ?', [quizId]);
      return res.status(400).json({
        error: 'No se pudo importar ninguna pregunta',
        errors
      });
    }

    res.json({
      success: true,
      quizId,
      importedCount: importedQuestions.length,
      totalRows: lines.length - 1,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length > 0
        ? 'Se importaron ' + importedQuestions.length + ' preguntas con ' + errors.length + ' errores'
        : 'Se importaron ' + importedQuestions.length + ' preguntas exitosamente'
    });

  } catch (error) {
    console.error('Error importing quiz:', error);
    res.status(500).json({ error: 'Error al importar el quiz' });
  }
});

/**
 * Helper function to parse CSV line, handling quoted values with commas
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * GET /api/quizzes/import/template
 * Download a sample CSV template for quiz import
 */
router.get('/template', (req, res) => {
  const template = `question,option1,option2,option3,option4,correct_answer,explanation,points
"Cual es la capital de Francia?","Londres","Paris","Berlin","Madrid","Paris","Paris es la capital de Francia desde hace siglos.",1
"Cuanto es 2 + 2?","3","4","5","6","4","La suma de 2 + 2 es igual a 4.",1
"Que lenguaje de programacion se usa principalmente para web frontend?","Python","Java","JavaScript","C++","JavaScript","JavaScript es el lenguaje principal para desarrollo web en el navegador.",1`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=quiz_template.csv');
  res.send('\uFEFF' + template); // BOM for Excel UTF-8 support
});

export default router;
