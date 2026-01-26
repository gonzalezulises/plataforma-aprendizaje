const http = require('http');

// Helper to make API requests
function makeRequest(method, path, data, cookie) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { 'Cookie': cookie } : {})
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function setup() {
  console.log('Setting up test data for breadcrumb feature...');

  // Login as instructor
  const loginRes = await makeRequest('POST', '/api/auth/dev-login', {
    email: 'instructor@test.com',
    password: 'password123'
  });

  console.log('Login response:', loginRes.status);

  const cookies = loginRes.headers['set-cookie'];
  if (!cookies) {
    console.error('No cookie received');
    return;
  }
  const sessionCookie = cookies[0].split(';')[0];
  console.log('Got session cookie');

  // Check current course 1
  const courseRes = await makeRequest('GET', '/api/courses/python-fundamentos', null, sessionCookie);
  console.log('Course info:', courseRes.status, courseRes.data.title);

  // Check modules for course 1
  const modulesRes = await makeRequest('GET', '/api/courses/1/modules', null, sessionCookie);
  console.log('Modules for course 1:', modulesRes.status, modulesRes.data);

  // Create module 1 if none exist
  if (!modulesRes.data.modules || modulesRes.data.modules.length === 0) {
    console.log('Creating modules...');

    // Create Module 1
    const module1Res = await makeRequest('POST', '/api/courses/1/modules', {
      title: 'Introduccion a Python',
      description: 'Conoce el lenguaje y configura tu entorno',
      order: 1
    }, sessionCookie);
    console.log('Module 1 created:', module1Res.status, module1Res.data);

    const module1Id = module1Res.data?.id || module1Res.data?.module?.id;

    if (module1Id) {
      // Create lessons for Module 1
      const lesson1Res = await makeRequest('POST', '/api/courses/1/modules/' + module1Id + '/lessons', {
        title: 'Bienvenida al Curso',
        description: 'Introduccion y objetivos del curso',
        order: 1,
        content_type: 'video',
        duration_minutes: 5
      }, sessionCookie);
      console.log('Lesson 1 created:', lesson1Res.status, lesson1Res.data);

      const lesson2Res = await makeRequest('POST', '/api/courses/1/modules/' + module1Id + '/lessons', {
        title: 'Instalacion de Python',
        description: 'Configuracion del entorno de desarrollo',
        order: 2,
        content_type: 'video',
        duration_minutes: 10
      }, sessionCookie);
      console.log('Lesson 2 created:', lesson2Res.status, lesson2Res.data);

      const lesson3Res = await makeRequest('POST', '/api/courses/1/modules/' + module1Id + '/lessons', {
        title: 'Tu Primer Programa',
        description: 'Escribe tu primer Hello World',
        order: 3,
        content_type: 'code',
        duration_minutes: 15
      }, sessionCookie);
      console.log('Lesson 3 created:', lesson3Res.status, lesson3Res.data);
    }

    // Create Module 2
    const module2Res = await makeRequest('POST', '/api/courses/1/modules', {
      title: 'Variables y Tipos de Datos',
      description: 'Aprende a trabajar con datos en Python',
      order: 2
    }, sessionCookie);
    console.log('Module 2 created:', module2Res.status, module2Res.data);
  } else {
    console.log('Modules already exist:', modulesRes.data.modules.length);

    // Check if we need to add lessons to existing modules
    for (const mod of modulesRes.data.modules) {
      const lessonsCheck = await makeRequest('GET', '/api/courses/1/modules/' + mod.id + '/lessons', null, sessionCookie);
      if (!lessonsCheck.data?.lessons || lessonsCheck.data.lessons.length === 0) {
        console.log('Adding lessons to module', mod.id, mod.title);

        const lesson1Res = await makeRequest('POST', '/api/courses/1/modules/' + mod.id + '/lessons', {
          title: 'Leccion 1: Introduccion',
          description: 'Primera leccion del modulo',
          content_type: 'video',
          duration_minutes: 10
        }, sessionCookie);
        console.log('Lesson 1 created:', lesson1Res.status, lesson1Res.data?.lesson?.id || lesson1Res.data);

        const lesson2Res = await makeRequest('POST', '/api/courses/1/modules/' + mod.id + '/lessons', {
          title: 'Leccion 2: Practica',
          description: 'Segunda leccion del modulo',
          content_type: 'code',
          duration_minutes: 15
        }, sessionCookie);
        console.log('Lesson 2 created:', lesson2Res.status, lesson2Res.data?.lesson?.id || lesson2Res.data);
      }
    }
  }

  // Final check
  const finalModulesRes = await makeRequest('GET', '/api/courses/1/modules', null, sessionCookie);
  console.log('Final modules count:', finalModulesRes.data?.modules?.length || 0);

  if (finalModulesRes.data?.modules) {
    for (const mod of finalModulesRes.data.modules) {
      console.log('  Module:', mod.id, mod.title);
      const lessonsRes = await makeRequest('GET', '/api/courses/1/modules/' + mod.id + '/lessons', null, sessionCookie);
      if (lessonsRes.data?.lessons) {
        for (const lesson of lessonsRes.data.lessons) {
          console.log('    Lesson:', lesson.id, lesson.title);
        }
      }
    }
  }
}

setup().catch(console.error);
