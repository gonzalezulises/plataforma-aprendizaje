import { useState, useRef, useCallback } from 'react';

const SQL_JS_CDN = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/';

// Singleton: only load sql.js once
let sqlJsPromise = null;
let SQL = null;

function loadSqlJsScript() {
  return new Promise((resolve, reject) => {
    if (window.initSqlJs) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `${SQL_JS_CDN}sql-wasm.js`;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load sql.js script'));
    document.head.appendChild(script);
  });
}

async function initSqlJs() {
  if (SQL) return SQL;
  if (sqlJsPromise) return sqlJsPromise;

  sqlJsPromise = (async () => {
    await loadSqlJsScript();
    const sqlJs = await window.initSqlJs({
      locateFile: (file) => `${SQL_JS_CDN}${file}`
    });
    SQL = sqlJs;
    return sqlJs;
  })();

  return sqlJsPromise;
}

/**
 * useSQLite - Hook for SQL query execution via sql.js (WASM).
 *
 * Returns:
 * - isLoading: true while sql.js is being loaded
 * - isReady: true when database is ready
 * - error: Error if loading failed
 * - runQuery: (sql: string) => Promise<{ columns, rows, error, executionTime, rowsAffected }>
 * - loadSchema: (schema: string) => Promise<void>
 * - loadCSV: (tableName: string, csvContent: string) => Promise<void>
 * - reset: () => void - Reset database to empty state
 * - isRunning: true while a query is executing
 */
export function useSQLite() {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const dbRef = useRef(null);
  const sqlRef = useRef(null);

  const load = useCallback(async () => {
    if (dbRef.current) {
      setIsReady(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const sqlJs = await initSqlJs();
      sqlRef.current = sqlJs;
      dbRef.current = new sqlJs.Database();
      setIsReady(true);

      // Create sample tables for common SQL exercises
      const db = dbRef.current;
      db.run(`
        CREATE TABLE IF NOT EXISTS empleados (
          id INTEGER PRIMARY KEY,
          nombre TEXT NOT NULL,
          departamento TEXT,
          salario REAL,
          fecha_ingreso DATE
        );
      `);
      db.run(`
        INSERT OR IGNORE INTO empleados (id, nombre, departamento, salario, fecha_ingreso) VALUES
        (1, 'Ana Garcia', 'Ventas', 45000, '2020-03-15'),
        (2, 'Carlos Lopez', 'Tecnologia', 55000, '2019-07-01'),
        (3, 'Maria Rodriguez', 'Ventas', 47000, '2021-01-10'),
        (4, 'Juan Martinez', 'RRHH', 42000, '2018-11-20'),
        (5, 'Laura Sanchez', 'Tecnologia', 58000, '2020-06-05'),
        (6, 'Pedro Hernandez', 'Marketing', 43000, '2022-02-14'),
        (7, 'Sofia Diaz', 'Tecnologia', 62000, '2017-09-30'),
        (8, 'Diego Torres', 'Ventas', 46000, '2021-08-22'),
        (9, 'Valentina Ruiz', 'RRHH', 44000, '2019-04-18'),
        (10, 'Andres Morales', 'Marketing', 41000, '2023-01-05');
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS productos (
          id INTEGER PRIMARY KEY,
          nombre TEXT NOT NULL,
          categoria TEXT,
          precio REAL,
          stock INTEGER
        );
      `);
      db.run(`
        INSERT OR IGNORE INTO productos (id, nombre, categoria, precio, stock) VALUES
        (1, 'Laptop Pro', 'Electronica', 1299.99, 50),
        (2, 'Mouse Wireless', 'Accesorios', 29.99, 200),
        (3, 'Teclado Mecanico', 'Accesorios', 89.99, 150),
        (4, 'Monitor 27"', 'Electronica', 449.99, 75),
        (5, 'Webcam HD', 'Accesorios', 59.99, 120),
        (6, 'SSD 1TB', 'Almacenamiento', 109.99, 300),
        (7, 'RAM 16GB', 'Componentes', 79.99, 180),
        (8, 'Auriculares BT', 'Audio', 149.99, 90),
        (9, 'Hub USB-C', 'Accesorios', 39.99, 250),
        (10, 'Tablet 10"', 'Electronica', 399.99, 60);
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS ventas (
          id INTEGER PRIMARY KEY,
          producto_id INTEGER,
          empleado_id INTEGER,
          cantidad INTEGER,
          fecha DATE,
          total REAL,
          FOREIGN KEY (producto_id) REFERENCES productos(id),
          FOREIGN KEY (empleado_id) REFERENCES empleados(id)
        );
      `);
      db.run(`
        INSERT OR IGNORE INTO ventas (id, producto_id, empleado_id, cantidad, fecha, total) VALUES
        (1, 1, 1, 2, '2024-01-15', 2599.98),
        (2, 3, 3, 5, '2024-01-20', 449.95),
        (3, 2, 1, 10, '2024-02-01', 299.90),
        (4, 4, 8, 3, '2024-02-10', 1349.97),
        (5, 6, 3, 8, '2024-02-15', 879.92),
        (6, 1, 8, 1, '2024-03-01', 1299.99),
        (7, 5, 1, 4, '2024-03-05', 239.96),
        (8, 8, 3, 6, '2024-03-12', 899.94),
        (9, 7, 8, 3, '2024-03-20', 239.97),
        (10, 10, 1, 2, '2024-04-01', 799.98);
      `);
    } catch (err) {
      setError(err);
      console.error('[useSQLite] Failed to load:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runQuery = useCallback(async (sql) => {
    const db = dbRef.current;
    if (!db) {
      return { columns: [], rows: [], error: 'Base de datos no esta lista.', executionTime: 0 };
    }

    setIsRunning(true);
    const startTime = performance.now();

    try {
      const results = db.exec(sql);
      const executionTime = Math.round(performance.now() - startTime);

      if (!results || results.length === 0) {
        // Might be a write statement (INSERT, UPDATE, DELETE)
        const changes = db.getRowsModified();
        return {
          columns: [],
          rows: [],
          error: null,
          executionTime,
          rowsAffected: changes,
          message: changes > 0 ? `${changes} fila(s) afectada(s)` : 'Consulta ejecutada correctamente (sin resultados)'
        };
      }

      // Take the first result set
      const { columns, values } = results[0];
      const rows = values.map(row => {
        const obj = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });

      return {
        columns,
        rows,
        error: null,
        executionTime,
        rowsAffected: 0
      };
    } catch (err) {
      const executionTime = Math.round(performance.now() - startTime);
      return {
        columns: [],
        rows: [],
        error: err.message || String(err),
        executionTime
      };
    } finally {
      setIsRunning(false);
    }
  }, []);

  const loadSchema = useCallback(async (schema) => {
    const db = dbRef.current;
    if (!db) return;
    try {
      db.run(schema);
    } catch (err) {
      console.error('[useSQLite] Failed to load schema:', err);
    }
  }, []);

  const loadCSV = useCallback(async (tableName, csvContent) => {
    const db = dbRef.current;
    if (!db) return;

    try {
      const lines = csvContent.trim().split('\n');
      if (lines.length < 2) return;

      const headers = parseCSVLine(lines[0]);
      const colDefs = headers.map(h => `"${h}" TEXT`).join(', ');
      db.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs});`);

      const placeholders = headers.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT INTO "${tableName}" VALUES (${placeholders})`);

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
          stmt.run(values);
        }
      }
      stmt.free();
    } catch (err) {
      console.error('[useSQLite] Failed to load CSV:', err);
    }
  }, []);

  const reset = useCallback(() => {
    if (dbRef.current) {
      dbRef.current.close();
      dbRef.current = null;
    }
    setIsReady(false);
    // Reload will recreate the database
    load();
  }, [load]);

  return {
    isLoading,
    isReady,
    error,
    isRunning,
    load,
    runQuery,
    loadSchema,
    loadCSV,
    reset
  };
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export default useSQLite;
