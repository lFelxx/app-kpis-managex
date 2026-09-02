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
      synced INTEGER NOT NULL DEFAULT 0,
      modo TEXT NOT NULL DEFAULT 'simple'
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
      styleNumber TEXT,
      resolutionSource TEXT,
      detalle TEXT,
      FOREIGN KEY (arqueoId) REFERENCES arqueos(id)
    );

    CREATE TABLE IF NOT EXISTS product_cache (
      upc TEXT PRIMARY KEY,
      styleNumber TEXT,
      brand TEXT,
      title TEXT,
      source TEXT NOT NULL,
      updatedAt TEXT NOT NULL
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

  // Limpieza: se probó guardar los UPC crudos en una tabla aparte y se
  // reemplazó por un diseño mejor (codigo siempre es el UPC real).
  await db.execAsync('DROP TABLE IF EXISTS arqueo_raw_upcs;');

  // Migración: bases de datos creadas antes de agregar isAdmin.
  const userColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(users)');
  if (!userColumns.some((c) => c.name === 'isAdmin')) {
    await db.execAsync('ALTER TABLE users ADD COLUMN isAdmin INTEGER NOT NULL DEFAULT 0;');
  }

  // Migración: bases de datos creadas antes del modo beta "Style Number".
  const arqueoColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(arqueos)');
  if (!arqueoColumns.some((c) => c.name === 'modo')) {
    await db.execAsync("ALTER TABLE arqueos ADD COLUMN modo TEXT NOT NULL DEFAULT 'simple';");
  }
  const itemColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(arqueo_items)');
  if (!itemColumns.some((c) => c.name === 'styleNumber')) {
    await db.execAsync('ALTER TABLE arqueo_items ADD COLUMN styleNumber TEXT;');
  }
  if (!itemColumns.some((c) => c.name === 'resolutionSource')) {
    await db.execAsync('ALTER TABLE arqueo_items ADD COLUMN resolutionSource TEXT;');
  }
  if (!itemColumns.some((c) => c.name === 'detalle')) {
    await db.execAsync('ALTER TABLE arqueo_items ADD COLUMN detalle TEXT;');
  }

  return db;
}
