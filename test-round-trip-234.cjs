// Test script for Feature #234: Round-trip data integrity
const http = require('http');
const fs = require('fs');

// Helper to make HTTP requests
function makeRequest(method, path, data = null, cookies = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('=== Feature #234: Round-trip Data Integrity Test ===\n');

  // Step 1: Login as instructor
  console.log('Step 1: Logging in as instructor...');
  const loginRes = await makeRequest('POST', '/api/auth/dev-login', {
    role: 'instructor_admin',
    name: 'Test Instructor',
    email: 'instructor@test.com'
  });

  const cookies = loginRes.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';
  console.log('Login successful:', loginRes.data.success);

  // Step 2: Create a test course with full structure
  console.log('\nStep 2: Creating test course with modules and lessons...');

  // Create course
  const courseData = {
    title: 'TEST_234_ROUNDTRIP_COURSE',
    slug: 'test-234-roundtrip-course',
    description: 'Test course for verifying round-trip data integrity',
    category: 'Testing',
    level: 'Intermedio',
    is_premium: true,
    is_published: true,
    duration_hours: 10
  };

  const createCourseRes = await makeRequest('POST', '/api/courses', courseData, cookies);
  if (createCourseRes.status !== 201) {
    console.log('Course creation response:', createCourseRes);
    // Try to get existing course
    const existingCourse = await makeRequest('GET', '/api/courses/test-234-roundtrip-course', null, cookies);
    if (existingCourse.status === 200) {
      console.log('Course already exists, using existing course');
      var courseId = existingCourse.data.course?.id || existingCourse.data.id;
    } else {
      console.error('Failed to create or find course');
      return;
    }
  } else {
    var courseId = createCourseRes.data.course?.id || createCourseRes.data.id;
    console.log('Created course ID:', courseId);
  }

  // Create module
  const moduleData = {
    title: 'Module 1 - Introduction',
    description: 'Introduction module with basic concepts',
    order_index: 0,
    bloom_objective: 'Remember and Understand',
    project_milestone: 'Complete introduction quiz',
    duration_hours: 2
  };

  const createModuleRes = await makeRequest('POST', `/api/courses/${courseId}/modules`, moduleData, cookies);
  let moduleId;
  if (createModuleRes.status === 201) {
    moduleId = createModuleRes.data.module?.id || createModuleRes.data.id;
    console.log('Created module ID:', moduleId);
  } else {
    console.log('Module creation response:', createModuleRes.status, createModuleRes.data);
    // Get existing module
    const modulesRes = await makeRequest('GET', `/api/courses/${courseId}/modules`, null, cookies);
    if (modulesRes.data.modules?.length > 0) {
      moduleId = modulesRes.data.modules[0].id;
      console.log('Using existing module ID:', moduleId);
    }
  }

  // Create lessons
  if (moduleId) {
    const lesson1Data = {
      title: 'Lesson 1 - Getting Started',
      description: 'First lesson covering basics',
      order_index: 0,
      bloom_level: 'Remember',
      content_type: 'video',
      duration_minutes: 15
    };

    const createLesson1Res = await makeRequest('POST', `/api/courses/${courseId}/modules/${moduleId}/lessons`, lesson1Data, cookies);
    let lesson1Id;
    if (createLesson1Res.status === 201) {
      lesson1Id = createLesson1Res.data.lesson?.id || createLesson1Res.data.id;
      console.log('Created lesson 1 ID:', lesson1Id);
    } else {
      console.log('Lesson 1 creation response:', createLesson1Res.status);
    }

    const lesson2Data = {
      title: 'Lesson 2 - Core Concepts',
      description: 'Second lesson with core concepts',
      order_index: 1,
      bloom_level: 'Understand',
      content_type: 'text',
      duration_minutes: 20
    };

    const createLesson2Res = await makeRequest('POST', `/api/courses/${courseId}/modules/${moduleId}/lessons`, lesson2Data, cookies);
    let lesson2Id;
    if (createLesson2Res.status === 201) {
      lesson2Id = createLesson2Res.data.lesson?.id || createLesson2Res.data.id;
      console.log('Created lesson 2 ID:', lesson2Id);
    }

    // Add content to lessons
    if (lesson1Id) {
      const content1 = {
        type: 'video',
        content: { url: 'https://example.com/video1.mp4', duration: 900, title: 'Intro Video' }
      };
      await makeRequest('POST', `/api/courses/${courseId}/modules/${moduleId}/lessons/${lesson1Id}/content`, content1, cookies);
      console.log('Added content to lesson 1');
    }

    if (lesson2Id) {
      const content2 = {
        type: 'text',
        content: { text: 'This is the main content for lesson 2. It covers important concepts.', format: 'markdown' }
      };
      await makeRequest('POST', `/api/courses/${courseId}/modules/${moduleId}/lessons/${lesson2Id}/content`, content2, cookies);

      const content3 = {
        type: 'code',
        content: { language: 'python', code: 'print("Hello, World!")', solution: 'print("Hello, World!")' }
      };
      await makeRequest('POST', `/api/courses/${courseId}/modules/${moduleId}/lessons/${lesson2Id}/content`, content3, cookies);
      console.log('Added content to lesson 2');
    }
  }

  // Step 3: Export the course structure
  console.log('\nStep 3: Exporting course structure...');
  const exportRes = await makeRequest('GET', `/api/analytics/export-structure/${courseId}`, null, cookies);

  if (exportRes.status !== 200) {
    console.error('Export failed:', exportRes.status, exportRes.data);
    return;
  }

  const exportedData = exportRes.data;
  console.log('Export successful!');
  console.log('- Export version:', exportedData.export_version);
  console.log('- Course title:', exportedData.course?.title);
  console.log('- Modules:', exportedData.summary?.total_modules);
  console.log('- Lessons:', exportedData.summary?.total_lessons);
  console.log('- Content items:', exportedData.summary?.total_content_items);

  // Save exported data to file
  fs.writeFileSync('C:/Users/gonza/claude-projects/exported-course-234.json', JSON.stringify(exportedData, null, 2));
  console.log('Exported data saved to exported-course-234.json');

  // Step 4: Import the exported data as a new course
  console.log('\nStep 4: Importing as new course...');
  const importRes = await makeRequest('POST', '/api/analytics/import-structure', {
    data: exportedData,
    duplicateAction: 'create_new'
  }, cookies);

  if (importRes.status !== 200) {
    console.error('Import failed:', importRes.status, importRes.data);
    return;
  }

  const importResult = importRes.data;
  console.log('Import successful!');
  console.log('- Action:', importResult.action);
  console.log('- New course ID:', importResult.course?.id);
  console.log('- New course slug:', importResult.course?.slug);
  console.log('- Modules created:', importResult.summary?.modules_created);
  console.log('- Lessons created:', importResult.summary?.lessons_created);
  console.log('- Content created:', importResult.summary?.content_created);

  // Step 5: Export the newly imported course and compare
  console.log('\nStep 5: Exporting newly imported course for comparison...');
  const newCourseId = importResult.course?.id;
  const reExportRes = await makeRequest('GET', `/api/analytics/export-structure/${newCourseId}`, null, cookies);

  if (reExportRes.status !== 200) {
    console.error('Re-export failed:', reExportRes.status, reExportRes.data);
    return;
  }

  const reExportedData = reExportRes.data;
  fs.writeFileSync('C:/Users/gonza/claude-projects/re-exported-course-234.json', JSON.stringify(reExportedData, null, 2));
  console.log('Re-exported data saved to re-exported-course-234.json');

  // Step 6: Compare the data
  console.log('\nStep 6: Comparing original and imported data...');

  const compareFields = (obj1, obj2, path = '') => {
    const differences = [];

    // Compare course fields (excluding generated fields like id, created_at, etc.)
    const fieldsToCompare = ['title', 'description', 'category', 'level', 'is_premium', 'is_published', 'duration_hours'];

    for (const field of fieldsToCompare) {
      // Handle title separately since imported course has " (Imported)" suffix
      if (field === 'title' && obj2[field] === obj1[field] + ' (Imported)') {
        continue; // Expected difference
      }
      if (JSON.stringify(obj1[field]) !== JSON.stringify(obj2[field])) {
        differences.push(`${path}${field}: "${obj1[field]}" vs "${obj2[field]}"`);
      }
    }

    return differences;
  };

  // Compare course
  const courseDiffs = compareFields(exportedData.course, reExportedData.course, 'course.');

  // Compare modules count
  const originalModules = exportedData.modules || [];
  const importedModules = reExportedData.modules || [];

  if (originalModules.length !== importedModules.length) {
    courseDiffs.push(`Module count: ${originalModules.length} vs ${importedModules.length}`);
  }

  // Compare module and lesson fields
  for (let i = 0; i < Math.min(originalModules.length, importedModules.length); i++) {
    const origModule = originalModules[i];
    const impModule = importedModules[i];

    if (origModule.title !== impModule.title) {
      courseDiffs.push(`Module ${i} title: "${origModule.title}" vs "${impModule.title}"`);
    }
    if (origModule.description !== impModule.description) {
      courseDiffs.push(`Module ${i} description differs`);
    }

    const origLessons = origModule.lessons || [];
    const impLessons = impModule.lessons || [];

    if (origLessons.length !== impLessons.length) {
      courseDiffs.push(`Module ${i} lesson count: ${origLessons.length} vs ${impLessons.length}`);
    }

    for (let j = 0; j < Math.min(origLessons.length, impLessons.length); j++) {
      const origLesson = origLessons[j];
      const impLesson = impLessons[j];

      if (origLesson.title !== impLesson.title) {
        courseDiffs.push(`Module ${i} Lesson ${j} title: "${origLesson.title}" vs "${impLesson.title}"`);
      }

      const origContent = origLesson.content || [];
      const impContent = impLesson.content || [];

      if (origContent.length !== impContent.length) {
        courseDiffs.push(`Module ${i} Lesson ${j} content count: ${origContent.length} vs ${impContent.length}`);
      }
    }
  }

  // Report results
  console.log('\n=== COMPARISON RESULTS ===');
  if (courseDiffs.length === 0) {
    console.log('SUCCESS! All fields match between original and imported course!');
  } else {
    console.log('Differences found:');
    courseDiffs.forEach(diff => console.log('  - ' + diff));
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log('Original course:');
  console.log('  - Modules:', exportedData.summary?.total_modules);
  console.log('  - Lessons:', exportedData.summary?.total_lessons);
  console.log('  - Content items:', exportedData.summary?.total_content_items);
  console.log('Imported course:');
  console.log('  - Modules:', reExportedData.summary?.total_modules);
  console.log('  - Lessons:', reExportedData.summary?.total_lessons);
  console.log('  - Content items:', reExportedData.summary?.total_content_items);

  const structureMatch =
    exportedData.summary?.total_modules === reExportedData.summary?.total_modules &&
    exportedData.summary?.total_lessons === reExportedData.summary?.total_lessons &&
    exportedData.summary?.total_content_items === reExportedData.summary?.total_content_items;

  console.log('\nStructure integrity:', structureMatch ? 'PASS ✓' : 'FAIL ✗');
  console.log('Data integrity:', courseDiffs.length === 0 ? 'PASS ✓' : 'FAIL ✗');
}

main().catch(console.error);
