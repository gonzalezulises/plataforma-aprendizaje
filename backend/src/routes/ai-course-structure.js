import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { queryOne, run } from '../config/database.js';
import { addStructure4CToTemplate } from '../utils/pedagogical4C.js';
import { queryCerebroRAG, isClaudeConfigured, getAIProvider } from '../lib/claude.js';

const router = express.Router();

// LLM Configuration - only use local when explicitly configured
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL;
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'nvidia/Qwen3-14B-NVFP4';
const LOCAL_LLM_API_KEY = process.env.LOCAL_LLM_API_KEY || 'not-needed';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Clean thinking blocks from Qwen3 model responses
 */
function cleanThinkingBlocks(content) {
  if (!content) return '';
  return content.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim();
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropicForStructure(systemPrompt, userPrompt) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  return message.content[0]?.text || '';
}

/**
 * Call local LLM for course structure generation
 */
async function callLocalLLMForStructure(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout for structure

  try {
    const response = await fetch(`${LOCAL_LLM_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOCAL_LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: LOCAL_LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4096,
        temperature: 0.7
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || '';
    return cleanThinkingBlocks(rawContent);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('LLM request timed out');
    }
    throw error;
  }
}

/**
 * Call LLM for structure - uses local if configured, otherwise Anthropic
 */
async function callLLMForStructure(systemPrompt, userPrompt) {
  const provider = getAIProvider();
  console.log(`[AI Structure] Using provider: ${provider}`);

  if (provider === 'local') {
    return callLocalLLMForStructure(systemPrompt, userPrompt);
  } else if (provider === 'anthropic') {
    return callAnthropicForStructure(systemPrompt, userPrompt);
  } else {
    throw new Error('No AI provider configured');
  }
}

/**
 * Parse JSON from LLM response (handles markdown code blocks)
 */
function parseJSONFromLLM(content) {
  // Try to extract JSON from markdown code block
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try to find JSON object in the content
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new Error('Could not parse JSON from LLM response');
  }
}

/**
 * POST /generate-course-structure
 * Generate course structure using LLM + RAG
 */
router.post('/generate-course-structure', async (req, res) => {
  try {
    const { topic, goals, level = 'Principiante', targetAudience } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    if (!isClaudeConfigured()) {
      return res.status(503).json({ error: 'AI not configured' });
    }

    console.log(`[AI Structure] Generating structure for: ${topic} (level: ${level})`);

    // Query RAG for relevant context
    let ragContext = '';
    let sources = [];

    const ragQuery = `${topic} ${goals || ''} curso estructura modulos lecciones`;
    const ragResult = await queryCerebroRAG(ragQuery, 5);

    if (ragResult.context) {
      ragContext = ragResult.context;
      sources = ragResult.sources;
      console.log(`[AI Structure] Using RAG context from ${sources.length} sources`);
    }

    // Build prompts for LLM
    const systemPrompt = `Eres un experto disenador instruccional que crea estructuras de cursos educativos.
Tu tarea es generar una estructura de curso completa y bien organizada.

IMPORTANTE: Responde SOLO con un objeto JSON valido, sin explicaciones adicionales.

El JSON debe tener exactamente esta estructura:
{
  "suggestedTitle": "Titulo del curso",
  "suggestedDescription": "Descripcion breve del curso (2-3 oraciones)",
  "learningObjectives": ["Objetivo 1", "Objetivo 2", "Objetivo 3", "Objetivo 4", "Objetivo 5"],
  "level": "Principiante|Intermedio|Avanzado",
  "estimatedDurationHours": 8,
  "modules": [
    {
      "title": "Titulo del modulo",
      "description": "Descripcion del modulo",
      "bloom_objective": "recordar|comprender|aplicar|analizar|evaluar|crear",
      "lessons": [
        {
          "title": "Titulo de la leccion",
          "content_type": "text|code|video|notebook|challenge",
          "duration_minutes": 15
        }
      ]
    }
  ]
}

Directrices:
- Genera entre 3-5 modulos
- Cada modulo debe tener entre 3-5 lecciones
- Los objetivos de Bloom deben progresar (recordar -> crear)
- Incluye variedad de tipos de contenido
- La duracion de lecciones: text (10-20min), code (15-25min), video (10-20min), notebook (20-30min), challenge (20-30min)`;

    let userPrompt = `Genera la estructura para un curso sobre: ${topic}

Nivel: ${level}`;

    if (goals) {
      userPrompt += `\n\nObjetivos de aprendizaje deseados:\n${goals}`;
    }

    if (targetAudience) {
      userPrompt += `\n\nAudiencia objetivo: ${targetAudience}`;
    }

    if (ragContext) {
      userPrompt += `\n\nInformacion de referencia de libros especializados:\n${ragContext.substring(0, 3000)}`;
    }

    userPrompt += '\n\nGenera el JSON de la estructura del curso:';

    // Call LLM
    const llmResponse = await callLLMForStructure(systemPrompt, userPrompt);

    // Parse JSON response
    let structure;
    try {
      structure = parseJSONFromLLM(llmResponse);
    } catch (parseError) {
      console.error('[AI Structure] Failed to parse LLM response:', parseError);
      console.log('[AI Structure] Raw response:', llmResponse.substring(0, 500));
      // Fallback to template
      structure = getFallbackStructure(topic, level);
    }

    // Ensure level is set correctly
    structure.level = level;

    // Add 4C pedagogical structure to all lessons
    structure = addStructure4CToTemplate(structure, topic);

    res.json({
      success: true,
      structure,
      sources: sources.map(s => ({ book: s.book, chapter: s.chapter })),
      metadata: {
        generatedAt: new Date().toISOString(),
        topic,
        level,
        provider: getAIProvider(),
        ragUsed: sources.length > 0,
        sourcesCount: sources.length
      }
    });
  } catch (error) {
    console.error('[AI Structure] Error generating course structure:', error);
    res.status(500).json({
      error: 'Failed to generate course structure',
      details: error.message
    });
  }
});

/**
 * POST /generate-course-objectives
 * Generate learning objectives using LLM + RAG
 */
router.post('/generate-course-objectives', async (req, res) => {
  try {
    const { topic, level = 'Principiante', targetAudience, count = 5 } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    if (!isClaudeConfigured()) {
      return res.status(503).json({ error: 'AI not configured' });
    }

    console.log(`[AI Objectives] Generating objectives for: ${topic}`);

    // Query RAG for context
    let ragContext = '';
    let sources = [];

    const ragResult = await queryCerebroRAG(`${topic} objetivos aprendizaje competencias`, 3);
    if (ragResult.context) {
      ragContext = ragResult.context;
      sources = ragResult.sources;
    }

    const systemPrompt = `Eres un experto en diseno instruccional.
Genera objetivos de aprendizaje claros y medibles usando la taxonomia de Bloom.

IMPORTANTE: Responde SOLO con un array JSON de strings, sin explicaciones.

Ejemplo: ["Objetivo 1", "Objetivo 2", "Objetivo 3"]

Los objetivos deben:
- Comenzar con un verbo de accion (Comprender, Aplicar, Analizar, Crear, etc.)
- Ser especificos y medibles
- Progresar en complejidad cognitiva`;

    let userPrompt = `Genera ${count} objetivos de aprendizaje para un curso de ${topic} nivel ${level}.`;

    if (targetAudience) {
      userPrompt += `\nAudiencia: ${targetAudience}`;
    }

    if (ragContext) {
      userPrompt += `\n\nContexto de referencia:\n${ragContext.substring(0, 2000)}`;
    }

    const llmResponse = await callLLMForStructure(systemPrompt, userPrompt);

    let objectives;
    try {
      objectives = parseJSONFromLLM(llmResponse);
      if (!Array.isArray(objectives)) {
        throw new Error('Response is not an array');
      }
    } catch {
      // Fallback
      objectives = [
        `Comprender los fundamentos de ${topic}`,
        `Aplicar conceptos basicos de ${topic} en ejercicios practicos`,
        `Analizar problemas relacionados con ${topic}`,
        `Evaluar diferentes enfoques para resolver problemas de ${topic}`,
        `Crear proyectos aplicando ${topic}`
      ];
    }

    res.json({
      success: true,
      objectives,
      sources: sources.map(s => ({ book: s.book })),
      metadata: {
        generatedAt: new Date().toISOString(),
        topic,
        level,
        ragUsed: sources.length > 0
      }
    });
  } catch (error) {
    console.error('[AI Objectives] Error:', error);
    res.status(500).json({ error: 'Failed to generate objectives', details: error.message });
  }
});

/**
 * POST /generate-course-description
 * Generate course description using LLM + RAG
 */
router.post('/generate-course-description', async (req, res) => {
  try {
    const { topic, level = 'Principiante', objectives, targetAudience } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    if (!isClaudeConfigured()) {
      return res.status(503).json({ error: 'AI not configured' });
    }

    console.log(`[AI Description] Generating description for: ${topic}`);

    // Query RAG
    let ragContext = '';
    let sources = [];

    const ragResult = await queryCerebroRAG(`${topic} descripcion curso introduccion`, 3);
    if (ragResult.context) {
      ragContext = ragResult.context;
      sources = ragResult.sources;
    }

    const systemPrompt = `Eres un experto en marketing educativo.
Genera una descripcion atractiva para un curso online.

IMPORTANTE: Responde SOLO con un objeto JSON:
{
  "title": "Titulo sugerido del curso",
  "description": "Descripcion del curso (3-4 oraciones, atractiva y profesional)"
}`;

    let userPrompt = `Genera titulo y descripcion para un curso de ${topic} nivel ${level}.`;

    if (objectives && Array.isArray(objectives)) {
      userPrompt += `\n\nObjetivos del curso:\n${objectives.join('\n')}`;
    }

    if (targetAudience) {
      userPrompt += `\nAudiencia: ${targetAudience}`;
    }

    if (ragContext) {
      userPrompt += `\n\nContexto:\n${ragContext.substring(0, 1500)}`;
    }

    const llmResponse = await callLLMForStructure(systemPrompt, userPrompt);

    let result;
    try {
      result = parseJSONFromLLM(llmResponse);
    } catch {
      result = {
        title: `Curso de ${topic}: De Principiante a Experto`,
        description: `Aprende ${topic} de forma practica y estructurada. Este curso te llevara desde los fundamentos hasta conceptos avanzados, con ejercicios practicos y proyectos reales.`
      };
    }

    res.json({
      success: true,
      ...result,
      sources: sources.map(s => ({ book: s.book })),
      metadata: {
        generatedAt: new Date().toISOString(),
        topic,
        ragUsed: sources.length > 0
      }
    });
  } catch (error) {
    console.error('[AI Description] Error:', error);
    res.status(500).json({ error: 'Failed to generate description', details: error.message });
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
            INSERT INTO lessons (module_id, title, description, content_type, duration_minutes, order_index, structure_4c, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [moduleId, lesson.title, lesson.description || '', lesson.content_type || 'text', lesson.duration_minutes || 15, lessonIndex, lesson.structure_4c ? JSON.stringify(lesson.structure_4c) : '{}', now, now]);
          createdLessons.push({ id: lessonResult.lastInsertRowid, title: lesson.title, duration_minutes: lesson.duration_minutes, structure_4c: lesson.structure_4c });
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
 * Fallback structure when LLM fails
 */
function getFallbackStructure(topic, level) {
  return {
    suggestedTitle: `Curso de ${topic}`,
    suggestedDescription: `Aprende ${topic} de forma practica y estructurada. Este curso cubre desde los fundamentos hasta conceptos mas avanzados.`,
    learningObjectives: [
      `Comprender los conceptos fundamentales de ${topic}`,
      `Aplicar ${topic} en situaciones practicas`,
      `Analizar problemas relacionados con ${topic}`,
      `Crear proyectos usando ${topic}`
    ],
    level: level,
    estimatedDurationHours: 8,
    modules: [
      {
        title: `Introduccion a ${topic}`,
        description: 'Fundamentos y conceptos basicos.',
        bloom_objective: 'recordar',
        lessons: [
          { title: `Que es ${topic}`, content_type: 'text', duration_minutes: 15 },
          { title: 'Configuracion del entorno', content_type: 'video', duration_minutes: 15 },
          { title: 'Primeros pasos', content_type: 'code', duration_minutes: 20 }
        ]
      },
      {
        title: 'Conceptos Intermedios',
        description: 'Profundizando en los conceptos.',
        bloom_objective: 'comprender',
        lessons: [
          { title: 'Conceptos clave', content_type: 'text', duration_minutes: 20 },
          { title: 'Ejercicios practicos', content_type: 'code', duration_minutes: 25 },
          { title: 'Practica guiada', content_type: 'challenge', duration_minutes: 25 }
        ]
      },
      {
        title: 'Aplicaciones Practicas',
        description: 'Aplicando lo aprendido.',
        bloom_objective: 'aplicar',
        lessons: [
          { title: 'Proyecto practico', content_type: 'notebook', duration_minutes: 30 },
          { title: 'Casos de uso', content_type: 'text', duration_minutes: 15 },
          { title: 'Reto final', content_type: 'challenge', duration_minutes: 30 }
        ]
      }
    ]
  };
}

export default router;
