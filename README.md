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
│  www.rizo.ma    │     │              DGX Spark (GPU Server)              │
│  /academia      │     │                                                  │
│  (Vercel)       │     │  ┌─────────────┐  ┌─────────────┐               │
│                 │────▶│  │ Backend API │  │ vLLM        │               │
│  React + Vite   │ CF  │  │ (PM2:3001)  │  │ Qwen3-14B   │               │
│                 │Named│  └──────┬──────┘  │ (GPU:8000)  │               │
└─────────────────┘Tunnel│        │         └─────────────┘               │
                   via   │        ▼                                        │
              api.rizo.ma│ ┌─────────────┐  ┌─────────────────────────┐   │
                        │  │ RAG Server  │  │ Milvus (Vector DB)      │   │
                        │  │ (8001)      │◀▶│ 562,834 chunks          │   │
                        │  └─────────────┘  │ 145+ books              │   │
                        │                    └─────────────────────────┘   │
                        └──────────────────────────────────────────────────┘
```

### Request Flow

```
User browser → www.rizo.ma/academia → Vercel (frontend SPA)
                                        │
                                        ├── Static assets → Vercel CDN
                                        └── /api/* → api.rizo.ma (Cloudflare Named Tunnel)
                                                        │
                                                        └── localhost:3001 (DGX Spark)
                                                              ├── Express API
                                                              ├── SQLite DB
                                                              ├── vLLM :8000 (Qwen3-14B)
                                                              └── Cerebro-RAG :8001 (Milvus)
```

## Tech Stack

### Frontend
- **React 18** - UI framework
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Pyodide** - Python WASM runtime (in-browser code execution)
- **sql.js** - SQLite WASM runtime (in-browser SQL execution)
- **ReactMarkdown** - Content rendering with custom widgets

### Backend
- **Node.js 22** - Runtime
- **Express.js** - Web framework
- **SQLite** - Database (sql.js)
- **WebSockets** - Real-time notifications
- **helmet** - Security headers (HSTS, CSP, referrer-policy)

### AI/RAG System
- **Qwen3-14B-NVFP4** - Local LLM (84GB VRAM on DGX Spark)
- **Cerebro-RAG** - Knowledge retrieval system
- **Milvus GPU** - Vector database
- **multilingual-e5-large** - Embeddings model
- **BGE-reranker-v2-m3** - Reranking model

### Infrastructure
- **DGX Spark** - NVIDIA GPU server (128GB unified memory)
- **Cloudflare** - DNS + Named Tunnel (`api.rizo.ma` → `localhost:3001`)
- **Vercel** - Frontend hosting (auto-deploys from `master`)
- **PM2** - Process management (backend + tunnel)
- **Supabase** - Auth (OAuth) + Storage (video uploads)

### Security
- **CSRF protection** - Token-based, enforced on all state-changing endpoints
- **Session security** - Cryptographic session secrets, httpOnly cookies
- **CORS** - Strict origin whitelist (rizo.ma domains only in production)
- **Course ownership** - Authorization checks on all content modification endpoints
- **Rate limiting** - Login attempt throttling (5 failures → 60s block)
- **Input validation** - Length limits on user-modifiable fields
- **HSTS** - 1 year, includeSubDomains, preload-ready
- **CSP** - Restrictive policy (API serves JSON only)

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
| Frontend (prod) | https://www.rizo.ma/academia |
| API (prod) | https://api.rizo.ma/api |

## Environment Variables

### Backend (.env)
```bash
# Core
NODE_ENV=production
PORT=3001
DATABASE_PATH=./data/learning.db
SESSION_SECRET=<min 32 chars, cryptographic random>

# AI - Local LLM (DGX Spark)
LOCAL_LLM_URL=http://localhost:8000/v1
LOCAL_LLM_MODEL=nvidia/Qwen3-14B-NVFP4
CEREBRO_RAG_URL=http://localhost:8001

# AI - Anthropic (fallback)
# ANTHROPIC_API_KEY=sk-ant-xxx

# Supabase (auth + storage)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Security
ADMIN_DEFAULT_PASSWORD=<strong random password>
# ENABLE_TEST_ENDPOINTS=true  # Only in development
# TEST_USER_PASSWORD=<password>  # Only with ENABLE_TEST_ENDPOINTS

# CORS (optional, for additional allowed origins)
# CORS_EXTRA_ORIGINS=https://extra-domain.com
```

### Frontend (Vercel Dashboard - not committed to git)
```bash
VITE_API_URL=https://api.rizo.ma/api
VITE_WS_URL=wss://api.rizo.ma
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Frontend (.env for local development)
```bash
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## AI Features

### RAG-Enhanced Content Generation
The platform uses Cerebro-RAG to generate pedagogically-sound content:

```bash
# Check AI status
curl https://api.rizo.ma/api/ai/status

# Search knowledge base
curl -X POST https://api.rizo.ma/api/ai/rag/search \
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
│   │   ├── middleware/    # Express middleware (auth, csrf, rateLimiter)
│   │   ├── config/        # Database config
│   │   └── utils/         # Utilities (pedagogical4C.js)
│   ├── data/              # SQLite database
│   └── .env               # Environment config (not committed)
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks (usePyodide, useSQLite)
│   │   ├── store/         # Context providers (Auth, Theme)
│   │   ├── lib/           # Supabase client
│   │   └── utils/         # Utilities (api, csrf, video-utils)
│   └── vercel.json        # Vercel config with rewrites
├── deploy/
│   └── update-dgx.sh     # Update backend on DGX via SSH
├── CLAUDE.md              # Claude Code project context
└── README.md
```

## DGX Spark Deployment

### PM2 Managed Services
```bash
ssh dgx-spark
pm2 status                  # View all services
pm2 logs plataforma-api     # View backend logs
pm2 restart plataforma-api  # Restart backend
```

| PM2 Process | Description |
|-------------|-------------|
| `plataforma-api` | Node.js backend on :3001 |
| `cloudflare-tunnel` | Named tunnel → api.rizo.ma |

### Update Backend
```bash
./deploy/update-dgx.sh
# Or manually:
ssh dgx-spark "cd ~/plataforma-aprendizaje && git pull && cd backend && npm install && pm2 restart plataforma-api"
```

### Service Ports
| Service | Port | Description |
|---------|------|-------------|
| Backend API | 3001 | Express server |
| vLLM | 8000 | Qwen3-14B LLM |
| RAG Server | 8001 | Cerebro-RAG search endpoint |
| RAG Proxy | 8002 | Chat completions proxy |

## User Roles

| Role | Description |
|------|-------------|
| **student_free** | Access to free courses, basic feedback |
| **student_premium** | All courses, AI suggestions, webinars |
| **instructor_admin** | Create/manage courses, analytics |

## Features

### For Students
- Browse and enroll in courses
- Interactive video lessons (YouTube/Vimeo/upload)
- Execute code in-browser (Python via Pyodide, SQL via sql.js)
- Quizzes with instant feedback (MCQ)
- Coding challenges
- Progress tracking & badges
- Forum discussions
- Certificates

### For Instructors
- AI-assisted course creation (RAG-enhanced, 4C pedagogical model)
- YouTube search + video upload for lessons
- Automatic and manual evaluation
- Course ownership and access control
- Analytics dashboard
- Webinar scheduling

## API Endpoints

### AI
- `GET /api/ai/status` - AI service status
- `POST /api/ai/rag/search` - Search knowledge base
- `POST /api/ai/generate-lesson-content` - Generate lesson content

### Courses
- `GET /api/courses` - List courses
- `POST /api/courses` - Create course (instructor only)
- `GET /api/courses/:id` - Get course details
- `PUT /api/courses/:id` - Update course (owner only)
- `DELETE /api/courses/:id` - Delete course (owner only)

### Video
- `POST /api/youtube/search` - Search YouTube videos
- `POST /api/video-upload/signed-url` - Get Supabase upload URL

### Auth
- `POST /api/direct-auth/login` - Email/password login
- `POST /api/direct-auth/register` - Register new account
- `GET /api/auth/csrf-token` - Get CSRF token

See `CLAUDE.md` for complete project context and operational documentation.

## Contributing

1. Create a feature branch
2. Make your changes
3. Verify the frontend builds: `cd frontend && npx vite build`
4. Submit a pull request

## License

MIT

---

**Academia Rizoma** - Parte de [rizo.ma](https://rizo.ma)
