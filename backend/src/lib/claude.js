/**
 * AI Client for Content Generation
 * Supports both local models (DGX/Ollama/vLLM) and Anthropic Claude API
 * Integrates with Cerebro-RAG for knowledge retrieval from Data Science books
 *
 * Configuration:
 * - LOCAL_LLM_URL: URL for local OpenAI-compatible API (e.g., http://localhost:8000/v1)
 * - LOCAL_LLM_MODEL: Model name for local LLM (default: 'nvidia/Qwen3-14B-NVFP4')
 * - ANTHROPIC_API_KEY: Anthropic API key (fallback if local not configured)
 * - CEREBRO_RAG_URL: URL for Cerebro-RAG API (e.g., http://localhost:8001)
 */

import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://localhost:8000/v1'; // DGX Spark vLLM (localhost when running on DGX)
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'nvidia/Qwen3-14B-NVFP4';
const LOCAL_LLM_API_KEY = process.env.LOCAL_LLM_API_KEY || 'not-needed';
const CEREBRO_RAG_URL = process.env.CEREBRO_RAG_URL || 'http://localhost:8001'; // Cerebro RAG proxy

let anthropicClient = null;

/**
 * Determine which AI provider to use
 * Priority: Local LLM (DGX Spark) > Anthropic
 */
export function getAIProvider() {
  // Local LLM is now configured by default for DGX Spark
  if (LOCAL_LLM_URL) {
    return 'local';
  }
  if (ANTHROPIC_API_KEY) {
    return 'anthropic';
  }
  return null;
}

/**
 * Query Cerebro-RAG for relevant context from Data Science books
 * Falls back gracefully if RAG service is unavailable
 * @param {string} query - Search query
 * @param {number} topK - Number of results (default: 5)
 * @returns {Promise<{context: string, sources: Array, error: string|null}>}
 */
export async function queryCerebroRAG(query, topK = 5) {
  try {
    console.log(`[RAG] Querying Cerebro-RAG for: "${query.substring(0, 50)}..."`);

    const response = await fetch(`${CEREBRO_RAG_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        top_k: topK,
        use_rerank: true
      }),
      signal: AbortSignal.timeout(10000) // 10 second timeout (reduced for faster fallback)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[RAG] Cerebro-RAG error: ${response.status} - ${errorText}`);
      return { context: '', sources: [], error: `RAG error: ${response.status}` };
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      console.log('[RAG] No relevant results found');
      return { context: '', sources: [], error: null };
    }

    // Format context from RAG results
    const contextParts = results.map((r, i) => {
      const book = r.book_title || r.metadata?.book || 'Unknown';
      const chapter = r.chapter || r.metadata?.chapter || '';
      return `[${i + 1}] ${book}${chapter ? ` - ${chapter}` : ''}:\n${r.content}`;
    });

    const sources = results.map(r => ({
      book: r.book_title || r.metadata?.book || 'Unknown',
      chapter: r.chapter || r.metadata?.chapter || '',
      score: r.score || 0
    }));

    console.log(`[RAG] Found ${results.length} relevant chunks from ${new Set(sources.map(s => s.book)).size} books`);

    return {
      context: contextParts.join('\n\n---\n\n'),
      sources,
      error: null
    };
  } catch (error) {
    console.warn('[RAG] Cerebro-RAG not available, proceeding without knowledge base:', error.message);
    // Return empty context - generation will proceed without RAG
    return { context: '', sources: [], error: error.message };
  }
}

/**
 * Check if Cerebro-RAG is available
 */
export async function isCerebroRAGAvailable() {
  try {
    const response = await fetch(`${CEREBRO_RAG_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if local LLM (DGX Spark) is available
 */
export async function isLocalLLMAvailable() {
  try {
    const response = await fetch(`${LOCAL_LLM_URL}/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get or create Anthropic client
 */
export function getClaudeClient() {
  if (!ANTHROPIC_API_KEY) {
    return null;
  }

  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
  }

  return anthropicClient;
}

/**
 * Check if AI is configured (either local or Anthropic)
 */
export function isClaudeConfigured() {
  return !!(LOCAL_LLM_URL || ANTHROPIC_API_KEY);
}

/**
 * Call local LLM with OpenAI-compatible API
 */
async function callLocalLLM(systemPrompt, userPrompt) {
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
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Local LLM error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropic(systemPrompt, userPrompt) {
  const claude = getClaudeClient();
  if (!claude) {
    throw new Error('Anthropic client not configured');
  }

  const message = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt }
    ]
  });

  return message.content[0]?.text || '';
}

/**
 * Generate lesson content using AI (local LLM or Anthropic)
 * @param {Object} params - Generation parameters
 * @param {string} params.lessonTitle - Title of the lesson
 * @param {string} params.lessonType - Type: text, code, notebook
 * @param {string} params.courseTitle - Title of the course
 * @param {string} params.moduleTitle - Title of the module
 * @param {string} params.level - Difficulty level
 * @param {string} params.targetAudience - Target audience
 * @param {string} params.context - Additional context or RAG content
 * @param {boolean} params.useRAG - Whether to use Cerebro-RAG for context (default: true)
 * @param {boolean} params.enhanced - Whether to use enhanced prompts with pedagogical sections (default: false)
 * @param {object} params.structure_4c - 4C pedagogical structure data for the lesson
 * @returns {Promise<{content: string, sources: Array, error: string|null}>}
 */
export async function generateLessonContent({
  lessonTitle,
  lessonType = 'text',
  courseTitle,
  moduleTitle,
  level = 'Principiante',
  targetAudience = '',
  context = '',
  useRAG = true,
  enhanced = false,
  structure_4c = null
}) {
  const provider = getAIProvider();

  if (!provider) {
    return { content: null, sources: [], error: 'No AI provider configured. Set LOCAL_LLM_URL or ANTHROPIC_API_KEY.' };
  }

  let ragContext = '';
  let sources = [];

  // Query Cerebro-RAG for relevant context if enabled
  if (useRAG) {
    const ragQuery = `${lessonTitle} ${courseTitle} ${moduleTitle}`.trim();
    const ragResult = await queryCerebroRAG(ragQuery, 5);

    if (ragResult.context) {
      ragContext = ragResult.context;
      sources = ragResult.sources;
      console.log(`[AI] Using RAG context from ${sources.length} sources`);
    }
  }

  // Combine provided context with RAG context
  const fullContext = [context, ragContext].filter(Boolean).join('\n\n---\n\n');

  try {
    const systemPrompt = buildSystemPrompt(lessonType, enhanced);
    const userPrompt = buildUserPrompt({
      lessonTitle,
      lessonType,
      courseTitle,
      moduleTitle,
      level,
      targetAudience,
      context: fullContext,
      enhanced,
      structure_4c
    });

    console.log(`[AI] Generating content for: ${lessonTitle} (provider: ${provider}, RAG: ${useRAG && sources.length > 0})`);

    let content;
    if (provider === 'local') {
      content = await callLocalLLM(systemPrompt, userPrompt);
    } else {
      content = await callAnthropic(systemPrompt, userPrompt);
    }

    console.log(`[AI] Content generated successfully, length: ${content.length}`);

    return { content, sources, error: null };
  } catch (error) {
    console.error('[AI] Error generating content:', error);
    return { content: null, sources: [], error: error.message };
  }
}

/**
 * Build system prompt based on lesson type
 * @param {string} lessonType - Type of lesson content
 * @param {boolean} enhanced - Whether to use enhanced pedagogical prompts
 */
function buildSystemPrompt(lessonType, enhanced = false) {
  const basePrompt = `Eres un experto creador de contenido educativo para una plataforma de aprendizaje en linea.
Tu objetivo es crear contenido claro, practico y atractivo que ayude a los estudiantes a aprender efectivamente.

Directrices:
- Escribe en espanol
- Usa un tono amigable pero profesional
- Incluye ejemplos practicos
- Estructura el contenido de forma clara
- Adapta el nivel de complejidad al publico objetivo`;

  const enhancedDirectives = enhanced ? `

ESTRUCTURA OBLIGATORIA del contenido (usa estos encabezados de nivel 2 en Markdown):

## Introduccion
Conecta con conocimientos previos del estudiante. Explica por que este tema es importante y como se relaciona con lo que ya saben. Usa una pregunta motivadora o escenario real.

## Contenido Principal
Explicacion detallada del tema con ejemplos intercalados. Usa sub-secciones (###) para organizar conceptos. Incluye notas importantes con blockquotes (>) y resalta terminos clave en **negrita**.

## Ejemplos Practicos
Minimo 2 ejemplos resueltos paso a paso. Cada ejemplo debe:
- Presentar el problema/situacion
- Mostrar la solucion completa con explicacion de cada paso
- Incluir el resultado o output esperado

## Ejercicios
3 ejercicios con dificultad progresiva:
1. **Basico**: Ejercicio directo para verificar comprension
2. **Intermedio**: Requiere combinar conceptos
3. **Avanzado**: Requiere analisis o aplicacion creativa

Para cada ejercicio incluye el enunciado y la solucion entre tags:
<details><summary>Ver solucion</summary>
(solucion aqui)
</details>

## Dinamica de Aprendizaje
Una actividad interactiva o reflexion. Puede ser:
- Pregunta de reflexion sobre aplicaciones del tema
- Mini-proyecto o reto rapido
- Ejercicio de autoevaluacion
- Actividad colaborativa sugerida

## Resumen y Puntos Clave
Lista concisa de los conceptos mas importantes cubiertos. Usa viñetas para cada punto clave.

## Que Sigue
Breve preview del siguiente tema y como se conecta con lo aprendido. Genera curiosidad.` : '';

  const typeSpecificPrompts = {
    text: `${basePrompt}${enhancedDirectives}

Para lecciones de tipo TEXTO:
- Usa formato Markdown
- Incluye encabezados, listas y enfasis donde sea apropiado
- Agrega notas importantes con blockquotes (>)
- Si es relevante, incluye bloques de codigo con sintaxis highlighting`,

    code: `${basePrompt}${enhancedDirectives}

Para lecciones de tipo CODIGO:
- Enfocate en ejemplos de codigo practicos
- Incluye comentarios explicativos en el codigo
- Muestra el output esperado
- Presenta el codigo de forma progresiva (simple a complejo)
- Usa formato Markdown con bloques de codigo`,

    notebook: `${basePrompt}${enhancedDirectives}

Para lecciones de tipo NOTEBOOK (Jupyter):
- Estructura el contenido como celdas de notebook
- Alterna entre explicaciones (markdown) y codigo ejecutable
- Incluye outputs de ejemplo
- Marca claramente las secciones: ## Titulo, codigo, output
- Formato: usa \`\`\`python para codigo y texto normal para markdown`,

    video: `${basePrompt}${enhancedDirectives}

Para lecciones de tipo VIDEO:
- Crea un guion/script para el video
- Incluye puntos clave a cubrir
- Sugiere visualizaciones o demos
- Estructura: introduccion, desarrollo, conclusion
- Agrega timestamps sugeridos`,

    challenge: `${basePrompt}${enhancedDirectives}

Para lecciones de tipo RETO/EJERCICIO:
- Define claramente el problema
- Proporciona el contexto necesario
- Incluye ejemplos de entrada/salida
- Agrega hints opcionales
- Proporciona la solucion al final (oculta para el estudiante)`
  };

  return typeSpecificPrompts[lessonType] || typeSpecificPrompts.text;
}

/**
 * Build user prompt for content generation
 */
function buildUserPrompt({
  lessonTitle,
  lessonType,
  courseTitle,
  moduleTitle,
  level,
  targetAudience,
  context,
  enhanced = false,
  structure_4c = null
}) {
  let prompt = `Genera el contenido para la siguiente leccion:

**Curso:** ${courseTitle}
**Modulo:** ${moduleTitle}
**Leccion:** ${lessonTitle}
**Tipo de contenido:** ${lessonType}
**Nivel:** ${level}`;

  if (targetAudience) {
    prompt += `\n**Audiencia objetivo:** ${targetAudience}`;
  }

  // Include 4C pedagogical structure data if available
  if (structure_4c && typeof structure_4c === 'object') {
    const s4c = structure_4c;
    prompt += `\n\n**Estructura Pedagogica 4C para esta leccion:**`;
    if (s4c.conexiones) {
      prompt += `\n- **Conexiones (conocimientos previos):** ${s4c.conexiones}`;
    }
    if (s4c.conceptos) {
      prompt += `\n- **Conceptos clave:** ${s4c.conceptos}`;
    }
    if (s4c.practica) {
      prompt += `\n- **Practica sugerida:** ${s4c.practica}`;
    }
    if (s4c.conclusion) {
      prompt += `\n- **Conclusion esperada:** ${s4c.conclusion}`;
    }
  }

  if (context) {
    prompt += `\n\n**Contexto adicional/Informacion de referencia:**\n${context}`;
  }

  if (enhanced) {
    prompt += `\n\nGenera contenido educativo COMPLETO y DETALLADO para esta leccion. DEBES incluir TODAS las secciones obligatorias: Introduccion, Contenido Principal, Ejemplos Practicos (minimo 2), Ejercicios (3 niveles con soluciones ocultas), Dinamica de Aprendizaje, Resumen y Puntos Clave, y Que Sigue. El contenido debe ser extenso, minimo 2000 palabras.`;
  } else {
    prompt += `\n\nGenera contenido educativo completo y de alta calidad para esta leccion.`;
  }

  return prompt;
}

export default {
  getClaudeClient,
  getAIProvider,
  isClaudeConfigured,
  generateLessonContent,
  queryCerebroRAG,
  isCerebroRAGAvailable,
  isLocalLLMAvailable,
};
