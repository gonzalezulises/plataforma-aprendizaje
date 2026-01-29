# Project Context - Academia Rizoma

## Architecture (as of 2026-01-28)

```
[Vercel Frontend] --HTTPS--> [Cloudflare Tunnel] --localhost:3001--> [Node.js Backend (PM2)]
                                                                             |
                                                               localhost:8000 (vLLM Qwen3-14B)
                                                               localhost:8001 (Cerebro-RAG API)
                                                               localhost:8002 (RAG Proxy)
                                                                      [DGX Spark]
```

- **Frontend**: React + Vite, hosted on Vercel (auto-deploys from `master`)
- **Backend**: Node.js + Express, runs on DGX Spark via PM2 (port 3001)
- **LLM**: Qwen3-14B-NVFP4 via vLLM on DGX Spark (port 8000)
- **RAG**: Cerebro-RAG with Milvus GPU, 145+ books, 562K chunks (port 8001)
- **Tunnel**: Cloudflare Tunnel (named + quick) exposes backend to internet
- **Auth**: Supabase
- **Database**: SQLite (backend/data/learning.db)

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
| Named Tunnel | `cloudflare-tunnel` | Permanent tunnel for api.rizo.ma (pending DNS) |
| Quick Tunnel | `quick-tunnel` | Temporary trycloudflare.com URL |

### Key DGX Paths

- Repo: `~/plataforma-aprendizaje/`
- Backend: `~/plataforma-aprendizaje/backend/`
- Backend .env: `~/plataforma-aprendizaje/backend/.env`
- PM2 logs: `~/.pm2/logs/`
- Cloudflared: `/usr/local/bin/cloudflared`
- nvm: `~/.nvm/`

## Pending Tasks

### 1. rizo.ma DNS Migration (BLOCKING)
- **Status**: Nameserver change submitted at Marcaria registrar
- **Target nameservers**: `elliott.ns.cloudflare.com`, `maisie.ns.cloudflare.com`
- **Current nameservers**: Still `ns1.vercel-dns.com`, `ns2.vercel-dns.com`
- **Marcaria says**: Up to 48 hours, pending prior change request
- **When ready**:
  1. Cloudflare will show rizo.ma as "Active"
  2. Go to Zero Trust > Tunnels > plataforma-api > Published application routes
  3. Add hostname: subdomain=`api`, domain=`rizo.ma`, type=`HTTP`, URL=`localhost:3001`
  4. Update `frontend/.env.production` and `frontend/vercel.json` to use `https://api.rizo.ma`
  5. Stop quick-tunnel: `pm2 delete quick-tunnel && pm2 save`
  6. Push to GitHub (Vercel auto-deploys)

### 2. Quick Tunnel URL (TEMPORARY)
- **Current URL**: `https://cloud-create-providers-average.trycloudflare.com`
- **Caveat**: URL changes if quick-tunnel PM2 process restarts
- **If it changes**: Check new URL with `pm2 logs quick-tunnel --lines 20 --nostream | grep trycloudflare`
- **Then update**: `frontend/.env.production` and `frontend/vercel.json`, commit, push

### 3. PM2 Startup Service
- **Status**: Configured as `pm2-root` systemd service (runs as root)
- **Note**: PM2 processes run as `gonzalezulises`, but startup service is root
- **pm2 save** has been executed — processes will be restored on reboot
- **Verify after reboot**: `pm2 status` should show all 3 processes

### 4. rizo.ma Website Impact
- rizo.ma was previously on Vercel (ns1.vercel-dns.com)
- After nameserver migration to Cloudflare, DNS records were imported
- Existing A records, MX records (Google), and TXT records preserved
- The main website should continue working once Cloudflare is active
- The `api` subdomain will be new (routed to DGX via tunnel)

## Cloudflare Account Details

- **Account**: Gonzalez.ulises@gm... (Zero Trust)
- **Tunnel ID**: `5c5f2a7d-46d5-470f-a5cc-1b3470b8403e`
- **Tunnel Name**: `plataforma-api`
- **Zone ID** (rizo.ma): `bd7fdcf20f27f3ea8807198d579b0369`
- **Account ID**: `ef859f719256817f3bdecc915153f27d`
- **Tunnel Token**: stored in PM2 process args (cloudflare-tunnel)

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/lib/claude.js` | AI client - LLM + RAG integration, defaults to localhost |
| `backend/src/routes/ai-course-structure.js` | AI course structure generation |
| `backend/src/index.js` | Express server entry point |
| `frontend/.env.production` | Production API/WS URLs (currently quick tunnel) |
| `frontend/vercel.json` | Vercel config with rewrites to backend |
| `deploy/update-dgx.sh` | Script to SSH into DGX and update backend |

## Common Operations

```bash
# Update backend on DGX
./deploy/update-dgx.sh

# Check backend status from internet
curl -s https://cloud-create-providers-average.trycloudflare.com/api/ai/status

# Check PM2 on DGX
ssh dgx-spark 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && pm2 status'

# View PM2 logs
ssh dgx-spark 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && pm2 logs plataforma-api --lines 50 --nostream'

# Check nameserver propagation
dig NS rizo.ma +short

# Restart backend
ssh dgx-spark 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && pm2 restart plataforma-api'
```

## Previous Architecture (deprecated)

- Backend was on Railway (`plataforma-aprendizaje-api-production.up.railway.app`)
- LLM accessed via Tailscale IP (`100.116.242.33:8000`)
- Tailscale Funnel used for API access
- **All replaced** by running backend directly on DGX + Cloudflare Tunnel
