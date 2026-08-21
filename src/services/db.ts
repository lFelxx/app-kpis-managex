import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('kpimanagex.db');
  }
  return dbPromise;
}

export async function initDb() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      displayName TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      pin TEXT,
      isAdmin INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS arqueos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      zona TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      closedAt TEXT,
      status TEXT NOT NULL DEFAULT 'abierto',
      notas TEXT,
      checksum TEXT,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS arqueo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arqueoId INTEGER NOT NULL,
      codigo TEXT NOT NULL,
      cantidad INTEGER NOT NULL DEFAULT 1,
      comentario TEXT,
      primerEscaneo TEXT NOT NULL,
      ultimoEscaneo TEXT NOT NULL,
      escaneadoPor TEXT NOT NULL,
      FOREIGN KEY (arqueoId) REFERENCES arqueos(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arqueoId INTEGER NOT NULL,
      itemId INTEGER,
      campo TEXT NOT NULL,
      valorAnterior TEXT,
      valorNuevo TEXT,
      cambiadoPor TEXT NOT NULL,
      cambiadoEn TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_arqueo ON arqueo_items(arqueoId);
    CREATE INDEX IF NOT EXISTS idx_items_codigo ON arqueo_items(arqueoId, codigo);
    CREATE INDEX IF NOT EXISTS idx_audit_arqueo ON audit_log(arqueoId);
  `);

  // Migración: bases de datos creadas antes de agregar isAdmin.
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(users)');
  if (!columns.some((c) => c.name === 'isAdmin')) {
    await db.execAsync('ALTER TABLE users ADD COLUMN isAdmin INTEGER NOT NULL DEFAULT 0;');
  }

  return db;
}
