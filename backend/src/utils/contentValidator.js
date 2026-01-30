/**
 * Content Validator for AI-generated lesson content.
 * Runs 5 validation passes to catch common LLM defects before saving.
 *
 * Pass 1: Remove quiz MCQ from Practica section (should only be in Conclusion)
 * Pass 5: Auto-tag untagged code blocks containing SQL or Python keywords
 * Pass 2: Convert placeholder SQL blocks (with [columna], [tabla], etc.) from ```sql to ```
 * Pass 3: Warn about invalid SQL tables/columns (hallucinated by LLM)
 * Pass 4: Verify 4C section headers exist
 *
 * Note: Pass 5 runs before Pass 2 so newly tagged blocks can be checked for placeholders.
 */

// Valid schema for the in-browser sql.js database
const VALID_TABLES = {
  empleados: ['id', 'nombre', 'departamento', 'salario', 'fecha_ingreso'],
  productos: ['id', 'nombre', 'categoria', 'precio', 'stock'],
  ventas: ['id', 'producto_id', 'empleado_id', 'cantidad', 'fecha', 'total']
};

const VALID_TABLE_NAMES = new Set(Object.keys(VALID_TABLES));
const ALL_VALID_COLUMNS = new Set(Object.values(VALID_TABLES).flat());

// Tables that LLMs commonly hallucinate
const KNOWN_INVALID_TABLES = new Set([
  'usuarios', 'clientes', 'customers', 'users', 'orders', 'pedidos',
  'posts', 'comments', 'categorias', 'categories', 'departamentos',
  'students', 'teachers', 'courses', 'grades', 'accounts'
]);

// Columns that LLMs commonly hallucinate
const KNOWN_INVALID_COLUMNS = new Set([
  'manager_id', 'telefono', 'email', 'direccion', 'edad', 'apellido',
  'phone', 'address', 'age', 'last_name', 'first_name', 'description',
  'created_at', 'updated_at', 'status', 'country', 'city'
]);

/**
 * Placeholder patterns that indicate template/generic SQL (not executable)
 */
const PLACEHOLDER_PATTERNS = [
  /\[columna[s]?\]/i,
  /\[tabla[s]?\]/i,
  /\[condicion[es]?\]/i,
  /\[valor[es]?\]/i,
  /\[nombre[_\s]?\w*\]/i,
  /\[expresion\]/i,
  /\[campo[s]?\]/i,
  /\[criterio[s]?\]/i,
  /\.\.\./,  // ellipsis in SQL code
];

/**
 * Main validation function.
 * @param {string} rawContent - The raw markdown content from the LLM
 * @param {string} lessonType - Lesson type (text, code, notebook, etc.)
 * @returns {{ cleanedContent: string, warnings: string[] }}
 */
export function validateAndCleanContent(rawContent, lessonType) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { cleanedContent: rawContent || '', warnings: ['Empty content received'] };
  }

  const warnings = [];
  let content = rawContent;

  // Pass 1: Remove quiz MCQ from Practica section
  content = removeQuizFromPractica(content, warnings);

  // Pass 5: Auto-tag untagged code blocks (must run BEFORE Pass 2)
  content = autoTagCodeBlocks(content, warnings);

  // Pass 2: Convert placeholder SQL blocks
  content = convertPlaceholderSQL(content, warnings);

  // Pass 3: Warn about invalid SQL tables/columns (no content modification)
  detectInvalidSQL(content, warnings);

  // Pass 4: Verify 4C section headers
  verify4CSections(content, warnings);

  return { cleanedContent: content, warnings };
}

/**
 * Pass 1: Detect and remove "### Ejercicio: Quiz" blocks within the Practica section.
 * The Practica section should only contain code exercises.
 */
function removeQuizFromPractica(content, warnings) {
  // Find the Practica section boundaries
  const practicaMatch = content.match(/## 🛠️\s*Practica\s*Concreta/i);
  if (!practicaMatch) return content;

  const practicaStart = practicaMatch.index;

  // Find the next ## section (Conclusion) after Practica
  const afterPractica = content.substring(practicaStart + practicaMatch[0].length);
  const nextSectionMatch = afterPractica.match(/\n## [🎯💡🔗]/);
  const practicaEnd = nextSectionMatch
    ? practicaStart + practicaMatch[0].length + nextSectionMatch.index
    : content.length;

  const practicaSection = content.substring(practicaStart, practicaEnd);

  // Look for "### Ejercicio: Quiz" or similar quiz headers within Practica
  const quizPattern = /### Ejercicio:\s*Quiz[\s\S]*?(?=###\s|## [🎯💡🔗🛠️]|$)/gi;
  const quizMatches = practicaSection.match(quizPattern);

  if (quizMatches && quizMatches.length > 0) {
    warnings.push(`Removed ${quizMatches.length} quiz block(s) from Practica section (quizzes belong in Conclusion only)`);
    const cleanedPractica = practicaSection.replace(quizPattern, '');
    content = content.substring(0, practicaStart) + cleanedPractica + content.substring(practicaEnd);
  }

  return content;
}

/**
 * Pass 5: Auto-tag untagged code blocks containing SQL or Python keywords.
 * LLMs sometimes generate ``` without a language tag even when instructed to use ```sql.
 * This pass detects SQL/Python keywords and adds the appropriate tag so the scorer
 * counts them as executable code blocks.
 */
function autoTagCodeBlocks(content, warnings) {
  const untaggedBlockRegex = /```\n([\s\S]*?)```/g;
  let tagCount = 0;

  const result = content.replace(untaggedBlockRegex, (match, code) => {
    // Skip placeholders (Pass 2 handles those)
    if (PLACEHOLDER_PATTERNS.some(p => p.test(code))) return match;

    const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|UNION|INTO|VALUES|SET|TABLE|INDEX|VIEW|WITH)\b/i;
    if (sqlKeywords.test(code)) {
      tagCount++;
      return '```sql\n' + code + '```';
    }

    const pyKeywords = /\b(def |class |import |from |print\(|if __name__|elif |lambda )/;
    if (pyKeywords.test(code)) {
      tagCount++;
      return '```python\n' + code + '```';
    }
    return match;
  });

  if (tagCount > 0) {
    warnings.push(`Auto-tagged ${tagCount} untagged code block(s) with language specifier`);
  }
  return result;
}

/**
 * Pass 2: Detect SQL code blocks with placeholder patterns and convert them
 * from ```sql to ``` (plain code block) so they won't be executed.
 */
function convertPlaceholderSQL(content, warnings) {
  const sqlBlockRegex = /```sql\n([\s\S]*?)```/g;
  let modified = false;

  const result = content.replace(sqlBlockRegex, (match, codeContent) => {
    const hasPlaceholder = PLACEHOLDER_PATTERNS.some(pattern => pattern.test(codeContent));
    if (hasPlaceholder) {
      modified = true;
      return '```\n' + codeContent + '```';
    }
    return match;
  });

  if (modified) {
    warnings.push('Converted placeholder SQL blocks from ```sql to ``` (non-executable) to prevent runtime errors');
  }

  return result;
}

/**
 * Pass 3: Detect invalid/hallucinated SQL tables and columns in ```sql blocks.
 * Does NOT modify content, only warns.
 */
function detectInvalidSQL(content, warnings) {
  const sqlBlockRegex = /```sql\n([\s\S]*?)```/g;
  let match;

  while ((match = sqlBlockRegex.exec(content)) !== null) {
    const sqlCode = match[1].toUpperCase();

    // Check for invalid tables (FROM, JOIN, INTO, UPDATE, TABLE keywords)
    const tableRefPattern = /(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([a-zA-Z_]\w*)/gi;
    let tableMatch;
    const sqlLower = match[1].toLowerCase();

    while ((tableMatch = tableRefPattern.exec(sqlLower)) !== null) {
      const tableName = tableMatch[1];
      if (!VALID_TABLE_NAMES.has(tableName) && !['select', 'where', 'set', 'values', 'as', 'on', 'and', 'or', 'not', 'in', 'null', 'like', 'between', 'exists'].includes(tableName)) {
        if (KNOWN_INVALID_TABLES.has(tableName)) {
          warnings.push(`SQL uses hallucinated table "${tableName}". Valid tables: ${[...VALID_TABLE_NAMES].join(', ')}`);
        } else {
          warnings.push(`SQL references unknown table "${tableName}". Valid tables: ${[...VALID_TABLE_NAMES].join(', ')}`);
        }
      }
    }

    // Check for invalid columns (basic heuristic: SELECT col, col FROM / WHERE col = )
    for (const invalidCol of KNOWN_INVALID_COLUMNS) {
      const colPattern = new RegExp(`\\b${invalidCol}\\b`, 'i');
      if (colPattern.test(match[1])) {
        warnings.push(`SQL may use hallucinated column "${invalidCol}". Valid columns: ${[...ALL_VALID_COLUMNS].join(', ')}`);
      }
    }
  }
}

/**
 * Pass 4: Verify that the 4 expected sections (4C model) exist in the content.
 * Does NOT modify content, only warns about missing sections.
 */
function verify4CSections(content, warnings) {
  const sections = [
    { header: '## 🔗 Conexiones', name: 'Conexiones' },
    { header: '## 💡 Conceptos', name: 'Conceptos' },
    { header: '## 🛠️ Practica Concreta', name: 'Practica Concreta' },
    { header: '## 🎯 Conclusion', name: 'Conclusion' }
  ];

  const missing = sections.filter(s => !content.includes(s.header));

  if (missing.length > 0) {
    warnings.push(`Missing 4C sections: ${missing.map(s => s.name).join(', ')}`);
  }
}

export default { validateAndCleanContent };
