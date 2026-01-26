/**
 * Sandbox Security Module - Feature #27
 * Ensures code execution is sandboxed and isolated:
 * - Blocks system file access
 * - Blocks network access
 * - Prevents access to other users' data
 *
 * This module provides security checks for the code executor.
 * In development mode, we simulate sandboxing by detecting and blocking
 * dangerous patterns. In production, this would be combined with Docker
 * containers for true isolation.
 */

/**
 * Dangerous patterns that attempt to access system files
 */
const SYSTEM_FILE_PATTERNS = [
  // Direct file operations
  { pattern: /\bopen\s*\(/, name: 'open()', type: 'file_access' },
  { pattern: /\bread\s*\(/, name: 'read()', type: 'file_access' },
  { pattern: /\bwrite\s*\(/, name: 'write()', type: 'file_access' },
  { pattern: /\bwith\s+open\s*\(/, name: 'with open()', type: 'file_access' },

  // File module operations
  { pattern: /\bos\.path\./, name: 'os.path', type: 'file_access' },
  { pattern: /\bos\.listdir\s*\(/, name: 'os.listdir()', type: 'file_access' },
  { pattern: /\bos\.walk\s*\(/, name: 'os.walk()', type: 'file_access' },
  { pattern: /\bos\.getcwd\s*\(/, name: 'os.getcwd()', type: 'file_access' },
  { pattern: /\bos\.chdir\s*\(/, name: 'os.chdir()', type: 'file_access' },
  { pattern: /\bos\.remove\s*\(/, name: 'os.remove()', type: 'file_access' },
  { pattern: /\bos\.unlink\s*\(/, name: 'os.unlink()', type: 'file_access' },
  { pattern: /\bos\.rmdir\s*\(/, name: 'os.rmdir()', type: 'file_access' },
  { pattern: /\bos\.mkdir\s*\(/, name: 'os.mkdir()', type: 'file_access' },
  { pattern: /\bos\.makedirs\s*\(/, name: 'os.makedirs()', type: 'file_access' },
  { pattern: /\bos\.rename\s*\(/, name: 'os.rename()', type: 'file_access' },
  { pattern: /\bos\.stat\s*\(/, name: 'os.stat()', type: 'file_access' },

  // pathlib operations
  { pattern: /\bpathlib\.Path\s*\(/, name: 'pathlib.Path()', type: 'file_access' },
  { pattern: /\bPath\s*\([^)]*\)\.read/, name: 'Path().read', type: 'file_access' },
  { pattern: /\bPath\s*\([^)]*\)\.write/, name: 'Path().write', type: 'file_access' },
  { pattern: /\bPath\s*\([^)]*\)\.open/, name: 'Path().open', type: 'file_access' },
  { pattern: /\bPath\s*\([^)]*\)\.unlink/, name: 'Path().unlink', type: 'file_access' },

  // shutil operations
  { pattern: /\bshutil\.copy/, name: 'shutil.copy', type: 'file_access' },
  { pattern: /\bshutil\.move/, name: 'shutil.move', type: 'file_access' },
  { pattern: /\bshutil\.rmtree/, name: 'shutil.rmtree', type: 'file_access' },

  // glob operations
  { pattern: /\bglob\.glob\s*\(/, name: 'glob.glob()', type: 'file_access' },
  { pattern: /\bglob\.iglob\s*\(/, name: 'glob.iglob()', type: 'file_access' },

  // Sensitive file paths
  { pattern: /['"]\/etc\//, name: '/etc/', type: 'system_file' },
  { pattern: /['"]\/proc\//, name: '/proc/', type: 'system_file' },
  { pattern: /['"]\/sys\//, name: '/sys/', type: 'system_file' },
  { pattern: /['"]\/dev\//, name: '/dev/', type: 'system_file' },
  { pattern: /['"]\/root\//, name: '/root/', type: 'system_file' },
  { pattern: /['"]\/home\//, name: '/home/', type: 'system_file' },
  { pattern: /['"]\/var\//, name: '/var/', type: 'system_file' },
  { pattern: /['"]\/tmp\//, name: '/tmp/', type: 'system_file' },
  { pattern: /['"]\/usr\//, name: '/usr/', type: 'system_file' },
  { pattern: /['"]C:\\/, name: 'C:\\', type: 'system_file' },
  { pattern: /['"]\.\.\//, name: '../', type: 'path_traversal' },
  { pattern: /['"]\.\.\\/, name: '..\\', type: 'path_traversal' },
  { pattern: /['"]\~\//, name: '~/', type: 'home_directory' },

  // Environment and secrets
  { pattern: /\bos\.environ/, name: 'os.environ', type: 'environment' },
  { pattern: /\bos\.getenv\s*\(/, name: 'os.getenv()', type: 'environment' },
  { pattern: /\.env/, name: '.env file', type: 'environment' },
  { pattern: /password/i, name: 'password pattern', type: 'credential_access' },
  { pattern: /secret/i, name: 'secret pattern', type: 'credential_access' },
  { pattern: /api[_-]?key/i, name: 'api_key pattern', type: 'credential_access' },
  { pattern: /token/i, name: 'token pattern', type: 'credential_access' },
];

/**
 * Dangerous patterns that attempt network access
 */
const NETWORK_PATTERNS = [
  // HTTP/networking libraries
  { pattern: /\bimport\s+requests/, name: 'requests', type: 'network' },
  { pattern: /\bfrom\s+requests\s+import/, name: 'requests', type: 'network' },
  { pattern: /\brequests\.get\s*\(/, name: 'requests.get()', type: 'network' },
  { pattern: /\brequests\.post\s*\(/, name: 'requests.post()', type: 'network' },
  { pattern: /\brequests\.put\s*\(/, name: 'requests.put()', type: 'network' },
  { pattern: /\brequests\.delete\s*\(/, name: 'requests.delete()', type: 'network' },

  { pattern: /\bimport\s+urllib/, name: 'urllib', type: 'network' },
  { pattern: /\bfrom\s+urllib\s+import/, name: 'urllib', type: 'network' },
  { pattern: /\burllib\.request\.urlopen\s*\(/, name: 'urlopen()', type: 'network' },
  { pattern: /\burllib\.request\.urlretrieve\s*\(/, name: 'urlretrieve()', type: 'network' },

  { pattern: /\bimport\s+http/, name: 'http', type: 'network' },
  { pattern: /\bfrom\s+http\s+import/, name: 'http', type: 'network' },
  { pattern: /\bhttp\.client/, name: 'http.client', type: 'network' },
  { pattern: /\bHTTPConnection\s*\(/, name: 'HTTPConnection()', type: 'network' },
  { pattern: /\bHTTPSConnection\s*\(/, name: 'HTTPSConnection()', type: 'network' },

  // Socket operations
  { pattern: /\bimport\s+socket/, name: 'socket', type: 'network' },
  { pattern: /\bfrom\s+socket\s+import/, name: 'socket', type: 'network' },
  { pattern: /\bsocket\.socket\s*\(/, name: 'socket.socket()', type: 'network' },
  { pattern: /\.connect\s*\(\s*\(/, name: '.connect()', type: 'network' },
  { pattern: /\.bind\s*\(\s*\(/, name: '.bind()', type: 'network' },
  { pattern: /\.listen\s*\(/, name: '.listen()', type: 'network' },
  { pattern: /\.accept\s*\(/, name: '.accept()', type: 'network' },

  // Async HTTP
  { pattern: /\bimport\s+aiohttp/, name: 'aiohttp', type: 'network' },
  { pattern: /\bfrom\s+aiohttp\s+import/, name: 'aiohttp', type: 'network' },
  { pattern: /\bimport\s+httpx/, name: 'httpx', type: 'network' },
  { pattern: /\bfrom\s+httpx\s+import/, name: 'httpx', type: 'network' },

  // URL patterns
  { pattern: /['"]https?:\/\//, name: 'URL pattern', type: 'network' },
  { pattern: /['"]ftp:\/\//, name: 'FTP URL', type: 'network' },
  { pattern: /['"]ws:\/\//, name: 'WebSocket URL', type: 'network' },
  { pattern: /['"]wss:\/\//, name: 'WebSocket Secure URL', type: 'network' },

  // Email
  { pattern: /\bimport\s+smtplib/, name: 'smtplib', type: 'network' },
  { pattern: /\bSMTP\s*\(/, name: 'SMTP()', type: 'network' },

  // FTP
  { pattern: /\bimport\s+ftplib/, name: 'ftplib', type: 'network' },
  { pattern: /\bFTP\s*\(/, name: 'FTP()', type: 'network' },

  // SSH
  { pattern: /\bimport\s+paramiko/, name: 'paramiko', type: 'network' },
  { pattern: /\bSSHClient\s*\(/, name: 'SSHClient()', type: 'network' },
];

/**
 * Dangerous patterns that attempt to execute system commands or escape sandbox
 */
const SYSTEM_COMMAND_PATTERNS = [
  // Process execution
  { pattern: /\bimport\s+subprocess/, name: 'subprocess', type: 'system_exec' },
  { pattern: /\bfrom\s+subprocess\s+import/, name: 'subprocess', type: 'system_exec' },
  { pattern: /\bsubprocess\.run\s*\(/, name: 'subprocess.run()', type: 'system_exec' },
  { pattern: /\bsubprocess\.Popen\s*\(/, name: 'subprocess.Popen()', type: 'system_exec' },
  { pattern: /\bsubprocess\.call\s*\(/, name: 'subprocess.call()', type: 'system_exec' },
  { pattern: /\bsubprocess\.check_output\s*\(/, name: 'subprocess.check_output()', type: 'system_exec' },

  { pattern: /\bos\.system\s*\(/, name: 'os.system()', type: 'system_exec' },
  { pattern: /\bos\.popen\s*\(/, name: 'os.popen()', type: 'system_exec' },
  { pattern: /\bos\.exec[vl]/, name: 'os.exec*()', type: 'system_exec' },
  { pattern: /\bos\.spawn/, name: 'os.spawn*()', type: 'system_exec' },
  { pattern: /\bos\.fork\s*\(/, name: 'os.fork()', type: 'system_exec' },

  // Eval/exec (code injection)
  { pattern: /\beval\s*\(/, name: 'eval()', type: 'code_injection' },
  { pattern: /\bexec\s*\(/, name: 'exec()', type: 'code_injection' },
  { pattern: /\bcompile\s*\(/, name: 'compile()', type: 'code_injection' },
  { pattern: /\b__import__\s*\(/, name: '__import__()', type: 'code_injection' },

  // Module manipulation
  { pattern: /\bimportlib\./, name: 'importlib', type: 'module_manipulation' },
  { pattern: /\b__builtins__/, name: '__builtins__', type: 'sandbox_escape' },
  { pattern: /\b__class__/, name: '__class__', type: 'sandbox_escape' },
  { pattern: /\b__mro__/, name: '__mro__', type: 'sandbox_escape' },
  { pattern: /\b__subclasses__/, name: '__subclasses__()', type: 'sandbox_escape' },
  { pattern: /\b__globals__/, name: '__globals__', type: 'sandbox_escape' },
  { pattern: /\b__code__/, name: '__code__', type: 'sandbox_escape' },
  { pattern: /\b__bases__/, name: '__bases__', type: 'sandbox_escape' },

  // Ctypes (FFI escape)
  { pattern: /\bimport\s+ctypes/, name: 'ctypes', type: 'sandbox_escape' },
  { pattern: /\bfrom\s+ctypes\s+import/, name: 'ctypes', type: 'sandbox_escape' },

  // Pickle (can execute arbitrary code)
  { pattern: /\bpickle\.loads?\s*\(/, name: 'pickle.load()', type: 'code_injection' },
  { pattern: /\bunpickle/, name: 'unpickle', type: 'code_injection' },

  // Multiprocessing
  { pattern: /\bimport\s+multiprocessing/, name: 'multiprocessing', type: 'process_spawn' },
  { pattern: /\bfrom\s+multiprocessing\s+import/, name: 'multiprocessing', type: 'process_spawn' },

  // Threading (can be used to bypass timeouts)
  { pattern: /\bimport\s+threading/, name: 'threading', type: 'thread_spawn' },
  { pattern: /\bfrom\s+threading\s+import/, name: 'threading', type: 'thread_spawn' },
  { pattern: /\bThread\s*\(/, name: 'Thread()', type: 'thread_spawn' },

  // Signal handlers (can interfere with timeout)
  { pattern: /\bimport\s+signal/, name: 'signal', type: 'signal_handler' },
  { pattern: /\bsignal\.signal\s*\(/, name: 'signal.signal()', type: 'signal_handler' },
];

/**
 * Patterns that might try to access database or other users' data
 */
const DATA_ACCESS_PATTERNS = [
  // Database access
  { pattern: /\bimport\s+sqlite3/, name: 'sqlite3', type: 'database' },
  { pattern: /\bfrom\s+sqlite3\s+import/, name: 'sqlite3', type: 'database' },
  { pattern: /\bsqlite3\.connect\s*\(/, name: 'sqlite3.connect()', type: 'database' },

  { pattern: /\bimport\s+mysql/, name: 'mysql', type: 'database' },
  { pattern: /\bimport\s+psycopg/, name: 'psycopg', type: 'database' },
  { pattern: /\bimport\s+pymongo/, name: 'pymongo', type: 'database' },
  { pattern: /\bimport\s+redis/, name: 'redis', type: 'database' },

  // ORM access
  { pattern: /\bfrom\s+sqlalchemy\s+import/, name: 'sqlalchemy', type: 'database' },
  { pattern: /\bimport\s+sqlalchemy/, name: 'sqlalchemy', type: 'database' },

  // User data references
  { pattern: /user_id/i, name: 'user_id reference', type: 'user_data' },
  { pattern: /other_user/i, name: 'other_user reference', type: 'user_data' },
  { pattern: /all_users/i, name: 'all_users reference', type: 'user_data' },
  { pattern: /\.db['"]/, name: '.db file access', type: 'database' },
  { pattern: /features\.db/i, name: 'features.db access', type: 'database' },
];

/**
 * Check code for security violations
 * @param {string} code - The Python code to check
 * @returns {object} - { isBlocked, violations: [{type, name, message}] }
 */
export function checkSandboxSecurity(code) {
  const violations = [];

  // Remove comments and strings for more accurate pattern matching
  // (but keep the original code for line reporting)
  const codeWithoutComments = code.replace(/#[^\n]*/g, '');

  // Check system file access patterns
  for (const check of SYSTEM_FILE_PATTERNS) {
    if (check.pattern.test(codeWithoutComments)) {
      violations.push({
        type: check.type,
        name: check.name,
        category: 'file_system',
        message: `Acceso al sistema de archivos bloqueado: ${check.name}`
      });
    }
  }

  // Check network access patterns
  for (const check of NETWORK_PATTERNS) {
    if (check.pattern.test(codeWithoutComments)) {
      violations.push({
        type: check.type,
        name: check.name,
        category: 'network',
        message: `Acceso a red bloqueado: ${check.name}`
      });
    }
  }

  // Check system command patterns
  for (const check of SYSTEM_COMMAND_PATTERNS) {
    if (check.pattern.test(codeWithoutComments)) {
      violations.push({
        type: check.type,
        name: check.name,
        category: 'system_command',
        message: `Ejecucion de comandos del sistema bloqueada: ${check.name}`
      });
    }
  }

  // Check data access patterns
  for (const check of DATA_ACCESS_PATTERNS) {
    if (check.pattern.test(codeWithoutComments)) {
      violations.push({
        type: check.type,
        name: check.name,
        category: 'data_access',
        message: `Acceso a datos bloqueado: ${check.name}`
      });
    }
  }

  // Deduplicate violations by name
  const uniqueViolations = [];
  const seenNames = new Set();
  for (const v of violations) {
    if (!seenNames.has(v.name)) {
      seenNames.add(v.name);
      uniqueViolations.push(v);
    }
  }

  return {
    isBlocked: uniqueViolations.length > 0,
    violations: uniqueViolations
  };
}

/**
 * Format security violation error for user display
 * @param {array} violations - List of violations
 * @returns {string} - Formatted error message
 */
export function formatSecurityError(violations) {
  if (violations.length === 0) return '';

  const categories = {
    file_system: [],
    network: [],
    system_command: [],
    data_access: []
  };

  for (const v of violations) {
    if (categories[v.category]) {
      categories[v.category].push(v.name);
    }
  }

  let message = 'SecurityError: Tu codigo intenta realizar operaciones no permitidas en el entorno sandbox:\n\n';

  if (categories.file_system.length > 0) {
    message += `[SISTEMA DE ARCHIVOS] No se permite acceder al sistema de archivos.\n`;
    message += `  Operaciones bloqueadas: ${categories.file_system.join(', ')}\n`;
    message += `  Razon: El codigo se ejecuta en un entorno aislado sin acceso a archivos del sistema.\n\n`;
  }

  if (categories.network.length > 0) {
    message += `[RED] No se permite acceso a la red.\n`;
    message += `  Operaciones bloqueadas: ${categories.network.join(', ')}\n`;
    message += `  Razon: El entorno sandbox esta aislado de Internet por seguridad.\n\n`;
  }

  if (categories.system_command.length > 0) {
    message += `[COMANDOS DEL SISTEMA] No se permite ejecutar comandos del sistema.\n`;
    message += `  Operaciones bloqueadas: ${categories.system_command.join(', ')}\n`;
    message += `  Razon: El codigo no puede interactuar con el sistema operativo.\n\n`;
  }

  if (categories.data_access.length > 0) {
    message += `[ACCESO A DATOS] No se permite acceso directo a bases de datos.\n`;
    message += `  Operaciones bloqueadas: ${categories.data_access.join(', ')}\n`;
    message += `  Razon: El codigo esta aislado de los datos de otros usuarios.\n\n`;
  }

  message += 'Consejo: Usa solo las funciones estandar de Python para resolver el ejercicio.';

  return message;
}

/**
 * Check if code attempts to access specific user data
 * @param {string} code - The Python code to check
 * @param {string} currentUserId - The current user's ID
 * @returns {object} - { isAttemptingUnauthorizedAccess, details }
 */
export function checkUserDataIsolation(code, currentUserId) {
  // Check for patterns that reference other users
  const otherUserPatterns = [
    /user_id\s*[!=]=\s*['"](?!anonymous|guest)/,  // user_id != 'value' or == 'value'
    /user_id\s*=\s*\d+/,  // user_id = number
    /SELECT\s+.*\s+FROM\s+.*user/i,  // SQL SELECT from user tables
    /users\s*\[/,  // Array access to users
    /get_user\s*\(/,  // get_user() function calls
    /fetch_user\s*\(/,
    /load_user\s*\(/,
  ];

  for (const pattern of otherUserPatterns) {
    if (pattern.test(code)) {
      return {
        isAttemptingUnauthorizedAccess: true,
        details: 'Intento de acceso a datos de otros usuarios detectado'
      };
    }
  }

  return {
    isAttemptingUnauthorizedAccess: false,
    details: null
  };
}

export default {
  checkSandboxSecurity,
  formatSecurityError,
  checkUserDataIsolation
};
