# Frontend Architecture

## Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR for landing, CSR for interactive pages |
| UI | Tailwind CSS 4, Radix UI, shadcn/ui | Accessible, composable, themeable |
| Auth | @supabase/ssr | SSR-compatible Supabase auth |
| Theme | next-themes | Dark/light mode with system detection |

Add domain-specific libraries as needed (maps, charts, editors, etc.).

## Auth Flow

1. User clicks login -> Supabase OAuth (GitHub, Google, etc.)
2. Callback redirects to `/auth/callback` route handler
3. Route handler exchanges code for session via `supabase.auth.exchangeCodeForSession()`
4. Session stored in cookies via `@supabase/ssr`
5. Frontend reads JWT from session for API calls: `Authorization: Bearer <access_token>`
6. No Next.js middleware — auth checks are client-side via `onAuthStateChange`

**Key pattern — INITIAL_SESSION:** The main page listens for `onAuthStateChange` and waits for the `INITIAL_SESSION` event before fetching data. This prevents the "empty state flash" when session cookies haven't been restored yet on page load.

## API Communication

Direct fetch to backend API with JWT from Supabase session:

```typescript
async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}
```

**Realtime updates:** Supabase Realtime subscription on `postgres_changes` for your domain table — INSERT/UPDATE/DELETE events update the local state without re-fetching.

## Responsive Design

Use `useMediaQuery("(min-width: 1024px)")` to split desktop/mobile layouts:
- **Desktop:** Side panels, floating cards, full-width layouts
- **Mobile:** Bottom drawers, stacked views, touch-optimized
