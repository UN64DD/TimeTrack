import { matchesParticipantSearch, normalizeSearchTerm } from '../participant-search';

// Dynamic server-only imports
const getFs = () => (typeof window === 'undefined' ? require('fs') : null);
const getPath = () => (typeof window === 'undefined' ? require('path') : null);

// Local DB file path
const getDbFilePath = () => {
  const p = getPath();
  return p ? p.join(process.cwd(), 'src/lib/supabase/db-store.json') : '';
};

// Helper to load database
function loadDb(): any {
  try {
    const fs = getFs();
    const filePath = getDbFilePath();
    if (fs && filePath && fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const db = JSON.parse(data);
      let updated = false;
      if (db.users) {
        const V = 'password123';
        for (const u of db.users) {
          if (!u.password) { u.password = V; updated = true; }
        }
        if (!db.users.some((u: any) => u.email === 'root@gmail.com')) {
          db.users.push({ id: 'admin_test', email: 'root@gmail.com', password: 'password123', role: 'ADMIN', status: 'ACTIVE' });
          updated = true;
        }
        if (!db.users.some((u: any) => u.email === 'admin@gmail.com')) {
          db.users.push({ id: 'admin_test_2', email: 'admin@gmail.com', password: 'password123', role: 'ADMIN', status: 'ACTIVE' });
          updated = true;
        }
        if (!db.users.some((u: any) => u.email === 'test@gmail.com')) {
          db.users.push({ id: 'user_test', email: 'test@gmail.com', password: 'password123', role: 'ATHLETE', status: 'ACTIVE' });
          updated = true;
        }
      }
      if (updated) {
        saveDb(db);
      }
      return db;
    }
  } catch (e) {
    console.error('Error loading local DB file, using memory:', e);
  }
  
  // Seed initial mock database structure if not exists
  const initialDb = {
    events: [
      {
        id: 'evt_1',
        title: 'Kuala Lumpur Marathon 2026',
        slug: 'kl-marathon-2026',
        description: 'The premier marathon event in Malaysia.',
        event_date: '2026-10-12T07:00:00Z',
        registration_open: '2026-06-01T00:00:00Z',
        registration_close: '2026-09-30T23:59:59Z',
        venue_name: 'Dataran Merdeka',
        city: 'Kuala Lumpur',
        status: 'LIVE',
        deleted_at: null,
        organizer_id: 'org_1',
        cover_image: 'https://images.unsplash.com/photo-1502224562085-639556652f33?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: 'evt_2',
        title: 'Penang Bridge International Bridge Run',
        slug: 'penang-bridge-run-2026',
        description: 'Run across the iconic Penang Bridge.',
        event_date: '2026-11-22T06:00:00Z',
        registration_open: '2026-06-15T00:00:00Z',
        registration_close: '2026-10-31T23:59:59Z',
        venue_name: 'Queensbay Mall',
        city: 'Penang',
        status: 'LIVE',
        deleted_at: null,
        organizer_id: 'org_1',
        cover_image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: 'evt_3',
        title: 'Melaka Ultra Challenge',
        slug: 'melaka-ultra-2026',
        description: 'Test your limits in historical Melaka.',
        event_date: '2026-05-15T05:00:00Z',
        registration_open: '2026-01-01T00:00:00Z',
        registration_close: '2026-04-30T23:59:59Z',
        venue_name: 'Stadthuys',
        city: 'Melaka',
        status: 'COMPLETED',
        deleted_at: null,
        organizer_id: 'org_1',
        cover_image: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?q=80&w=600&auto=format&fit=crop'
      }
    ],
    event_categories: [
      { id: 'cat_1', event_id: 'evt_1', name: 'Full Marathon (42km)', base_price: '120.00', max_slots: 1000 },
      { id: 'cat_2', event_id: 'evt_1', name: 'Half Marathon (21km)', base_price: '80.00', max_slots: 1500 },
      { id: 'cat_3', event_id: 'evt_2', name: '10K Fun Run', base_price: '50.00', max_slots: 2000 },
      { id: 'cat_4', event_id: 'evt_3', name: '50K Ultra', base_price: '220.00', max_slots: 300 }
    ],
    registrations: [
      { id: 'reg_1', event_id: 'evt_1', athlete_id: 'user_test', category_id: 'cat_1', bib_number: '1004', total_amount: '120.00', status: 'CONFIRMED', created_at: '2026-06-18T10:00:00Z' },
      { id: 'reg_2', event_id: 'evt_2', athlete_id: 'user_test', category_id: 'cat_3', bib_number: '2055', total_amount: '50.00', status: 'CONFIRMED', created_at: '2026-06-19T14:30:00Z' },
      { id: 'reg_3', event_id: 'evt_1', athlete_id: 'user_1', category_id: 'cat_2', bib_number: '2001', total_amount: '80.00', status: 'CONFIRMED', created_at: '2026-06-18T11:00:00Z' }
    ],
    payments: [],
    participants: [],
    results: [
      { id: 'res_1', event_id: 'evt_3', bib_number: '5001', athlete_name: 'John Doe', finish_time: '04:12:35', overall_rank: 1, category_name: '50K Ultra', age_group: 'Men Open' },
      { id: 'res_2', event_id: 'evt_3', bib_number: '5002', athlete_name: 'Jane Smith', finish_time: '04:25:12', overall_rank: 2, category_name: '50K Ultra', age_group: 'Women Open' },
      { id: 'res_3', event_id: 'evt_3', bib_number: '5003', athlete_name: 'Ahmad bin Ali', finish_time: '04:38:40', overall_rank: 3, category_name: '50K Ultra', age_group: 'Men Open' }
    ],
    coupons: [],
    users: [
      { id: 'org_1', email: 'organizer@timetrack.asia', password: 'password123', role: 'ORGANIZER', status: 'ACTIVE' },
      { id: 'user_1', email: 'athlete@timetrack.asia', password: 'password123', role: 'ATHLETE', status: 'ACTIVE' },
      { id: 'user_test', email: 'test@gmail.com', password: 'password123', role: 'ATHLETE', status: 'ACTIVE' },
      { id: 'admin_test', email: 'root@gmail.com', password: 'password123', role: 'ADMIN', status: 'ACTIVE' },
      { id: 'admin_test_2', email: 'admin@gmail.com', password: 'password123', role: 'ADMIN', status: 'ACTIVE' }
    ],
    organizer_codes: [],
    audit_logs: [],
    email_queue: []
  };

  saveDb(initialDb);
  return initialDb;
}

// Helper to save database
function saveDb(db: any) {
  try {
    const fs = getFs();
    const path = getPath();
    const filePath = getDbFilePath();
    if (fs && path && filePath) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('Error saving local DB file:', e);
  }
}

// In-Memory fallback for client-side usage (since FS is not available in browser)
let clientMemoryDb: any = null;
function getClientDb(): any {
  if (typeof window === 'undefined') {
    return loadDb();
  }
  if (!clientMemoryDb) {
    // Attempt to load from localStorage, fallback to default seed
    try {
      const stored = localStorage.getItem('timetrack_local_db');
      if (stored) {
        clientMemoryDb = JSON.parse(stored);
      }
    } catch {}
    if (!clientMemoryDb) {
      clientMemoryDb = {
        events: [
          {
            id: 'evt_1',
            title: 'Kuala Lumpur Marathon 2026',
            slug: 'kl-marathon-2026',
            description: 'The premier marathon event in Malaysia.',
            event_date: '2026-10-12T07:00:00Z',
            registration_open: '2026-06-01T00:00:00Z',
            registration_close: '2026-09-30T23:59:59Z',
            venue_name: 'Dataran Merdeka',
            city: 'Kuala Lumpur',
            status: 'LIVE',
            deleted_at: null,
            organizer_id: 'org_1',
            cover_image: 'https://images.unsplash.com/photo-1502224562085-639556652f33?q=80&w=600&auto=format&fit=crop'
          },
          {
            id: 'evt_2',
            title: 'Penang Bridge International Bridge Run',
            slug: 'penang-bridge-run-2026',
            description: 'Run across the iconic Penang Bridge.',
            event_date: '2026-11-22T06:00:00Z',
            registration_open: '2026-06-15T00:00:00Z',
            registration_close: '2026-10-31T23:59:59Z',
            venue_name: 'Queensbay Mall',
            city: 'Penang',
            status: 'LIVE',
            deleted_at: null,
            organizer_id: 'org_1',
            cover_image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=600&auto=format&fit=crop'
          },
          {
            id: 'evt_3',
            title: 'Melaka Ultra Challenge',
            slug: 'melaka-ultra-2026',
            description: 'Test your limits in historical Melaka.',
            event_date: '2026-05-15T05:00:00Z',
            registration_open: '2026-01-01T00:00:00Z',
            registration_close: '2026-04-30T23:59:59Z',
            venue_name: 'Stadthuys',
            city: 'Melaka',
            status: 'COMPLETED',
            deleted_at: null,
            organizer_id: 'org_1',
            cover_image: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?q=80&w=600&auto=format&fit=crop'
          }
        ],
        event_categories: [
          { id: 'cat_1', event_id: 'evt_1', name: 'Full Marathon (42km)', base_price: '120.00', max_slots: 1000 },
          { id: 'cat_2', event_id: 'evt_1', name: 'Half Marathon (21km)', base_price: '80.00', max_slots: 1500 },
          { id: 'cat_3', event_id: 'evt_2', name: '10K Fun Run', base_price: '50.00', max_slots: 2000 },
          { id: 'cat_4', event_id: 'evt_3', name: '50K Ultra', base_price: '220.00', max_slots: 300 }
        ],
        registrations: [
          { id: 'reg_1', event_id: 'evt_1', athlete_id: 'user_test', category_id: 'cat_1', bib_number: '1004', total_amount: '120.00', status: 'CONFIRMED', created_at: '2026-06-18T10:00:00Z' },
          { id: 'reg_2', event_id: 'evt_2', athlete_id: 'user_test', category_id: 'cat_3', bib_number: '2055', total_amount: '50.00', status: 'CONFIRMED', created_at: '2026-06-19T14:30:00Z' },
          { id: 'reg_3', event_id: 'evt_1', athlete_id: 'user_1', category_id: 'cat_2', bib_number: '2001', total_amount: '80.00', status: 'CONFIRMED', created_at: '2026-06-18T11:00:00Z' }
        ],
        payments: [],
        participants: [],
        results: [
          { id: 'res_1', event_id: 'evt_3', bib_number: '5001', athlete_name: 'John Doe', finish_time: '04:12:35', overall_rank: 1, category_name: '50K Ultra', age_group: 'Men Open' },
          { id: 'res_2', event_id: 'evt_3', bib_number: '5002', athlete_name: 'Jane Smith', finish_time: '04:25:12', overall_rank: 2, category_name: '50K Ultra', age_group: 'Women Open' },
          { id: 'res_3', event_id: 'evt_3', bib_number: '5003', athlete_name: 'Ahmad bin Ali', finish_time: '04:38:40', overall_rank: 3, category_name: '50K Ultra', age_group: 'Men Open' }
        ],
        coupons: [],
        users: [
          { id: 'org_1', email: 'organizer@timetrack.asia', role: 'ORGANIZER', status: 'ACTIVE' },
          { id: 'user_1', email: 'athlete@timetrack.asia', role: 'ATHLETE', status: 'ACTIVE' },
          { id: 'user_test', email: 'test@gmail.com', role: 'ATHLETE', status: 'ACTIVE' },
          { id: 'admin_test', email: 'root@gmail.com', role: 'ADMIN', status: 'ACTIVE' },
          { id: 'admin_test_2', email: 'admin@gmail.com', role: 'ADMIN', status: 'ACTIVE' }
        ],
        organizer_codes: [],
        audit_logs: [],
        email_queue: []
      };
      saveClientDb(clientMemoryDb);
    }
  }
  
  let clientUpdated = false;
  if (clientMemoryDb) {
    if (clientMemoryDb.users) {
      for (const u of clientMemoryDb.users) {
        if (!u.password) { u.password = 'password123'; clientUpdated = true; }
      }
    }
    if (!clientMemoryDb.users.some((u: any) => u.email === 'root@gmail.com')) {
      clientMemoryDb.users.push({ id: 'admin_test', email: 'root@gmail.com', role: 'ADMIN', status: 'ACTIVE' });
      clientUpdated = true;
    }
    if (!clientMemoryDb.users.some((u: any) => u.email === 'admin@gmail.com')) {
      clientMemoryDb.users.push({ id: 'admin_test_2', email: 'admin@gmail.com', role: 'ADMIN', status: 'ACTIVE' });
      clientUpdated = true;
    }
    if (!clientMemoryDb.users.some((u: any) => u.email === 'test@gmail.com')) {
      clientMemoryDb.users.push({ id: 'user_test', email: 'test@gmail.com', role: 'ATHLETE', status: 'ACTIVE' });
      clientUpdated = true;
    }
  }
  if (clientUpdated) {
    saveClientDb(clientMemoryDb);
  }
  
  return clientMemoryDb;
}

function saveClientDb(db: any) {
  if (typeof window === 'undefined') {
    saveDb(db);
    return;
  }
  clientMemoryDb = db;
  try {
    localStorage.setItem('timetrack_local_db', JSON.stringify(db));
  } catch {}
}

class LocalQueryBuilder {
  private filters: ((row: any) => boolean)[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private isSingle = false;
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private opData: any = null;
  private onConflictCol = 'id';

  private static parseOrFilter(filterOr: string): (row: any) => boolean {
    const tokens = filterOr.split(',');
    return (row: any) =>
      tokens.some((token) => {
        const idx = token.indexOf('.');
        if (idx === -1) return false;
        const col = token.slice(0, idx);
        const rest = token.slice(idx + 1);
        const opEnd = rest.indexOf('.');
        if (opEnd === -1) return row[col] == rest;
        const op = rest.slice(0, opEnd);
        const value: any = rest.slice(opEnd + 1);
        if (op === 'is') {
          if (value === 'null') return row[col] === null || row[col] === undefined;
          if (value === 'not.null') return row[col] !== null && row[col] !== undefined;
          return row[col] === value;
        }
        if (op === 'eq') return row[col] == value;
        if (op === 'neq') return row[col] != value;
        if (op === 'lte' || op === 'lt' || op === 'gte' || op === 'gt') {
          if (row[col] === null || row[col] === undefined) return false;
          const a = row[col];
          const b = value;
          if (op === 'lte') return a <= b;
          if (op === 'lt') return a < b;
          if (op === 'gte') return a >= b;
          return a > b;
        }
        return row[col] === value;
      });
  }

  constructor(private table: string) {}

  select(fields?: string) {
    return this;
  }

  is(col: string, val: any) {
    if (val === null) {
      this.filters.push((row) => row[col] === null || row[col] === undefined);
    } else {
      this.filters.push((row) => row[col] === val);
    }
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((row) => row[col] == val);
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters.push((row) => vals.includes(row[col]));
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  not(col: string, op: string, value: any) {
    if (op === 'is') {
      if (value === null) {
        this.filters.push((row) => row[col] !== null && row[col] !== undefined);
      } else {
        this.filters.push((row) => row[col] === null || row[col] === undefined);
      }
      return this;
    }
    if (op === 'eq') return this.neq(col, value);
    if (op === 'neq') return this.eq(col, value);
    this.filters.push((row) => {
      if (op === 'lte') return row[col] > value;
      if (op === 'lt') return row[col] >= value;
      if (op === 'gte') return row[col] < value;
      if (op === 'gt') return row[col] <= value;
      return row[col] !== value;
    });
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push((row) => row[col] != val);
    return this;
  }

  or(filterOr: string, _options?: any) {
    this.filters.push(LocalQueryBuilder.parseOrFilter(filterOr));
    return this;
  }

  // Execute Query
  async then(resolve: any, reject: any) {
    if (this.operation === 'upsert') {
      try {
        const db = getClientDb();
        if (!db[this.table]) db[this.table] = [];
        const toUpsert = Array.isArray(this.opData) ? this.opData : [this.opData];
        const now = new Date().toISOString();
        const upserted = toUpsert.map((item) => {
          const key = item[this.onConflictCol];
          const existing = key
            ? (db[this.table] as any[]).find((row) => row[this.onConflictCol] === key)
            : undefined;
          if (existing && (this.onConflictCol === 'id' || key !== undefined)) {
            const merged = { ...existing, ...item, updated_at: now };
            db[this.table] = (db[this.table] as any[]).map((row) =>
              row[this.onConflictCol] === key ? merged : row
            );
            return merged;
          }
          const created = {
            id: item.id || `${this.table.slice(0, 3)}_${Math.random().toString(36).substring(2, 9)}`,
            created_at: now,
            ...item
          };
          db[this.table].push(created);
          return created;
        });
        saveClientDb(db);

        if (this.isSingle) {
          return resolve({ data: upserted[0] || null, error: null });
        }
        return resolve({ data: Array.isArray(this.opData) ? upserted : upserted[0], error: null });
      } catch (e: any) {
        return resolve({ data: null, error: { message: e.message } });
      }
    }

    if (this.operation === 'insert') {
      try {
        const db = getClientDb();
        if (!db[this.table]) db[this.table] = [];
        const toInsert = Array.isArray(this.opData) ? this.opData : [this.opData];
        const inserted = toInsert.map((item) => ({
          id: item.id || `${this.table.slice(0, 3)}_${Math.random().toString(36).substring(2, 9)}`,
          created_at: new Date().toISOString(),
          ...item
        }));
        db[this.table].push(...inserted);
        saveClientDb(db);

        if (this.isSingle) {
          return resolve({ data: inserted[0], error: null });
        }
        return resolve({ data: Array.isArray(this.opData) ? inserted : inserted[0], error: null });
      } catch (e: any) {
        return resolve({ data: null, error: { message: e.message } });
      }
    }

    if (this.operation === 'update') {
      try {
        const db = getClientDb();
        const rows = db[this.table] || [];
        db[this.table] = rows.map((row: any) => {
          if (this.filters.every((f) => f(row))) {
            return { ...row, ...this.opData, updated_at: new Date().toISOString() };
          }
          return row;
        });
        saveClientDb(db);
        return resolve({ data: null, error: null });
      } catch (e: any) {
        return resolve({ data: null, error: { message: e.message } });
      }
    }

    if (this.operation === 'delete') {
      try {
        const db = getClientDb();
        const rows = db[this.table] || [];
        db[this.table] = rows.filter((row: any) => {
          return !this.filters.every((f) => f(row));
        });
        saveClientDb(db);
        return resolve({ data: null, error: null });
      } catch (e: any) {
        return resolve({ data: null, error: { message: e.message } });
      }
    }

    try {
      const db = getClientDb();
      const rows = db[this.table] || [];
      let result = [...rows].filter((row) => {
        return this.filters.every((f) => f(row));
      });

      // Handle order
      if (this.orderCol) {
        result.sort((a, b) => {
          const valA = a[this.orderCol!];
          const valB = b[this.orderCol!];
          if (valA < valB) return this.orderAsc ? -1 : 1;
          if (valA > valB) return this.orderAsc ? 1 : -1;
          return 0;
        });
      }

      // Handle relations (e.g. event_categories on events)
      if (this.table === 'events') {
        const categories = db.event_categories || [];
        result = result.map((evt) => ({
          ...evt,
          event_categories: categories.filter((c: any) => c.event_id === evt.id)
        }));
      }

      if (this.table === 'registrations') {
        const events = db.events || [];
        const categories = db.event_categories || [];
        result = result.map((reg) => ({
          ...reg,
          events: events.find((e: any) => e.id === reg.event_id) || null,
          event_categories: categories.find((c: any) => c.id === reg.category_id) || null
        }));
      }

      if (this.limitCount !== null) {
        result = result.slice(0, this.limitCount);
      }

      if (this.isSingle) {
        return resolve({ data: result[0] || null, error: null });
      }

      return resolve({ data: result, error: null });
    } catch (e: any) {
      return resolve({ data: null, error: { message: e.message } });
    }
  }

  // Execute Insert Query
  insert(data: any) {
    this.operation = 'insert';
    this.opData = data;
    return this;
  }

  // Execute Update Query
  update(data: any) {
    this.operation = 'update';
    this.opData = data;
    return this;
  }

  // Execute Delete Query
  delete() {
    this.operation = 'delete';
    return this;
  }

  // Execute Upsert Query
  upsert(data: any, options?: any) {
    this.operation = 'upsert';
    this.opData = data;
    if (options?.onConflict) this.onConflictCol = options.onConflict;
    return this;
  }
}

// Active user session helpers
async function getActiveUser(): Promise<any> {
  if (typeof window === 'undefined') {
    try {
      const nextCookies = require('next/headers').cookies;
      const cookieStore = typeof nextCookies === 'function' ? await nextCookies() : nextCookies;
      const cookieVal = cookieStore.get('timetrack_local_session')?.value;
      if (cookieVal) {
        return JSON.parse(decodeURIComponent(cookieVal));
      }
    } catch (e) {
      // cookies() might not be available in some server contexts
    }
  } else {
    try {
      const stored = localStorage.getItem('timetrack_local_session');
      if (stored) return JSON.parse(stored);
    } catch {}
    
    try {
      const match = document.cookie.match(/(^| )timetrack_local_session=([^;]+)/);
      if (match) {
        return JSON.parse(decodeURIComponent(match[2]));
      }
    } catch {}
  }
  return null;
}

async function saveActiveUser(user: any) {
  const userStr = encodeURIComponent(JSON.stringify(user));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('timetrack_local_session', JSON.stringify(user));
      document.cookie = `timetrack_local_session=${userStr}; path=/; max-age=604800`;
    } catch {}
  } else {
    try {
      const nextCookies = require('next/headers').cookies;
      const cookieStore = typeof nextCookies === 'function' ? await nextCookies() : nextCookies;
      cookieStore.set('timetrack_local_session', userStr, { path: '/', maxAge: 604800 });
    } catch {}
  }
}

async function clearActiveUser() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('timetrack_local_session');
      document.cookie = 'timetrack_local_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    } catch {}
  } else {
    try {
      const nextCookies = require('next/headers').cookies;
      const cookieStore = typeof nextCookies === 'function' ? await nextCookies() : nextCookies;
      cookieStore.delete('timetrack_local_session');
    } catch {}
  }
}

// Mock Supabase Client Object
export function createLocalSupabaseClient() {
  return {
    from: (table: string) => {
      return new LocalQueryBuilder(table);
    },
    rpc: async (fnName: string, args: any = {}) => {
      const db = getClientDb();
      const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).substring(2, 9)}`;

      const findCoupon = () => {
        const code = String(args.p_code || args.p_coupon_code || '').toUpperCase();
        return (db.coupons || []).find((c: any) =>
          c.code === code &&
          c.is_active !== false &&
          !c.deleted_at &&
          (!c.event_id || c.event_id === args.p_event_id) &&
          (!c.expires_at || new Date(c.expires_at) > new Date()) &&
          (!c.starts_at || new Date(c.starts_at) < new Date())
        );
      };

      const computeDiscount = (coupon: any, orderAmount: number) => {
        if (orderAmount < Number(coupon.min_order_amount || 0)) return 0;
        let discount = 0;
        if (coupon.type === 'FIXED') discount = Math.min(Number(coupon.value), orderAmount);
        else if (coupon.type === 'PERCENTAGE') discount = Math.min(orderAmount * Number(coupon.value) / 100, orderAmount);
        return Math.round(discount * 100) / 100;
      };

      try {
        if (fnName === 'generate_registration_number') {
          return { data: `TT-${Date.now().toString(36).toUpperCase()}`, error: null };
        }

        if (fnName === 'validate_coupon') {
          const coupon = findCoupon();
          if (!coupon) return { data: { valid: false, error: 'Coupon not found or expired' }, error: null };
          if (coupon.max_uses != null && (coupon.current_uses || 0) >= coupon.max_uses) {
            return { data: { valid: false, error: 'Coupon has reached maximum uses' }, error: null };
          }
          return {
            data: {
              valid: true,
              coupon_id: coupon.id,
              code: coupon.code,
              type: coupon.type,
              value: coupon.value,
              discount_amount: computeDiscount(coupon, Number(args.p_order_amount || 0)),
            },
            error: null,
          };
        }

        if (fnName === 'redeem_coupon') {
          db.coupon_redemptions = db.coupon_redemptions || [];
          db.coupon_redemptions.push({
            id: newId('red'),
            coupon_id: args.p_coupon_id,
            registration_id: args.p_registration_id,
            user_id: args.p_user_id,
            discount_amount: args.p_discount_amount,
            created_at: new Date().toISOString(),
          });
          const coupon = (db.coupons || []).find((c: any) => c.id === args.p_coupon_id);
          if (coupon) coupon.current_uses = (coupon.current_uses || 0) + 1;
          saveClientDb(db);
          return { data: null, error: null };
        }

        if (fnName === 'create_registration_atomic') {
          const participants = Array.isArray(args.p_participants) ? args.p_participants : [];
          if (participants.length === 0) throw new Error('At least one participant is required');

          let total = 0;
          for (const p of participants) {
            const cat = (db.event_categories || []).find(
              (c: any) => c.id === p.category_id && c.event_id === args.p_event_id
            );
            if (!cat) throw new Error('Invalid category for this event');
            total += Number(cat.base_price);
          }

          const coupon = args.p_coupon_code ? findCoupon() : null;
          const discount = coupon ? computeDiscount(coupon, total) : 0;
          const net = Math.max(0, total - discount);
          const regId = newId('reg');

          db.registrations = db.registrations || [];
          db.registrations.push({
            id: regId,
            event_id: args.p_event_id,
            athlete_id: args.p_athlete_id,
            registration_number: `TT-${Date.now().toString(36).toUpperCase()}`,
            persons_count: participants.length,
            status: net > 0 ? 'PENDING' : 'PAID',
            total_amount: String(total),
            discount_amount: String(discount),
            net_amount: String(net),
            coupon_id: coupon ? coupon.id : null,
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            created_at: new Date().toISOString(),
          });

          db.billing_details = db.billing_details || [];
          db.billing_details.push({ id: newId('bill'), registration_id: regId, ...args.p_billing });

          db.participants = db.participants || [];
          for (const p of participants) {
            db.participants.push({ id: newId('part'), registration_id: regId, ...p });
          }

          if (coupon && discount > 0) {
            db.coupon_redemptions = db.coupon_redemptions || [];
            db.coupon_redemptions.push({
              id: newId('red'),
              coupon_id: coupon.id,
              registration_id: regId,
              user_id: args.p_athlete_id,
              discount_amount: discount,
              created_at: new Date().toISOString(),
            });
            coupon.current_uses = (coupon.current_uses || 0) + 1;
          }

          saveClientDb(db);
          return {
            data: { registration_id: regId, net_amount: net, total_amount: total, discount_amount: discount },
            error: null,
          };
        }

        if (fnName === 'search_event_participants') {
          const term = normalizeSearchTerm(args.p_query);
          const limit = Math.min(Math.max(Number(args.p_limit) || 25, 1), 100);
          const rows: Array<{
            participant_id: string;
            full_name: string;
            ic_passport: string | null;
            bib_name: string | null;
            bib_number: string | null;
            category_id: string | null;
            category_name: string | null;
            registration_id: string;
            order_number: string;
            registration_status: string;
          }> = [];

          for (const reg of db.registrations || []) {
            if (reg.event_id !== args.p_event_id || reg.deleted_at) continue;
            for (const participant of db.participants || []) {
              if (participant.registration_id !== reg.id || participant.deleted_at) continue;

              const categories = (db.event_categories || []) as Array<{ id: string; name: string }>;
              const category = categories.find((c) => c.id === participant.category_id);
              const row = {
                participant_id: participant.id,
                full_name: participant.full_name,
                ic_passport: participant.ic_passport ?? null,
                bib_name: participant.bib_name ?? null,
                bib_number: participant.bib_number ?? null,
                category_id: participant.category_id ?? null,
                category_name: category?.name ?? null,
                registration_id: reg.id,
                order_number: reg.registration_number,
                registration_status: reg.status,
              };

              if (matchesParticipantSearch(row, term)) rows.push(row);
            }
          }

          rows.sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
          return { data: rows.slice(0, limit), error: null };
        }

        return { data: null, error: { message: `Unknown RPC: ${fnName}` } };
      } catch (e: any) {
        return { data: null, error: { message: e.message } };
      }
    },
    auth: {
      getUser: async () => {
        const user = await getActiveUser();
        return { data: { user }, error: null };
      },
      getSession: async () => {
        const user = await getActiveUser();
        if (!user) return { data: { session: null }, error: null };
        return {
          data: {
            session: {
              access_token: 'local-token',
              refresh_token: 'local-refresh-token',
              expires_in: 3600,
              token_type: 'bearer',
              user: user
            }
          },
          error: null
        };
      },
      signUp: async ({ email, password }: any) => {
        const db = getClientDb();
        const existing = (db.users || []).find((u: any) => u.email === email);
        if (existing) {
          return { data: { user: null, session: null }, error: { message: 'User already registered' } };
        }
        const newUser = {
          id: `usr_${Math.random().toString(36).substring(2, 9)}`,
          email,
          user_metadata: { role: 'ATHLETE' }
        };
        // Mirror the server: metadata role is never trusted for local accounts.
        db.users.push({
          id: newUser.id,
          email: newUser.email,
          password: String(password || ''),
          role: 'ATHLETE',
          status: 'ACTIVE'
        });
        saveClientDb(db);
        
        await saveActiveUser(newUser);
        return { data: { user: newUser, session: { access_token: 'local-token', user: newUser } }, error: null };
      },
      signInWithPassword: async ({ email, password }: any) => {
        const db = getClientDb();
        const found = (db.users || []).find((u: any) => u.email === email);
        if (!found || found.password !== password) {
          return {
            data: { user: null, session: null },
            error: { message: 'Invalid login credentials' }
          };
        }
        const loggedInUser = {
          id: found.id,
          email: found.email,
          user_metadata: { role: found.role }
        };
        
        await saveActiveUser(loggedInUser);
        return { data: { user: loggedInUser, session: { access_token: 'local-token', user: loggedInUser } }, error: null };
      },
      signOut: async () => {
        await clearActiveUser();
        return { error: null };
      },
      onAuthStateChange: (callback: any) => {
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
    }
  } as any;
}

