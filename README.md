# Plataforma de Aprendizaje

> Aprende haciendo con cursos interactivos, ejecucion de codigo en vivo y asistencia de IA pedagogica.

## Overview

Plataforma de aprendizaje activo para crear cursos enriquecidos con:
- Ejecucion de codigo en vivo (Python, SQL, R)
- Asistencia de IA basada en principios pedagogicos (Taxonomia de Bloom, Modelo 4C, Flipped Classroom)
- Sistema de evaluacion automatica + humana
- Integracion con rizo.ma mediante subdominio (cursos.rizo.ma)

## Tech Stack

### Frontend
- **React** - UI framework
- **Tailwind CSS** - Styling
- **Plyr** - Video player
- **Monaco Editor** - Code editor (VS Code engine)
- **Vite** - Build tool

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **SQLite** - Database
- **Docker** - Sandboxed code execution
- **WebSockets** - Real-time communication

## Getting Started

### Prerequisites
- Node.js 18+
- Docker (for code execution sandbox)
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd plataforma-aprendizaje
```

2. Run the setup script:
```bash
./init.sh
```

Or manually:

3. Install backend dependencies:
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
```

4. Install frontend dependencies:
```bash
cd frontend
npm install
cp .env.example .env
```

### Running the Development Servers

Start the backend:
```bash
cd backend
npm run dev
```

Start the frontend (in a new terminal):
```bash
cd frontend
npm run dev
```

### Access Points
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **WebSocket:** ws://localhost:3001/ws

## Project Structure

```
plataforma-aprendizaje/
├── backend/
│   ├── src/
│   │   ├── routes/        # API route definitions
│   │   ├── controllers/   # Request handlers
│   │   ├── middleware/    # Express middleware
│   │   ├── models/        # Database models
│   │   ├── services/      # Business logic
│   │   ├── utils/         # Utility functions
│   │   └── config/        # Configuration files
│   ├── data/              # SQLite database
│   └── tests/             # Backend tests
├── frontend/
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API client services
│   │   ├── store/         # State management
│   │   ├── utils/         # Utility functions
│   │   ├── styles/        # Global styles
│   │   └── assets/        # Static assets
│   └── public/            # Public static files
├── init.sh                # Setup script
└── README.md
```

## User Roles

| Role | Description |
|------|-------------|
| **student_free** | Access to free courses, basic feedback |
| **student_premium** | Access to all courses, AI suggestions, webinars |
| **instructor_admin** | Create/manage courses, analytics, feedback |

## Features

### For Students
- Browse and enroll in courses
- Interactive video lessons
- Execute code in Python, SQL, R
- Interactive Jupyter-style notebooks
- Quizzes with instant feedback
- Practical coding challenges
- Track progress and earn badges
- Forum discussions and comments
- Certificates of completion

### For Instructors
- AI-assisted course creation
- Pedagogical structure based on Bloom's taxonomy
- Automatic and manual evaluation
- Rubric-based feedback
- Video feedback recording
- Analytics dashboard
- Webinar scheduling (Google Meet)

## API Endpoints

See `app_spec.txt` for the complete API documentation.

## Environment Variables

### Backend (.env)
```
DATABASE_PATH=./data/learning_platform.db
PORT=3001
SESSION_SECRET=your-secret
OAUTH_CLIENT_ID=your-client-id
...
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
```

## Development

### Running Tests
```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

### Linting
```bash
# Backend
cd backend && npm run lint

# Frontend
cd frontend && npm run lint
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

MIT
