# Infrastructure

## Kubernetes (Backend)

Single YAML manifest (`k8s/<project>.yaml`) with:

```yaml
# Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: <project>

# Deployment (1 replica)
spec:
  replicas: 1
  containers:
    - image: <registry>/<project>-backend:latest
      resources:
        requests: { memory: "128Mi", cpu: "100m" }
        limits:   { memory: "512Mi", cpu: "500m" }
      readinessProbe:
        httpGet: { path: /api/health, port: 8000 }
        initialDelaySeconds: 5, periodSeconds: 10
      livenessProbe:
        httpGet: { path: /api/health, port: 8000 }
        initialDelaySeconds: 10, periodSeconds: 30
      envFrom:
        - secretRef: { name: <project>-secrets }

# Service (ClusterIP)
# Ingress (Traefik -> api.project.com)
```

**Secrets management:** `envFrom: secretRef` — all env vars injected from a K8s Secret.

## Docker

**Dev Dockerfile** (`backend/Dockerfile`):
- `python:3.13-slim`, installs with `uv`, runs `uvicorn --reload`

**Prod Dockerfile** (`backend/Dockerfile.prod`):
- Multi-stage build: builder installs deps, runtime copies only site-packages + app code + migrations
- Runs `uvicorn --workers 1` (single worker because in-memory rate limiter is per-process)

**Frontend Dockerfile** (`frontend/Dockerfile`):
- `node:22-slim`, `npm ci`, runs `next dev --turbopack`
- Frontend is deployed to Vercel in production (Dockerfile is dev-only)

## Domain Architecture & DNS

```
┌──────────────────────────────────────────────────────────────────────┐
│  DNS RECORDS                                                          │
│                                                                       │
│  project.com          -> CNAME -> Vercel (cname.vercel-dns.com)      │
│  www.project.com      -> CNAME -> Vercel                             │
│  api.project.com      -> A/CNAME -> K8s Ingress IP / Load Balancer  │
│                                                                       │
│  Example:                                                             │
│  myapp.com            -> Vercel       (Next.js frontend)             │
│  api.myapp.com        -> K8s/Traefik  (FastAPI + MCP backend)       │
│  <project>.supabase.co -> Supabase    (managed, no DNS config needed)│
└──────────────────────────────────────────────────────────────────────┘
```

**The split-domain pattern:**

| Domain | Hosted On | Serves | TLS |
|---|---|---|---|
| `project.com` | **Vercel** | Next.js frontend (SSR + static) | Vercel auto-provisions |
| `api.project.com` | **K8s cluster** | FastAPI REST + MCP SSE | Traefik / cert-manager / Cloudflare |

**Why separate domains (not `/api` path rewrite on Vercel):**
- Vercel `rewrites` to an external backend add latency (double-hop) and complicate SSE streaming
- MCP SSE needs direct, unbuffered connection to the backend — Vercel's edge network can interfere
- Independent scaling: frontend scales via Vercel's CDN, backend scales via K8s replicas
- CORS is explicit and auditable — `api.project.com` only allows `project.com` + `*.vercel.app`

**Vercel preview deploys:**
- Each PR gets `https://<branch>-<project>.vercel.app`
- Backend CORS supports `*.vercel.app` wildcard to allow all previews
- Preview deploys use the **same production backend** (unless you set up staging)

**What you configure where:**
1. **Domain registrar** — Point `project.com` NS to Vercel (or add CNAME)
2. **Domain registrar** — Point `api.project.com` A record to K8s ingress IP
3. **Vercel dashboard** — Add `project.com` as custom domain
4. **K8s Ingress** — `host: api.project.com` in Ingress spec
5. **Backend env** — `FRONTEND_URL=https://project.com,https://*.vercel.app`
6. **Backend env** — `MCP_BASE_URL=https://api.project.com`
7. **Frontend env** — `NEXT_PUBLIC_API_URL=https://api.project.com`
8. **Supabase dashboard** — Add `https://project.com/auth/callback` as allowed redirect URL

**Deployment topology:**

```
                    Internet
                       |
         ┌─────────────┼─────────────┐
         v             v             v
┌────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ Vercel CDN     │  │ K8s Cluster          │  │ Supabase Cloud       │
│                │  │                      │  │                      │
│ project.com    │  │ Traefik Ingress      │  │ <ref>.supabase.co    │
│ *.vercel.app   │  │ └─ api.project.com   │  │ ├── Auth (GoTrue)   │
│                │  │    └─ Service:8000   │  │ ├── PostgreSQL       │
│ Next.js 15     │  │       └─ Pod         │  │ ├── PostGIS          │
│ ├── SSR pages  │  │          ├── /api/*  │  │ ├── Realtime WS     │
│ ├── Static     │  │          └── /mcp    │  │ └── JWKS endpoint   │
│ └── Edge fns   │  │                      │  │                      │
└───────┬────────┘  └──────────┬───────────┘  └──────────┬───────────┘
        │                      │                          │
        │  fetch(/api/*)       │  asyncpg                 │
        ├─────────────────────>│<─────────────────────────┘
        │                      │
        │  Realtime WS         │
        ├──────────────────────┼─────────────────────────>
        │                      │        (direct to Supabase)
```

## Environment Variables

**Backend:**
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (asyncpg format) |
| `SUPABASE_PROJECT_URL` | Supabase project URL (for JWKS, auth endpoints) |
| `MCP_BASE_URL` | Public URL of the MCP server (for OAuth redirects) |
| `FRONTEND_URL` | Comma-separated allowed origins (supports `*.vercel.app` wildcards) |

**Frontend:**
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
