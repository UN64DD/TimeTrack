-- 015_participant_search.sql
-- Participant search by name, IC/passport number and order number.
--
-- IC/passport numbers are stored as entered. `normalize_ic` strips separators
-- (spaces, dashes, slashes) so "900101-14-5678" and "900101145678" are found by
-- the same query. The search function filters on registrations.event_id first,
-- so only the event's own rows are considered (no full-table scan), and returns
-- only the fields needed by the organizer-facing result list.

CREATE OR REPLACE FUNCTION normalize_ic(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT upper(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

-- Matching is infix (ILIKE '%term%'), so a btree index cannot serve the text
-- comparison itself. The scan is bounded by filtering registrations.event_id
-- first (idx_registrations_event_id) and by capping the result set below. If
-- partial search on very large events becomes hot, add a pg_trgm GIN index on
-- participants.full_name and participants.ic_passport.

CREATE OR REPLACE FUNCTION search_event_participants(
  p_event_id uuid,
  p_query text,
  p_limit integer DEFAULT 25
)
RETURNS TABLE (
  participant_id uuid,
  full_name varchar,
  ic_passport varchar,
  bib_name varchar,
  bib_number varchar,
  category_id uuid,
  category_name varchar,
  registration_id uuid,
  order_number varchar,
  registration_status varchar
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH term AS (
    SELECT
      left(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')), 100) AS raw,
      normalize_ic(p_query) AS ic
  ),
  input AS (
    SELECT
      replace(replace(replace(raw, '\', '\\'), '%', '\%'), '_', '\_') AS escaped,
      ic
    FROM term
  )
  SELECT
    p.id,
    p.full_name,
    p.ic_passport,
    p.bib_name,
    p.bib_number,
    p.category_id,
    c.name,
    r.id,
    r.registration_number,
    r.status
  FROM registrations r
  JOIN participants p ON p.registration_id = r.id
  LEFT JOIN event_categories c ON c.id = p.category_id
  CROSS JOIN input
  WHERE r.event_id = p_event_id
    AND r.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND (
      input.escaped = ''
      OR p.full_name ILIKE '%' || input.escaped || '%' ESCAPE '\'
      OR (input.ic <> '' AND normalize_ic(p.ic_passport) LIKE '%' || input.ic || '%')
      OR r.registration_number ILIKE '%' || input.escaped || '%' ESCAPE '\'
    )
  ORDER BY p.full_name ASC, r.created_at ASC
  LIMIT least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

REVOKE ALL ON FUNCTION search_event_participants(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_event_participants(uuid, text, integer) TO authenticated;
