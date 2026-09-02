import { getDb } from './db';
import { ResolvedProduct, ResolutionSource } from '../types';

/**
 * Patrón de "style number" en calzado/ropa: 5-6 dígitos + separador + 2-3
 * dígitos. Confirmado con etiquetas reales de Puma que el separador es un
 * ESPACIO ("313313 01", "685016 01") — también se acepta guion por si algún
 * texto externo lo trae así. Se normaliza siempre con espacio para que la
 * agrupación por style number sea consistente sin importar la fuente.
 */
const STYLE_REGEX = /\b(\d{5,6})[\s-](\d{2,3})\b/;

const UPCITEMDB_TRIAL_URL = 'https://api.upcitemdb.com/prod/trial/lookup';

/**
 * Llave pública de demo de OCR.space — funciona sin registro pero es
 * compartida por todo el mundo y puede fallar por límite ajeno.
 * Para uso real de la tienda, registra una gratis (sin tarjeta, 25,000/mes)
 * en https://ocr.space/ocrapi y reemplázala aquí.
 */
const OCR_SPACE_API_KEY = 'helloworld';
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';

const log = (...args: any[]) => console.log('[StyleResolver]', ...args);

function extractStyleNumber(haystack: string): string | null {
  const match = haystack.match(STYLE_REGEX);
  return match ? `${match[1]} ${match[2]}` : null;
}

async function getCachedProduct(upc: string): Promise<ResolvedProduct | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM product_cache WHERE upc = ?', [upc]);
  if (!row) return null;
  return { styleNumber: row.styleNumber, brand: row.brand, title: row.title, source: row.source };
}

/** true si ningún UPC ya ha sido asociado antes a este style number. */
async function isStyleNumberKnown(styleNumber: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT 1 FROM product_cache WHERE styleNumber = ? LIMIT 1', [styleNumber]);
  return !!row;
}

/**
 * Chequeo rápido de caché, sin foto ni red — para usar ANTES de decidir si
 * hace falta tomar foto y esperar a OCR. Si el UPC ya se vio antes, esto es
 * instantáneo y evita cualquier demora en escaneos repetidos.
 */
export async function getCachedStyleNumber(upc: string): Promise<ResolvedProduct | null> {
  const cached = await getCachedProduct(upc);
  return cached?.styleNumber ? cached : null;
}

async function saveCachedProduct(upc: string, product: Omit<ResolvedProduct, 'source'> & { source: ResolutionSource }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO product_cache (upc, styleNumber, brand, title, source, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(upc) DO UPDATE SET styleNumber=excluded.styleNumber, brand=excluded.brand,
       title=excluded.title, source=excluded.source, updatedAt=excluded.updatedAt`,
    [upc, product.styleNumber, product.brand, product.title, product.source, new Date().toISOString()]
  );
  log('Guardado en caché ->', upc, product);
}

/**
 * Fuente principal: OCR sobre una foto del cuadro completo (no solo cerca
 * del código de barras) — así también funciona si la etiqueta trae el style
 * number en otra parte del empaque. Lee TODO el texto de la foto y busca el
 * patrón en cualquier parte, sin asumir una posición fija.
 */
async function tryOcr(photoBase64: string): Promise<ResolvedProduct | null> {
  const body = new URLSearchParams();
  body.append('apikey', OCR_SPACE_API_KEY);
  body.append('base64Image', `data:image/jpeg;base64,${photoBase64}`);
  body.append('OCREngine', '2');
  body.append('scale', 'true');
  body.append('isOverlayRequired', 'false');

  log('[OCR] Enviando foto a OCR.space (tamaño base64:', photoBase64.length, 'chars)…');
  const res = await fetch(OCR_SPACE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  log('[OCR] Respuesta HTTP:', res.status, res.statusText);

  const json = await res.json();
  log('[OCR] Body:', JSON.stringify(json).slice(0, 2000));

  if (json?.IsErroredOnProcessing) {
    log('[OCR] ⚠️ OCR.space no pudo procesar la imagen:', json?.ErrorMessage ?? json?.ErrorDetails);
    return null;
  }

  const text: string = (json?.ParsedResults ?? []).map((r: any) => r.ParsedText ?? '').join('\n');
  log('[OCR] Texto leído de la etiqueta:', JSON.stringify(text));

  if (!text.trim()) {
    log('[OCR] ⚠️ No se detectó ningún texto en la foto (mala luz, enfoque, o etiqueta fuera de cuadro).');
    return null;
  }

  const styleNumber = extractStyleNumber(text);
  if (styleNumber) {
    log('[OCR] ✅ Style number leído directo de la etiqueta:', styleNumber);
    return { styleNumber, brand: null, title: null, source: 'ocr' };
  }
  log('[OCR] ⚠️ Se leyó texto pero ninguna parte coincide con el patrón de style number.');
  return null;
}

/** Respaldo: UPCitemdb (gratis, sin llave, 100 consultas/día, sesgo hacia EE.UU.). */
async function tryUpcItemDb(upc: string): Promise<ResolvedProduct | null> {
  const url = `${UPCITEMDB_TRIAL_URL}?upc=${encodeURIComponent(upc)}`;
  log('[UPCitemdb] GET', url);
  const res = await fetch(url);
  log('[UPCitemdb] Respuesta HTTP:', res.status, res.statusText);

  const json = await res.json();
  log('[UPCitemdb] Body:', JSON.stringify(json));

  if (!res.ok) {
    log('[UPCitemdb] ⚠️ Error HTTP, revisa "message"/"code" arriba.');
    return null;
  }
  const item = json?.items?.[0];
  if (!item) {
    log('[UPCitemdb] ⚠️ No tiene este UPC en su base (total 0).');
    return null;
  }

  log('[UPCitemdb] Producto encontrado ->', { brand: item.brand, model: item.model, title: item.title });
  const brand: string | null = item.brand ?? null;
  const title: string | null = item.title ?? null;

  const modelMatch = typeof item.model === 'string' ? item.model.match(STYLE_REGEX) : null;
  if (modelMatch) {
    const styleNumber = `${modelMatch[1]} ${modelMatch[2]}`;
    log('[UPCitemdb] ✅ Style number en campo "model":', styleNumber);
    return { styleNumber, brand, title, source: 'api_model' };
  }
  const styleNumber = extractStyleNumber(`${item.title ?? ''} ${item.description ?? ''}`);
  if (styleNumber) {
    log('[UPCitemdb] ✅ Style number por regex en título/descripción:', styleNumber);
    return { styleNumber, brand, title, source: 'api_regex' };
  }
  log('[UPCitemdb] ⚠️ Existe el producto pero ningún campo trae el patrón de style number.');
  return { styleNumber: null, brand, title, source: 'none' };
}

/**
 * Intenta resolver el Style Number de un UPC escaneado, en orden:
 * 1) caché local (offline, gratis, instantáneo)
 * 2) OCR de una foto del cuadro completo (principal — lee la etiqueta real)
 * 3) UPCitemdb (respaldo, por si el producto está en su base)
 * 4) si nada funciona, devuelve null para que el usuario lo ingrese a mano
 *
 * `photoBase64` es opcional: si no se pasa una foto (ej. al agregar un
 * código a mano), se salta el paso de OCR y va directo al respaldo.
 */
export async function resolveStyleNumber(upc: string, photoBase64?: string): Promise<ResolvedProduct> {
  log('=== Resolviendo UPC:', upc, '===');

  const cached = await getCachedProduct(upc);
  if (cached && cached.styleNumber) {
    log('Encontrado en caché local:', cached);
    return cached;
  }
  log('No estaba en caché, intentando resolver…');

  if (photoBase64) {
    try {
      const ocrResult = await tryOcr(photoBase64);
      if (ocrResult?.styleNumber) {
        await saveCachedProduct(upc, ocrResult);
        return ocrResult;
      }
    } catch (e: any) {
      log('❌ Error de red/parseo con OCR.space:', e?.message ?? e);
    }
  } else {
    log('(sin foto disponible, se salta el paso de OCR)');
  }

  let best: ResolvedProduct = { styleNumber: null, brand: null, title: null, source: 'none' };
  try {
    const upcResult = await tryUpcItemDb(upc);
    if (upcResult) {
      best = upcResult;
      if (upcResult.styleNumber) {
        await saveCachedProduct(upc, upcResult);
        return upcResult;
      }
    }
  } catch (e: any) {
    log('❌ Error de red/parseo con UPCitemdb:', e?.message ?? e);
  }

  log('=== Ninguna fuente resolvió el style number para', upc, '— queda pendiente de ingreso manual ===');
  return best;
}

/**
 * Igual que `resolveStyleNumber`, pero SIN chequear la caché primero — para
 * usarse en segundo plano, después de ya haber chequeado la caché y haber
 * dejado seguir escaneando el siguiente código sin esperar esto.
 */
export async function resolveWithoutCache(upc: string, photoBase64?: string): Promise<ResolvedProduct> {
  if (photoBase64) {
    try {
      const ocrResult = await tryOcr(photoBase64);
      if (ocrResult?.styleNumber) {
        const isNewStyle = !(await isStyleNumberKnown(ocrResult.styleNumber));
        await saveCachedProduct(upc, ocrResult);
        return { ...ocrResult, isNewStyle };
      }
    } catch (e: any) {
      log('❌ Error de red/parseo con OCR.space:', e?.message ?? e);
    }
  }

  let best: ResolvedProduct = { styleNumber: null, brand: null, title: null, source: 'none' };
  try {
    const upcResult = await tryUpcItemDb(upc);
    if (upcResult) {
      best = upcResult;
      if (upcResult.styleNumber) {
        const isNewStyle = !(await isStyleNumberKnown(upcResult.styleNumber));
        await saveCachedProduct(upc, upcResult);
        return { ...upcResult, isNewStyle };
      }
    }
  } catch (e: any) {
    log('❌ Error de red/parseo con UPCitemdb:', e?.message ?? e);
  }

  log('=== Ninguna fuente resolvió el style number para', upc, '— queda pendiente de ingreso manual ===');
  return best;
}

/** Guarda una corrección/entrada manual del usuario, para no volver a preguntar ese UPC. */
export async function saveManualStyleNumber(upc: string, styleNumber: string, brand?: string, title?: string) {
  await saveCachedProduct(upc, { styleNumber, brand: brand ?? null, title: title ?? null, source: 'manual' });
}
