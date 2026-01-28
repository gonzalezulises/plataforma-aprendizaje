/**
 * Claude AI Client for Content Generation
 * Uses Anthropic SDK to generate educational content
 */

import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

let client = null;

/**
 * Get or create Claude client
 */
export function getClaudeClient() {
  if (!ANTHROPIC_API_KEY) {
    console.warn('[Claude] ANTHROPIC_API_KEY not configured. AI content generation will not work.');
    return null;
  }

  if (!client) {
    client = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
  }

  return client;
}

/**
 * Check if Claude is configured
 */
export function isClaudeConfigured() {
  return !!ANTHROPIC_API_KEY;
}

/**
 * Generate lesson content using Claude
 * @param {Object} params - Generation parameters
 * @param {string} params.lessonTitle - Title of the lesson
 * @param {string} params.lessonType - Type: text, code, notebook
 * @param {string} params.courseTitle - Title of the course
 * @param {string} params.moduleTitle - Title of the module
 * @param {string} params.level - Difficulty level
 * @param {string} params.targetAudience - Target audience
 * @param {string} params.context - Additional context or RAG content
 * @returns {Promise<{content: string, error: string|null}>}
 */
export async function generateLessonContent({
  lessonTitle,
  lessonType = 'text',
  courseTitle,
  moduleTitle,
  level = 'Principiante',
  targetAudience = '',
  context = ''
}) {
  const claude = getClaudeClient();

  if (!claude) {
    return { content: null, error: 'Claude API not configured' };
  }

  try {
    const systemPrompt = buildSystemPrompt(lessonType);
    const userPrompt = buildUserPrompt({
      lessonTitle,
      lessonType,
      courseTitle,
      moduleTitle,
      level,
      targetAudience,
      context
    });

    console.log('[Claude] Generating content for:', lessonTitle);

    const message = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const content = message.content[0]?.text || '';

    console.log('[Claude] Content generated successfully, length:', content.length);

    return { content, error: null };
  } catch (error) {
    console.error('[Claude] Error generating content:', error);
    return { content: null, error: error.message };
  }
}

/**
 * Build system prompt based on lesson type
 */
function buildSystemPrompt(lessonType) {
  const basePrompt = `Eres un experto creador de contenido educativo para una plataforma de aprendizaje en linea.
Tu objetivo es crear contenido claro, practico y atractivo que ayude a los estudiantes a aprender efectivamente.

Directrices:
- Escribe en espanol
- Usa un tono amigable pero profesional
- Incluye ejemplos practicos
- Estructura el contenido de forma clara
- Adapta el nivel de complejidad al publico objetivo`;

  const typeSpecificPrompts = {
    text: `${basePrompt}

Para lecciones de tipo TEXTO:
- Usa formato Markdown
- Incluye encabezados, listas y enfasis donde sea apropiado
- Agrega notas importantes con blockquotes (>)
- Si es relevante, incluye bloques de codigo con sintaxis highlighting`,

    code: `${basePrompt}

Para lecciones de tipo CODIGO:
- Enfocate en ejemplos de codigo practicos
- Incluye comentarios explicativos en el codigo
- Muestra el output esperado
- Presenta el codigo de forma progresiva (simple a complejo)
- Usa formato Markdown con bloques de codigo`,

    notebook: `${basePrompt}

Para lecciones de tipo NOTEBOOK (Jupyter):
- Estructura el contenido como celdas de notebook
- Alterna entre explicaciones (markdown) y codigo ejecutable
- Incluye outputs de ejemplo
- Marca claramente las secciones: ## Titulo, codigo, output
- Formato: usa \`\`\`python para codigo y texto normal para markdown`,

    video: `${basePrompt}

Para lecciones de tipo VIDEO:
- Crea un guion/script para el video
- Incluye puntos clave a cubrir
- Sugiere visualizaciones o demos
- Estructura: introduccion, desarrollo, conclusion
- Agrega timestamps sugeridos`,

    challenge: `${basePrompt}

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
  context
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

  if (context) {
    prompt += `\n\n**Contexto adicional/Informacion de referencia:**\n${context}`;
  }

  prompt += `\n\nGenera contenido educativo completo y de alta calidad para esta leccion.`;

  return prompt;
}

export default {
  getClaudeClient,
  isClaudeConfigured,
  generateLessonContent,
};
