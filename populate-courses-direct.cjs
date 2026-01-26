// Feature #236: Populate database with 100 courses directly via SQLite
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Course categories and levels for realistic data
const categories = ['Programacion', 'Data Science', 'Web Development', 'Machine Learning', 'DevOps', 'Seguridad', 'Cloud Computing', 'Mobile Development', 'Blockchain', 'Testing'];
const levels = ['Principiante', 'Intermedio', 'Avanzado'];
const topics = ['React', 'Python', 'JavaScript', 'SQL', 'Node.js', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'MongoDB', 'PostgreSQL', 'Git', 'Linux', 'TensorFlow', 'PyTorch', 'FastAPI', 'Django', 'Vue.js', 'Angular', 'TypeScript', 'Go', 'Rust', 'Java', 'Spring', 'GraphQL', 'REST API', 'Microservices', 'CI/CD', 'Terraform', 'Ansible'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

async function main() {
  console.log('Feature #236: Populating database with 100 courses...\n');

  const DB_PATH = path.join(__dirname, 'backend', 'data', 'learning.db');

  if (!fs.existsSync(DB_PATH)) {
    console.error('Database file not found at:', DB_PATH);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  // Check current count
  const countResult = db.exec('SELECT COUNT(*) as count FROM courses');
  const existingCount = countResult[0]?.values[0]?.[0] || 0;
  console.log(`Currently ${existingCount} courses in database`);

  const targetCount = 100;
  const coursesToCreate = targetCount - existingCount;

  if (coursesToCreate <= 0) {
    console.log(`Already have ${existingCount} courses, no need to add more.`);
    db.close();
    return;
  }

  console.log(`Creating ${coursesToCreate} new courses to reach 100 total...\n`);

  const now = new Date().toISOString();
  let created = 0;

  for (let i = existingCount + 1; i <= targetCount; i++) {
    const topic1 = getRandomItem(topics);
    const topic2 = getRandomItem(topics.filter(t => t !== topic1));
    const category = getRandomItem(categories);
    const level = getRandomItem(levels);

    const title = `PERF_TEST_${i.toString().padStart(3, '0')}: ${topic1} y ${topic2}`;
    const slug = generateSlug(title);
    const description = `Curso de rendimiento #${i}. Aprende ${topic1} combinado con ${topic2}. Este es un curso de prueba para verificar el rendimiento de la plataforma con muchos cursos. Incluye ejemplos prácticos, ejercicios y proyectos del mundo real.`;
    const isPremium = Math.random() > 0.7 ? 1 : 0;
    const durationHours = Math.floor(Math.random() * 40) + 5;

    try {
      db.run(`
        INSERT INTO courses (title, slug, description, instructor_id, category, tags, level, is_premium, is_published, thumbnail_url, duration_hours, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [title, slug, description, 2, category, '[]', level, isPremium, 1, null, durationHours, now, now]);

      created++;
      if (created % 10 === 0) {
        console.log(`Created ${created}/${coursesToCreate} courses...`);
      }
    } catch (err) {
      console.error(`Error creating course ${i}:`, err.message);
    }
  }

  // Save database
  const data = db.export();
  const buffer2 = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer2);

  console.log(`\nDone! Created: ${created}`);

  // Verify final count
  const finalCount = db.exec('SELECT COUNT(*) as count FROM courses');
  console.log(`Final course count: ${finalCount[0]?.values[0]?.[0]}`);

  db.close();
}

main().catch(console.error);
