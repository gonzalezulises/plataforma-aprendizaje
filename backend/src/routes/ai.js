import express from 'express';
import { queryOne, queryAll, run } from '../config/database.js';
import { generateLessonContent, isClaudeConfigured, getAIProvider, queryCerebroRAG, isCerebroRAGAvailable, isLocalLLMAvailable } from '../lib/claude.js';
import { validateAndCleanContent } from '../utils/contentValidator.js';
import { scoreContent } from '../utils/contentQualityScorer.js';
import { emitGlobalBroadcast } from '../utils/websocket-events.js';
import yts from 'yt-search';

const router = express.Router();

// Active batch generation processes
const activeBatches = new Map();

/**
 * GET /api/ai/status
 * Check if AI content generation is available
 */
router.get('/status', async (req, res) => {
  const provider = getAIProvider();
  const [ragAvailable, llmAvailable] = await Promise.all([
    isCerebroRAGAvailable(),
    provider === 'local' ? isLocalLLMAvailable() : Promise.resolve(false)
  ]);

  res.json({
    configured: isClaudeConfigured(),
    provider: provider, // 'local', 'anthropic', or null
    providerDetails: provider === 'local' ? {
      model: process.env.LOCAL_LLM_MODEL || 'nvidia/Qwen3-14B-NVFP4',
      url: process.env.LOCAL_LLM_URL || 'http://100.116.242.33:8000/v1',
      available: llmAvailable
    } : null,
    rag: {
      available: ragAvailable,
      url: process.env.CEREBRO_RAG_URL || 'http://100.116.242.33:8002',
      description: 'Cerebro-RAG: ~145 books indexed (562,834 chunks)'
    },
    features: {
      lessonContent: isClaudeConfigured() && (llmAvailable || provider === 'anthropic'),
      ragEnhanced: ragAvailable,
      quizGeneration: true,
      courseStructure: true
    }
  });
});

/**
 * POST /api/ai/rag/search
 * Search Cerebro-RAG directly for knowledge retrieval
 */
router.post('/rag/search', async (req, res) => {
  try {
    const { query, topK = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const { context, sources, error } = await queryCerebroRAG(query, topK);

    if (error) {
      return res.status(503).json({
        error: 'RAG search failed',
        details: error
      });
    }

    res.json({
      success: true,
      results: sources.map((s, i) => ({
        ...s,
        snippet: context.split('\n\n---\n\n')[i]?.substring(0, 500) + '...'
      })),
      totalResults: sources.length
    });
  } catch (error) {
    console.error('[RAG] Search error:', error);
    res.status(500).json({ error: 'RAG search failed' });
  }
});

/**
 * POST /api/ai/generate-lesson-content
 * Generate content for a lesson using AI with optional RAG enhancement
 */
router.post('/generate-lesson-content', async (req, res) => {
  try {
    const {
      lessonId,
      lessonTitle,
      lessonType = 'text',
      courseTitle,
      moduleTitle,
      level = 'Principiante',
      targetAudience,
      context,
      useRAG = true, // Enable RAG by default
      enhanced = true // Use enhanced pedagogical prompts by default
    } = req.body;

    if (!lessonTitle) {
      return res.status(400).json({ error: 'lessonTitle is required' });
    }

    if (!isClaudeConfigured()) {
      return res.status(503).json({
        error: 'AI content generation not available',
        message: 'No AI provider configured (LOCAL_LLM_URL or ANTHROPIC_API_KEY required)'
      });
    }

    // Fetch structure_4c from the lesson if lessonId provided
    let structure4c = null;
    if (lessonId) {
      const lessonRow = queryOne('SELECT structure_4c FROM lessons WHERE id = ?', [lessonId]);
      if (lessonRow?.structure_4c) {
        try {
          structure4c = typeof lessonRow.structure_4c === 'string'
            ? JSON.parse(lessonRow.structure_4c)
            : lessonRow.structure_4c;
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    const provider = getAIProvider();
    console.log(`[AI] Generating content for lesson: ${lessonTitle} (provider: ${provider}, RAG: ${useRAG}, enhanced: ${enhanced})`);

    const { content, sources, error } = await generateLessonContent({
      lessonTitle,
      lessonType,
      courseTitle: courseTitle || 'Curso',
      moduleTitle: moduleTitle || 'Modulo',
      level,
      targetAudience,
      context,
      useRAG,
      enhanced,
      structure_4c: structure4c
    });

    if (error) {
      console.error('[AI] Content generation error:', error);
      return res.status(500).json({ error: 'Failed to generate content', details: error });
    }

    // Save to lesson_content table if lessonId provided
    let qualityResult = null;
    if (lessonId) {
      const saveResult = saveLessonContent(lessonId, lessonType, content, structure4c);
      qualityResult = saveResult.quality;
      console.log('[AI] Content saved to lesson_content for lesson:', lessonId);
    }

    // Search YouTube for suggested videos when lesson type is video
    let suggestedVideos = [];
    if (lessonType === 'video') {
      try {
        const searchQuery = `${lessonTitle} tutorial`;
        const ytResults = await yts(searchQuery);
        suggestedVideos = ytResults.videos.slice(0, 5).map(v => ({
          id: v.videoId,
          title: v.title,
          url: v.url,
          thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
          duration: v.timestamp,
          author: v.author?.name || ''
        }));
        console.log(`[AI] Found ${suggestedVideos.length} YouTube suggestions for: ${lessonTitle}`);
      } catch (ytError) {
        console.warn('[AI] YouTube suggestion search failed:', ytError.message);
      }
    }

    res.json({
      success: true,
      content,
      sources: sources || [], // Books used as reference
      suggestedVideos,
      quality: qualityResult ? {
        score: qualityResult.overall,
        status: qualityResult.reviewStatus,
        breakdown: qualityResult.breakdown,
        issues: qualityResult.issues
      } : null,
      metadata: {
        generatedAt: new Date().toISOString(),
        lessonTitle,
        lessonType,
        contentLength: content.length,
        provider,
        ragUsed: useRAG && sources.length > 0,
        sourcesCount: sources.length
      }
    });
  } catch (error) {
    console.error('[AI] Error in generate-lesson-content:', error);
    res.status(500).json({ error: 'Failed to generate lesson content' });
  }
});

/**
 * POST /api/ai/generate-quiz
 * Generate quiz questions based on source content or topic
 *
 * For development/demo purposes, this uses predefined templates.
 * In production, this would integrate with an LLM API (OpenAI, Claude, etc.)
 */
router.post('/generate-quiz', (req, res) => {
  try {
    const { sourceContent, topic, questionCount = 5, difficulty = 'medium', lessonId } = req.body;

    if (!sourceContent && !topic) {
      return res.status(400).json({ error: 'Either sourceContent or topic is required' });
    }

    // Determine the topic for generation
    const effectiveTopic = topic || extractTopic(sourceContent);

    // Generate questions based on topic and difficulty
    const questions = generateQuestionsForTopic(effectiveTopic, questionCount, difficulty);

    // Create quiz title and description
    const quizTitle = `Quiz: ${capitalizeFirst(effectiveTopic)}`;
    const quizDescription = `Pon a prueba tus conocimientos sobre ${effectiveTopic}. Este quiz fue generado automaticamente por IA para evaluar tu comprension del tema.`;

    res.json({
      success: true,
      quiz: {
        title: quizTitle,
        description: quizDescription,
        timeLimitMinutes: Math.max(10, questionCount * 2), // 2 min per question
        passingScore: 70,
        maxAttempts: 3,
        showCorrectAnswers: true
      },
      questions,
      metadata: {
        generatedAt: new Date().toISOString(),
        topic: effectiveTopic,
        difficulty,
        questionCount: questions.length,
        sourceContentLength: sourceContent ? sourceContent.length : 0
      }
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

/**
 * POST /api/ai/save-generated-quiz
 * Save an AI-generated quiz to the database
 */
router.post('/save-generated-quiz', (req, res) => {
  try {
    const { lessonId, quiz, questions } = req.body;

    if (!quiz || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Quiz data and questions are required' });
    }

    const now = new Date().toISOString();

    // Create the quiz
    const result = run(`
      INSERT INTO quizzes (lesson_id, title, description, time_limit_minutes, max_attempts, passing_score, show_correct_answers, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      lessonId || null,
      quiz.title,
      quiz.description || '',
      quiz.timeLimitMinutes || null,
      quiz.maxAttempts || 3,
      quiz.passingScore || 70,
      quiz.showCorrectAnswers !== false ? 1 : 0,
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
      message: 'Quiz guardado exitosamente'
    });
  } catch (error) {
    console.error('Error saving quiz:', error);
    res.status(500).json({ error: 'Failed to save quiz' });
  }
});

/**
 * GET /api/ai/topics
 * Get suggested topics for quiz generation
 */
router.get('/topics', (req, res) => {
  const topics = [
    { id: 'python-basics', name: 'Python Basico', category: 'Programacion' },
    { id: 'python-functions', name: 'Funciones en Python', category: 'Programacion' },
    { id: 'python-oop', name: 'Programacion Orientada a Objetos', category: 'Programacion' },
    { id: 'python-data-structures', name: 'Estructuras de Datos en Python', category: 'Programacion' },
    { id: 'sql-basics', name: 'SQL Basico', category: 'Bases de Datos' },
    { id: 'sql-joins', name: 'JOINs en SQL', category: 'Bases de Datos' },
    { id: 'data-science-intro', name: 'Introduccion a Data Science', category: 'Data Science' },
    { id: 'pandas-basics', name: 'Pandas Basico', category: 'Data Science' },
    { id: 'statistics-basics', name: 'Estadistica Basica', category: 'Data Science' },
    { id: 'machine-learning-intro', name: 'Introduccion a Machine Learning', category: 'IA / ML' }
  ];

  res.json({ topics });
});

/**
 * Helper: Extract topic from source content
 */
function extractTopic(content) {
  if (!content) return 'programacion';

  const lowerContent = content.toLowerCase();

  // Check for keywords to determine topic
  if (lowerContent.includes('python') || lowerContent.includes('print(') || lowerContent.includes('def ')) {
    if (lowerContent.includes('class ') || lowerContent.includes('self.')) {
      return 'programacion orientada a objetos en Python';
    }
    if (lowerContent.includes('list') || lowerContent.includes('dict') || lowerContent.includes('tuple')) {
      return 'estructuras de datos en Python';
    }
    if (lowerContent.includes('def ') || lowerContent.includes('return ') || lowerContent.includes('function')) {
      return 'funciones en Python';
    }
    return 'fundamentos de Python';
  }

  if (lowerContent.includes('select') || lowerContent.includes('from ') || lowerContent.includes('where ')) {
    if (lowerContent.includes('join')) {
      return 'JOINs en SQL';
    }
    return 'consultas SQL';
  }

  if (lowerContent.includes('pandas') || lowerContent.includes('dataframe')) {
    return 'analisis de datos con Pandas';
  }

  if (lowerContent.includes('machine learning') || lowerContent.includes('model') || lowerContent.includes('predict')) {
    return 'machine learning';
  }

  return 'programacion';
}

/**
 * Helper: Capitalize first letter
 */
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Helper: Generate questions based on topic
 */
function generateQuestionsForTopic(topic, count, difficulty) {
  const lowerTopic = topic.toLowerCase();

  // Question templates by topic
  const questionBanks = {
    python: [
      {
        question: 'Cual es la forma correcta de declarar una variable en Python?',
        options: ['var nombre = "Juan"', 'nombre = "Juan"', 'let nombre = "Juan"', 'string nombre = "Juan"'],
        correctAnswer: 'nombre = "Juan"',
        explanation: 'En Python, las variables se declaran simplemente asignando un valor con el operador =. No se necesita declarar el tipo ni usar palabras clave como var o let.'
      },
      {
        question: 'Que tipo de dato devuelve type(3.14)?',
        options: ["<class 'int'>", "<class 'float'>", "<class 'str'>", "<class 'decimal'>"],
        correctAnswer: "<class 'float'>",
        explanation: 'Los numeros decimales en Python son de tipo float (punto flotante).'
      },
      {
        question: 'Cual es el resultado de 10 // 3 en Python?',
        options: ['3.33', '3', '4', '1'],
        correctAnswer: '3',
        explanation: 'El operador // realiza division entera (floor division), descartando la parte decimal.'
      },
      {
        question: 'Como se crea una lista vacia en Python?',
        options: ['list()', '[]', 'array()', 'Todas las anteriores son correctas'],
        correctAnswer: 'Todas las anteriores son correctas',
        explanation: 'Una lista vacia se puede crear con list() o con los corchetes vacios []. array() no es nativo de Python pero existe en numpy.'
      },
      {
        question: 'Que funcion se usa para obtener la longitud de una lista?',
        options: ['length()', 'size()', 'len()', 'count()'],
        correctAnswer: 'len()',
        explanation: 'La funcion len() devuelve el numero de elementos en una secuencia (lista, string, tupla, etc.).'
      },
      {
        question: 'Cual es el resultado de "Hola" + " " + "Mundo"?',
        options: ['HolaMundo', '"Hola Mundo"', 'Hola Mundo', 'Error'],
        correctAnswer: 'Hola Mundo',
        explanation: 'El operador + concatena strings en Python, uniendo "Hola", " " y "Mundo" en un solo string.'
      },
      {
        question: 'Que operador se usa para verificar si un valor esta en una lista?',
        options: ['contains', 'has', 'in', 'includes'],
        correctAnswer: 'in',
        explanation: 'El operador "in" verifica si un elemento existe en una secuencia. Ejemplo: "a" in ["a", "b", "c"] devuelve True.'
      },
      {
        question: 'Como se accede al primer elemento de una lista llamada "mi_lista"?',
        options: ['mi_lista[1]', 'mi_lista[0]', 'mi_lista.first()', 'mi_lista.get(0)'],
        correctAnswer: 'mi_lista[0]',
        explanation: 'En Python, los indices comienzan en 0, por lo que el primer elemento esta en la posicion 0.'
      }
    ],
    funciones: [
      {
        question: 'Cual es la palabra clave para definir una funcion en Python?',
        options: ['function', 'func', 'def', 'define'],
        correctAnswer: 'def',
        explanation: 'En Python, las funciones se definen usando la palabra clave "def" seguida del nombre de la funcion.'
      },
      {
        question: 'Que devuelve una funcion que no tiene declaracion return?',
        options: ['0', 'False', 'None', 'Error'],
        correctAnswer: 'None',
        explanation: 'Si una funcion no tiene return o tiene return sin valor, devuelve None por defecto.'
      },
      {
        question: 'Como se llama a una funcion saludar(nombre) con el argumento "Maria"?',
        options: ['saludar Maria', 'saludar("Maria")', 'call saludar("Maria")', 'saludar["Maria"]'],
        correctAnswer: 'saludar("Maria")',
        explanation: 'Las funciones se llaman usando parentesis y pasando los argumentos dentro de ellos.'
      },
      {
        question: 'Que es un parametro con valor por defecto?',
        options: ['Un parametro obligatorio', 'Un parametro que tiene un valor asignado si no se proporciona', 'Un parametro global', 'Un parametro que no puede cambiar'],
        correctAnswer: 'Un parametro que tiene un valor asignado si no se proporciona',
        explanation: 'Los parametros con valor por defecto se definen como def funcion(param=valor) y usan ese valor si no se proporciona otro.'
      },
      {
        question: 'Que palabra clave se usa para devolver un valor desde una funcion?',
        options: ['return', 'give', 'output', 'yield'],
        correctAnswer: 'return',
        explanation: 'La palabra clave return devuelve un valor desde la funcion y termina su ejecucion.'
      }
    ],
    sql: [
      {
        question: 'Que clausula se usa para filtrar registros en SQL?',
        options: ['FILTER', 'WHERE', 'HAVING', 'WHEN'],
        correctAnswer: 'WHERE',
        explanation: 'La clausula WHERE se usa para filtrar registros basandose en una condicion.'
      },
      {
        question: 'Cual es la sintaxis correcta para seleccionar todas las columnas de una tabla?',
        options: ['SELECT ALL FROM tabla', 'SELECT * FROM tabla', 'SELECT tabla.*', 'GET * FROM tabla'],
        correctAnswer: 'SELECT * FROM tabla',
        explanation: 'El asterisco (*) es el comodin que selecciona todas las columnas de una tabla.'
      },
      {
        question: 'Que tipo de JOIN devuelve solo los registros que coinciden en ambas tablas?',
        options: ['LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN'],
        correctAnswer: 'INNER JOIN',
        explanation: 'INNER JOIN devuelve solo las filas donde hay coincidencia en ambas tablas.'
      },
      {
        question: 'Que funcion de agregacion cuenta el numero de registros?',
        options: ['SUM()', 'COUNT()', 'TOTAL()', 'NUM()'],
        correctAnswer: 'COUNT()',
        explanation: 'COUNT() cuenta el numero de filas que coinciden con la consulta.'
      },
      {
        question: 'Que clausula se usa para ordenar resultados?',
        options: ['SORT BY', 'ORDER BY', 'ARRANGE BY', 'GROUP BY'],
        correctAnswer: 'ORDER BY',
        explanation: 'ORDER BY ordena los resultados en orden ascendente (ASC) o descendente (DESC).'
      }
    ],
    oop: [
      {
        question: 'Que palabra clave se usa para definir una clase en Python?',
        options: ['class', 'Class', 'define class', 'new class'],
        correctAnswer: 'class',
        explanation: 'Las clases se definen usando la palabra clave "class" en minusculas.'
      },
      {
        question: 'Que metodo especial se llama al crear una instancia de una clase?',
        options: ['__create__', '__new__', '__init__', '__start__'],
        correctAnswer: '__init__',
        explanation: '__init__ es el constructor que inicializa los atributos de la instancia.'
      },
      {
        question: 'Que es "self" en un metodo de clase?',
        options: ['Una palabra reservada', 'Una referencia a la instancia actual', 'El nombre de la clase', 'Un parametro opcional'],
        correctAnswer: 'Una referencia a la instancia actual',
        explanation: '"self" es la referencia a la instancia actual del objeto, permitiendo acceder a sus atributos y metodos.'
      },
      {
        question: 'Como se hereda de una clase padre en Python?',
        options: ['class Hija extends Padre', 'class Hija : Padre', 'class Hija(Padre)', 'class Hija inherits Padre'],
        correctAnswer: 'class Hija(Padre)',
        explanation: 'En Python, la herencia se indica poniendo la clase padre entre parentesis al definir la clase hija.'
      },
      {
        question: 'Que es la encapsulacion en OOP?',
        options: ['Ocultar detalles internos y exponer una interfaz', 'Crear multiples instancias', 'Heredar de multiples clases', 'Llamar metodos de otras clases'],
        correctAnswer: 'Ocultar detalles internos y exponer una interfaz',
        explanation: 'La encapsulacion es el principio de ocultar la implementacion interna y exponer solo lo necesario a traves de una interfaz publica.'
      }
    ],
    pandas: [
      {
        question: 'Que estructura de datos principal usa Pandas para datos tabulares?',
        options: ['Array', 'Table', 'DataFrame', 'Matrix'],
        correctAnswer: 'DataFrame',
        explanation: 'DataFrame es la estructura principal de Pandas para datos tabulares con filas y columnas.'
      },
      {
        question: 'Como se lee un archivo CSV en Pandas?',
        options: ['pd.open_csv()', 'pd.read_csv()', 'pd.load_csv()', 'pd.import_csv()'],
        correctAnswer: 'pd.read_csv()',
        explanation: 'pd.read_csv() es la funcion para leer archivos CSV y crear un DataFrame.'
      },
      {
        question: 'Como se selecciona una columna llamada "nombre" de un DataFrame df?',
        options: ['df.nombre', 'df["nombre"]', 'df.get("nombre")', 'Todas las anteriores pueden funcionar'],
        correctAnswer: 'Todas las anteriores pueden funcionar',
        explanation: 'Se puede acceder a columnas con notacion de punto (df.nombre) o corchetes (df["nombre"]). get() tambien funciona.'
      },
      {
        question: 'Que metodo muestra las primeras filas de un DataFrame?',
        options: ['df.first()', 'df.head()', 'df.top()', 'df.preview()'],
        correctAnswer: 'df.head()',
        explanation: 'head() muestra las primeras 5 filas por defecto, o el numero especificado.'
      },
      {
        question: 'Como se obtiene informacion sobre los tipos de datos de las columnas?',
        options: ['df.types()', 'df.info()', 'df.describe()', 'df.columns()'],
        correctAnswer: 'df.info()',
        explanation: 'df.info() muestra informacion sobre el DataFrame incluyendo tipos de datos y valores no nulos.'
      }
    ],
    ml: [
      {
        question: 'Que es aprendizaje supervisado?',
        options: ['Aprender sin datos', 'Aprender con datos etiquetados', 'Aprender solo con imagenes', 'Aprender en tiempo real'],
        correctAnswer: 'Aprender con datos etiquetados',
        explanation: 'En aprendizaje supervisado, el modelo aprende de datos que tienen etiquetas o respuestas conocidas.'
      },
      {
        question: 'Cual es la diferencia entre clasificacion y regresion?',
        options: ['No hay diferencia', 'Clasificacion predice categorias, regresion predice valores continuos', 'Clasificacion es mas rapida', 'Regresion usa menos datos'],
        correctAnswer: 'Clasificacion predice categorias, regresion predice valores continuos',
        explanation: 'Clasificacion predice clases discretas (ej: spam/no spam), regresion predice valores numericos continuos (ej: precio).'
      },
      {
        question: 'Que es overfitting?',
        options: ['Cuando el modelo es muy simple', 'Cuando el modelo memoriza los datos de entrenamiento', 'Cuando faltan datos', 'Cuando el modelo es muy lento'],
        correctAnswer: 'Cuando el modelo memoriza los datos de entrenamiento',
        explanation: 'Overfitting ocurre cuando el modelo se ajusta demasiado a los datos de entrenamiento y no generaliza bien a nuevos datos.'
      },
      {
        question: 'Para que se usa train_test_split?',
        options: ['Para limpiar datos', 'Para dividir datos en conjuntos de entrenamiento y prueba', 'Para visualizar datos', 'Para exportar el modelo'],
        correctAnswer: 'Para dividir datos en conjuntos de entrenamiento y prueba',
        explanation: 'train_test_split divide los datos para entrenar el modelo con una parte y evaluarlo con otra.'
      },
      {
        question: 'Que es una metrica de evaluacion?',
        options: ['El tamano del modelo', 'Una medida de que tan bien funciona el modelo', 'La velocidad de entrenamiento', 'El numero de parametros'],
        correctAnswer: 'Una medida de que tan bien funciona el modelo',
        explanation: 'Las metricas (accuracy, precision, recall, F1, etc.) miden el rendimiento del modelo en predicciones.'
      }
    ]
  };

  // Select appropriate question bank
  let selectedBank = questionBanks.python; // default

  if (lowerTopic.includes('funcion')) {
    selectedBank = questionBanks.funciones;
  } else if (lowerTopic.includes('sql') || lowerTopic.includes('consulta') || lowerTopic.includes('base de datos')) {
    selectedBank = questionBanks.sql;
  } else if (lowerTopic.includes('orientada a objeto') || lowerTopic.includes('oop') || lowerTopic.includes('clase')) {
    selectedBank = questionBanks.oop;
  } else if (lowerTopic.includes('pandas') || lowerTopic.includes('dataframe') || lowerTopic.includes('analisis de datos')) {
    selectedBank = questionBanks.pandas;
  } else if (lowerTopic.includes('machine learning') || lowerTopic.includes('ml') || lowerTopic.includes('aprendizaje')) {
    selectedBank = questionBanks.ml;
  }

  // Shuffle and select questions
  const shuffled = [...selectedBank].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  // Add metadata to each question
  return selected.map((q, index) => ({
    id: `generated-${Date.now()}-${index}`,
    type: 'multiple_choice',
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    points: difficulty === 'hard' ? 2 : 1
  }));
}

/**
 * POST /api/ai/batch-generate-course-content/:courseId
 * Generate content for ALL lessons in a course using AI (background process)
 * Returns immediately with batchId, broadcasts progress via WebSocket
 */
router.post('/batch-generate-course-content/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!isClaudeConfigured()) {
      return res.status(503).json({
        error: 'AI content generation not available',
        message: 'No AI provider configured'
      });
    }

    // Query course info
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Query all lessons for the course with module info
    const lessons = queryAll(`
      SELECT l.id, l.title, l.content_type, l.structure_4c, l.duration_minutes,
             m.id as module_id, m.title as module_title, m.order_index as module_order,
             l.order_index as lesson_order
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      WHERE m.course_id = ?
      ORDER BY m.order_index ASC, l.order_index ASC
    `, [courseId]);

    if (lessons.length === 0) {
      return res.status(400).json({ error: 'No lessons found in this course' });
    }

    // Generate a batch ID
    const batchId = `batch_${courseId}_${Date.now()}`;

    // Register the batch
    activeBatches.set(batchId, {
      cancelled: false,
      completed: 0,
      failed: 0,
      total: lessons.length,
      errors: []
    });

    // Return immediately with batch info
    res.status(202).json({
      success: true,
      batchId,
      courseId: parseInt(courseId),
      totalLessons: lessons.length,
      message: `Batch generation started for ${lessons.length} lessons`
    });

    // Process in background (no await)
    processBatchGeneration(batchId, parseInt(courseId), course, lessons);

  } catch (error) {
    console.error('[AI] Error starting batch generation:', error);
    res.status(500).json({ error: 'Failed to start batch generation' });
  }
});

/**
 * POST /api/ai/batch-cancel/:batchId
 * Cancel an in-progress batch generation
 */
router.post('/batch-cancel/:batchId', (req, res) => {
  const { batchId } = req.params;
  const batch = activeBatches.get(batchId);

  if (!batch) {
    return res.status(404).json({ error: 'Batch not found or already completed' });
  }

  batch.cancelled = true;
  res.json({ success: true, message: 'Batch cancellation requested' });
});

/**
 * GET /api/ai/batch-status/:batchId
 * Get current status of a batch generation
 */
router.get('/batch-status/:batchId', (req, res) => {
  const { batchId } = req.params;
  const batch = activeBatches.get(batchId);

  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  res.json({
    batchId,
    completed: batch.completed,
    failed: batch.failed,
    total: batch.total,
    cancelled: batch.cancelled,
    errors: batch.errors
  });
});

/**
 * Background processor for batch content generation
 */
async function processBatchGeneration(batchId, courseId, course, lessons) {
  const batch = activeBatches.get(batchId);
  if (!batch) return;

  console.log(`[AI] Starting batch generation: ${batchId} (${lessons.length} lessons)`);

  for (let i = 0; i < lessons.length; i++) {
    // Check if cancelled
    if (batch.cancelled) {
      console.log(`[AI] Batch ${batchId} cancelled at lesson ${i + 1}/${lessons.length}`);
      break;
    }

    const lesson = lessons[i];

    // Broadcast: generating lesson
    emitGlobalBroadcast({
      type: 'batch_content_progress',
      batchId,
      courseId,
      currentLesson: i + 1,
      totalLessons: lessons.length,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      moduleTitle: lesson.module_title,
      status: 'generating'
    });

    // Parse structure_4c if it's a string
    let structure4c = null;
    if (lesson.structure_4c) {
      try {
        structure4c = typeof lesson.structure_4c === 'string'
          ? JSON.parse(lesson.structure_4c)
          : lesson.structure_4c;
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Retry logic: up to 2 attempts (1 retry) for transient LLM timeouts
    const MAX_ATTEMPTS = 2;
    let lastError = null;
    let success = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (batch.cancelled) break;

      try {
        const { content, sources, error } = await generateLessonContent({
          lessonTitle: lesson.title,
          lessonType: lesson.content_type || 'text',
          courseTitle: course.title,
          moduleTitle: lesson.module_title,
          level: course.level || 'Principiante',
          targetAudience: '',
          useRAG: true,
          enhanced: true,
          structure_4c: structure4c
        });

        if (error) {
          throw new Error(error);
        }

        // Save content to lesson_content table with quality scoring
        const saveResult = saveLessonContent(lesson.id, lesson.content_type, content, structure4c);

        batch.completed++;
        success = true;

        // Broadcast: completed (includes quality score)
        emitGlobalBroadcast({
          type: 'batch_content_progress',
          batchId,
          courseId,
          currentLesson: i + 1,
          totalLessons: lessons.length,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          moduleTitle: lesson.module_title,
          status: 'completed',
          contentLength: content.length,
          qualityScore: saveResult.quality.overall,
          reviewStatus: saveResult.quality.reviewStatus
        });

        console.log(`[AI] Batch ${batchId}: Lesson ${i + 1}/${lessons.length} completed - ${lesson.title} (${content.length} chars)`);
        break; // Success, exit retry loop

      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS) {
          console.warn(`[AI] Batch ${batchId}: Lesson ${i + 1} attempt ${attempt} failed, retrying... (${err.message})`);
          // Brief pause before retry
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    if (!success && !batch.cancelled) {
      batch.failed++;
      batch.errors.push({ lessonId: lesson.id, lessonTitle: lesson.title, error: lastError?.message || 'Unknown error' });

      // Broadcast: failed, continue with next
      emitGlobalBroadcast({
        type: 'batch_content_progress',
        batchId,
        courseId,
        currentLesson: i + 1,
        totalLessons: lessons.length,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        moduleTitle: lesson.module_title,
        status: 'failed',
        error: lastError?.message || 'Unknown error'
      });

      console.error(`[AI] Batch ${batchId}: Lesson ${i + 1}/${lessons.length} failed - ${lesson.title}:`, lastError?.message);
    }
  }

  // Broadcast: batch complete
  emitGlobalBroadcast({
    type: 'batch_content_complete',
    batchId,
    courseId,
    completed: batch.completed,
    failed: batch.failed,
    total: batch.total,
    cancelled: batch.cancelled,
    errors: batch.errors
  });

  console.log(`[AI] Batch ${batchId} finished: ${batch.completed} completed, ${batch.failed} failed, cancelled: ${batch.cancelled}`);

  // Clean up after a delay (keep status available for a bit)
  setTimeout(() => {
    activeBatches.delete(batchId);
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Helper: Save generated content to lesson_content table
 * @param {number} lessonId
 * @param {string} contentType
 * @param {string} rawContent
 * @param {object|null} structure4c - 4C structure for quality scoring
 * @returns {{ cleanedContent: string, warnings: string[], quality: object }}
 */
function saveLessonContent(lessonId, contentType, rawContent, structure4c = null) {
  const now = new Date().toISOString();

  // Validate and clean content before saving
  const { cleanedContent, warnings } = validateAndCleanContent(rawContent, contentType);

  if (warnings.length > 0) {
    console.warn(`[ContentValidator] Lesson ${lessonId}: ${warnings.length} issue(s) found:`);
    warnings.forEach(w => console.warn(`[ContentValidator]   - ${w}`));
  }

  // Score content quality
  const quality = scoreContent(cleanedContent, structure4c);
  console.log(`[QualityScorer] Lesson ${lessonId}: score=${quality.overall}, status=${quality.reviewStatus}, issues=${quality.issues.length}`);

  // Delete existing content for this lesson
  run('DELETE FROM lesson_content WHERE lesson_id = ?', [lessonId]);

  // Insert validated content with quality data
  run(`INSERT INTO lesson_content (lesson_id, type, content, order_index, review_status, quality_score, quality_breakdown, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [lessonId, contentType || 'text', JSON.stringify({ text: cleanedContent }), quality.reviewStatus, quality.overall, JSON.stringify(quality.breakdown), now, now]
  );

  return { cleanedContent, warnings, quality };
}

/**
 * POST /api/ai/regenerate-lesson-content
 * Regenerate content for a lesson — either all sections or a specific 4C section.
 *
 * Body: { lessonId, instructions?, regenerateSection: 'all'|'conexiones'|'conceptos'|'practica'|'conclusion' }
 */
router.post('/regenerate-lesson-content', async (req, res) => {
  try {
    const {
      lessonId,
      instructions = '',
      regenerateSection = 'all'
    } = req.body;

    if (!lessonId) {
      return res.status(400).json({ error: 'lessonId is required' });
    }

    if (!isClaudeConfigured()) {
      return res.status(503).json({ error: 'AI content generation not available' });
    }

    // Fetch lesson + module + course context
    const lesson = queryOne(`
      SELECT l.*, m.title as module_title, m.course_id, c.title as course_title, c.level
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      JOIN courses c ON m.course_id = c.id
      WHERE l.id = ?
    `, [lessonId]);

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Parse structure_4c
    let structure4c = null;
    if (lesson.structure_4c) {
      try {
        structure4c = typeof lesson.structure_4c === 'string'
          ? JSON.parse(lesson.structure_4c)
          : lesson.structure_4c;
      } catch (e) { /* ignore */ }
    }

    const sectionHeaderMap = {
      conexiones: '## 🔗 Conexiones',
      conceptos: '## 💡 Conceptos',
      practica: '## 🛠️ Practica Concreta',
      conclusion: '## 🎯 Conclusion'
    };

    let finalContent;

    if (regenerateSection === 'all') {
      // Full regeneration with optional additional instructions
      const contextWithInstructions = instructions
        ? `Instrucciones adicionales del instructor: ${instructions}`
        : '';

      const { content, error } = await generateLessonContent({
        lessonTitle: lesson.title,
        lessonType: lesson.content_type || 'text',
        courseTitle: lesson.course_title,
        moduleTitle: lesson.module_title,
        level: lesson.level || 'Principiante',
        context: contextWithInstructions,
        useRAG: true,
        enhanced: true,
        structure_4c: structure4c
      });

      if (error) {
        return res.status(500).json({ error: 'Failed to regenerate content', details: error });
      }

      finalContent = content;
    } else {
      // Partial regeneration — only one section
      if (!sectionHeaderMap[regenerateSection]) {
        return res.status(400).json({ error: `Invalid section: ${regenerateSection}. Use: all, conexiones, conceptos, practica, conclusion` });
      }

      // Fetch existing content
      const existingRow = queryOne(
        'SELECT content FROM lesson_content WHERE lesson_id = ? ORDER BY order_index LIMIT 1',
        [lessonId]
      );

      if (!existingRow) {
        return res.status(400).json({ error: 'No existing content to partially regenerate. Use regenerateSection=all instead.' });
      }

      let existingContent;
      try {
        const parsed = JSON.parse(existingRow.content);
        existingContent = parsed.text || '';
      } catch (e) {
        existingContent = existingRow.content;
      }

      // Parse existing content into sections
      const existingSections = {};
      const orderedKeys = ['conexiones', 'conceptos', 'practica', 'conclusion'];

      for (let i = 0; i < orderedKeys.length; i++) {
        const key = orderedKeys[i];
        const header = sectionHeaderMap[key];
        const startIdx = existingContent.indexOf(header);
        if (startIdx === -1) {
          existingSections[key] = '';
          continue;
        }

        // Find end: start of next section or end of content
        let endIdx = existingContent.length;
        for (let j = i + 1; j < orderedKeys.length; j++) {
          const nextHeader = sectionHeaderMap[orderedKeys[j]];
          const nextIdx = existingContent.indexOf(nextHeader);
          if (nextIdx !== -1) {
            endIdx = nextIdx;
            break;
          }
        }

        existingSections[key] = existingContent.substring(startIdx, endIdx);
      }

      // Generate only the target section
      const sectionPrompt = `Regenera SOLO la seccion "${sectionHeaderMap[regenerateSection]}" para la leccion "${lesson.title}".
${instructions ? `Instrucciones del instructor: ${instructions}` : ''}
Genera SOLO el contenido de esa seccion (incluyendo el header ##). No incluyas otras secciones.`;

      const { content: sectionContent, error } = await generateLessonContent({
        lessonTitle: lesson.title,
        lessonType: lesson.content_type || 'text',
        courseTitle: lesson.course_title,
        moduleTitle: lesson.module_title,
        level: lesson.level || 'Principiante',
        context: sectionPrompt,
        useRAG: true,
        enhanced: true,
        structure_4c: structure4c
      });

      if (error) {
        return res.status(500).json({ error: 'Failed to regenerate section', details: error });
      }

      // Replace the target section with new content
      existingSections[regenerateSection] = sectionContent;

      // Reassemble all 4 sections
      finalContent = orderedKeys
        .map(key => existingSections[key])
        .filter(s => s.length > 0)
        .join('\n\n');
    }

    // Validate, score, and save
    const saveResult = saveLessonContent(lessonId, lesson.content_type, finalContent, structure4c);

    res.json({
      success: true,
      content: saveResult.cleanedContent,
      quality: {
        score: saveResult.quality.overall,
        status: saveResult.quality.reviewStatus,
        breakdown: saveResult.quality.breakdown,
        issues: saveResult.quality.issues
      },
      validatorWarnings: saveResult.warnings,
      regeneratedSection: regenerateSection
    });
  } catch (error) {
    console.error('[AI] Error in regenerate-lesson-content:', error);
    res.status(500).json({ error: 'Failed to regenerate lesson content' });
  }
});

export default router;
