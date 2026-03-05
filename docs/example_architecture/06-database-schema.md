# Database Schema

Example schema — replace `recommendations` with your domain model.

```sql
-- Domain table (replace with your model)
<domain>        (id, user_id, name, ..., agent_id, tags JSONB, created_at, updated_at)

-- Reusable patterns (keep as-is)
lists           (id, user_id, name, description, color, icon, is_ordered,
                 agent_id, created_at, updated_at)

list_items      (id, list_id FK, <domain>_id FK, position, created_at)

activity_log    (id, user_id, action, <domain>_id FK, agent_id, details JSONB, created_at)

api_keys        (id, user_id, key_hash, key_prefix, label, is_active, created_at, last_used_at)

-- Indexes (adapt to your domain)
idx_<domain>_user_id     (user_id)
GIN index on tags        -- JSONB containment queries

-- RLS policies: every table has row-level security
-- Users can only SELECT/INSERT/UPDATE/DELETE their own rows
```

## Domain-Specific Functions (Example: PostGIS)

These are specific to the map use case — replace with your domain's query patterns:

```sql
nearby_<domain>(user_id, lat, lng, radius_meters)  -- Radius search
<domain>_in_bbox(user_id, min_lat, min_lng, max_lat, max_lng)  -- Bounding box
user_<domain>_count(user_id)  -- Quota enforcement
```
