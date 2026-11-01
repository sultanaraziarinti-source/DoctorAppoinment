import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TABLES,
  UPLOAD_ORDER,
  buildInitialTables,
  dropDanglingLinks,
  emptyTables,
  pickColumns,
  sortRows,
} from './schema';
import { supabase } from './supabase';

// Supabase holds the shared data (see supabase/schema.sql and docs/ER_DIAGRAM.md).
// Every table is also cached in AsyncStorage under @doctor_app_db_v2_<table>,
// so the app still opens offline and the phone's earlier data can be uploaded once.
const DB_PREFIX = '@doctor_app_db_v2_';
const DB_READY_KEY = '@doctor_app_db_v2__ready';

// Keys used by the old app, read once to migrate saved data
const LEGACY_KEYS = [
  '@doctor_app_users_v1',
  '@doctor_app_custom_departments_v1',
  '@doctor_app_appointments_v1',
];

const keyFor = (table) => `${DB_PREFIX}${table}`;

let memory = emptyTables();
let openPromise = null;

// Columns the code knows about but the Supabase project doesn't have yet (schema.sql not re-run).
// Writes leave them out instead of failing; the phone copy still keeps them.
const missingColumns = {};
const MISSING_COLUMN = /Could not find the '([^']+)' column/;

const cleanRow = (table, row) => {
  const out = pickColumns(table, row);
  (missingColumns[table] || new Set()).forEach((col) => delete out[col]);
  return out;
};

// Run a write; if Supabase reports an unknown column, remember it and retry without it
const writeWithRetry = async (table, run) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await run();
    const match = result.error && result.error.code === 'PGRST204' && MISSING_COLUMN.exec(result.error.message);
    if (!match) return result;
    console.warn(`Supabase has no ${table}.${match[1]} column yet; saving without it (run supabase/schema.sql)`);
    if (!missingColumns[table]) missingColumns[table] = new Set();
    missingColumns[table].add(match[1]);
  }
  return run();
};

const parseArray = (json) => {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const persist = async (table) => {
  try {
    await AsyncStorage.setItem(keyFor(table), JSON.stringify(memory[table]));
  } catch (error) {
    console.warn(`Error caching ${table}:`, error);
  }
};

// Phone copy: the cached tables, or (first run) tables built from v1 data plus the seed
const openLocal = async () => {
  try {
    const ready = await AsyncStorage.getItem(DB_READY_KEY);
    if (ready) {
      const pairs = await AsyncStorage.multiGet(TABLES.map(keyFor));
      const loaded = emptyTables();
      pairs.forEach(([, json], i) => {
        loaded[TABLES[i]] = parseArray(json);
      });
      memory = loaded;
      return;
    }
  } catch (error) {
    console.warn('Error reading database:', error);
  }

  let legacy = {};
  try {
    const [[, users], [, departments], [, appointments]] = await AsyncStorage.multiGet(LEGACY_KEYS);
    legacy = {
      users: parseArray(users),
      departments: parseArray(departments),
      appointments: parseArray(appointments),
    };
  } catch (error) {
    console.warn('Error reading old storage for migration:', error);
  }

  memory = buildInitialTables(legacy);
  try {
    await AsyncStorage.multiSet([
      ...TABLES.map((table) => [keyFor(table), JSON.stringify(memory[table])]),
      [DB_READY_KEY, '1'],
    ]);
  } catch (error) {
    console.warn('Error saving new database:', error);
  }
};

// First phone to connect to an empty Supabase project uploads its tables
const seedRemoteIfEmpty = async () => {
  if (!supabase) return;
  try {
    const { count, error } = await supabase
      .from('departments')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    if (count > 0) return;

    const upload = dropDanglingLinks(memory);
    for (const table of UPLOAD_ORDER) {
      if (upload[table].length === 0) continue;
      const { error: upsertError } = await writeWithRetry(table, () =>
        supabase.from(table).upsert(upload[table].map((row) => cleanRow(table, row)))
      );
      if (upsertError) throw upsertError;
    }
  } catch (error) {
    console.warn('Supabase seed skipped:', error.message || error);
  }
};

const openDatabase = async () => {
  await openLocal();
  await seedRemoteIfEmpty();
};

export const ensureDatabase = () => {
  if (!openPromise) openPromise = openDatabase();
  return openPromise;
};

// Rows from Supabase lack columns it doesn't have yet; fill those from the phone copy
const keepLocalOnlyColumns = (table, rows) => {
  const cols = missingColumns[table];
  if (!cols || cols.size === 0) return rows.slice();
  const local = new Map(memory[table].map((row) => [row.id, row]));
  return rows.map((row) => {
    const mine = local.get(row.id);
    if (!mine) return row;
    const merged = { ...row };
    cols.forEach((col) => {
      if (mine[col] !== undefined) merged[col] = mine[col];
    });
    return merged;
  });
};

const setTable = async (table, rows) => {
  memory[table] = sortRows(table, rows);
  await persist(table);
  return memory[table];
};

export const newId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Rows already in memory (empty before the database has opened)
export const getCached = (table) => memory[table] || [];

// Reads go to Supabase; if it can't be reached, the phone copy is returned
export const getAll = async (table) => {
  await ensureDatabase();
  if (supabase) {
    const { data, error } = await supabase.from(table).select('*');
    // Supabase returns oldest-saved first; reversed, the latest booking stays on top when times tie
    if (!error) return setTable(table, keepLocalOnlyColumns(table, data).reverse());
    console.warn(`Supabase read ${table} failed, using phone copy:`, error.message);
  }
  return memory[table];
};

export const findById = async (table, id) => {
  await ensureDatabase();
  if (supabase) {
    const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
    if (!error) return data;
    console.warn(`Supabase read ${table} failed, using phone copy:`, error.message);
  }
  return memory[table].find((row) => row.id === id) || null;
};

// Writes go to Supabase first and fail loudly if it refuses, so the phone never drifts from the server
export const insert = async (table, row, { atStart = false } = {}) => {
  await ensureDatabase();
  let saved = row;
  if (supabase) {
    const { data, error } = await writeWithRetry(table, () =>
      supabase.from(table).insert(cleanRow(table, row)).select().single()
    );
    if (error) throw new Error(`Saving to ${table} failed: ${error.message}`);
    saved = { ...row, ...data };
  }
  await setTable(table, atStart ? [saved, ...memory[table]] : [...memory[table], saved]);
  return saved;
};

export const update = async (table, id, fields) => {
  await ensureDatabase();
  let saved = null;
  if (supabase) {
    const { data, error } = await writeWithRetry(table, () =>
      supabase.from(table).update(cleanRow(table, fields)).eq('id', id).select().maybeSingle()
    );
    if (error) throw new Error(`Updating ${table} failed: ${error.message}`);
    const current = memory[table].find((row) => row.id === id) || {};
    saved = data ? { ...current, ...fields, ...data } : null;
  } else {
    const current = memory[table].find((row) => row.id === id);
    saved = current ? { ...current, ...fields } : null;
  }
  if (saved) {
    await setTable(table, memory[table].map((row) => (row.id === id ? saved : row)));
  }
  return saved;
};

export const remove = async (table, id) => {
  await ensureDatabase();
  let removed = memory[table].some((row) => row.id === id);
  if (supabase) {
    const { data, error } = await supabase.from(table).delete().eq('id', id).select('id');
    if (error) throw new Error(`Deleting from ${table} failed: ${error.message}`);
    removed = data.length > 0;
  }
  await setTable(table, memory[table].filter((row) => row.id !== id));
  return removed;
};

// Make the table hold exactly these rows (used for the registrar's bulk save)
export const replaceAll = async (table, rows) => {
  await ensureDatabase();
  if (supabase) {
    if (rows.length > 0) {
      const { error } = await writeWithRetry(table, () =>
        supabase.from(table).upsert(rows.map((row) => cleanRow(table, row)))
      );
      if (error) throw new Error(`Saving ${table} failed: ${error.message}`);
    }
    const keep = new Set(rows.map((row) => row.id));
    const stale = memory[table].filter((row) => !keep.has(row.id)).map((row) => row.id);
    if (stale.length > 0) {
      const { error } = await supabase.from(table).delete().in('id', stale);
      if (error) throw new Error(`Saving ${table} failed: ${error.message}`);
    }
  }
  return setTable(table, rows);
};
