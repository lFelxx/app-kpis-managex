import * as Crypto from 'expo-crypto';
import { getDb } from './db';
import { Arqueo, ArqueoItem, AuditLogEntry } from '../types';

function rowToArqueo(r: any): Arqueo {
  return {
    id: r.id,
    nombre: r.nombre,
    zona: r.zona,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    closedAt: r.closedAt,
    status: r.status,
    notas: r.notas,
    checksum: r.checksum,
    synced: !!r.synced,
  };
}

function rowToItem(r: any): ArqueoItem {
  return {
    id: r.id,
    arqueoId: r.arqueoId,
    codigo: r.codigo,
    cantidad: r.cantidad,
    comentario: r.comentario,
    primerEscaneo: r.primerEscaneo,
    ultimoEscaneo: r.ultimoEscaneo,
    escaneadoPor: r.escaneadoPor,
  };
}

export async function createArqueo(nombre: string, zona: string | null, createdBy: string): Promise<Arqueo> {
  const db = await getDb();
  const createdAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO arqueos (nombre, zona, createdBy, createdAt, status, synced) VALUES (?, ?, ?, ?, ?, 0)',
    [nombre.trim(), zona, createdBy, createdAt, 'abierto']
  );
  return {
    id: result.lastInsertRowId,
    nombre: nombre.trim(),
    zona,
    createdBy,
    createdAt,
    closedAt: null,
    status: 'abierto',
    notas: null,
    checksum: null,
    synced: false,
  };
}

export async function getArqueos(): Promise<Arqueo[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM arqueos ORDER BY createdAt DESC');
  return rows.map(rowToArqueo);
}

export async function getArqueo(id: number): Promise<Arqueo | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM arqueos WHERE id = ?', [id]);
  return row ? rowToArqueo(row) : null;
}

export async function getItems(arqueoId: number): Promise<ArqueoItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM arqueo_items WHERE arqueoId = ? ORDER BY ultimoEscaneo DESC',
    [arqueoId]
  );
  return rows.map(rowToItem);
}

/** Registra un escaneo: si el código ya existe en el arqueo, incrementa cantidad; si no, crea el item. */
export async function scanItem(arqueoId: number, codigo: string, scannedBy: string): Promise<ArqueoItem> {
  const db = await getDb();
  const now = new Date().toISOString();
  const existing = await db.getFirstAsync<any>(
    'SELECT * FROM arqueo_items WHERE arqueoId = ? AND codigo = ?',
    [arqueoId, codigo]
  );
  if (existing) {
    await db.runAsync(
      'UPDATE arqueo_items SET cantidad = cantidad + 1, ultimoEscaneo = ? WHERE id = ?',
      [now, existing.id]
    );
    return rowToItem({ ...existing, cantidad: existing.cantidad + 1, ultimoEscaneo: now });
  }
  const result = await db.runAsync(
    'INSERT INTO arqueo_items (arqueoId, codigo, cantidad, primerEscaneo, ultimoEscaneo, escaneadoPor) VALUES (?, ?, 1, ?, ?, ?)',
    [arqueoId, codigo, now, now, scannedBy]
  );
  return {
    id: result.lastInsertRowId,
    arqueoId,
    codigo,
    cantidad: 1,
    comentario: null,
    primerEscaneo: now,
    ultimoEscaneo: now,
    escaneadoPor: scannedBy,
  };
}

async function logAudit(
  arqueoId: number,
  itemId: number | null,
  campo: string,
  valorAnterior: string | null,
  valorNuevo: string | null,
  cambiadoPor: string
) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO audit_log (arqueoId, itemId, campo, valorAnterior, valorNuevo, cambiadoPor, cambiadoEn) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [arqueoId, itemId, campo, valorAnterior, valorNuevo, cambiadoPor, new Date().toISOString()]
  );
}

/** Actualiza cantidad/comentario de un item. Si el arqueo ya está cerrado, queda constancia en audit_log. */
export async function updateItem(
  item: ArqueoItem,
  changes: { cantidad?: number; comentario?: string | null },
  changedBy: string
) {
  const db = await getDb();
  const arqueo = await getArqueo(item.arqueoId);
  const isClosed = arqueo?.status === 'cerrado';

  if (changes.cantidad !== undefined && changes.cantidad !== item.cantidad) {
    await db.runAsync('UPDATE arqueo_items SET cantidad = ? WHERE id = ?', [changes.cantidad, item.id]);
    if (isClosed) {
      await logAudit(item.arqueoId, item.id, 'cantidad', String(item.cantidad), String(changes.cantidad), changedBy);
    }
  }
  if (changes.comentario !== undefined && changes.comentario !== item.comentario) {
    await db.runAsync('UPDATE arqueo_items SET comentario = ? WHERE id = ?', [changes.comentario, item.id]);
    if (isClosed) {
      await logAudit(item.arqueoId, item.id, 'comentario', item.comentario, changes.comentario, changedBy);
    }
  }
}

export async function deleteItem(item: ArqueoItem, changedBy: string) {
  const db = await getDb();
  const arqueo = await getArqueo(item.arqueoId);
  if (arqueo?.status === 'cerrado') {
    await logAudit(item.arqueoId, item.id, 'eliminado', `${item.codigo} x${item.cantidad}`, null, changedBy);
  }
  await db.runAsync('DELETE FROM arqueo_items WHERE id = ?', [item.id]);
}

export async function updateArqueoNotas(arqueoId: number, notas: string, changedBy: string) {
  const db = await getDb();
  const arqueo = await getArqueo(arqueoId);
  await db.runAsync('UPDATE arqueos SET notas = ? WHERE id = ?', [notas, arqueoId]);
  if (arqueo?.status === 'cerrado') {
    await logAudit(arqueoId, null, 'notas', arqueo.notas, notas, changedBy);
  }
}

/** Renombra el arqueo. El cambio de nombre siempre queda en la bitácora, esté abierto o cerrado. */
export async function renameArqueo(arqueoId: number, nombre: string, changedBy: string) {
  const db = await getDb();
  const arqueo = await getArqueo(arqueoId);
  const nuevoNombre = nombre.trim();
  if (!arqueo || !nuevoNombre || nuevoNombre === arqueo.nombre) return;
  await db.runAsync('UPDATE arqueos SET nombre = ? WHERE id = ?', [nuevoNombre, arqueoId]);
  await logAudit(arqueoId, null, 'nombre', arqueo.nombre, nuevoNombre, changedBy);
}

async function computeChecksum(arqueoId: number): Promise<string> {
  const items = await getItems(arqueoId);
  const payload = items
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map((i) => `${i.codigo}:${i.cantidad}`)
    .join('|');
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
}

export async function closeArqueo(arqueoId: number, changedBy: string): Promise<string> {
  const db = await getDb();
  const checksum = await computeChecksum(arqueoId);
  const closedAt = new Date().toISOString();
  await db.runAsync('UPDATE arqueos SET status = ?, closedAt = ?, checksum = ? WHERE id = ?', [
    'cerrado',
    closedAt,
    checksum,
    arqueoId,
  ]);
  await logAudit(arqueoId, null, 'estado', 'abierto', `cerrado (${closedAt})`, changedBy);
  return checksum;
}

export async function reopenArqueo(arqueoId: number, changedBy: string) {
  const db = await getDb();
  await logAudit(arqueoId, null, 'estado', 'cerrado', 'reabierto', changedBy);
  await db.runAsync('UPDATE arqueos SET status = ?, closedAt = NULL WHERE id = ?', ['abierto', arqueoId]);
}

/** true si el checksum actual de los items difiere del guardado al cerrar (evidencia de manipulación posterior). */
export async function wasModifiedAfterClose(arqueo: Arqueo): Promise<boolean> {
  if (arqueo.status !== 'cerrado' || !arqueo.checksum) return false;
  const current = await computeChecksum(arqueo.id);
  return current !== arqueo.checksum;
}

export async function getAuditLog(arqueoId: number): Promise<AuditLogEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM audit_log WHERE arqueoId = ? ORDER BY cambiadoEn DESC',
    [arqueoId]
  );
  return rows.map((r) => ({
    id: r.id,
    arqueoId: r.arqueoId,
    itemId: r.itemId,
    campo: r.campo,
    valorAnterior: r.valorAnterior,
    valorNuevo: r.valorNuevo,
    cambiadoPor: r.cambiadoPor,
    cambiadoEn: r.cambiadoEn,
  }));
}

export async function deleteArqueo(arqueoId: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM arqueo_items WHERE arqueoId = ?', [arqueoId]);
  await db.runAsync('DELETE FROM audit_log WHERE arqueoId = ?', [arqueoId]);
  await db.runAsync('DELETE FROM arqueos WHERE id = ?', [arqueoId]);
}
