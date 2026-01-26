const http = require('http');

const PORT = process.env.TEST_PORT || 4002;

const postData = JSON.stringify({
  topic: 'Python basics',
  goals: 'Learn programming fundamentals',
  level: 'Principiante'
});

const options = {
  hostname: 'localhost',
  port: PORT,
  path: '/api/ai/generate-course-structure',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log(`Testing AI course structure on port ${PORT}...`);

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('\n=== AI Course Structure Generation Test ===\n');

      if (result.success && result.structure) {
        const structure = result.structure;
        console.log('Course Title:', structure.suggestedTitle);
        console.log('Modules:', structure.modules.length);

        // Check first lesson of first module for 4C structure
        const firstLesson = structure.modules[0].lessons[0];
        console.log('\n=== First Lesson ===');
        console.log('Title:', firstLesson.title);
        console.log('Content Type:', firstLesson.content_type);

        if (firstLesson.structure_4c) {
          console.log('\n=== 4C Structure Found ===');
          const s4c = firstLesson.structure_4c;

          console.log('\n1. CONNECTIONS:');
          if (s4c.connections) {
            console.log('   - Prior Knowledge:', s4c.connections.prior_knowledge ? 'YES' : 'NO');
            console.log('   - Real World Context:', s4c.connections.real_world_context ? 'YES' : 'NO');
            console.log('   - Guiding Questions:', s4c.connections.guiding_questions ? s4c.connections.guiding_questions.length + ' questions' : 'NO');
          } else {
            console.log('   MISSING!');
          }

          console.log('\n2. CONCEPTS:');
          if (s4c.concepts) {
            console.log('   - Key Concepts:', s4c.concepts.key_concepts ? s4c.concepts.key_concepts.length + ' concepts' : 'NO');
            console.log('   - Learning Outcomes:', s4c.concepts.learning_outcomes ? 'YES' : 'NO');
            console.log('   - Difficulty Level:', s4c.concepts.difficulty_level ? 'YES' : 'NO');
          } else {
            console.log('   MISSING!');
          }

          console.log('\n3. CONCRETE PRACTICE:');
          if (s4c.concrete_practice) {
            console.log('   - Activity Type:', s4c.concrete_practice.activity_type ? 'YES' : 'NO');
            console.log('   - Activity Description:', s4c.concrete_practice.activity_description ? 'YES' : 'NO');
            console.log('   - Expected Output:', s4c.concrete_practice.expected_output ? 'YES' : 'NO');
            console.log('   - Hints:', s4c.concrete_practice.hints ? s4c.concrete_practice.hints.length + ' hints' : 'NO');
          } else {
            console.log('   MISSING!');
          }

          console.log('\n4. CONCLUSION:');
          if (s4c.conclusion) {
            console.log('   - Reflection Questions:', s4c.conclusion.reflection_questions ? s4c.conclusion.reflection_questions.length + ' questions' : 'NO');
            console.log('   - Synthesis:', s4c.conclusion.synthesis ? 'YES' : 'NO');
            console.log('   - Next Steps:', s4c.conclusion.next_steps ? 'YES' : 'NO');
          } else {
            console.log('   MISSING!');
          }

          // Check all lessons
          console.log('\n=== All Lessons Check ===');
          let allHave4C = true;
          structure.modules.forEach((module, mi) => {
            module.lessons.forEach((lesson, li) => {
              const has4C = !!lesson.structure_4c;
              if (!has4C) allHave4C = false;
              console.log(`Module ${mi+1} Lesson ${li+1} (${lesson.title}): ${has4C ? 'HAS 4C' : 'MISSING 4C'}`);
            });
          });

          console.log('\n=== TEST RESULT: ' + (allHave4C ? 'PASS' : 'PARTIAL') + ' ===');
          if (allHave4C) {
            console.log('All lessons have 4C structure!');
          }
        } else {
          console.log('\n=== 4C Structure NOT Found ===');
          console.log('structure_4c field is missing from lesson');
          console.log('Lesson keys:', Object.keys(firstLesson));
          console.log('\n=== TEST RESULT: FAIL ===');
        }
      } else {
        console.log('Error:', result.error || 'Unknown error');
        console.log('\n=== TEST RESULT: FAIL ===');
      }
    } catch (e) {
      console.log('Error parsing response:', e.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request failed:', e.message);
});

req.write(postData);
req.end();
