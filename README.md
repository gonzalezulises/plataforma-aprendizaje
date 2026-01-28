# Academia Rizoma - Plataforma de Aprendizaje

> Aprende haciendo con cursos interactivos, ejecucion de codigo en vivo y asistencia de IA pedagogica potenciada por RAG.

## Overview

Plataforma de aprendizaje activo para crear cursos enriquecidos con:
- Ejecucion de codigo en vivo (Python, SQL, R)
- **IA pedagogica con RAG** - Contenido generado usando 145+ libros de Data Science (562,834 chunks)
- Sistema de evaluacion automatica + humana
- Modelo pedagogico 4C (Conexiones, Conceptos, Practica Concreta, Conclusion)

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────────────────┐
│  Frontend       │     │              DGX Spark (GPU Server)              │
│  (Vercel)       │     │                                                  │
│                 │     │  ┌─────────────┐  ┌─────────────┐               │
│  React + Vite   │────▶│  │ Backend API │  │ vLLM        │               │
│                 │     │  │ (PM2:3001)  │  │ Qwen3-14B   │               │
└─────────────────┘     │  └──────┬──────┘  │ (GPU:8000)  │               │
        │               │         │         └─────────────┘               │
        │               │         │                                        │
   Tailscale Funnel     │         ▼                                        │
        │               │  ┌─────────────┐  ┌─────────────────────────┐   │
        └──────────────▶│  │ RAG Server  │  │ Milvus (Vector DB)      │   │
                        │  │ (8001)      │◀▶│ 562,834 chunks          │   │
                        │  └─────────────┘  │ 145+ books              │   │
                        │                    └─────────────────────────┘   │
                        └──────────────────────────────────────────────────┘
```

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
- **WebSockets** - Real-time communication

### AI/RAG System
- **Qwen3-14B-NVFP4** - Local LLM (84GB VRAM on DGX Spark)
- **Cerebro-RAG** - Knowledge retrieval system
- **Milvus GPU** - Vector database
- **multilingual-e5-large** - Embeddings model
- **BGE-reranker-v2-m3** - Reranking model

### Infrastructure
- **DGX Spark** - NVIDIA GPU server (128GB unified memory)
- **Tailscale Funnel** - Secure tunnel for API access
- **Vercel** - Frontend hosting
- **PM2** - Process management

## Quick Start

### Prerequisites
- Node.js 18+
- Access to DGX Spark (for AI features) or Anthropic API key

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/gonzalezulises/plataforma-aprendizaje.git
cd plataforma-aprendizaje
```

2. Install dependencies:
```bash
# Backend
cd backend && npm install
cp .env.example .env

# Frontend
cd ../frontend && npm install
```

3. Start development servers:
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Access Points
| Service | URL |
|---------|-----|
| Frontend (local) | http://localhost:5173 |
| Backend API (local) | http://localhost:3001 |
| Frontend (prod) | https://plataforma-aprendizaje-neon.vercel.app |
| API (prod) | https://spark-279e.tail0b36db.ts.net/api |

## Environment Variables

### Backend (.env)
```bash
# Core
NODE_ENV=production
PORT=3001
DATABASE_PATH=./data/learning.db
SESSION_SECRET=your-secret

# AI - Local LLM (DGX Spark)
LOCAL_LLM_URL=http://localhost:8000/v1
LOCAL_LLM_MODEL=nvidia/Qwen3-14B-NVFP4
CEREBRO_RAG_URL=http://localhost:8001

# AI - Anthropic (fallback)
# ANTHROPIC_API_KEY=sk-ant-xxx

# Supabase (auth)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# CORS
CORS_ORIGIN=https://academia.rizo.ma,http://localhost:5173
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## AI Features

### RAG-Enhanced Content Generation
The platform uses Cerebro-RAG to generate pedagogically-sound content:

```bash
# Check AI status
curl https://spark-279e.tail0b36db.ts.net/api/ai/status

# Search knowledge base
curl -X POST https://spark-279e.tail0b36db.ts.net/api/ai/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning neural networks", "topK": 5}'
```

### Knowledge Base
- **562,834** indexed chunks
- **145+** books including:
  - PMBOK Guide 8th Edition
  - Hands-On Machine Learning (Geron)
  - Deep Learning (Goodfellow)
  - Python Data Science Handbook
  - And 140+ more...

## Project Structure

```
plataforma-aprendizaje/
├── backend/
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── lib/           # Core libraries (claude.js, supabase.js)
│   │   ├── middleware/    # Express middleware
│   │   ├── config/        # Database config
│   │   └── utils/         # Utilities
│   ├── data/              # SQLite database
│   └── .env               # Environment config
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # API clients
│   │   └── utils/         # Utilities
│   └── .env.production    # Production config
└── README.md
```

## DGX Spark Deployment

### Start All Services
```bash
ssh spark
~/start-academia.sh
```

### Individual Services
```bash
# Backend (PM2)
cd ~/plataforma-aprendizaje/backend
pm2 start src/index.js --name plataforma-api

# RAG Server (port 8001)
cd ~/cerebro-ds
source ~/.vllm/bin/activate
python -m uvicorn src.rag_api.server:app --host 0.0.0.0 --port 8001

# Tailscale Funnel
tailscale funnel --bg 3001
```

### Service Ports
| Service | Port | Description |
|---------|------|-------------|
| vLLM | 8000 | Qwen3-14B LLM |
| RAG Server | 8001 | Search endpoint |
| RAG Proxy | 8002 | Chat completions |
| Backend API | 3001 | Express server |

## User Roles

| Role | Description |
|------|-------------|
| **student_free** | Access to free courses, basic feedback |
| **student_premium** | All courses, AI suggestions, webinars |
| **instructor_admin** | Create/manage courses, analytics |

## Features

### For Students
- Browse and enroll in courses
- Interactive video lessons
- Execute code (Python, SQL, R)
- Jupyter-style notebooks
- Quizzes with instant feedback
- Coding challenges
- Progress tracking & badges
- Forum discussions
- Certificates

### For Instructors
- AI-assisted course creation (RAG-enhanced)
- Pedagogical structure (Bloom's taxonomy, 4C model)
- Automatic and manual evaluation
- Video feedback recording
- Analytics dashboard
- Webinar scheduling

## API Endpoints

### AI
- `GET /api/ai/status` - AI service status
- `POST /api/ai/rag/search` - Search knowledge base
- `POST /api/ai/generate-lesson-content` - Generate lesson content

### Courses
- `GET /api/courses` - List courses
- `POST /api/courses` - Create course
- `GET /api/courses/:id` - Get course details

See `app_spec.txt` for complete API documentation.

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

MIT

---

**Academia Rizoma** - Parte de [rizo.ma](https://rizo.ma)
