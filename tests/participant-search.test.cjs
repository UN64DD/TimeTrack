const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

function load(file, dependencies = {}) {
  const filename = path.resolve(file);
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = name => Object.hasOwn(dependencies, name) ? dependencies[name] : original(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return loaded.exports;
}

const search = load('src/lib/participant-search.ts');
const organizerId = '00000000-0000-4000-8000-000000000001';
const otherOrganizerId = '00000000-0000-4000-8000-000000000002';
const eventId = '00000000-0000-4000-8000-000000000010';
const otherEventId = '00000000-0000-4000-8000-000000000011';

const participant = {
  full_name: 'Ahmad bin Ali',
  ic_passport: '900101-14-5678',
  order_number: 'TT-ABC123',
};

test('search matches participant name partially and case-insensitively', () => {
  assert.equal(search.matchesParticipantSearch(participant, 'Ahmad'), true);
  assert.equal(search.matchesParticipantSearch(participant, 'bin ali'), true);
  assert.equal(search.matchesParticipantSearch(participant, 'AHMAD BIN'), true);
  assert.equal(search.matchesParticipantSearch(participant, 'Siti'), false);
});

test('search matches a complete IC number with or without formatting', () => {
  assert.equal(search.matchesParticipantSearch(participant, '900101-14-5678'), true);
  assert.equal(search.matchesParticipantSearch(participant, '900101145678'), true);
  assert.equal(search.matchesParticipantSearch(participant, ' 900101 14 5678 '), true);
});

test('search matches a partial IC number', () => {
  assert.equal(search.matchesParticipantSearch(participant, '9001'), true);
  assert.equal(search.matchesParticipantSearch(participant, '14-56'), true);
  assert.equal(search.matchesParticipantSearch(participant, '5678'), true);
  assert.equal(search.matchesParticipantSearch(participant, '8001'), false);
});

test('search matches the order number partially', () => {
  assert.equal(search.matchesParticipantSearch(participant, 'TT-ABC123'), true);
  assert.equal(search.matchesParticipantSearch(participant, 'tt-abc'), true);
  assert.equal(search.matchesParticipantSearch(participant, 'ABC123'), true);
  assert.equal(search.matchesParticipantSearch(participant, 'TT-XYZ'), false);
});

test('search for a nonexistent participant returns no match', () => {
  assert.equal(search.matchesParticipantSearch(participant, 'Nobody Here'), false);
  assert.equal(search.matchesParticipantSearch(participant, '999999999999'), false);
  assert.equal(search.matchesParticipantSearch({ full_name: 'Ahmad', ic_passport: null, order_number: 'TT-1' }, 'zzz'), false);
});

test('normalization trims, collapses whitespace and caps length', () => {
  assert.equal(search.normalizeSearchTerm('  Ahmad   bin  Ali  '), 'Ahmad bin Ali');
  assert.equal(search.normalizeSearchTerm(undefined), '');
  assert.equal(search.normalizeSearchTerm('x'.repeat(500)).length, search.MAX_SEARCH_LENGTH);
  assert.equal(search.normalizeIc(' 900101-14 5678 '), '900101145678');
  assert.equal(search.normalizeIc(null), '');
});

test('IC numbers are masked in search results', () => {
  assert.equal(search.maskIcPassport('900101-14-5678'), '********5678');
  assert.equal(search.maskIcPassport('1234'), '****');
  assert.equal(search.maskIcPassport(''), null);
  assert.equal(search.maskIcPassport(null), null);
});

test('LIKE wildcards in user input are escaped for the SQL predicate', () => {
  assert.equal(search.escapeLikePattern('100%_done'), '100\\%\\_done');
  assert.equal(search.escapeLikePattern('a\\b'), 'a\\\\b');
});

function fixture({ role = 'ORGANIZER', callerId = organizerId, event = { id: eventId, organizer_id: organizerId, deleted_at: null }, rpcResult = { data: [], error: null } } = {}) {
  const calls = { rpc: [], filters: [] };
  const client = {
    from(table) {
      const chain = {
        select() { return this; },
        eq(field, value) { calls.filters.push([table, field, value]); return this; },
        is(field, value) { calls.filters.push([table, field, value]); return this; },
        async single() { return { data: event, error: event ? null : { message: 'not found' } }; },
      };
      return chain;
    },
    async rpc(fn, args) { calls.rpc.push([fn, args]); return rpcResult; },
  };
  const action = load('src/lib/server/actions/participant.actions.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => client },
    '@/lib/server/auth/require-role': { requireRole: async () => ({ user: { id: callerId }, role }) },
    '@/lib/participant-search': search,
  });
  return { action, calls };
}

test('action searches only the requested event and masks IC numbers', async () => {
  const rows = [{
    participant_id: 'p1', full_name: 'Ahmad bin Ali', ic_passport: '900101-14-5678',
    bib_name: null, bib_number: '1004', category_id: 'c1', category_name: 'Full Marathon',
    registration_id: 'r1', order_number: 'TT-ABC123', registration_status: 'PAID',
  }];
  const { action, calls } = fixture({ rpcResult: { data: rows, error: null } });

  const results = await action.searchEventParticipantsAction(eventId, '  900101-14-5678  ');

  assert.equal(results.length, 1);
  assert.equal(results[0].full_name, 'Ahmad bin Ali');
  assert.equal(results[0].order_number, 'TT-ABC123');
  assert.equal(results[0].ic_passport, '********5678');
  assert.equal(results[0].category_name, 'Full Marathon');
  assert.ok(calls.filters.some(([table, field, value]) => table === 'events' && field === 'id' && value === eventId));
  assert.deepEqual(calls.rpc, [['search_event_participants', { p_event_id: eventId, p_query: '900101-14-5678', p_limit: search.PARTICIPANT_SEARCH_LIMIT }]]);
});

test('action returns an empty list when nothing matches', async () => {
  const { action } = fixture({ rpcResult: { data: [], error: null } });
  assert.deepEqual(await action.searchEventParticipantsAction(eventId, 'nobody here'), []);
});

test('action ignores queries shorter than the minimum length', async () => {
  const { action, calls } = fixture();
  assert.deepEqual(await action.searchEventParticipantsAction(eventId, ' a '), []);
  assert.equal(calls.rpc.length, 0);
  assert.equal(calls.filters.length, 0);
});

test('action rejects an organizer searching another organizer’s event', async () => {
  const { action, calls } = fixture({
    callerId: otherOrganizerId,
    event: { id: eventId, organizer_id: organizerId, deleted_at: null },
  });

  await assert.rejects(action.searchEventParticipantsAction(eventId, 'Ahmad'), /Forbidden/);
  assert.equal(calls.rpc.length, 0);
});

test('action rejects a deleted or unknown event', async () => {
  const { action, calls } = fixture({ event: null });
  await assert.rejects(action.searchEventParticipantsAction(otherEventId, 'Ahmad'), /Event not found/);
  assert.equal(calls.rpc.length, 0);
});

test('admin can search any event and the event id is always scoped', async () => {
  const { action, calls } = fixture({
    role: 'ADMIN',
    callerId: otherOrganizerId,
    event: { id: eventId, organizer_id: organizerId, deleted_at: null },
  });

  await action.searchEventParticipantsAction(eventId, 'Ahmad');
  assert.deepEqual(calls.rpc, [['search_event_participants', { p_event_id: eventId, p_query: 'Ahmad', p_limit: search.PARTICIPANT_SEARCH_LIMIT }]]);
});

test('database errors surface as action errors', async () => {
  const { action } = fixture({ rpcResult: { data: null, error: { message: 'boom' } } });
  await assert.rejects(action.searchEventParticipantsAction(eventId, 'Ahmad'), /boom/);
});

// ---------------------------------------------------------------------------
// SQL search function: matching, escaping, event isolation and RLS.
// ---------------------------------------------------------------------------

const organizerA = '00000000-0000-4000-8000-0000000000a1';
const organizerB = '00000000-0000-4000-8000-0000000000a2';
const eventA = '00000000-0000-4000-8000-0000000000b1';
const eventB = '00000000-0000-4000-8000-0000000000b2';
const categoryA = '00000000-0000-4000-8000-0000000000c1';
const categoryB = '00000000-0000-4000-8000-0000000000c2';
let db;

async function asUser(id, sql, params = []) {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${id}', false); SELECT set_config('request.jwt.claim.role', 'authenticated', false);`);
  try { return await db.query(sql, params); }
  finally { await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false); SELECT set_config('request.jwt.claim.role', '', false);"); }
}

async function searchRows(eventIdValue, query, caller = organizerA) {
  const result = await asUser(caller, 'SELECT * FROM public.search_event_participants($1, $2, 25)', [eventIdValue, query]);
  return result.rows;
}

before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;`);
  for (const name of fs.readdirSync(path.join(__dirname, '../supabase/migrations')).sort()) {
    if (!name.endsWith('.sql') || name.startsWith('003_')) continue;
    const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations', name), 'utf8')
      .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/g, '');
    await db.exec(sql);
  }
  await db.exec(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
    INSERT INTO public.users (id, email) VALUES ('${organizerA}', 'a@example.test'), ('${organizerB}', 'b@example.test');
    INSERT INTO public.events (id, organizer_id, title, slug, status, event_date, registration_open, registration_close)
      VALUES ('${eventA}', '${organizerA}', 'Event A', 'event-a', 'LIVE', now() + interval '1 month', now() - interval '1 day', now() + interval '1 week'),
             ('${eventB}', '${organizerB}', 'Event B', 'event-b', 'LIVE', now() + interval '1 month', now() - interval '1 day', now() + interval '1 week');
    INSERT INTO public.event_categories (id, event_id, name, base_price) VALUES
      ('${categoryA}', '${eventA}', 'Full Marathon', 50), ('${categoryB}', '${eventB}', '10K Fun Run', 30);
    INSERT INTO public.registrations (id, event_id, athlete_id, registration_number, status) VALUES
      ('00000000-0000-4000-8000-0000000000d1', '${eventA}', '${organizerA}', 'TT-AHMAD01', 'PAID'),
      ('00000000-0000-4000-8000-0000000000d2', '${eventB}', '${organizerB}', 'TT-SITI02', 'PAID');
    INSERT INTO public.participants (id, registration_id, category_id, full_name, ic_passport) VALUES
      ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', '${categoryA}', 'Ahmad bin Ali', '900101-14-5678'),
      ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000d2', '${categoryB}', 'Siti Aminah', '880202145566');`);
});

after(async () => { await db?.close(); });

test('SQL search finds participants by partial name within the event', async () => {
  const rows = await searchRows(eventA, 'ahmad');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].full_name, 'Ahmad bin Ali');
  assert.equal(rows[0].order_number, 'TT-AHMAD01');
  assert.equal(rows[0].category_name, 'Full Marathon');
});

test('SQL search matches complete and partial IC numbers regardless of formatting', async () => {
  assert.equal((await searchRows(eventA, '900101-14-5678')).length, 1);
  assert.equal((await searchRows(eventA, '900101145678')).length, 1);
  assert.equal((await searchRows(eventA, '9001')).length, 1);
  assert.equal((await searchRows(eventA, '14-56')).length, 1);
  assert.equal((await searchRows(eventA, '1456')).length, 1);
  assert.equal((await searchRows(eventA, '8001')).length, 0);
});

test('SQL search matches order numbers and rejects nonexistent participants', async () => {
  assert.equal((await searchRows(eventA, 'AHMAD01')).length, 1);
  assert.equal((await searchRows(eventA, 'TT-AH')).length, 1);
  assert.equal((await searchRows(eventA, 'Nobody Here')).length, 0);
  assert.equal((await searchRows(eventA, '999999999999')).length, 0);
});

test('SQL search never leaks another event’s participants', async () => {
  assert.equal((await searchRows(eventA, 'Siti')).length, 0);
  assert.equal((await searchRows(eventA, 'TT-SITI02')).length, 0);
  const eventBRows = await searchRows(eventB, 'Siti', organizerB);
  assert.equal(eventBRows.length, 1);
  assert.equal(eventBRows[0].full_name, 'Siti Aminah');
});

test('SQL search is bounded by organizer RLS permissions', async () => {
  assert.equal((await searchRows(eventA, 'Ahmad', organizerB)).length, 0);
  assert.equal((await searchRows(eventA, '900101145678', organizerB)).length, 0);
});

test('SQL search treats LIKE wildcards as literal characters', async () => {
  assert.equal((await searchRows(eventA, '%')).length, 0);
  assert.equal((await searchRows(eventA, '_')).length, 0);
});

test('SQL search limits the result set', async () => {
  const result = await asUser(organizerA, 'SELECT * FROM public.search_event_participants($1, $2, 1)', [eventA, '']);
  assert.equal(result.rows.length, 1);
});
