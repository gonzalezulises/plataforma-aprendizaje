import express from 'express';
import { queryOne, run } from '../config/database.js';

const router = express.Router();

/**
 * POST /generate-course-structure
 * Generate course structure based on topic and goals
 */
router.post('/generate-course-structure', (req, res) => {
  try {
    const { topic, goals, level = 'Principiante', targetAudience } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const structure = generateCourseStructure(topic, goals, level, targetAudience);

    res.json({
      success: true,
      structure,
      metadata: {
        generatedAt: new Date().toISOString(),
        topic,
        level
      }
    });
  } catch (error) {
    console.error('Error generating course structure:', error);
    res.status(500).json({ error: 'Failed to generate course structure' });
  }
});

/**
 * POST /apply-course-structure/:courseId
 * Apply AI-generated structure to an existing course
 */
router.post('/apply-course-structure/:courseId', (req, res) => {
  try {
    const { courseId } = req.params;
    const { modules } = req.body;

    if (!modules || !Array.isArray(modules)) {
      return res.status(400).json({ error: 'Modules array is required' });
    }

    const course = queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const now = new Date().toISOString();
    const createdModules = [];

    modules.forEach((module, moduleIndex) => {
      const moduleResult = run(`
        INSERT INTO modules (course_id, title, description, bloom_objective, order_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [courseId, module.title, module.description || '', module.bloom_objective || '', moduleIndex, now, now]);

      const moduleId = moduleResult.lastInsertRowid;
      const createdLessons = [];

      if (module.lessons && Array.isArray(module.lessons)) {
        module.lessons.forEach((lesson, lessonIndex) => {
          const lessonResult = run(`
            INSERT INTO lessons (module_id, title, description, content_type, duration_minutes, order_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [moduleId, lesson.title, lesson.description || '', lesson.content_type || 'text', lesson.duration_minutes || 15, lessonIndex, now, now]);
          createdLessons.push({ id: lessonResult.lastInsertRowid, title: lesson.title, duration_minutes: lesson.duration_minutes });
        });
      }

      createdModules.push({ id: moduleId, title: module.title, description: module.description, lessons: createdLessons });
    });

    const totalMinutes = modules.reduce((acc, m) => {
      return acc + (m.lessons || []).reduce((lacc, l) => lacc + (l.duration_minutes || 15), 0);
    }, 0);
    const durationHours = Math.ceil(totalMinutes / 60);

    run('UPDATE courses SET duration_hours = ?, updated_at = ? WHERE id = ?', [durationHours, now, courseId]);

    res.json({
      success: true,
      courseId,
      modules: createdModules,
      totalModules: createdModules.length,
      totalLessons: createdModules.reduce((acc, m) => acc + m.lessons.length, 0),
      durationHours,
      message: 'Estructura del curso aplicada exitosamente'
    });
  } catch (error) {
    console.error('Error applying course structure:', error);
    res.status(500).json({ error: 'Failed to apply course structure' });
  }
});

/**
 * Helper: Generate course structure based on topic
 */
function generateCourseStructure(topic, goals, level, targetAudience) {
  const lowerTopic = topic.toLowerCase();

  // Default Python template
  let template = {
    suggestedTitle: 'Python desde Cero: Fundamentos de Programacion',
    suggestedDescription: 'Aprende los fundamentos de Python, desde variables y tipos de datos hasta funciones y programacion orientada a objetos.',
    learningObjectives: [
      'Comprender la sintaxis basica de Python',
      'Trabajar con variables, tipos de datos y operadores',
      'Crear y utilizar funciones',
      'Entender estructuras de control de flujo',
      'Manejar listas, diccionarios y tuplas'
    ],
    level: level,
    estimatedDurationHours: 8,
    modules: [
      {
        title: 'Introduccion a Python',
        description: 'Primeros pasos con Python: instalacion, configuracion y conceptos basicos.',
        bloom_objective: 'recordar',
        lessons: [
          { title: 'Que es Python y por que aprenderlo', content_type: 'text', duration_minutes: 10 },
          { title: 'Instalacion y configuracion del entorno', content_type: 'video', duration_minutes: 15 },
          { title: 'Tu primer programa: Hola Mundo', content_type: 'code', duration_minutes: 10 },
          { title: 'Usando el interprete de Python', content_type: 'notebook', duration_minutes: 15 }
        ]
      },
      {
        title: 'Variables y Tipos de Datos',
        description: 'Aprende a trabajar con diferentes tipos de datos y variables en Python.',
        bloom_objective: 'comprender',
        lessons: [
          { title: 'Variables y asignacion', content_type: 'text', duration_minutes: 15 },
          { title: 'Numeros: enteros y flotantes', content_type: 'code', duration_minutes: 15 },
          { title: 'Strings y manipulacion de texto', content_type: 'code', duration_minutes: 20 },
          { title: 'Booleanos y operadores logicos', content_type: 'text', duration_minutes: 15 },
          { title: 'Practica: Variables y tipos', content_type: 'challenge', duration_minutes: 20 }
        ]
      },
      {
        title: 'Estructuras de Control',
        description: 'Control de flujo con condicionales y bucles.',
        bloom_objective: 'aplicar',
        lessons: [
          { title: 'Condicionales: if, elif, else', content_type: 'text', duration_minutes: 20 },
          { title: 'Bucle while', content_type: 'code', duration_minutes: 15 },
          { title: 'Bucle for y range', content_type: 'code', duration_minutes: 20 },
          { title: 'break, continue y pass', content_type: 'text', duration_minutes: 10 },
          { title: 'Practica: Estructuras de control', content_type: 'challenge', duration_minutes: 25 }
        ]
      },
      {
        title: 'Funciones',
        description: 'Crear y utilizar funciones para modularizar el codigo.',
        bloom_objective: 'analizar',
        lessons: [
          { title: 'Definir funciones con def', content_type: 'code', duration_minutes: 15 },
          { title: 'Parametros y argumentos', content_type: 'code', duration_minutes: 20 },
          { title: 'Valores de retorno', content_type: 'text', duration_minutes: 15 },
          { title: 'Funciones lambda', content_type: 'code', duration_minutes: 15 },
          { title: 'Practica: Funciones', content_type: 'challenge', duration_minutes: 25 }
        ]
      }
    ]
  };

  // JavaScript template
  if (lowerTopic.includes('javascript') || lowerTopic.includes('js')) {
    template = {
      suggestedTitle: 'JavaScript Moderno: De Cero a Desarrollador',
      suggestedDescription: 'Domina JavaScript moderno con ES6+, desde conceptos basicos hasta programacion asincrona.',
      learningObjectives: [
        'Dominar la sintaxis moderna de JavaScript (ES6+)',
        'Manipular el DOM efectivamente',
        'Trabajar con funciones, objetos y clases',
        'Entender promesas y async/await'
      ],
      level: level,
      estimatedDurationHours: 10,
      modules: [
        {
          title: 'Fundamentos de JavaScript',
          description: 'Variables, tipos de datos y operadores en JavaScript moderno.',
          bloom_objective: 'recordar',
          lessons: [
            { title: 'Introduccion a JavaScript', content_type: 'text', duration_minutes: 10 },
            { title: 'Variables: let, const y var', content_type: 'code', duration_minutes: 15 },
            { title: 'Tipos de datos primitivos', content_type: 'code', duration_minutes: 15 },
            { title: 'Operadores y expresiones', content_type: 'text', duration_minutes: 15 }
          ]
        },
        {
          title: 'Funciones y Scope',
          description: 'Funciones tradicionales, arrow functions y closures.',
          bloom_objective: 'aplicar',
          lessons: [
            { title: 'Declaracion de funciones', content_type: 'code', duration_minutes: 15 },
            { title: 'Arrow functions', content_type: 'code', duration_minutes: 15 },
            { title: 'Parametros y valores por defecto', content_type: 'text', duration_minutes: 15 },
            { title: 'Closures y scope', content_type: 'code', duration_minutes: 20 },
            { title: 'Practica: Funciones', content_type: 'challenge', duration_minutes: 25 }
          ]
        },
        {
          title: 'Arrays y Objetos',
          description: 'Manipulacion avanzada de arrays y objetos.',
          bloom_objective: 'aplicar',
          lessons: [
            { title: 'Arrays y sus metodos', content_type: 'code', duration_minutes: 20 },
            { title: 'map, filter, reduce', content_type: 'code', duration_minutes: 25 },
            { title: 'Objetos y destructuring', content_type: 'code', duration_minutes: 20 },
            { title: 'Spread operator', content_type: 'code', duration_minutes: 15 },
            { title: 'Practica: Arrays y objetos', content_type: 'challenge', duration_minutes: 30 }
          ]
        }
      ]
    };
  }

  // SQL template
  if (lowerTopic.includes('sql') || lowerTopic.includes('base de datos') || lowerTopic.includes('database')) {
    template = {
      suggestedTitle: 'SQL: Bases de Datos Relacionales',
      suggestedDescription: 'Domina SQL desde consultas basicas hasta queries avanzados.',
      learningObjectives: [
        'Escribir consultas SELECT efectivas',
        'Realizar JOINs entre tablas',
        'Agregar y agrupar datos',
        'Crear y modificar tablas'
      ],
      level: level,
      estimatedDurationHours: 8,
      modules: [
        {
          title: 'Introduccion a SQL',
          description: 'Fundamentos de bases de datos relacionales.',
          bloom_objective: 'recordar',
          lessons: [
            { title: 'Que son las bases de datos relacionales', content_type: 'text', duration_minutes: 15 },
            { title: 'Instalacion y herramientas', content_type: 'video', duration_minutes: 15 },
            { title: 'Tu primera consulta SELECT', content_type: 'code', duration_minutes: 15 }
          ]
        },
        {
          title: 'Consultas Basicas',
          description: 'SELECT, WHERE, ORDER BY y LIMIT.',
          bloom_objective: 'comprender',
          lessons: [
            { title: 'SELECT y FROM', content_type: 'code', duration_minutes: 15 },
            { title: 'Filtros con WHERE', content_type: 'code', duration_minutes: 20 },
            { title: 'ORDER BY y LIMIT', content_type: 'code', duration_minutes: 15 },
            { title: 'Practica: Consultas basicas', content_type: 'challenge', duration_minutes: 25 }
          ]
        },
        {
          title: 'JOINs',
          description: 'Combinar datos de multiples tablas.',
          bloom_objective: 'aplicar',
          lessons: [
            { title: 'INNER JOIN', content_type: 'code', duration_minutes: 20 },
            { title: 'LEFT y RIGHT JOIN', content_type: 'code', duration_minutes: 20 },
            { title: 'Self JOIN', content_type: 'code', duration_minutes: 15 },
            { title: 'Practica: JOINs', content_type: 'challenge', duration_minutes: 30 }
          ]
        }
      ]
    };
  }

  // Data Science template
  if (lowerTopic.includes('data science') || lowerTopic.includes('ciencia de datos') || lowerTopic.includes('pandas')) {
    template = {
      suggestedTitle: 'Ciencia de Datos con Python',
      suggestedDescription: 'Aprende analisis de datos con Python usando Pandas y NumPy.',
      learningObjectives: [
        'Manipular datos con Pandas',
        'Realizar calculos con NumPy',
        'Crear visualizaciones',
        'Limpiar y preparar datos'
      ],
      level: level,
      estimatedDurationHours: 12,
      modules: [
        {
          title: 'Introduccion a Data Science',
          description: 'Conceptos fundamentales.',
          bloom_objective: 'recordar',
          lessons: [
            { title: 'Que es Data Science', content_type: 'text', duration_minutes: 15 },
            { title: 'Jupyter Notebooks', content_type: 'notebook', duration_minutes: 20 },
            { title: 'Introduccion a NumPy', content_type: 'code', duration_minutes: 20 }
          ]
        },
        {
          title: 'Pandas Fundamentals',
          description: 'Manipulacion de datos.',
          bloom_objective: 'comprender',
          lessons: [
            { title: 'Series y DataFrames', content_type: 'code', duration_minutes: 20 },
            { title: 'Lectura de datos', content_type: 'code', duration_minutes: 15 },
            { title: 'Seleccion y filtrado', content_type: 'code', duration_minutes: 20 }
          ]
        },
        {
          title: 'Analisis Exploratorio',
          description: 'EDA y estadisticas.',
          bloom_objective: 'analizar',
          lessons: [
            { title: 'Estadisticas descriptivas', content_type: 'code', duration_minutes: 20 },
            { title: 'Agrupaciones', content_type: 'code', duration_minutes: 25 },
            { title: 'Correlaciones', content_type: 'code', duration_minutes: 20 }
          ]
        }
      ]
    };
  }

  return template;
}

export default router;
