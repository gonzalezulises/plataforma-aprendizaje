# Project Context - Academia Rizoma

## Architecture (as of 2026-01-29)

```
www.rizo.ma/academia  --Vercel rewrite-->  frontend-one-sigma-58.vercel.app/academia
(rizo-web repo)                            (plataforma-aprendizaje/frontend)
                                                        |
                                                   VITE_API_URL
                                                        |
                                           [Cloudflare Named Tunnel]
                                               api.rizo.ma
                                                        |
                                              [DGX Spark - localhost]
                                              ├── :3001 Node.js Backend (PM2)
                                              ├── :8000 vLLM Qwen3-14B
                                              ├── :8001 Cerebro-RAG API
                                              └── :8002 RAG Proxy
```

### Two Repos
- **rizo-web** (github.com/gonzalezulises/rizo-web) — Main site www.rizo.ma (Astro). Rewrites `/academia/*` to the plataforma frontend.
- **plataforma-aprendizaje** (this repo) — Backend + Frontend for the learning platform.

### Deployment
- **rizo-web**: Vercel project, serves `www.rizo.ma`. Has rewrite in `vercel.json` for `/academia` → `frontend-one-sigma-58.vercel.app`
- **plataforma-aprendizaje/frontend**: Vercel project `frontend` (`frontend-one-sigma-58.vercel.app`). Auto-deploys from `master`.
- **plataforma-aprendizaje/backend**: Runs on DGX Spark via PM2, exposed via Cloudflare Tunnel.
- **Backend**: Node.js + Express, runs on DGX Spark via PM2 (port 3001)
- **LLM**: Qwen3-14B-NVFP4 via vLLM on DGX Spark (port 8000)
- **RAG**: Cerebro-RAG with Milvus GPU, 145+ books, 562K chunks (port 8001)
- **Tunnel**: Cloudflare Named Tunnel → `api.rizo.ma` → `localhost:3001`
- **Auth**: Supabase
- **Database**: SQLite (backend/data/learning.db)

## PROTOCOLO DE DEPLOY AUTOMATICO

**OBLIGATORIO**: Despues de CADA cambio de codigo (commit), ejecutar automaticamente:

```bash
# 1. Commit + push a GitHub (frontend se auto-deploya en Vercel desde master)
git add <archivos> && git commit -m "mensaje" && git push origin master

# 2. Actualizar backend en DGX Spark (pull + restart PM2)
ssh dgx-spark 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd ~/plataforma-aprendizaje && git pull origin master && pm2 restart plataforma-api'

# 3. Verificar que el backend responde
curl -s https://api.rizo.ma/api/ai/status | python3 -c "import sys,json; d=json.load(sys.stdin); print('Backend OK' if d.get('configured') else 'ERROR')"
```

**Reglas:**
- NO esperar a que el usuario pida "deploy" — hacerlo automaticamente tras cada commit
- Si el cambio es solo frontend, el paso 2 (DGX) se puede omitir
- Si el cambio es solo backend, el push a GitHub igual es necesario para mantener el repo sincronizado
- Si el cambio es solo en base de datos (SQL directo en DGX), no se necesita commit ni deploy

## DGX Spark Access

- **SSH**: `ssh dgx-spark` (configured in ~/.ssh/config)
- **IP**: 192.168.100.35 (local) / Tailscale available
- **OS**: Ubuntu 24.04 ARM64 (aarch64)
- **Node.js**: v22.22.0 via nvm
- **PM2**: v6.0.14

### PM2 Processes on DGX

| Process | Name | Description |
|---------|------|-------------|
| Backend API | `plataforma-api` | Node.js backend on :3001 |
| Named Tunnel | `cloudflare-tunnel` | Permanent tunnel for api.rizo.ma |

### Key DGX Paths

- Repo: `~/plataforma-aprendizaje/`
- Backend: `~/plataforma-aprendizaje/backend/`
- Backend .env: `~/plataforma-aprendizaje/backend/.env`
- PM2 logs: `~/.pm2/logs/`
- Cloudflared: `/usr/local/bin/cloudflared`
- nvm: `~/.nvm/`

## Completed Migrations

### DNS Migration to Cloudflare (completed 2026-01-29)
- **Nameservers**: `elliott.ns.cloudflare.com`, `maisie.ns.cloudflare.com`
- **API URL**: `https://api.rizo.ma` (permanent, via Cloudflare Named Tunnel)
- **Quick tunnel**: Removed (`pm2 delete quick-tunnel`)
- **Vercel env vars**: `VITE_API_URL=https://api.rizo.ma/api`, `VITE_WS_URL=wss://api.rizo.ma`

## Operational Notes

### PM2 Startup Service
- **Status**: Configured as `pm2-root` systemd service (runs as root)
- **Note**: PM2 processes run as `gonzalezulises`, but startup service is root
- **pm2 save** has been executed — 2 processes will be restored on reboot
- **Verify after reboot**: `pm2 status` should show `plataforma-api` + `cloudflare-tunnel`

## Cloudflare Account Details

- **Account**: Gonzalez.ulises@gm... (Zero Trust)
- **Tunnel ID**: `5c5f2a7d-46d5-470f-a5cc-1b3470b8403e`
- **Tunnel Name**: `plataforma-api`
- **Zone ID** (rizo.ma): `bd7fdcf20f27f3ea8807198d579b0369`
- **Account ID**: `ef859f719256817f3bdecc915153f27d`
- **Tunnel Token**: stored in PM2 process args (cloudflare-tunnel)

## Interactive Content System (as of 2026-01-29)

AI-generated lesson content is rendered interactively in the browser. Students can execute code, answer quizzes, and receive immediate feedback — all client-side (no backend needed for execution).

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `LessonContentRenderer` | `frontend/src/components/LessonContentRenderer.jsx` | Central markdown renderer with ReactMarkdown + custom widgets |
| `ExecutableCodeBlock` | `frontend/src/components/ExecutableCodeBlock.jsx` | Editable code blocks with Run/Reset (Python via Pyodide, SQL via sql.js) |
| `InlineQuiz` | `frontend/src/components/InlineQuiz.jsx` | MCQ widget with A/B/C/D options, instant feedback, score |
| `InlineExercise` | `frontend/src/components/InlineExercise.jsx` | Exercise card with code editor + solution toggle |
| `usePyodide` | `frontend/src/hooks/usePyodide.js` | Singleton Pyodide v0.24.1 runtime (Python WASM) |
| `useSQLite` | `frontend/src/hooks/useSQLite.js` | Singleton sql.js runtime with pre-loaded sample tables |
| `exercise-parser` | `frontend/src/utils/exercise-parser.js` | Detects exercise/quiz patterns in markdown content |

### How It Works

1. AI generates markdown content with ````python`/`\`\`\`sql` code blocks, `### Ejercicio` sections, MCQ options (A/B/C/D)
2. `exercise-parser.js` splits markdown into segments: `markdown | quiz | exercise`
3. `LessonContentRenderer` renders each segment with the appropriate interactive widget
4. Code blocks use lazy-loaded WASM runtimes (Pyodide for Python, sql.js for SQL)
5. Exercises and quizzes track progress via `/api/inline-exercises` endpoints

### Exercise Parser Detection

- **Structured markers**: `<!-- quiz-start -->` / `<!-- quiz-end -->`, `<!-- exercise-start type="code" lang="python" -->`
- **Natural patterns**: `### Ejercicio`, `### Quiz de consolidacion`, `A)/B)/C)/D)` option lists, `<details><summary>Ver solucion</summary>`
- Multi-question quiz blocks with numbered questions (1. / 2. / 3.) are supported

## 4C Pedagogical Model

Every lesson follows the 4C instructional design model:

1. **Conexiones** (Connections) — Activate prior knowledge with MCQ questions
2. **Conceptos** (Concepts) — Theory + worked examples
3. **Practica Concreta** (Concrete Practice) — Exercises + quiz (~40% of content)
4. **Conclusion** — Summary + consolidation quiz + preview of next topic

### Implementation

- `backend/src/utils/pedagogical4C.js` — Generates 4C structure per lesson (stored in `lessons.structure_4c`)
- `backend/src/lib/claude.js` — `buildSystemPrompt()` enforces 4C section headers; `buildUserPrompt()` injects 4C data into AI prompt

### MCQ-Only Policy (Async Instructional Design)

Since the course is asynchronous (no live instructor), ALL student-facing questions must be multiple-choice:
- Single correct answer or multiple correct answers
- With answer verification and explanation in `<details>` blocks
- NO open-ended questions anywhere (Conexiones, Practica, Conclusion)
- Policy enforced in: `buildSystemPrompt()`, `buildUserPrompt()`, `pedagogical4C.js`
- Database migration auto-updates `structure_4c` in existing lessons

## Content Generation Pipeline

```
CourseCreatorPage → POST /api/ai/generate-lesson-content
                       |
                       ├── queryCerebroRAG(topic) → RAG context from 145+ books
                       |
                       ├── buildSystemPrompt(type, enhanced=true)
                       |   ├── Base directives (Spanish, MCQ-only policy)
                       |   └── 4C model structure with section templates
                       |
                       ├── buildUserPrompt(lesson, structure_4c)
                       |   ├── Course/module/lesson metadata
                       |   ├── 4C pedagogical data (connections, concepts, practice, conclusion)
                       |   └── RAG context
                       |
                       ├── callLocalLLM() → Qwen3-14B on DGX (:8000)
                       |   └── stripThinkingTokens() — removes <think>...</think> from Qwen3
                       |
                       └── Save to lesson_content table as JSON { text: "markdown..." }
```

## Video System (as of 2026-01-29)

Lessons of type "video" support three video sources: YouTube/Vimeo embeds, YouTube search, and direct upload.

### How It Works

1. **VideoPlayer** (`frontend/src/components/VideoPlayer.jsx`) detects the URL type via `parseVideoUrl()` and renders:
   - YouTube: privacy-enhanced iframe (`youtube-nocookie.com/embed/`)
   - Vimeo: iframe (`player.vimeo.com/video/`)
   - Direct (MP4/WebM): HTML5 `<video>` with progress tracking (save/restore position)
2. **CourseCreatorPage** video editor shows URL input with real-time platform detection, live preview, YouTube search button, and upload button
3. Video content is stored in `lesson_content.content` as JSON: `{ "video_url": "https://...", "video_source": "youtube|vimeo|upload|direct", "title": "...", "text": "optional notes" }`
4. **LessonPage** maps `video_url` → `src` in the content block transformation

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `VideoPlayer` | `frontend/src/components/VideoPlayer.jsx` | Multi-source video player (YouTube/Vimeo/direct) |
| `YouTubeSearchModal` | `frontend/src/components/YouTubeSearchModal.jsx` | Search YouTube, select video from results grid |
| `VideoUploadButton` | `frontend/src/components/VideoUploadButton.jsx` | Upload MP4/WebM to Supabase Storage with progress bar |
| `video-utils` | `frontend/src/utils/video-utils.js` | URL parsing, platform detection, validation |

### Backend Endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| `POST /api/youtube/search` | `backend/src/routes/youtube-search.js` | YouTube search via `yt-search` (no API key) |
| `POST /api/video-upload/signed-url` | `backend/src/routes/video-upload.js` | Signed URL for direct upload to Supabase Storage |

### AI Integration

When generating content for `lessonType === 'video'`, the AI route (`/api/ai/generate-lesson-content`) automatically searches YouTube and includes `suggestedVideos` in the response.

### Supabase Storage (Video Upload)

- **Bucket**: `lesson-videos` (must be created manually in Supabase dashboard, set to public)
- **Max size**: 500MB per file
- **Allowed MIME**: `video/mp4`, `video/webm`, `video/quicktime`
- **Flow**: Backend generates signed upload URL → frontend uploads directly to Supabase → public URL returned

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/lib/claude.js` | AI client - LLM + RAG integration, 4C prompts, MCQ policy |
| `backend/src/utils/pedagogical4C.js` | 4C pedagogical model structure generator |
| `backend/src/routes/ai-course-structure.js` | AI course structure generation |
| `backend/src/routes/ai.js` | AI content generation + YouTube suggestions for video lessons |
| `backend/src/routes/youtube-search.js` | YouTube search endpoint (yt-search, no API key) |
| `backend/src/routes/video-upload.js` | Supabase Storage signed URL for video upload |
| `backend/src/routes/inline-exercises.js` | Exercise progress tracking API |
| `backend/src/config/database.js` | SQLite database + schema + migrations |
| `backend/src/index.js` | Express server entry point |
| `frontend/src/components/VideoPlayer.jsx` | Multi-source video player (YouTube/Vimeo/direct) |
| `frontend/src/components/YouTubeSearchModal.jsx` | YouTube search modal with results grid |
| `frontend/src/components/VideoUploadButton.jsx` | Video upload with progress bar |
| `frontend/src/utils/video-utils.js` | Video URL parsing and platform detection |
| `frontend/src/components/LessonContentRenderer.jsx` | Central interactive markdown renderer |
| `frontend/src/utils/exercise-parser.js` | Exercise/quiz detection in markdown |
| `frontend/vercel.json` | Vercel config with rewrites to api.rizo.ma |
| `deploy/update-dgx.sh` | Script to SSH into DGX and update backend |

## Common Operations

```bash
# Update backend on DGX
./deploy/update-dgx.sh

# Check backend status from internet
curl -s https://api.rizo.ma/api/ai/status

# Check PM2 on DGX
ssh dgx-spark 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && pm2 status'

# View PM2 logs
ssh dgx-spark 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && pm2 logs plataforma-api --lines 50 --nostream'

# Check nameserver propagation
dig NS rizo.ma +short

# Restart backend
ssh dgx-spark 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && pm2 restart plataforma-api'
```

## Database Migrations

Migrations run automatically on backend startup in `database.js:runMigrations()`:

| Migration | Description |
|-----------|-------------|
| `objectives` column | Added `objectives` and `objectives_sources` TEXT columns to `courses` table |
| `structure_4c` MCQ update | Replaces open-ended reflection/guiding questions with MCQ-format topics in all lessons |

## Recent Changes (2026-01-29)

### DNS Migration to api.rizo.ma
- Cloudflare nameservers active (`elliott.ns.cloudflare.com`, `maisie.ns.cloudflare.com`)
- `api.rizo.ma` permanent URL via Cloudflare Named Tunnel
- Quick tunnel (`trycloudflare.com`) removed
- Vercel env vars updated, `vercel.json` proxy points to `api.rizo.ma`

### Security Audit (18 issues fixed)
- **Critical (3)**: Removed hardcoded admin password, eliminated x-user-id header spoofing, moved env vars to Vercel dashboard
- **High (5)**: Strong session secret validation, tightened CSRF exclusions, restricted CORS, secured test endpoints, added course ownership enforcement on all 13 state-changing endpoints
- **Medium (5)**: Input length validation (bio/name/avatar_url), safe error response parsing, removed 95 debug console.logs from frontend, standardized API port across 11 files, replaced deprecated references
- **Low (5)**: Deleted 6,087 lines of dead code (10 .bak files + 4 test pages), configured HSTS/CSP/referrer-policy headers via helmet, set ADMIN_DEFAULT_PASSWORD on DGX

### Video System for Lessons
- `VideoPlayer` refactored into 3 sub-components: `YouTubeEmbed`, `VimeoEmbed`, `DirectVideo`
- YouTube/Vimeo URLs auto-detected and rendered as privacy-enhanced iframes
- `YouTubeSearchModal` with search input, results grid (thumbnail + title + duration + channel)
- `VideoUploadButton` with Supabase Storage signed URL upload and progress bar
- `CourseCreatorPage` video content editor with URL input, platform badge, live preview
- `LessonPage` maps `video_url` to `src` in content block transformation
- Backend `POST /api/youtube/search` via `yt-search` (no API key required)
- Backend `POST /api/video-upload/signed-url` for direct-to-Supabase upload
- AI content generation includes `suggestedVideos` for video-type lessons
- New dependency: `yt-search` (backend)

### Interactive Content System (Phases 1-5)
- `LessonContentRenderer` replaces custom regex parsing with ReactMarkdown + interactive widgets
- `ExecutableCodeBlock` with Pyodide (Python WASM) and sql.js (SQLite WASM) in-browser
- `InlineQuiz` MCQ widget with instant feedback
- `InlineExercise` with code editor and solution toggle
- Exercise progress tracking via backend API

### 4C Pedagogical Model Alignment
- Fixed critical field name mismatch in `buildUserPrompt()` — 4C data was generated but never used
- Restructured `buildSystemPrompt()` to follow 4C section headers

### Course Objectives Persistence
- Added `objectives` and `objectives_sources` columns to courses table
- Backend POST/PUT now accept and store objectives
- Frontend `saveCourse()` includes objectives in request body

### Qwen3 Thinking Token Cleanup
- `stripThinkingTokens()` removes `<think>...</think>` blocks from LLM output
- Applied in both backend (`callLocalLLM`) and frontend (`LessonContentRenderer`)

### MCQ-Only Instructional Design Policy
- All student-facing questions mandated as multiple choice
- System prompt updated with explicit MCQ policy
- 4C sections (Conexiones, Conclusion) now generate MCQ quiz format
- Database migration updates existing `structure_4c` data
- Exercise parser supports `### Quiz de consolidacion` headers and multi-question blocks

## Previous Architecture (deprecated)

- Backend was on Railway (`plataforma-aprendizaje-api-production.up.railway.app`)
- LLM accessed via Tailscale IP (`100.116.242.33:8000`)
- Tailscale Funnel used for API access
- Quick tunnel (`cloud-create-providers-average.trycloudflare.com`) used temporarily before DNS migration
- **All replaced** by DGX Spark + Cloudflare Named Tunnel (`api.rizo.ma`)
