/**
 * 4C Model Helper for Pedagogical Lesson Structure
 *
 * The 4C model consists of:
 * - Connections: Activate prior knowledge, connect to real-world context
 * - Concepts: Minimum necessary concepts to understand
 * - Concrete Practice: Hands-on activity applying the concepts
 * - Conclusion: Reflection, synthesis, and transfer of learning
 */

/**
 * Generate 4C model structure for a lesson
 */
export function generate4CStructure(lessonTitle, contentType, topic) {
  const lowerTitle = lessonTitle.toLowerCase();
  const lowerTopic = topic.toLowerCase();

  const keyTerm = extractKeyTerm(lowerTitle, lowerTopic);

  return {
    connections: {
      prior_knowledge: `Antes de comenzar, reflexiona sobre lo que ya sabes sobre ${keyTerm}.`,
      real_world_context: `Este tema es fundamental porque ${getContextForTopic(lowerTitle)}.`,
      guiding_questions: generateGuidingQuestions(lowerTitle, keyTerm)
    },
    concepts: {
      key_concepts: generateKeyConcepts(lowerTitle),
      learning_outcomes: `Al finalizar esta leccion, podras ${getLearningOutcome(contentType)}.`,
      difficulty_level: getDifficultyLevel(lowerTitle)
    },
    concrete_practice: {
      activity_type: getActivityType(contentType),
      activity_description: getActivityDescription(contentType),
      expected_output: `Deberias poder ${getExpectedOutput(contentType)}.`,
      hints: getHints(contentType)
    },
    conclusion: {
      reflection_questions: [
        `Identificar el concepto central de ${keyTerm} entre varias opciones`,
        `Distinguir una aplicacion correcta vs incorrecta de ${keyTerm} en un escenario practico`,
        `Relacionar ${keyTerm} con conceptos previos del curso eligiendo la conexion correcta`
      ],
      synthesis: `Conecta lo aprendido sobre ${keyTerm} con conceptos anteriores.`,
      next_steps: 'En la siguiente leccion, aplicaras estos conocimientos para profundizar en temas mas avanzados.'
    }
  };
}

/**
 * Add 4C structure to all lessons in a course template
 */
export function addStructure4CToTemplate(template, topic) {
  template.modules.forEach(module => {
    module.lessons.forEach(lesson => {
      lesson.structure_4c = generate4CStructure(lesson.title, lesson.content_type, topic);
    });
  });
  return template;
}

// Helper functions
function extractKeyTerm(title, topic) {
  const keywords = ['variables', 'funciones', 'bucles', 'condicionales', 'listas',
                    'diccionarios', 'clases', 'objetos', 'modulos', 'archivos',
                    'arrays', 'strings', 'numeros', 'tipos', 'sql', 'join', 'select',
                    'dataframe', 'pandas', 'numpy'];
  for (const kw of keywords) {
    if (title.includes(kw)) return kw;
  }
  return topic.split(' ')[0] || 'este tema';
}

function getContextForTopic(title) {
  if (title.includes('variable')) return 'almacenar y manipular datos es la base de cualquier programa';
  if (title.includes('funcion')) return 'la reutilizacion de codigo es esencial para proyectos escalables';
  if (title.includes('bucle') || title.includes('for') || title.includes('while'))
    return 'automatizar tareas repetitivas ahorra tiempo y reduce errores';
  if (title.includes('condicional') || title.includes('if'))
    return 'tomar decisiones es fundamental en cualquier aplicacion';
  if (title.includes('lista') || title.includes('array'))
    return 'organizar colecciones de datos es comun en aplicaciones reales';
  if (title.includes('sql') || title.includes('select') || title.includes('join'))
    return 'manipular bases de datos es clave para cualquier aplicacion moderna';
  if (title.includes('pandas') || title.includes('dataframe'))
    return 'el analisis de datos impulsa decisiones en todas las industrias';
  return 'dominar este concepto te permite resolver problemas del mundo real';
}

function generateGuidingQuestions(title, keyTerm) {
  const questions = [];
  if (title.includes('variable')) {
    questions.push('Identificar cual de varias opciones describe correctamente como una aplicacion guarda datos temporalmente');
    questions.push('Seleccionar la razon principal por la que un programa necesita almacenar informacion en variables');
  } else if (title.includes('funcion')) {
    questions.push('Identificar el problema principal de repetir el mismo bloque de codigo en varias partes de un programa');
    questions.push('Seleccionar cual de las opciones describe mejor el proposito de una funcion');
  } else if (title.includes('bucle') || title.includes('for') || title.includes('while')) {
    questions.push('Seleccionar la mejor estrategia para procesar una lista de 1000 elementos');
    questions.push('Identificar cual tarea se beneficia mas de la automatizacion con bucles');
  } else {
    questions.push(`Seleccionar la definicion correcta de ${keyTerm} entre varias opciones`);
    questions.push(`Identificar un caso de uso real de ${keyTerm} entre varias opciones`);
  }
  return questions;
}

function generateKeyConcepts(title) {
  if (title.includes('variable')) {
    return ['Declaracion de variables', 'Asignacion de valores', 'Tipos de datos basicos'];
  } else if (title.includes('funcion')) {
    return ['Definicion de funciones', 'Parametros y argumentos', 'Valores de retorno'];
  } else if (title.includes('bucle') || title.includes('for')) {
    return ['Iteracion', 'Condicion de terminacion', 'Acumuladores'];
  } else if (title.includes('condicional') || title.includes('if')) {
    return ['Expresiones booleanas', 'Flujo de control', 'Ramas de ejecucion'];
  } else if (title.includes('sql') || title.includes('select')) {
    return ['Sintaxis de consultas', 'Filtrado de datos', 'Ordenamiento'];
  }
  return ['Concepto principal', 'Aplicacion practica', 'Mejores practicas'];
}

function getLearningOutcome(contentType) {
  if (contentType === 'challenge') return 'aplicar lo aprendido en un reto practico';
  if (contentType === 'code') return 'escribir y ejecutar codigo funcional';
  if (contentType === 'notebook') return 'experimentar interactivamente con ejemplos';
  if (contentType === 'video') return 'comprender visualmente los conceptos clave';
  if (contentType === 'quiz') return 'demostrar tu comprension del tema';
  return 'aplicar estos conceptos en situaciones reales';
}

function getDifficultyLevel(title) {
  if (title.includes('introduccion') || title.includes('basico') || title.includes('primero'))
    return 'Nivel inicial - sin prerequisitos';
  if (title.includes('avanzado') || title.includes('lambda') || title.includes('recursion'))
    return 'Nivel avanzado - requiere dominio de conceptos previos';
  return 'Nivel intermedio';
}

function getActivityType(contentType) {
  const types = {
    code: 'Ejercicio de codigo interactivo',
    challenge: 'Reto de programacion',
    notebook: 'Notebook interactivo',
    quiz: 'Cuestionario de comprension',
    video: 'Ejercicio guiado post-video',
    text: 'Ejercicio de reflexion'
  };
  return types[contentType] || 'Actividad practica';
}

function getActivityDescription(contentType) {
  if (contentType === 'code' || contentType === 'challenge') {
    return 'Escribe codigo para resolver el problema planteado. Prueba tu solucion con los casos de ejemplo.';
  }
  if (contentType === 'notebook') {
    return 'Ejecuta cada celda del notebook y modifica los ejemplos para experimentar.';
  }
  if (contentType === 'quiz') {
    return 'Responde las preguntas para evaluar tu comprension del tema.';
  }
  return 'Aplica los conceptos en el ejercicio propuesto.';
}

function getExpectedOutput(contentType) {
  if (contentType === 'code') return 'ejecutar codigo sin errores y obtener el resultado esperado';
  if (contentType === 'challenge') return 'resolver el reto y pasar todos los tests automaticos';
  if (contentType === 'notebook') return 'ejecutar todas las celdas y entender los resultados';
  if (contentType === 'quiz') return 'alcanzar al menos 70% en el cuestionario';
  return 'completar la actividad satisfactoriamente';
}

function getHints(contentType) {
  if (contentType === 'code' || contentType === 'challenge') {
    return [
      'Lee el enunciado cuidadosamente antes de escribir codigo',
      'Prueba con ejemplos simples primero',
      'Revisa la sintaxis si hay errores'
    ];
  }
  return ['Toma notas mientras avanzas', 'Relaciona con lo aprendido anteriormente'];
}

export default {
  generate4CStructure,
  addStructure4CToTemplate
};
