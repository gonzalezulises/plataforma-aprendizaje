import express from 'express';
import { queryOne, run } from '../config/database.js';

const router = express.Router();

// Middleware to require instructor role
function requireInstructor(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * AI Course Structure Generator
 * Simulates AI-powered course structure generation based on topic and goals
 */
function generateCourseStructure(topic, goals, level, targetAudience) {
  const topicLower = topic.toLowerCase();

  const courseTemplates = {
    python: {
      modules: [
        {
          title: 'Introduccion a Python',
          description: 'Fundamentos del lenguaje Python y configuracion del entorno',
          bloom_objective: 'Comprender la sintaxis basica de Python',
          lessons: [
            { title: 'Que es Python y por que aprenderlo', duration_minutes: 15 },
            { title: 'Instalacion y configuracion del entorno', duration_minutes: 20 },
            { title: 'Tu primer programa en Python', duration_minutes: 25 },
            { title: 'Variables y tipos de datos', duration_minutes: 30 }
          ]
        },
        {
          title: 'Estructuras de Control',
          description: 'Aprende a controlar el flujo de tu programa',
          bloom_objective: 'Aplicar estructuras de control en programas',
          lessons: [
            { title: 'Condicionales if, elif, else', duration_minutes: 25 },
            { title: 'Bucles for y while', duration_minutes: 30 },
            { title: 'Comprension de listas', duration_minutes: 25 },
            { title: 'Manejo de excepciones', duration_minutes: 20 }
          ]
        },
        {
          title: 'Funciones y Modulos',
          description: 'Organiza tu codigo con funciones y modulos',
          bloom_objective: 'Disenar funciones reutilizables',
          lessons: [
            { title: 'Definicion y llamada de funciones', duration_minutes: 25 },
            { title: 'Parametros y valores de retorno', duration_minutes: 20 },
            { title: 'Alcance de variables (scope)', duration_minutes: 20 },
            { title: 'Importacion de modulos', duration_minutes: 25 }
          ]
        },
        {
          title: 'Estructuras de Datos',
          description: 'Trabaja con colecciones de datos',
          bloom_objective: 'Manipular estructuras de datos complejas',
          lessons: [
            { title: 'Listas y tuplas', duration_minutes: 30 },
            { title: 'Diccionarios', duration_minutes: 25 },
            { title: 'Conjuntos (sets)', duration_minutes: 20 },
            { title: 'Proyecto: Sistema de gestion de datos', duration_minutes: 45 }
          ]
        }
      ]
    },
    javascript: {
      modules: [
        {
          title: 'Fundamentos de JavaScript',
          description: 'Aprende las bases del lenguaje mas popular de la web',
          bloom_objective: 'Comprender la sintaxis de JavaScript',
          lessons: [
            { title: 'Introduccion a JavaScript', duration_minutes: 20 },
            { title: 'Variables: var, let y const', duration_minutes: 25 },
            { title: 'Tipos de datos y operadores', duration_minutes: 30 },
            { title: 'Funciones y arrow functions', duration_minutes: 30 }
          ]
        },
        {
          title: 'Manipulacion del DOM',
          description: 'Interactua con paginas web dinamicamente',
          bloom_objective: 'Manipular elementos HTML con JavaScript',
          lessons: [
            { title: 'Seleccion de elementos', duration_minutes: 25 },
            { title: 'Eventos y event listeners', duration_minutes: 30 },
            { title: 'Modificacion de estilos y contenido', duration_minutes: 25 },
            { title: 'Proyecto: Aplicacion interactiva', duration_minutes: 45 }
          ]
        },
        {
          title: 'JavaScript Asincrono',
          description: 'Maneja operaciones asincronas eficientemente',
          bloom_objective: 'Implementar codigo asincrono',
          lessons: [
            { title: 'Callbacks y problemas comunes', duration_minutes: 25 },
            { title: 'Promesas (Promises)', duration_minutes: 30 },
            { title: 'Async/Await', duration_minutes: 30 },
            { title: 'Fetch API y peticiones HTTP', duration_minutes: 35 }
          ]
        }
      ]
    },
    'data science': {
      modules: [
        {
          title: 'Introduccion a Data Science',
          description: 'Conceptos fundamentales de ciencia de datos',
          bloom_objective: 'Comprender el proceso de analisis de datos',
          lessons: [
            { title: 'Que es Data Science', duration_minutes: 20 },
            { title: 'El ciclo de vida de un proyecto de datos', duration_minutes: 25 },
            { title: 'Herramientas y ecosistema Python', duration_minutes: 30 },
            { title: 'Jupyter Notebooks', duration_minutes: 25 }
          ]
        },
        {
          title: 'Analisis con Pandas',
          description: 'Manipulacion y analisis de datos tabulares',
          bloom_objective: 'Manipular DataFrames eficientemente',
          lessons: [
            { title: 'Introduccion a Pandas', duration_minutes: 25 },
            { title: 'DataFrames y Series', duration_minutes: 30 },
            { title: 'Limpieza de datos', duration_minutes: 35 },
            { title: 'Agregaciones y groupby', duration_minutes: 30 }
          ]
        },
        {
          title: 'Visualizacion de Datos',
          description: 'Crea graficos informativos y atractivos',
          bloom_objective: 'Disenar visualizaciones efectivas',
          lessons: [
            { title: 'Matplotlib basico', duration_minutes: 25 },
            { title: 'Graficos con Seaborn', duration_minutes: 30 },
            { title: 'Visualizaciones interactivas con Plotly', duration_minutes: 35 },
            { title: 'Proyecto: Dashboard de datos', duration_minutes: 45 }
          ]
        }
      ]
    },
    'machine learning': {
      modules: [
        {
          title: 'Fundamentos de Machine Learning',
          description: 'Conceptos basicos de aprendizaje automatico',
          bloom_objective: 'Comprender los tipos de aprendizaje automatico',
          lessons: [
            { title: 'Que es Machine Learning', duration_minutes: 25 },
            { title: 'Aprendizaje supervisado vs no supervisado', duration_minutes: 30 },
            { title: 'Preparacion de datos', duration_minutes: 35 },
            { title: 'Evaluacion de modelos', duration_minutes: 30 }
          ]
        },
        {
          title: 'Modelos de Clasificacion',
          description: 'Algoritmos para predecir categorias',
          bloom_objective: 'Implementar modelos de clasificacion',
          lessons: [
            { title: 'Regresion Logistica', duration_minutes: 30 },
            { title: 'Arboles de Decision', duration_minutes: 35 },
            { title: 'Random Forest', duration_minutes: 30 },
            { title: 'Proyecto: Clasificador de imagenes', duration_minutes: 45 }
          ]
        },
        {
          title: 'Modelos de Regresion',
          description: 'Algoritmos para predecir valores numericos',
          bloom_objective: 'Aplicar modelos de regresion',
          lessons: [
            { title: 'Regresion Lineal', duration_minutes: 30 },
            { title: 'Regresion Polinomial', duration_minutes: 25 },
            { title: 'Regularizacion: Lasso y Ridge', duration_minutes: 30 },
            { title: 'Proyecto: Prediccion de precios', duration_minutes: 45 }
          ]
        }
      ]
    },
    sql: {
      modules: [
        {
          title: 'Fundamentos de SQL',
          description: 'Aprende a consultar bases de datos',
          bloom_objective: 'Escribir consultas SQL basicas',
          lessons: [
            { title: 'Introduccion a bases de datos relacionales', duration_minutes: 20 },
            { title: 'SELECT: Consultas basicas', duration_minutes: 25 },
            { title: 'WHERE: Filtrado de datos', duration_minutes: 25 },
            { title: 'ORDER BY y LIMIT', duration_minutes: 20 }
          ]
        },
        {
          title: 'Consultas Avanzadas',
          description: 'Domina consultas complejas',
          bloom_objective: 'Combinar datos de multiples tablas',
          lessons: [
            { title: 'JOINs: INNER, LEFT, RIGHT', duration_minutes: 35 },
            { title: 'GROUP BY y funciones de agregacion', duration_minutes: 30 },
            { title: 'Subconsultas', duration_minutes: 30 },
            { title: 'Vistas y CTEs', duration_minutes: 25 }
          ]
        },
        {
          title: 'Administracion de Datos',
          description: 'Crea y modifica estructuras de datos',
          bloom_objective: 'Disenar esquemas de base de datos',
          lessons: [
            { title: 'CREATE, ALTER, DROP', duration_minutes: 25 },
            { title: 'INSERT, UPDATE, DELETE', duration_minutes: 25 },
            { title: 'Indices y optimizacion', duration_minutes: 30 },
            { title: 'Proyecto: Diseno de base de datos', duration_minutes: 45 }
          ]
        }
      ]
    }
  };

  let template = null;
  for (const [key, value] of Object.entries(courseTemplates)) {
    if (topicLower.includes(key)) {
      template = value;
      break;
    }
  }

  if (!template) {
    const goalsArray = goals.split(/[,.\n]/).filter(g => g.trim()).slice(0, 4);
    template = { modules: [] };

    template.modules.push({
      title: `Introduccion a ${topic}`,
      description: `Fundamentos y conceptos basicos de ${topic}`,
      bloom_objective: `Comprender los conceptos fundamentales de ${topic}`,
      lessons: [
        { title: `Que es ${topic} y por que es importante`, duration_minutes: 20 },
        { title: 'Configuracion del entorno de trabajo', duration_minutes: 25 },
        { title: 'Conceptos clave y terminologia', duration_minutes: 20 },
        { title: 'Primeros pasos practicos', duration_minutes: 30 }
      ]
    });

    goalsArray.forEach((goal) => {
      const cleanGoal = goal.trim();
      if (cleanGoal) {
        template.modules.push({
          title: cleanGoal.charAt(0).toUpperCase() + cleanGoal.slice(1),
          description: `Profundiza en: ${cleanGoal}`,
          bloom_objective: `Aplicar ${cleanGoal} en proyectos reales`,
          lessons: [
            { title: `Fundamentos de ${cleanGoal}`, duration_minutes: 25 },
            { title: `Tecnicas avanzadas`, duration_minutes: 30 },
            { title: `Mejores practicas`, duration_minutes: 25 },
            { title: `Ejercicio practico`, duration_minutes: 35 }
          ]
        });
      }
    });

    template.modules.push({
      title: 'Proyecto Final',
      description: `Aplica todo lo aprendido en un proyecto completo de ${topic}`,
      bloom_objective: `Crear un proyecto completo integrando todos los conceptos`,
      lessons: [
        { title: 'Planificacion del proyecto', duration_minutes: 25 },
        { title: 'Implementacion paso a paso', duration_minutes: 45 },
        { title: 'Testing y optimizacion', duration_minutes: 30 },
        { title: 'Presentacion y documentacion', duration_minutes: 25 }
      ]
    });
  }

  const durationMultiplier = level === 'Avanzado' ? 1.3 : level === 'Intermedio' ? 1.1 : 1.0;
  let totalDuration = 0;
  template.modules.forEach(module => {
    module.lessons.forEach(lesson => {
      lesson.duration_minutes = Math.round(lesson.duration_minutes * durationMultiplier);
      totalDuration += lesson.duration_minutes;
    });
  });

  return {
    topic,
    goals,
    level,
    targetAudience: targetAudience || 'Estudiantes y profesionales',
    suggestedTitle: `${topic}: ${level === 'Principiante' ? 'Desde Cero' : level === 'Intermedio' ? 'Nivel Intermedio' : 'Avanzado'}`,
    suggestedDescription: `Curso completo de ${topic} para ${targetAudience || 'estudiantes y profesionales'}. ${goals}`,
    estimatedDurationHours: Math.round(totalDuration / 60),
    modules: template.modules,
    learningObjectives: template.modules.map(m => m.bloom_objective)
  };
}

/**
 * POST /api/ai/generate-structure - Generate AI course structure
 */
router.post('/generate-structure', requireInstructor, (req, res) => {
  try {
    const { topic, goals, level = 'Principiante', targetAudience } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'El tema del curso es obligatorio' });
    }

    if (!goals || !goals.trim()) {
      return res.status(400).json({ error: 'Los objetivos de aprendizaje son obligatorios' });
    }

    const structure = generateCourseStructure(topic.trim(), goals.trim(), level, targetAudience);

    res.json({
      success: true,
      message: 'Estructura generada exitosamente',
      structure
    });
  } catch (error) {
    console.error('Error generating course structure:', error);
    res.status(500).json({ error: 'Error al generar la estructura del curso' });
  }
});

/**
 * POST /api/ai/apply-structure/:courseId - Apply AI-generated structure to a course
 */
router.post('/apply-structure/:courseId', requireInstructor, (req, res) => {
  try {
    const { courseId } = req.params;
    const { modules } = req.body;

    if (!modules || !Array.isArray(modules) || modules.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron modulos para crear' });
    }

    const course = queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }

    const now = new Date().toISOString();
    const createdModules = [];

    modules.forEach((moduleData, moduleIndex) => {
      run(
        `INSERT INTO modules (course_id, title, description, bloom_objective, order_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [courseId, moduleData.title, moduleData.description || null, moduleData.bloom_objective || null, moduleIndex, now, now]
      );

      const module = queryOne(
        'SELECT * FROM modules WHERE course_id = ? AND order_index = ? ORDER BY id DESC LIMIT 1',
        [courseId, moduleIndex]
      );

      const createdLessons = [];

      if (moduleData.lessons && Array.isArray(moduleData.lessons)) {
        moduleData.lessons.forEach((lessonData, lessonIndex) => {
          run(
            `INSERT INTO lessons (module_id, title, description, order_index, content_type, duration_minutes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [module.id, lessonData.title, lessonData.description || null, lessonIndex, 'text', lessonData.duration_minutes || 15, now, now]
          );

          const lesson = queryOne(
            'SELECT * FROM lessons WHERE module_id = ? AND order_index = ? ORDER BY id DESC LIMIT 1',
            [module.id, lessonIndex]
          );
          createdLessons.push(lesson);
        });
      }

      createdModules.push({
        ...module,
        lessons: createdLessons
      });
    });

    const totalMinutes = createdModules.reduce((acc, m) =>
      acc + m.lessons.reduce((lessonAcc, l) => lessonAcc + (l.duration_minutes || 0), 0), 0);
    const totalHours = Math.round(totalMinutes / 60);

    run('UPDATE courses SET duration_hours = ?, updated_at = ? WHERE id = ?', [totalHours, now, courseId]);

    res.json({
      success: true,
      message: `Se crearon ${createdModules.length} modulos con ${createdModules.reduce((acc, m) => acc + m.lessons.length, 0)} lecciones`,
      modules: createdModules
    });
  } catch (error) {
    console.error('Error applying AI structure:', error);
    res.status(500).json({ error: 'Error al aplicar la estructura del curso' });
  }
});

export default router;
