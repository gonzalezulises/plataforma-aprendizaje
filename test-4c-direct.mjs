// Direct test of the pedagogical4C module
import { generate4CStructure, addStructure4CToTemplate } from './backend/src/utils/pedagogical4C.js';

// Test 1: Generate 4C structure for a single lesson
console.log('=== Test 1: Generate 4C Structure ===');
const structure4c = generate4CStructure('Variables y asignacion', 'text', 'Python basics');
console.log('Structure generated:', JSON.stringify(structure4c, null, 2));

// Check all 4C components
console.log('\n=== Checking 4C Components ===');
const hasConnections = structure4c.connections &&
                       structure4c.connections.prior_knowledge &&
                       structure4c.connections.real_world_context &&
                       structure4c.connections.guiding_questions;
const hasConcepts = structure4c.concepts &&
                    structure4c.concepts.key_concepts &&
                    structure4c.concepts.learning_outcomes;
const hasConcretePractice = structure4c.concrete_practice &&
                            structure4c.concrete_practice.activity_type &&
                            structure4c.concrete_practice.activity_description;
const hasConclusion = structure4c.conclusion &&
                      structure4c.conclusion.reflection_questions &&
                      structure4c.conclusion.synthesis;

console.log('1. Connections section:', hasConnections ? 'PASS' : 'FAIL');
console.log('2. Concepts section:', hasConcepts ? 'PASS' : 'FAIL');
console.log('3. Concrete Practice section:', hasConcretePractice ? 'PASS' : 'FAIL');
console.log('4. Conclusion section:', hasConclusion ? 'PASS' : 'FAIL');

// Test 2: Add 4C to template
console.log('\n=== Test 2: Add 4C to Template ===');
const template = {
  suggestedTitle: 'Test Course',
  modules: [
    {
      title: 'Module 1',
      lessons: [
        { title: 'Lesson 1', content_type: 'text', duration_minutes: 15 },
        { title: 'Lesson 2', content_type: 'code', duration_minutes: 20 }
      ]
    }
  ]
};

const templateWith4C = addStructure4CToTemplate(template, 'Python');
const lesson1 = templateWith4C.modules[0].lessons[0];
const lesson2 = templateWith4C.modules[0].lessons[1];

console.log('Lesson 1 has structure_4c:', lesson1.structure_4c ? 'YES' : 'NO');
console.log('Lesson 2 has structure_4c:', lesson2.structure_4c ? 'YES' : 'NO');

if (lesson1.structure_4c && lesson2.structure_4c) {
  console.log('\n=== TEST RESULT: PASS ===');
  console.log('The pedagogical4C module correctly adds 4C structure to lessons!');
} else {
  console.log('\n=== TEST RESULT: FAIL ===');
  console.log('4C structure was not added to lessons.');
}
