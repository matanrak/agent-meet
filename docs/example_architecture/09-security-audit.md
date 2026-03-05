# Security Audit

## What's Done Well

1. **RLS as defense-in-depth.** Even if application code has a bug (missing WHERE clause, wrong user_id), the database won't return another user's data. This is the strongest pattern for multi-tenant isolation.

2. **JWT verification via JWKS.** Tokens are verified against Supabase's public JWKS endpoint with proper algorithm pinning (ES256), audience check, and expiry validation. No shared secrets.

3. **API key hashing.** Keys stored as SHA-256 hashes, never plaintext. Key shown once at creation. Prefix stored separately for display.

4. **Input sanitization.** All user text passes through `bleach.clean(tags=[], strip=True)` before storage — prevents stored XSS.

5. **CORS isolation.** REST sub-app has CORS, MCP root app doesn't. Wildcard CORS uses regex matching (not blanket `*`). Only specific origins are allowed.

6. **Quota enforcement at DB level.** `user_recommendation_count()` runs in PostgreSQL, not just application code. Hard to bypass.

7. **Connection pool role reset.** The `checkin` listener clears RLS context when connections return to the pool. Defense against identity leakage between requests.

8. **API key management is JWT-only.** Can't use an API key to create/revoke API keys. Prevents key escalation.

9. **Activity audit trail.** Every CRUD operation is logged with user_id, agent_id, access_method, and timestamp. Full accountability for who did what.

10. **Parameterized queries throughout.** SQLAlchemy's query builder prevents SQL injection. No raw string interpolation in SQL.

## Security Concerns

### HIGH — Fix These

**H1. API key hashing is SHA-256 without salt or iterations.**
```python
key_hash = hashlib.sha256(plaintext_key.encode()).hexdigest()
```
Single-pass SHA-256 is fast to brute-force. If the `api_keys` table is leaked (SQL injection, backup exposure, Supabase breach), an attacker can reverse hashes quickly. The keys have 256-bit entropy which mitigates this somewhat, but best practice is `bcrypt`, `scrypt`, or `argon2`. Since keys are high-entropy random strings (not passwords), SHA-256 is *acceptable* but not ideal — the real risk is if the table leaks and the attacker can compute `sha256(<prefix>_<candidate>)` at GPU speeds.

**Verdict:** Acceptable for high-entropy keys, but switch to HMAC-SHA256 with a server-side secret for zero-cost improvement.

**H2. No rate limiting on authentication endpoints.**
The dual-auth `get_auth_context` tries JWT then API key. There's no throttle on failed API key attempts. An attacker can brute-force API key hashes via the REST API. The 256-bit key entropy makes this impractical, but there's no log/alert for failed auth attempts either (only a `logger.warning` in the api_keys service).

**Verdict:** Add failed-auth rate limiting (e.g., 10 failures per IP per minute) and alerting.

**H3. CORS wildcard `*.vercel.app` can be tightened.**
```python
FRONTEND_URL=https://project.com,https://*.vercel.app
```
The `.env.example` suggests `*.vercel.app` which, via the regex matcher (`.*\.vercel\.app`), would match ANY Vercel-deployed site — not just your project's preview deploys. Vercel preview URLs follow a predictable pattern like `https://<project>-<hash>-<username>s-projects.vercel.app`, so in practice you'd set something scoped to your project. But if someone copies the example verbatim with `*.vercel.app`, any Vercel site could make cross-origin requests to the API.

Note: this is only exploitable if the victim already has a valid JWT (CORS allows the request, but auth still requires a Bearer token — browsers don't auto-attach it). The real risk is if a malicious Vercel site tricks the user into pasting their token.

**Verdict:** Use your project-specific pattern: `https://<project>-*-<username>s-projects.vercel.app`. Update the `.env.example` comment to make this clear.

**H4. No CSRF protection on state-changing endpoints.**
The REST API uses JWT Bearer tokens (not cookies) for auth, which naturally prevents CSRF since browsers don't auto-attach Bearer headers. However, the Supabase session IS cookie-based on the frontend. If any endpoint accepts cookies for auth (not just the Bearer header), it's CSRF-vulnerable.

**Verdict:** Currently safe because `getAuthHeaders()` explicitly reads the token and sets `Authorization: Bearer`. But adding a Next.js API route that proxies to the backend with cookies would open a CSRF hole. Document this as a constraint.

### MEDIUM — Should Fix

**M1. `authenticator` role default behavior is unclear.**
If `set_rls_context()` is never called (bug in new code), queries run as `authenticator`. Depending on Supabase's default grants, `authenticator` might have SELECT on all tables without RLS filtering (it's a member of `authenticated` but might not have policies applied when not SET ROLE'd). The checkin listener resets to `authenticator`, but the *default* `authenticator` access is not locked down.

**Verdict:** Verify that `authenticator` WITHOUT `SET ROLE` cannot read any user tables. Add a test that queries without `set_rls_context()` and asserts 0 rows.

**M2. MCP tool error responses leak internal state.**
MCP tools return error dicts like `{"error": "Quota exceeded: 847/1000 recommendations"}`. This tells an attacker exactly how many records a user has. Also `{"error": "invalid list_id format"}` confirms parameter names.

**Verdict:** Generic error messages for external-facing errors. Log details server-side.

**M3. No request size limits on the REST API.**
FastAPI defaults allow large request bodies. The `save_recommendation_list` endpoint accepts up to 50 recommendations per batch, but there's no global body size limit. A malicious client could send a huge JSON payload.

**Verdict:** Add `--limit-request-body` to uvicorn or a middleware.

**M4. `image_urls` are stored but never validated for content.**
URLs are checked for `https://` prefix and length, but not fetched or validated. An attacker could store `https://evil.com/tracking-pixel.gif` and it would render in the frontend. This enables tracking and potential XSS if the frontend renders URLs unsafely.

**Verdict:** Consider a URL allowlist (e.g., only `https://*.googleusercontent.com`, `https://*.unsplash.com`) or proxy images through your own domain.

**M5. Supabase Realtime subscription has no server-side filter.**
```typescript
supabase.channel("recommendations-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "recommendations" }, ...)
```
The frontend subscribes to ALL changes on the table. RLS filters events, but the subscription itself is broad. If RLS is misconfigured, all users' changes would be broadcast.

**Verdict:** Add a filter: `filter: "user_id=eq.<current_user_id>"` to the subscription for defense-in-depth.

### LOW — Nice to Have

**L1. No Content-Security-Policy headers.** The frontend doesn't set CSP headers, allowing inline scripts and any source for images/fonts.

**L2. No Strict-Transport-Security header** on the backend. Browsers could be MitM'd on first visit.

**L3. No API key rotation mechanism.** Users can revoke and create new keys, but there's no "rotate" (create new + revoke old atomically). During rotation, there's a window where both keys are active.

**L4. Session storage for map state.** `sessionStorage` is per-tab and not encrypted. View state (lat/lng) could reveal user's location to someone with physical access.

**L5. `bleach` is deprecated.** Still works but no longer maintained. Switch to `nh3` (Rust-based, same API).

## Overall Assessment

The architecture is **solid for its scale**. The combination of RLS + JWT + input sanitization + parameterized queries covers the critical bases. The main gaps are:
- CORS wildcard too broad (H3 — easy fix)
- No auth failure rate limiting (H2 — moderate effort)
- Missing security headers (L1/L2 — easy fix)

For a single-developer project with <1000 users, this is above-average security. For a production SaaS, address H2, H3, and M1 before launch.
