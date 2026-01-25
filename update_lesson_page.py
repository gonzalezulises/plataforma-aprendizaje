import re

file_path = r'C:/Users/gonza/claude-projects/frontend/src/pages/LessonPage.jsx'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the specific lines
old_text = '''  // Use API-fetched lesson or fall back to sample data
  const sampleLesson = lessonsData[currentLessonId];
  const lesson = apiLesson || sampleLesson;'''

new_text = '''  // Use API-fetched lesson or fall back to sample data
  // If API lesson has no content, prefer sample data (which has video examples)
  const sampleLesson = lessonsData[currentLessonId];
  const hasApiContent = apiLesson && apiLesson.content && apiLesson.content.length > 0;
  const lesson = hasApiContent ? apiLesson : (sampleLesson || apiLesson);'''

# Replace the text
if old_text in content:
    content = content.replace(old_text, new_text)
    # Write back to file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Successfully updated LessonPage.jsx')
else:
    print('ERROR: Could not find the exact text to replace')
    print('Looking for:')
    print(repr(old_text))
