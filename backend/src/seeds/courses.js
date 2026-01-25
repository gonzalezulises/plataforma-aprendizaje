// Seed script for sample courses
import { run, queryOne } from '../config/database.js';

export function seedCourses() {
  console.log('Seeding courses...');

  const sampleCourses = [
    {
      title: 'Python: Fundamentos',
      slug: 'python-fundamentos',
      description: 'Aprende Python desde cero con ejercicios practicos y proyectos reales. Este curso te llevara desde los conceptos basicos hasta la creacion de programas funcionales.',
      category: 'Programacion',
      level: 'Principiante',
      is_premium: 0,
      is_published: 1,
      duration_hours: 20,
      tags: JSON.stringify(['python', 'programacion', 'principiante'])
    },
    {
      title: 'Data Science con Python',
      slug: 'data-science-python',
      description: 'Domina pandas, numpy y matplotlib para analisis de datos. Aprende a limpiar, explorar y visualizar datos como un profesional.',
      category: 'Data Science',
      level: 'Intermedio',
      is_premium: 1,
      is_published: 1,
      duration_hours: 35,
      tags: JSON.stringify(['python', 'data-science', 'pandas', 'numpy'])
    },
    {
      title: 'SQL desde Cero',
      slug: 'sql-desde-cero',
      description: 'Aprende a consultar y manipular bases de datos con SQL. Desde las consultas mas basicas hasta joins complejos y subconsultas.',
      category: 'Bases de Datos',
      level: 'Principiante',
      is_premium: 0,
      is_published: 1,
      duration_hours: 15,
      tags: JSON.stringify(['sql', 'bases-datos', 'principiante'])
    },
    {
      title: 'Machine Learning Basico',
      slug: 'machine-learning-basico',
      description: 'Introduccion a los algoritmos de aprendizaje automatico con scikit-learn.',
      category: 'IA / ML',
      level: 'Avanzado',
      is_premium: 1,
      is_published: 1,
      duration_hours: 40,
      tags: JSON.stringify(['machine-learning', 'python', 'avanzado'])
    },
    {
      title: 'R para Estadistica',
      slug: 'r-estadistica',
      description: 'Analisis estadistico y visualizacion de datos con R.',
      category: 'Data Science',
      level: 'Intermedio',
      is_premium: 0,
      is_published: 1,
      duration_hours: 25,
      tags: JSON.stringify(['r', 'estadistica', 'data-science'])
    },
    {
      title: 'Web3 y Solidity',
      slug: 'web3-solidity',
      description: 'Desarrolla smart contracts y aplicaciones descentralizadas.',
      category: 'Web3',
      level: 'Avanzado',
      is_premium: 1,
      is_published: 1,
      duration_hours: 30,
      tags: JSON.stringify(['web3', 'solidity', 'blockchain'])
    }
  ];

  const now = new Date().toISOString();

  for (const course of sampleCourses) {
    // Check if course already exists
    const existing = queryOne('SELECT id FROM courses WHERE slug = ?', [course.slug]);
    if (existing) {
      console.log(`Course "${course.title}" already exists, skipping...`);
      continue;
    }

    run(`
      INSERT INTO courses (title, slug, description, category, level, is_premium, is_published, duration_hours, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      course.title,
      course.slug,
      course.description,
      course.category,
      course.level,
      course.is_premium,
      course.is_published,
      course.duration_hours,
      course.tags,
      now,
      now
    ]);

    console.log(`Created course: ${course.title}`);
  }

  console.log('Courses seeding complete!');
}
