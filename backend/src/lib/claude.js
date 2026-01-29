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
 * Strip thinking/reasoning tokens from LLM output.
 * Qwen3 and similar models emit <think>...</think> blocks
 * containing internal chain-of-thought that should not be shown to users.
 */
function stripThinkingTokens(text) {
  if (!text) return text;
  // Remove <think>...</think> blocks (including multiline)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // Also handle unclosed <think> at the start (model started thinking but output got cut)
  cleaned = cleaned.replace(/^<think>[\s\S]*$/gi, '');
  // Clean up leading whitespace/newlines left behind
  cleaned = cleaned.replace(/^\s*\n+/, '');
  return cleaned.trim();
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
  const raw = data.choices[0]?.message?.content || '';
  return stripThinkingTokens(raw);
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

ESTRUCTURA OBLIGATORIA — MODELO PEDAGOGICO 4C:

Tu contenido DEBE seguir el modelo pedagogico de las 4C en este orden exacto.
Cada seccion corresponde a una fase del aprendizaje. NO uses encabezados genericos.

## 🔗 Conexiones
Activa conocimientos previos del estudiante. Esta fase prepara al cerebro para recibir informacion nueva.
- Comienza con 1-2 preguntas motivadoras que conecten con la experiencia del estudiante
- Explica por que este tema es importante en el mundo real (contexto profesional/practico)
- Conecta explicitamente con temas anteriores del curso si aplica
- Usa un escenario o problema real como gancho

## 💡 Conceptos
Presenta los conceptos minimos necesarios. NO sobrecargues: ensenha solo lo que el estudiante necesita para poder practicar.
- Explicacion clara de cada concepto clave, uno a la vez
- Usa sub-secciones (###) para organizar conceptos individuales
- Incluye notas importantes con blockquotes (>) y terminos clave en **negrita**
- Minimo 2 ejemplos resueltos paso a paso intercalados con la teoria
- Cada ejemplo debe: presentar el problema, mostrar la solucion con explicacion de cada paso, incluir el output esperado
- Progresion de simple a complejo

## 🛠️ Practica Concreta
El estudiante aplica lo aprendido con las manos. Esta es la fase MAS IMPORTANTE — debe ocupar ~40% del contenido.

3 ejercicios con dificultad progresiva:
1. **Basico**: Ejercicio directo para verificar comprension
2. **Intermedio**: Requiere combinar conceptos
3. **Avanzado**: Requiere analisis o aplicacion creativa

Para ejercicios de codigo, incluye un bloque de codigo ejecutable con la plantilla/starter y la solucion:

### Ejercicio 1: (titulo)
(Enunciado del ejercicio)

\`\`\`python
# Escribe tu codigo aqui
\`\`\`

<details><summary>Ver solucion</summary>

\`\`\`python
# Solucion completa
\`\`\`

Explicacion de la solucion.
</details>

Incluye tambien 2-3 preguntas de opcion multiple para verificar comprension:

### Ejercicio: Quiz

1. (Pregunta)
A) Opcion 1
B) Opcion 2
C) Opcion 3
D) Opcion 4

<details><summary>Ver solucion</summary>
Respuesta correcta: X)
Explicacion de por que esta es la respuesta correcta.
</details>

## 🎯 Conclusion
Cierra el ciclo de aprendizaje. El estudiante reflexiona y consolida.
- **Resumen visual**: Lista concisa de los 3-5 puntos clave aprendidos (usa vinetas)
- **Preguntas de reflexion**: 2-3 preguntas que hagan al estudiante pensar en como aplicar lo aprendido
- **Conexion con lo que sigue**: Breve preview del siguiente tema y como se conecta. Genera curiosidad.` : '';

  const typeSpecificPrompts = {
    text: `${basePrompt}${enhancedDirectives}

Para lecciones de tipo TEXTO:
- Usa formato Markdown
- Incluye encabezados, listas y enfasis donde sea apropiado
- Agrega notas importantes con blockquotes (>)
- Si es relevante, incluye bloques de codigo ejecutable con \`\`\`python o \`\`\`sql
- Los bloques de codigo con \`\`\`python o \`\`\`sql seran EJECUTABLES en el navegador del estudiante
- Para ejercicios de codigo usa secciones ### Ejercicio con bloques de codigo editables
- Para preguntas de opcion multiple usa formato A) B) C) D) con solucion en <details>
- El contenido sera renderizado interactivamente: el estudiante puede ejecutar codigo y responder quizzes`,

    code: `${basePrompt}${enhancedDirectives}

Para lecciones de tipo CODIGO:
- Enfocate en ejemplos de codigo practicos
- Incluye comentarios explicativos en el codigo
- Muestra el output esperado
- Presenta el codigo de forma progresiva (simple a complejo)
- Usa formato Markdown con bloques de codigo (\`\`\`python o \`\`\`sql)
- IMPORTANTE: Los bloques de codigo seran EJECUTABLES en el navegador (via Pyodide/sql.js)
- El estudiante puede editar y ejecutar cada bloque de codigo directamente
- Para ejercicios, usa ### Ejercicio con codigo starter incompleto para que el estudiante complete
- Incluye la solucion en <details><summary>Ver solucion</summary>...</details>`,

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
  // Fields come from pedagogical4C.js: connections, concepts, concrete_practice, conclusion
  if (structure_4c && typeof structure_4c === 'object') {
    const s4c = structure_4c;
    prompt += `\n\n**ESTRUCTURA PEDAGOGICA 4C PARA ESTA LECCION — DEBES SEGUIR ESTA GUIA:**`;

    // 1. Connections
    if (s4c.connections) {
      prompt += `\n\n🔗 **CONEXIONES (seccion "## 🔗 Conexiones"):**`;
      if (s4c.connections.prior_knowledge) {
        prompt += `\n- Conocimientos previos a activar: ${s4c.connections.prior_knowledge}`;
      }
      if (s4c.connections.real_world_context) {
        prompt += `\n- Contexto del mundo real: ${s4c.connections.real_world_context}`;
      }
      if (s4c.connections.guiding_questions && Array.isArray(s4c.connections.guiding_questions)) {
        prompt += `\n- Preguntas guia para abrir la leccion:`;
        s4c.connections.guiding_questions.forEach(q => {
          prompt += `\n  - "${q}"`;
        });
      }
    }

    // 2. Concepts
    if (s4c.concepts) {
      prompt += `\n\n💡 **CONCEPTOS (seccion "## 💡 Conceptos"):**`;
      if (s4c.concepts.key_concepts && Array.isArray(s4c.concepts.key_concepts)) {
        prompt += `\n- Conceptos clave a cubrir: ${s4c.concepts.key_concepts.join(', ')}`;
      }
      if (s4c.concepts.learning_outcomes) {
        prompt += `\n- Resultado de aprendizaje: ${s4c.concepts.learning_outcomes}`;
      }
      if (s4c.concepts.difficulty_level) {
        prompt += `\n- Nivel de dificultad: ${s4c.concepts.difficulty_level}`;
      }
    }

    // 3. Concrete Practice
    if (s4c.concrete_practice) {
      prompt += `\n\n🛠️ **PRACTICA CONCRETA (seccion "## 🛠️ Practica Concreta"):**`;
      if (s4c.concrete_practice.activity_type) {
        prompt += `\n- Tipo de actividad: ${s4c.concrete_practice.activity_type}`;
      }
      if (s4c.concrete_practice.activity_description) {
        prompt += `\n- Descripcion: ${s4c.concrete_practice.activity_description}`;
      }
      if (s4c.concrete_practice.expected_output) {
        prompt += `\n- Output esperado: ${s4c.concrete_practice.expected_output}`;
      }
      if (s4c.concrete_practice.hints && Array.isArray(s4c.concrete_practice.hints)) {
        prompt += `\n- Hints para incluir en los ejercicios:`;
        s4c.concrete_practice.hints.forEach(h => {
          prompt += `\n  - ${h}`;
        });
      }
    }

    // 4. Conclusion
    if (s4c.conclusion) {
      prompt += `\n\n🎯 **CONCLUSION (seccion "## 🎯 Conclusion"):**`;
      if (s4c.conclusion.reflection_questions && Array.isArray(s4c.conclusion.reflection_questions)) {
        prompt += `\n- Preguntas de reflexion a incluir:`;
        s4c.conclusion.reflection_questions.forEach(q => {
          prompt += `\n  - "${q}"`;
        });
      }
      if (s4c.conclusion.synthesis) {
        prompt += `\n- Sintesis esperada: ${s4c.conclusion.synthesis}`;
      }
      if (s4c.conclusion.next_steps) {
        prompt += `\n- Siguientes pasos: ${s4c.conclusion.next_steps}`;
      }
    }
  }

  if (context) {
    prompt += `\n\n**Contexto adicional/Informacion de referencia:**\n${context}`;
  }

  if (enhanced) {
    prompt += `\n\nGenera contenido educativo COMPLETO y DETALLADO para esta leccion siguiendo el MODELO PEDAGOGICO 4C. DEBES incluir las 4 secciones en este orden exacto: "## 🔗 Conexiones" (activar conocimiento previo), "## 💡 Conceptos" (teoria + ejemplos), "## 🛠️ Practica Concreta" (ejercicios de codigo ejecutable + quiz, ~40% del contenido), "## 🎯 Conclusion" (resumen + reflexion + que sigue). Si se proporciona estructura 4C arriba, USA esos datos especificos. El contenido debe ser extenso, minimo 2000 palabras.`;
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
