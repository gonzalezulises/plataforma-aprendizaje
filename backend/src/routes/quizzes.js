import express from 'express';
import { queryOne, queryAll, run, getDatabase } from '../config/database.js';

const router = express.Router();

let tablesInitialized = false;

/**
 * Ensure quiz tables exist (called lazily on first request)
 */
function ensureQuizTables() {
  if (tablesInitialized) return;

  try {
    // Check if database is ready
    getDatabase();
  } catch (e) {
    // Database not ready yet, will be initialized on first request
    return;
  }

  // Quizzes table - stores quiz definitions
  run(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      time_limit_minutes INTEGER DEFAULT NULL,
      max_attempts INTEGER DEFAULT 0,
      passing_score INTEGER DEFAULT 70,
      show_correct_answers INTEGER DEFAULT 1,
      shuffle_questions INTEGER DEFAULT 0,
      shuffle_options INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Quiz questions table
  run(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'multiple_choice',
      question TEXT NOT NULL,
      options TEXT DEFAULT '[]',
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      points INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    )
  `);

  // Quiz attempts table
  run(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      quiz_id INTEGER NOT NULL,
      answers TEXT NOT NULL DEFAULT '{}',
      score REAL NOT NULL DEFAULT 0,
      total_points INTEGER NOT NULL DEFAULT 0,
      passed INTEGER DEFAULT 0,
      attempt_number INTEGER DEFAULT 1,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      time_spent_seconds INTEGER DEFAULT 0,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  run(`CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id)`);
  run(`CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id)`);
  run(`CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id)`);

  tablesInitialized = true;

  // Seed sample quiz after tables are created
  seedSampleQuiz();
}

// Middleware to ensure tables exist before any route handler
router.use((req, res, next) => {
  ensureQuizTables();
  next();
});

/**
 * GET /api/quizzes/:id
 * Get quiz details with questions (without correct answers for active quiz)
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';

    const quiz = queryOne(`SELECT * FROM quizzes WHERE id = ?`, [id]);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get questions (without correct answers initially)
    const questions = queryAll(`
      SELECT id, type, question, options, points, order_index, explanation
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY order_index
    `, [id]).map(q => ({
      ...q,
      options: JSON.parse(q.options || '[]')
    }));

    // Get user's attempts
    const attempts = queryAll(`
      SELECT id, score, total_points, passed, attempt_number, started_at, completed_at
      FROM quiz_attempts
      WHERE user_id = ? AND quiz_id = ?
      ORDER BY attempt_number DESC
    `, [userId, id]);

    // Check if user can attempt (max_attempts = 0 means unlimited)
    const canAttempt = quiz.max_attempts === 0 || attempts.length < quiz.max_attempts;
    const attemptsRemaining = quiz.max_attempts === 0 ? 'unlimited' : Math.max(0, quiz.max_attempts - attempts.length);

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        timeLimitMinutes: quiz.time_limit_minutes,
        maxAttempts: quiz.max_attempts,
        passingScore: quiz.passing_score,
        showCorrectAnswers: !!quiz.show_correct_answers,
        totalQuestions: questions.length,
        totalPoints: questions.reduce((sum, q) => sum + q.points, 0)
      },
      questions: questions.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        points: q.points
      })),
      attempts,
      canAttempt,
      attemptsRemaining
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

/**
 * POST /api/quizzes/:id/start
 * Start a new quiz attempt
 */
router.post('/:id/start', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';
    const now = new Date().toISOString();

    const quiz = queryOne(`SELECT * FROM quizzes WHERE id = ?`, [id]);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Check if user can attempt
    const attemptCount = queryOne(`
      SELECT COUNT(*) as count FROM quiz_attempts
      WHERE user_id = ? AND quiz_id = ?
    `, [userId, id]);

    if (quiz.max_attempts > 0 && attemptCount.count >= quiz.max_attempts) {
      return res.status(400).json({
        error: 'Maximum attempts reached',
        maxAttempts: quiz.max_attempts,
        attemptsMade: attemptCount.count
      });
    }

    // Get total points
    const totalPoints = queryOne(`
      SELECT COALESCE(SUM(points), 0) as total FROM quiz_questions WHERE quiz_id = ?
    `, [id]);

    // Create new attempt
    run(`
      INSERT INTO quiz_attempts (user_id, quiz_id, answers, score, total_points, attempt_number, started_at)
      VALUES (?, ?, '{}', 0, ?, ?, ?)
    `, [userId, id, totalPoints.total, attemptCount.count + 1, now]);

    // Get the actual attempt ID
    const newAttempt = queryOne(`
      SELECT id FROM quiz_attempts
      WHERE user_id = ? AND quiz_id = ? AND started_at = ?
      ORDER BY id DESC LIMIT 1
    `, [userId, id, now]);

    res.json({
      success: true,
      attemptId: newAttempt ? newAttempt.id : null,
      attemptNumber: attemptCount.count + 1,
      startedAt: now,
      timeLimitMinutes: quiz.time_limit_minutes
    });
  } catch (error) {
    console.error('Error starting quiz:', error);
    res.status(500).json({ error: 'Failed to start quiz' });
  }
});

/**
 * POST /api/quizzes/:id/submit-timeout
 * Test endpoint: Simulate a slow server response for timeout testing
 * DEV ONLY - delays response by 35 seconds
 */
router.post('/:id/submit-timeout', async (req, res) => {
  // Only available in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  console.log('[DEV] Simulating 35-second timeout for quiz submission...');
  await new Promise(resolve => setTimeout(resolve, 35000));
  res.json({ simulated: true, message: 'This response was delayed for testing' });
});

/**
 * POST /api/quizzes/:id/submit
 * Submit quiz answers and get results
 */
router.post('/:id/submit', (req, res) => {
  try {
    const { id } = req.params;
    const { attemptId, answers } = req.body;
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';
    const now = new Date().toISOString();

    if (!attemptId || !answers) {
      return res.status(400).json({ error: 'Attempt ID and answers are required' });
    }

    const quiz = queryOne(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Verify attempt belongs to user and is not already completed
    const attempt = queryOne(`
      SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND quiz_id = ?
    `, [attemptId, userId, id]);

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.completed_at) {
      return res.status(400).json({ error: 'This attempt has already been submitted' });
    }

    // Get questions with correct answers
    const questions = queryAll(`
      SELECT id, question, options, correct_answer, explanation, points
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY order_index
    `, [id]).map(q => ({
      ...q,
      options: JSON.parse(q.options || '[]')
    }));

    // Grade the quiz
    let earnedPoints = 0;
    let totalPoints = 0;
    const results = [];

    for (const question of questions) {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correct_answer;

      if (isCorrect) {
        earnedPoints += question.points;
      }

      results.push({
        questionId: question.id,
        question: question.question,
        options: question.options,
        userAnswer: userAnswer || null,
        correctAnswer: quiz.show_correct_answers ? question.correct_answer : null,
        isCorrect,
        points: question.points,
        earnedPoints: isCorrect ? question.points : 0,
        explanation: quiz.show_correct_answers ? question.explanation : null
      });
    }

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= quiz.passing_score;

    // Calculate time spent
    const startTime = new Date(attempt.started_at).getTime();
    const endTime = new Date(now).getTime();
    const timeSpentSeconds = Math.round((endTime - startTime) / 1000);

    // Update attempt with results
    run(`
      UPDATE quiz_attempts
      SET answers = ?, score = ?, passed = ?, completed_at = ?, time_spent_seconds = ?
      WHERE id = ?
    `, [JSON.stringify(answers), score, passed ? 1 : 0, now, timeSpentSeconds, attemptId]);

    // Get remaining attempts
    const attemptCount = queryOne(`
      SELECT COUNT(*) as count FROM quiz_attempts
      WHERE user_id = ? AND quiz_id = ?
    `, [userId, id]);

    const canRetry = quiz.max_attempts === 0 || attemptCount.count < quiz.max_attempts;
    const attemptsRemaining = quiz.max_attempts === 0 ? 'unlimited' : Math.max(0, quiz.max_attempts - attemptCount.count);

    res.json({
      success: true,
      score,
      earnedPoints,
      totalPoints,
      passed,
      passingScore: quiz.passing_score,
      results,
      timeSpentSeconds,
      canRetry,
      attemptsRemaining,
      attemptNumber: attempt.attempt_number
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

/**
 * GET /api/quizzes/:id/attempts
 * Get all attempts for a quiz by the current user
 */
router.get('/:id/attempts', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';

    const attempts = queryAll(`
      SELECT id, score, total_points, passed, attempt_number, started_at, completed_at, time_spent_seconds
      FROM quiz_attempts
      WHERE user_id = ? AND quiz_id = ?
      ORDER BY attempt_number DESC
    `, [userId, id]);

    res.json({ attempts });
  } catch (error) {
    console.error('Error fetching quiz attempts:', error);
    res.status(500).json({ error: 'Failed to fetch quiz attempts' });
  }
});

/**
 * GET /api/quizzes/:id/attempt/:attemptId
 * Get detailed results for a specific attempt
 */
router.get('/:id/attempt/:attemptId', (req, res) => {
  try {
    const { id, attemptId } = req.params;
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';

    const quiz = queryOne(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const attempt = queryOne(`
      SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND quiz_id = ?
    `, [attemptId, userId, id]);

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Get questions with correct answers (only if completed and show_correct_answers is enabled)
    const questions = queryAll(`
      SELECT id, question, options, correct_answer, explanation, points
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY order_index
    `, [id]).map(q => ({
      ...q,
      options: JSON.parse(q.options || '[]')
    }));

    const userAnswers = JSON.parse(attempt.answers || '{}');
    const results = questions.map(q => {
      const userAnswer = userAnswers[q.id];
      const isCorrect = userAnswer === q.correct_answer;
      return {
        questionId: q.id,
        question: q.question,
        options: q.options,
        userAnswer,
        correctAnswer: quiz.show_correct_answers ? q.correct_answer : null,
        isCorrect,
        points: q.points,
        earnedPoints: isCorrect ? q.points : 0,
        explanation: quiz.show_correct_answers ? q.explanation : null
      };
    });

    res.json({
      attempt: {
        id: attempt.id,
        score: attempt.score,
        totalPoints: attempt.total_points,
        passed: !!attempt.passed,
        attemptNumber: attempt.attempt_number,
        startedAt: attempt.started_at,
        completedAt: attempt.completed_at,
        timeSpentSeconds: attempt.time_spent_seconds
      },
      results,
      quiz: {
        title: quiz.title,
        passingScore: quiz.passing_score
      }
    });
  } catch (error) {
    console.error('Error fetching attempt details:', error);
    res.status(500).json({ error: 'Failed to fetch attempt details' });
  }
});

/**
 * DELETE /api/quizzes/:id/attempts
 * Reset/delete all attempts for a quiz (for testing)
 */
router.delete('/:id/attempts', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?.id || req.headers['x-user-id'] || 'anonymous';

    run(`DELETE FROM quiz_attempts WHERE user_id = ? AND quiz_id = ?`, [userId, id]);

    res.json({ success: true, message: 'Attempts reset successfully' });
  } catch (error) {
    console.error('Error resetting attempts:', error);
    res.status(500).json({ error: 'Failed to reset attempts' });
  }
});

/**
 * PATCH /api/quizzes/:id
 * Update quiz settings
 */
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { maxAttempts, passingScore, timeLimitMinutes } = req.body;
    const now = new Date().toISOString();

    const updates = [];
    const params = [];

    if (maxAttempts !== undefined) {
      updates.push('max_attempts = ?');
      params.push(maxAttempts);
    }
    if (passingScore !== undefined) {
      updates.push('passing_score = ?');
      params.push(passingScore);
    }
    if (timeLimitMinutes !== undefined) {
      updates.push('time_limit_minutes = ?');
      params.push(timeLimitMinutes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = ?');
    params.push(now, id);

    run(`UPDATE quizzes SET ${updates.join(', ')} WHERE id = ?`, params);

    const quiz = queryOne(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    res.json({ success: true, quiz });
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

/**
 * POST /api/quizzes
 * Create a new quiz (instructor only)
 */
router.post('/', (req, res) => {
  try {
    const { lessonId, title, description, timeLimitMinutes, maxAttempts, passingScore, showCorrectAnswers, questions } = req.body;
    const now = new Date().toISOString();

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Title and at least one question are required' });
    }

    // Create quiz
    const result = run(`
      INSERT INTO quizzes (lesson_id, title, description, time_limit_minutes, max_attempts, passing_score, show_correct_answers, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      lessonId || null,
      title,
      description || '',
      timeLimitMinutes || null,
      maxAttempts || 0,
      passingScore || 70,
      showCorrectAnswers !== false ? 1 : 0,
      now,
      now
    ]);

    const quizId = result.lastInsertRowid;

    // Add questions
    questions.forEach((q, index) => {
      run(`
        INSERT INTO quiz_questions (quiz_id, type, question, options, correct_answer, explanation, points, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        quizId,
        q.type || 'multiple_choice',
        q.question,
        JSON.stringify(q.options || []),
        q.correctAnswer,
        q.explanation || '',
        q.points || 1,
        index
      ]);
    });

    res.json({
      success: true,
      quizId,
      message: 'Quiz created successfully'
    });
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

/**
 * Seed a sample quiz for testing
 */
export function seedSampleQuiz() {
  // Check if sample quiz already exists
  const existing = queryOne(`SELECT id FROM quizzes WHERE title = 'Quiz: Fundamentos de Python'`);

  let quizId;
  const now = new Date().toISOString();

  if (existing) {
    quizId = existing.id;
    // Check if questions exist
    const questionCount = queryOne(`SELECT COUNT(*) as count FROM quiz_questions WHERE quiz_id = ?`, [quizId]);
    if (questionCount && questionCount.count > 0) {
      console.log(`Sample quiz already exists with ${questionCount.count} questions`);
      return quizId;
    }
    console.log(`Sample quiz exists but has no questions, adding them...`);
  } else {

    // Create sample quiz
    const result = run(`
      INSERT INTO quizzes (lesson_id, title, description, time_limit_minutes, max_attempts, passing_score, show_correct_answers, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      3, // lesson_id for quiz lesson
      'Quiz: Fundamentos de Python',
      'Pon a prueba tus conocimientos sobre variables, tipos de datos y operadores basicos en Python.',
      15, // 15 minutes time limit
      3, // 3 attempts allowed
      70, // 70% passing score
      1, // show correct answers
      now,
      now
    ]);

    // Get the actual quiz ID from the database
    const newQuiz = queryOne(`SELECT id FROM quizzes WHERE title = 'Quiz: Fundamentos de Python'`);
    quizId = newQuiz ? newQuiz.id : result.lastInsertRowid;
  }

  // Add questions
  const questions = [
    {
      type: 'multiple_choice',
      question: 'Cual es el tipo de dato correcto para almacenar el numero 3.14 en Python?',
      options: ['int', 'float', 'str', 'bool'],
      correctAnswer: 'float',
      explanation: 'Los numeros decimales en Python se almacenan como tipo float (punto flotante).',
      points: 1
    },
    {
      type: 'multiple_choice',
      question: 'Cual es la forma correcta de crear una variable en Python?',
      options: ['var nombre = "Juan"', 'nombre = "Juan"', 'string nombre = "Juan"', 'let nombre = "Juan"'],
      correctAnswer: 'nombre = "Juan"',
      explanation: 'En Python, las variables se crean simplemente asignando un valor. No se necesita declarar el tipo.',
      points: 1
    },
    {
      type: 'multiple_choice',
      question: 'Que devuelve type(True) en Python?',
      options: ["<class 'str'>", "<class 'int'>", "<class 'bool'>", "<class 'boolean'>"],
      correctAnswer: "<class 'bool'>",
      explanation: 'True y False son valores booleanos, por lo que type() devuelve <class \'bool\'>.',
      points: 1
    },
    {
      type: 'multiple_choice',
      question: 'Cual es el resultado de 10 // 3 en Python?',
      options: ['3.33', '3', '4', '1'],
      correctAnswer: '3',
      explanation: 'El operador // realiza division entera (floor division), descartando la parte decimal.',
      points: 1
    },
    {
      type: 'multiple_choice',
      question: 'Como se concatenan dos strings en Python?',
      options: ['string1.concat(string2)', 'string1 + string2', 'string1 & string2', 'concat(string1, string2)'],
      correctAnswer: 'string1 + string2',
      explanation: 'En Python, el operador + concatena strings cuando ambos operandos son de tipo string.',
      points: 1
    },
    {
      type: 'multiple_choice',
      question: 'Cual es el resultado de bool("")?',
      options: ['True', 'False', 'None', 'Error'],
      correctAnswer: 'False',
      explanation: 'Un string vacio se evalua como False en Python. Los strings no vacios se evaluan como True.',
      points: 1
    },
    {
      type: 'multiple_choice',
      question: 'Que operador se usa para verificar si dos valores son iguales?',
      options: ['=', '==', '===', 'equals()'],
      correctAnswer: '==',
      explanation: 'El operador == compara si dos valores son iguales. El operador = es para asignacion.',
      points: 1
    },
    {
      type: 'multiple_choice',
      question: 'Cual es la salida de print(2 ** 3)?',
      options: ['6', '8', '5', '9'],
      correctAnswer: '8',
      explanation: 'El operador ** es el operador de potencia. 2 ** 3 significa 2 elevado a la 3, que es 8.',
      points: 1
    },
    {
      type: 'multiple_choice',
      question: 'Que tipo de dato es [1, 2, 3] en Python?',
      options: ['array', 'list', 'tuple', 'set'],
      correctAnswer: 'list',
      explanation: 'Los corchetes [] crean una lista (list) en Python. Es una coleccion ordenada y mutable.',
      points: 1
    },
    {
      type: 'multiple_choice',
      question: 'Cual es el resultado de 5 % 2?',
      options: ['2', '2.5', '1', '0'],
      correctAnswer: '1',
      explanation: 'El operador % devuelve el resto de la division. 5 dividido entre 2 es 2 con resto 1.',
      points: 1
    }
  ];

  questions.forEach((q, index) => {
    run(`
      INSERT INTO quiz_questions (quiz_id, type, question, options, correct_answer, explanation, points, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      quizId,
      q.type,
      q.question,
      JSON.stringify(q.options),
      q.correctAnswer,
      q.explanation,
      q.points,
      index
    ]);
  });

  console.log(`Created sample quiz with ID: ${quizId}`);
  return quizId;
}

// Note: Sample quiz is seeded lazily via the middleware

export default router;
