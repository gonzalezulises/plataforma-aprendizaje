const fs = require('fs');

const filePath = 'C:/Users/gonza/claude-projects/frontend/src/pages/AnalyticsDashboardPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add API_BASE_URL constant after imports
const oldImports = `import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

/**`;

const newImports = `import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

// Use env variable for API URL, matching AuthContext pattern
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**`;

if (content.includes('const API_BASE_URL')) {
  console.log('API_BASE_URL already added');
} else {
  content = content.replace(oldImports, newImports);
}

// 2. Update fetch calls to use API_BASE_URL
content = content.replace(
  "const response = await fetch('/api/analytics/dashboard',",
  "const response = await fetch(`${API_BASE_URL}/analytics/dashboard`,"
);

content = content.replace(
  "? `/api/analytics/export-all?format=${exportFormat}`",
  "? `${API_BASE_URL}/analytics/export-all?format=${exportFormat}`"
);

content = content.replace(
  ": `/api/analytics/export/${exportCourseId}?format=${exportFormat}`;",
  ": `${API_BASE_URL}/analytics/export/${exportCourseId}?format=${exportFormat}`;"
);

fs.writeFileSync(filePath, content);
console.log('Successfully patched AnalyticsDashboardPage.jsx with API_BASE_URL');
