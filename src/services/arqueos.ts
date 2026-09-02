import * as Crypto from 'expo-crypto';
import { getDb } from './db';
import { saveManualStyleNumber } from './styleResolver';
import { Arqueo, ArqueoItem, AuditLogEntry, ArqueoModo, ResolvedProduct } from '../types';

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
    modo: r.modo ?? 'simple',
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
    styleNumber: r.styleNumber ?? null,
    resolutionSource: r.resolutionSource ?? null,
    detalle: r.detalle ?? null,
  };
}

export async function createArqueo(
  nombre: string,
  zona: string | null,
  createdBy: string,
  modo: ArqueoModo = 'simple'
): Promise<Arqueo> {
  const db = await getDb();
  const createdAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO arqueos (nombre, zona, createdBy, createdAt, status, synced, modo) VALUES (?, ?, ?, ?, ?, 0, ?)',
    [nombre.trim(), zona, createdBy, createdAt, 'abierto', modo]
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
    modo,
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
    styleNumber: null,
    resolutionSource: null,
    detalle: null,
  };
}

function buildDetalle(resolved: ResolvedProduct): string | null {
  const parts = [resolved.brand, resolved.title].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Registra un escaneo en modo beta "Style Number". A diferencia de la primera
 * versión de esto, `codigo` SIEMPRE es el UPC real escaneado — igual que en
 * modo simple — nunca se sobrescribe con el style number. El style number
 * resuelto se guarda en su propia columna (`styleNumber`) como metadato.
 * La "unificación por talla" es solo una agrupación visual al mostrar la
 * lista (ver `groupByStyle`), no una transformación de los datos guardados.
 * Esto evita perder el UPC y evita ambigüedad al editar cantidades de una
 * talla específica.
 */
export async function scanItemByStyle(
  arqueoId: number,
  rawUpc: string,
  resolved: ResolvedProduct,
  scannedBy: string
): Promise<ArqueoItem> {
  const db = await getDb();
  const now = new Date().toISOString();

  const existing = await db.getFirstAsync<any>('SELECT * FROM arqueo_items WHERE arqueoId = ? AND codigo = ?', [
    arqueoId,
    rawUpc,
  ]);

  if (existing) {
    await db.runAsync('UPDATE arqueo_items SET cantidad = cantidad + 1, ultimoEscaneo = ? WHERE id = ?', [
      now,
      existing.id,
    ]);
    return rowToItem({ ...existing, cantidad: existing.cantidad + 1, ultimoEscaneo: now });
  }

  const detalle = buildDetalle(resolved);
  const result = await db.runAsync(
    `INSERT INTO arqueo_items
      (arqueoId, codigo, cantidad, primerEscaneo, ultimoEscaneo, escaneadoPor, styleNumber, resolutionSource, detalle)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    [arqueoId, rawUpc, now, now, scannedBy, resolved.styleNumber, resolved.source, detalle]
  );
  return {
    id: result.lastInsertRowId,
    arqueoId,
    codigo: rawUpc,
    cantidad: 1,
    comentario: null,
    primerEscaneo: now,
    ultimoEscaneo: now,
    escaneadoPor: scannedBy,
    styleNumber: resolved.styleNumber,
    resolutionSource: resolved.source,
    detalle,
  };
}

/**
 * Actualiza el style number de un ítem ya guardado, una vez que la resolución
 * en segundo plano (OCR/UPCitemdb) termina — el escaneo no espera esto, así
 * que el ítem ya existe con `styleNumber = null` cuando se llama esta función.
 */
export async function updateItemResolution(itemId: number, resolved: ResolvedProduct, changedBy: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM arqueo_items WHERE id = ?', [itemId]);
  if (!row) return;
  const detalle = buildDetalle(resolved);
  await db.runAsync('UPDATE arqueo_items SET styleNumber = ?, resolutionSource = ?, detalle = ? WHERE id = ?', [
    resolved.styleNumber,
    resolved.source,
    detalle,
    itemId,
  ]);
  const arqueo = await getArqueo(row.arqueoId);
  if (arqueo?.status === 'cerrado') {
    await logAudit(row.arqueoId, itemId, 'styleNumber', row.styleNumber, resolved.styleNumber, changedBy);
  }
}

/**
 * Corrige a mano el Style Number de un ítem. `codigo` (el UPC) nunca se toca.
 * También guarda la corrección en la caché de productos (`product_cache`)
 * para que la próxima vez que se escanee ese mismo UPC —en cualquier
 * arqueo— se resuelva solo, sin volver a pasar por OCR/API.
 */
export async function setItemStyleNumber(item: ArqueoItem, styleNumber: string, changedBy: string) {
  const db = await getDb();
  const arqueo = await getArqueo(item.arqueoId);
  const nuevo = styleNumber.trim().replace(/\s+/g, ' ');
  if (!nuevo || nuevo === item.styleNumber) return;
  await db.runAsync('UPDATE arqueo_items SET styleNumber = ?, resolutionSource = ? WHERE id = ?', [
    nuevo,
    'manual',
    item.id,
  ]);
  await saveManualStyleNumber(item.codigo, nuevo);
  if (arqueo?.status === 'cerrado') {
    await logAudit(item.arqueoId, item.id, 'styleNumber', item.styleNumber, nuevo, changedBy);
  }
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

/**
 * Crea un arqueo NUEVO que consolida varios arqueos ya cerrados en uno solo
 * (por ejemplo, varios arqueos por sección/pasillo que se quieren totalizar
 * para el sistema POS). Los arqueos originales NO se tocan ni se borran —
 * esto solo crea una copia consolidada aparte.
 *
 * Los ítems se combinan por `codigo` (UPC): si el mismo código aparece en
 * varios arqueos de origen, las cantidades se suman en una sola fila. El
 * modo del arqueo resultante es "style_beta" si alguno de los orígenes lo
 * era (para no perder la agrupación por style number), o "simple" si todos
 * los orígenes eran simples.
 */
export async function mergeArqueos(arqueoIds: number[], nombre: string, createdBy: string): Promise<Arqueo> {
  if (arqueoIds.length < 2) throw new Error('Selecciona al menos 2 arqueos para unificar');
  const db = await getDb();

  const sourceArqueos: Arqueo[] = [];
  for (const id of arqueoIds) {
    const a = await getArqueo(id);
    if (a) sourceArqueos.push(a);
  }
  if (sourceArqueos.length < 2) throw new Error('No se encontraron suficientes arqueos para unificar');

  const modo: ArqueoModo = sourceArqueos.some((a) => a.modo === 'style_beta') ? 'style_beta' : 'simple';
  const createdAt = new Date().toISOString();

  const result = await db.runAsync(
    'INSERT INTO arqueos (nombre, zona, createdBy, createdAt, status, synced, modo) VALUES (?, ?, ?, ?, ?, 0, ?)',
    [nombre.trim(), null, createdBy, createdAt, 'abierto', modo]
  );
  const newArqueoId = result.lastInsertRowId;

  interface MergedEntry {
    cantidad: number;
    styleNumber: string | null;
    resolutionSource: string | null;
    detalle: string | null;
    comentarios: string[];
    primerEscaneo: string;
    ultimoEscaneo: string;
    escaneadoPor: string;
  }
  const merged = new Map<string, MergedEntry>();

  for (const arqueo of sourceArqueos) {
    const items = await getItems(arqueo.id);
    for (const item of items) {
      let entry = merged.get(item.codigo);
      if (!entry) {
        entry = {
          cantidad: 0,
          styleNumber: null,
          resolutionSource: null,
          detalle: null,
          comentarios: [],
          primerEscaneo: item.primerEscaneo,
          ultimoEscaneo: item.ultimoEscaneo,
          escaneadoPor: item.escaneadoPor,
        };
        merged.set(item.codigo, entry);
      }
      entry.cantidad += item.cantidad;
      if (!entry.styleNumber && item.styleNumber) {
        entry.styleNumber = item.styleNumber;
        entry.resolutionSource = item.resolutionSource;
        entry.detalle = item.detalle;
      }
      if (item.comentario) entry.comentarios.push(`[${arqueo.nombre}] ${item.comentario}`);
      if (item.primerEscaneo < entry.primerEscaneo) entry.primerEscaneo = item.primerEscaneo;
      if (item.ultimoEscaneo > entry.ultimoEscaneo) entry.ultimoEscaneo = item.ultimoEscaneo;
    }
  }

  for (const [codigo, entry] of merged) {
    await db.runAsync(
      `INSERT INTO arqueo_items
        (arqueoId, codigo, cantidad, comentario, primerEscaneo, ultimoEscaneo, escaneadoPor, styleNumber, resolutionSource, detalle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newArqueoId,
        codigo,
        entry.cantidad,
        entry.comentarios.join(' | ') || null,
        entry.primerEscaneo,
        entry.ultimoEscaneo,
        entry.escaneadoPor,
        entry.styleNumber,
        entry.resolutionSource,
        entry.detalle,
      ]
    );
  }

  const origenes = sourceArqueos.map((a) => a.nombre).join(', ');
  const checksum = await computeChecksum(newArqueoId);
  const closedAt = new Date().toISOString();
  await db.runAsync('UPDATE arqueos SET status = ?, closedAt = ?, checksum = ?, notas = ? WHERE id = ?', [
    'cerrado',
    closedAt,
    checksum,
    `Unificado de: ${origenes}`,
    newArqueoId,
  ]);
  await logAudit(newArqueoId, null, 'creado', null, `Unificación de ${sourceArqueos.length} arqueos: ${origenes}`, createdBy);

  const finalArqueo = await getArqueo(newArqueoId);
  if (!finalArqueo) throw new Error('No se pudo crear el arqueo unificado');
  return finalArqueo;
}

export async function deleteArqueo(arqueoId: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM arqueo_items WHERE arqueoId = ?', [arqueoId]);
  await db.runAsync('DELETE FROM audit_log WHERE arqueoId = ?', [arqueoId]);
  await db.runAsync('DELETE FROM arqueos WHERE id = ?', [arqueoId]);
}
