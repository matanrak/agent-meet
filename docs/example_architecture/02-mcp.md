# MCP Server — Authentication & Mounting

> Known pain points documented. This is the trickiest part of the architecture.

## Setup

FastMCP with `RemoteAuthProvider` — delegates OAuth to Supabase, verifies JWTs locally.

```python
# backend/app/mcp/server.py
_jwt_verifier = JWTVerifier(
    jwks_uri=settings.SUPABASE_JWKS_URL,    # e.g. https://<project>.supabase.co/auth/v1/.well-known/jwks.json
    issuer=settings.SUPABASE_AUTH_URL,       # e.g. https://<project>.supabase.co/auth/v1
    audience="authenticated",
    algorithm="ES256",
)
_auth = RemoteAuthProvider(
    token_verifier=_jwt_verifier,
    authorization_servers=[AnyHttpUrl(settings.SUPABASE_AUTH_URL)],
    base_url=settings.MCP_BASE_URL,          # e.g. https://api.project.com — MUST match the public URL
)
mcp = FastMCP("MyApp", auth=_auth)
```

## Mounting — The Critical Subtlety

```python
# backend/app/main.py
mcp_app = mcp.http_app(path="/mcp")          # Creates Starlette sub-app for /mcp endpoint

app = FastAPI(lifespan=lifespan)
app.mount("/api", api)                         # REST routes (with CORS)
app.mount("/", mcp_app)                        # MCP SSE at root (catch-all, MUST be last)
```

**Mount order matters.** `/api` must be mounted before `/` because Starlette matches mounts in order. If `/` were first, it would catch all requests including `/api/*`.

**MCP gets NO global CORS.** FastMCP's `RemoteAuthProvider` manages its own CORS for the OAuth flow. The root `app` deliberately has no CORS middleware — only the `api` sub-app does. Adding CORS to the root app would **break MCP OAuth** with duplicate/conflicting headers.

**Lifespan coupling:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with mcp_app.lifespan(app):   # MCP app lifespan runs inside main app's lifespan
        yield
    await engine.dispose()               # DB engine cleanup on shutdown
```

## OAuth Flow (Supabase as Authorization Server)

The full MCP authentication flow involves **three parties**: the AI agent (Claude Desktop), the FastMCP backend, and Supabase Auth.

```
AI Agent (Claude Desktop)                Backend (FastMCP)                    Supabase Auth
────────────────────────────────────────────────────────────────────────────────────────────
1. Connect to MCP server
   GET /mcp ──────────────────────►  SSE connection established

2. Agent needs auth
   MCP: get OAuth metadata ──────►  Returns authorization_servers
                                     (Supabase Auth URL)

3. Agent starts OAuth                                                 ◄── Supabase handles
   Opens browser to Supabase ──────────────────────────────────────►     OAuth provider
   (Google, GitHub, etc.)                                                (Google, GitHub)

4. User logs in & consents                                           ◄── Supabase issues
                                                                          authorization code

5. Supabase redirects to
   consent page on FRONTEND ────►  /oauth/consent?authorization_id=xxx
   (project.com, NOT the API)

6. Frontend consent page:
   - Checks Supabase session
   - If no session → triggers OAuth login first
   - Fetches authorization details from Supabase
   - Auto-approves (or shows consent UI)
   - Supabase redirects back to agent callback

7. Agent exchanges code ──────►  FastMCP verifies via Supabase
                                  Returns access token (JWT)

8. Agent uses JWT in MCP calls ─►  JWTVerifier validates ES256 sig
                                   via JWKS endpoint
```

**The consent page lives on the FRONTEND** (`/oauth/consent`), not the backend. This is a key architectural decision — Supabase needs to redirect to a page where the user has an active browser session.

## Known Issues & Pain Points

1. **`MCP_BASE_URL` must exactly match the public-facing URL.** If the MCP server is behind a proxy/ingress and the URL doesn't match, OAuth redirects break. This includes trailing slashes — `https://api.project.com` vs `https://api.project.com/` can cause mismatches.

2. **Consent page session chicken-and-egg.** The consent page at `/oauth/consent` needs a Supabase session to approve the authorization. If the user isn't logged in, the page triggers an OAuth login to Supabase first, then returns to complete the MCP authorization. This two-step flow can fail if:
   - The `next` parameter in the callback URL gets URL-encoded incorrectly
   - The browser blocks third-party cookies (Supabase session cookies)
   - Pop-up blockers prevent the OAuth redirect

3. **CORS conflicts.** If you accidentally add CORS middleware to the root FastAPI app (or to a middleware that wraps both `/api` and `/`), FastMCP's OAuth endpoints will return duplicate CORS headers, causing browsers to reject the preflight.

4. **SSE transport quirks.** MCP uses Server-Sent Events. Some reverse proxies (including some Traefik configs) buffer SSE responses or add incorrect `Content-Encoding` headers, which breaks the MCP connection. Traefik needs `flush-interval: -1` or equivalent streaming config.

5. **Token refresh.** MCP sessions can be long-lived, but Supabase JWTs expire (default 1 hour). FastMCP must handle token refresh — if the agent's token expires mid-session, the tool call fails with a JWT expiry error. The agent needs to re-authenticate.

6. **Supabase OAuth provider registration.** For MCP OAuth to work, the MCP client (e.g., Claude Desktop) must be registered as an OAuth application in Supabase's third-party auth settings. The `client_id` and `redirect_uri` must match exactly.

## Tool Pattern

MCP tools follow a standard pattern (CRUD for your domain model + list management). Each tool:

1. Extracts `user_id` from `token.claims["sub"]`
2. Checks rate limit
3. Opens a session with RLS context
4. Calls the shared service layer
5. Logs activity with `access_method="mcp"`
