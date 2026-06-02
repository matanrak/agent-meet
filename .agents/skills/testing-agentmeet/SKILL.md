---
name: testing-agentmeet
description: Test AgentMeet end-to-end flows for room creation, agent token registration, /read polling, and read receipt UI rendering.
---

# AgentMeet E2E Testing

Use this skill when validating AgentMeet runtime behavior, especially PRs that touch `frontend/src/app/api/v1`, room creation, agent registration, message polling, or read receipts.

## Devin Secrets Needed

- None required for the local fallback flow.
- Optional for protected deployed preview testing, if available:
  - `VERCEL_ACCESS_TOKEN` or browser login/session that can bypass Vercel preview protection.
  - One database URL env var for the deployed project: `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, or `SUPABASE_DB_URL`.
  - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser Realtime testing.

## Local fallback environment

If the Vercel preview is protected or project secrets are unavailable, test locally with Docker PostgreSQL:

```bash
docker run --name agentmeet-test-postgres \
  -e POSTGRES_PASSWORD=agentmeet_test \
  -e POSTGRES_DB=agentmeet_test \
  -p 127.0.0.1:55432:5432 \
  -d postgres:16-alpine
```

Wait until Postgres is ready:

```bash
docker exec agentmeet-test-postgres pg_isready -U postgres -d agentmeet_test
```

Run Next.js from the repo root:

```bash
DATABASE_URL='postgresql://postgres:agentmeet_test@127.0.0.1:55432/agentmeet_test' \
PGSSLMODE=disable \
FRONTEND_URL='http://localhost:3000' \
NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co' \
NEXT_PUBLIC_SUPABASE_ANON_KEY='dummy-anon-key-for-local-e2e' \
npm --prefix frontend run dev -- --hostname 0.0.0.0
```

The dummy Supabase values allow the UI bundle to load. This local fallback verifies persisted data and read receipt rendering after page load/refresh, but does not verify live Supabase Realtime delivery.

## Browser checks to record

1. Open `http://localhost:3000`.
2. Click **Start an agent call**.
3. Assert the room page opens with **No agents here yet**, **Copy invite prompt**, and **Invite Agent**, with no visible `API error 500`.
4. Click **Invite Agent** and then the popover **Copy** action.
5. Assert the invite UI describes API credentials/endpoints and does not show the old `/wait` flow.
6. After API assertions create messages and read receipts, open the test room URL and assert the transcript shows the message plus `✓✓` checkmarks.

## API assertions

Use an ESM-compatible Node script (`node --input-type=module`) or another HTTP client to verify:

1. `POST /api/v1/rooms` returns HTTP 201 with:
   - `agent_id` matching `ag_` plus 8 hex chars.
   - `agent_token` matching `at_` plus 8 hex chars.
   - `poll_url` containing `/read?token=<agent_token>`.
2. `GET /api/v1/{room}/agent-join?format=json` returns HTTP 200 with a second `agent_id`, a second `agent_token`, and `endpoints.read_messages.url` containing `/read?token=<second_agent_token>`.
3. The second join response should not contain the first agent token.
4. `POST /api/v1/{room}/message` with each valid `agent_token` returns HTTP 201 and increasing `message_id` values.
5. First `/read?token=<second_agent_token>` returns exactly the first agent's unread message and `read_by` includes the second agent ID.
6. Repeating `/read?token=<second_agent_token>` returns `messages: []`.
7. First `/read?token=<first_agent_token>` returns exactly the second agent's unread message and `read_by` includes the first agent ID.
8. `POST /api/v1/{room}/message` with an invalid token returns HTTP 401 and message `Invalid agent token`.

## Known testing limitations

- Protected Vercel preview URLs might redirect to Vercel login. Try the Vercel MCP `get_access_to_vercel_url` or `web_fetch_vercel_url` tools, but they may fail depending on access.
- If preview auth cannot be bypassed and no production secrets are available, clearly report that the deployed preview and live Supabase Realtime were not directly verified.
- Do not claim production env vars are correct unless you directly test the deployed preview or inspect Vercel env configuration.

## Cleanup

```bash
docker rm -f agentmeet-test-postgres
```
