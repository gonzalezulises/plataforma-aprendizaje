import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';

/**
 * LessonPage - Displays lesson content including code blocks
 * This page demonstrates the use of JetBrains Mono font for code
 */
function LessonPage() {
  const { slug, lessonId } = useParams();
  const [codeOutput, setCodeOutput] = useState(null);

  // Sample lesson data - in a real app this would come from API
  const lesson = {
    id: lessonId || 1,
    title: 'Introduccion a Python: Variables y Tipos de Datos',
    module: 'Modulo 1: Fundamentos',
    course: 'Python: Fundamentos',
    bloomLevel: 'Comprender',
    duration: 15,
    description: 'En esta leccion aprenderemos los conceptos basicos de variables y tipos de datos en Python.',
    content: [
      {
        type: 'text',
        content: `## Variables en Python

Las variables en Python son contenedores para almacenar valores de datos. A diferencia de otros lenguajes de programacion, Python no requiere declarar el tipo de variable explicitamente.

### Reglas para nombrar variables:
- Deben comenzar con una letra o guion bajo
- Solo pueden contener caracteres alfanumericos y guiones bajos
- Son sensibles a mayusculas y minusculas`
      },
      {
        type: 'code',
        language: 'python',
        title: 'ejemplo_variables.py',
        code: `# Asignacion de variables
nombre = "Maria"
edad = 25
altura = 1.65
es_estudiante = True

# Imprimiendo variables
print(f"Nombre: {nombre}")
print(f"Edad: {edad}")
print(f"Altura: {altura}m")
print(f"Es estudiante: {es_estudiante}")

# Tipo de cada variable
print(type(nombre))    # <class 'str'>
print(type(edad))      # <class 'int'>
print(type(altura))    # <class 'float'>
print(type(es_estudiante))  # <class 'bool'>`
      },
      {
        type: 'text',
        content: `## Tipos de Datos Basicos

Python tiene varios tipos de datos integrados:

| Tipo | Descripcion | Ejemplo |
|------|-------------|---------|
| str | Cadena de texto | "Hola" |
| int | Numero entero | 42 |
| float | Numero decimal | 3.14 |
| bool | Valor booleano | True/False |
| list | Lista ordenada | [1, 2, 3] |
| dict | Diccionario | {"clave": "valor"} |`
      },
      {
        type: 'code',
        language: 'python',
        title: 'tipos_datos.py',
        code: `# Diferentes tipos de datos
texto = "Hola, mundo!"
numero_entero = 100
numero_decimal = 99.99
booleano = True
lista = [1, 2, 3, 4, 5]
diccionario = {
    "nombre": "Python",
    "version": 3.11,
    "paradigma": "multiparadigma"
}

# Operaciones con diferentes tipos
resultado = numero_entero + numero_decimal
print(f"Suma: {resultado}")  # 199.99

# Conversion de tipos
edad_texto = "25"
edad_numero = int(edad_texto)
print(f"Edad + 1 = {edad_numero + 1}")  # 26`
      },
      {
        type: 'text',
        content: `## Practica: Tu Turno

Ahora es tu turno de practicar. Intenta crear variables de diferentes tipos y experimenta con las operaciones basicas.`
      },
      {
        type: 'code',
        language: 'python',
        title: 'practica.py',
        code: `# Tu codigo aqui
# Crea una variable para tu nombre
# Crea una variable para tu edad
# Imprime un mensaje de presentacion

nombre = ""  # Escribe tu nombre
edad = 0     # Escribe tu edad

# Completa el mensaje
print(f"Hola, me llamo {nombre} y tengo {edad} anios.")`
      }
    ]
  };

  const handleRunCode = (code) => {
    // Simulate code execution
    setCodeOutput(`>>> Ejecutando codigo...
Nombre: Maria
Edad: 25
Altura: 1.65m
Es estudiante: True
<class 'str'>
<class 'int'>
<class 'float'>
<class 'bool'>`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/courses" className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
              Cursos
            </Link>
            <span className="text-gray-400">/</span>
            <Link to={`/course/${slug}`} className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
              {lesson.course}
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-700 dark:text-gray-300">{lesson.module}</span>
          </nav>
        </div>
      </div>

      {/* Lesson header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300">
              {lesson.bloomLevel}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {lesson.duration} min
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {lesson.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {lesson.description}
          </p>
        </div>
      </div>

      {/* Lesson content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="prose dark:prose-invert max-w-none">
          {lesson.content.map((block, index) => {
            if (block.type === 'text') {
              return (
                <div key={index} className="mb-8 text-gray-700 dark:text-gray-300">
                  {/* Simple markdown-like rendering */}
                  {block.content.split('\n').map((line, lineIndex) => {
                    if (line.startsWith('## ')) {
                      return (
                        <h2 key={lineIndex} className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3">
                          {line.replace('## ', '')}
                        </h2>
                      );
                    }
                    if (line.startsWith('### ')) {
                      return (
                        <h3 key={lineIndex} className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
                          {line.replace('### ', '')}
                        </h3>
                      );
                    }
                    if (line.startsWith('- ')) {
                      return (
                        <li key={lineIndex} className="ml-4 text-gray-600 dark:text-gray-400">
                          {line.replace('- ', '')}
                        </li>
                      );
                    }
                    if (line.startsWith('| ')) {
                      // Skip table header separator
                      if (line.includes('---')) return null;
                      const cells = line.split('|').filter(c => c.trim());
                      return (
                        <div key={lineIndex} className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 grid grid-cols-3 gap-2 border-b border-gray-200 dark:border-gray-700">
                          {cells.map((cell, cellIndex) => (
                            <span key={cellIndex} className="truncate">{cell.trim()}</span>
                          ))}
                        </div>
                      );
                    }
                    return line ? (
                      <p key={lineIndex} className="mb-2">{line}</p>
                    ) : null;
                  })}
                </div>
              );
            }
            if (block.type === 'code') {
              return (
                <div key={index} className="mb-8">
                  <CodeBlock
                    code={block.code}
                    language={block.language}
                    title={block.title}
                    showLineNumbers={true}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleRunCode(block.code)}
                      className="px-4 py-2 bg-success-500 hover:bg-success-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Ejecutar
                    </button>
                    <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors">
                      Resetear
                    </button>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* Code output panel */}
        {codeOutput && (
          <div className="mt-6 bg-gray-900 dark:bg-gray-950 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Salida</h3>
              <button
                onClick={() => setCodeOutput(null)}
                className="text-gray-500 hover:text-gray-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">{codeOutput}</pre>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-12 flex justify-between">
          <Link
            to={`/course/${slug}`}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            Volver al curso
          </Link>
          <button className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
            Siguiente leccion
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default LessonPage;
