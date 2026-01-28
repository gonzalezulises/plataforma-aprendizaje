import express from 'express';
import { queryOne, queryAll, run } from '../config/database.js';
import { generateLessonContent, isClaudeConfigured, getAIProvider, queryCerebroRAG, isCerebroRAGAvailable, isLocalLLMAvailable } from '../lib/claude.js';

const router = express.Router();

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
      description: 'Cerebro-RAG: 128 Data Science books indexed (454,272 chunks)'
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
      useRAG = true // Enable RAG by default
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

    const provider = getAIProvider();
    console.log(`[AI] Generating content for lesson: ${lessonTitle} (provider: ${provider}, RAG: ${useRAG})`);

    const { content, sources, error } = await generateLessonContent({
      lessonTitle,
      lessonType,
      courseTitle: courseTitle || 'Curso',
      moduleTitle: moduleTitle || 'Modulo',
      level,
      targetAudience,
      context,
      useRAG
    });

    if (error) {
      console.error('[AI] Content generation error:', error);
      return res.status(500).json({ error: 'Failed to generate content', details: error });
    }

    // If lessonId provided, optionally save to database
    if (lessonId) {
      const lesson = queryOne('SELECT * FROM lessons WHERE id = ?', [lessonId]);
      if (lesson) {
        run('UPDATE lessons SET content = ?, updated_at = ? WHERE id = ?', [
          content,
          new Date().toISOString(),
          lessonId
        ]);
        console.log('[AI] Content saved to lesson:', lessonId);
      }
    }

    res.json({
      success: true,
      content,
      sources: sources || [], // Books used as reference
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

export default router;
