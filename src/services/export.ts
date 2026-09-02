import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as Crypto from 'expo-crypto';
import * as XLSX from 'xlsx';
import { Arqueo, ArqueoItem, ExportFormat } from '../types';
import { groupByStyle } from '../utils/styleGroups';

function safeFileName(name: string) {
  return name.replace(/[^a-z0-9\-_]+/gi, '_');
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

async function buildFooterChecksum(arqueo: Arqueo, items: ArqueoItem[]) {
  const payload = items.map((i) => `${i.codigo}:${i.cantidad}`).join('|');
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
}

/**
 * En modo "Style Number (beta)", el reporte de almacenamiento se agrupa por
 * style number (no por UPC) para dar el total real de inventario por
 * referencia — que es lo que se quiere ver en un reporte interno. El UPC de
 * cada talla que aportó a ese total queda igual visible, para trazabilidad.
 */
interface StyleExportRow {
  styleNumber: string;
  cantidad: number;
  upcs: string;
  comentarios: string;
  ultimoEscaneo: string;
  detalle: string | null;
}

function buildStyleExportRows(items: ArqueoItem[]): StyleExportRow[] {
  return groupByStyle(items).map((g) => ({
    styleNumber: g.label,
    cantidad: g.cantidad,
    upcs: g.items.map((i) => `${i.codigo} x${i.cantidad}`).join(', '),
    comentarios: g.items.map((i) => i.comentario).filter(Boolean).join(' | '),
    ultimoEscaneo: g.ultimoEscaneo,
    detalle: g.detalle,
  }));
}

function buildTextContent(arqueo: Arqueo, items: ArqueoItem[], checksum: string): string {
  const lines: string[] = [];
  lines.push('KPIManageX — Reporte de Arqueo');
  lines.push('================================');
  lines.push(`Arqueo: ${arqueo.nombre}`);
  if (arqueo.zona) lines.push(`Zona: ${arqueo.zona}`);
  lines.push(`Responsable: ${arqueo.createdBy}`);
  lines.push(`Creado: ${formatDate(arqueo.createdAt)}`);
  if (arqueo.closedAt) lines.push(`Cerrado: ${formatDate(arqueo.closedAt)}`);
  lines.push(`Estado: ${arqueo.status}`);
  if (arqueo.notas) lines.push(`Notas: ${arqueo.notas}`);
  lines.push('--------------------------------');
  lines.push('Código'.padEnd(20) + 'Cant.'.padEnd(8) + 'Últ. escaneo'.padEnd(20) + 'Comentario');
  for (const item of items) {
    lines.push(
      item.codigo.padEnd(20) +
        String(item.cantidad).padEnd(8) +
        formatDate(item.ultimoEscaneo).padEnd(20) +
        (item.comentario ?? '')
    );
  }
  lines.push('--------------------------------');
  lines.push(`Total de ítems distintos: ${items.length}`);
  lines.push(`Total de unidades: ${items.reduce((s, i) => s + i.cantidad, 0)}`);
  lines.push('');
  lines.push(`Checksum (integridad): ${checksum}`);
  lines.push('Generado por KPIManageX');
  return lines.join('\n');
}

function buildTextContentGrouped(arqueo: Arqueo, rows: StyleExportRow[], checksum: string): string {
  const lines: string[] = [];
  lines.push('KPIManageX — Reporte de Arqueo (agrupado por Style Number)');
  lines.push('================================');
  lines.push(`Arqueo: ${arqueo.nombre}`);
  if (arqueo.zona) lines.push(`Zona: ${arqueo.zona}`);
  lines.push(`Responsable: ${arqueo.createdBy}`);
  lines.push(`Creado: ${formatDate(arqueo.createdAt)}`);
  if (arqueo.closedAt) lines.push(`Cerrado: ${formatDate(arqueo.closedAt)}`);
  lines.push(`Estado: ${arqueo.status}`);
  if (arqueo.notas) lines.push(`Notas: ${arqueo.notas}`);
  lines.push('--------------------------------');
  lines.push('Style Number'.padEnd(18) + 'Cant.'.padEnd(8) + 'UPCs (tallas)');
  for (const row of rows) {
    lines.push(row.styleNumber.padEnd(18) + String(row.cantidad).padEnd(8) + row.upcs);
    if (row.comentarios) lines.push('  Comentarios: ' + row.comentarios);
  }
  lines.push('--------------------------------');
  lines.push(`Total de referencias distintas: ${rows.length}`);
  lines.push(`Total de unidades: ${rows.reduce((s, r) => s + r.cantidad, 0)}`);
  lines.push('');
  lines.push(`Checksum (integridad): ${checksum}`);
  lines.push('Generado por KPIManageX');
  return lines.join('\n');
}

function buildCsvContentGrouped(rows: StyleExportRow[]): string {
  const header = 'StyleNumber,Cantidad,UPCs,Comentarios,UltimoEscaneo';
  const csvRows = rows.map((r) =>
    [
      r.styleNumber,
      r.cantidad,
      `"${r.upcs.replace(/"/g, '""')}"`,
      `"${r.comentarios.replace(/"/g, '""')}"`,
      r.ultimoEscaneo,
    ].join(',')
  );
  return [header, ...csvRows].join('\n');
}

function buildXlsxBase64Grouped(arqueo: Arqueo, rows: StyleExportRow[], checksum: string): string {
  const wb = XLSX.utils.book_new();

  const header = [
    ['KPIManageX — Reporte de Arqueo (agrupado por Style Number)'],
    ['Arqueo', arqueo.nombre],
    ['Zona', arqueo.zona ?? ''],
    ['Responsable', arqueo.createdBy],
    ['Creado', formatDate(arqueo.createdAt)],
    ['Cerrado', arqueo.closedAt ? formatDate(arqueo.closedAt) : ''],
    ['Estado', arqueo.status],
    ['Notas', arqueo.notas ?? ''],
    [],
    ['Style Number', 'Cantidad total', 'UPCs (tallas)', 'Comentarios', 'Último escaneo'],
  ];

  const dataRows = rows.map((r) => [r.styleNumber, r.cantidad, r.upcs, r.comentarios, formatDate(r.ultimoEscaneo)]);

  const footer = [
    [],
    ['Total referencias distintas', rows.length],
    ['Total unidades', rows.reduce((s, r) => s + r.cantidad, 0)],
    ['Checksum', checksum],
  ];

  const ws = XLSX.utils.aoa_to_sheet([...header, ...dataRows, ...footer]);
  ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 36 }, { wch: 30 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Arqueo');

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

/**
 * Formato "Sistema POS": una línea por unidad, solo el código limpio,
 * sin cantidad ni ningún otro dato — para sistemas que solo aceptan
 * el listado plano de referencias/SKU escaneadas.
 */
function buildPosTextContent(items: ArqueoItem[]): string {
  const lines: string[] = [];
  for (const item of items) {
    for (let i = 0; i < item.cantidad; i++) {
      lines.push(item.codigo);
    }
  }
  return lines.join('\n');
}

function buildCsvContent(items: ArqueoItem[]): string {
  const header = 'Codigo,Cantidad,Comentario,PrimerEscaneo,UltimoEscaneo,EscaneadoPor';
  const rows = items.map((i) =>
    [
      i.codigo,
      i.cantidad,
      `"${(i.comentario ?? '').replace(/"/g, '""')}"`,
      i.primerEscaneo,
      i.ultimoEscaneo,
      i.escaneadoPor,
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

function buildXlsxBase64(arqueo: Arqueo, items: ArqueoItem[], checksum: string): string {
  const wb = XLSX.utils.book_new();

  const header = [
    ['KPIManageX — Reporte de Arqueo'],
    ['Arqueo', arqueo.nombre],
    ['Zona', arqueo.zona ?? ''],
    ['Responsable', arqueo.createdBy],
    ['Creado', formatDate(arqueo.createdAt)],
    ['Cerrado', arqueo.closedAt ? formatDate(arqueo.closedAt) : ''],
    ['Estado', arqueo.status],
    ['Notas', arqueo.notas ?? ''],
    [],
    ['Código', 'Cantidad', 'Comentario', 'Primer escaneo', 'Último escaneo', 'Escaneado por'],
  ];

  const rows = items.map((i) => [
    i.codigo,
    i.cantidad,
    i.comentario ?? '',
    formatDate(i.primerEscaneo),
    formatDate(i.ultimoEscaneo),
    i.escaneadoPor,
  ]);

  const footer = [
    [],
    ['Total ítems distintos', items.length],
    ['Total unidades', items.reduce((s, i) => s + i.cantidad, 0)],
    ['Checksum', checksum],
  ];

  const ws = XLSX.utils.aoa_to_sheet([...header, ...rows, ...footer]);
  ws['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Arqueo');

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

export interface ExportResult {
  uri: string;
  fileName: string;
  mimeType: string;
}

/** Formato "para almacenar" de siempre: una fila por UPC/talla, sin agrupar. */
export async function generateExportFile(
  arqueo: Arqueo,
  items: ArqueoItem[],
  format: ExportFormat
): Promise<ExportResult> {
  const checksum = await buildFooterChecksum(arqueo, items);
  const baseName = `Arqueo_${safeFileName(arqueo.nombre)}_${new Date(arqueo.createdAt)
    .toISOString()
    .slice(0, 10)}`;

  let fileName: string;
  let mimeType: string;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';

  if (format === 'txt') {
    fileName = `${baseName}.txt`;
    mimeType = 'text/plain';
    await FileSystem.writeAsStringAsync(dir + fileName, buildTextContent(arqueo, items, checksum), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } else if (format === 'csv') {
    fileName = `${baseName}.csv`;
    mimeType = 'text/csv';
    await FileSystem.writeAsStringAsync(dir + fileName, buildCsvContent(items), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } else {
    fileName = `${baseName}.xlsx`;
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const base64 = buildXlsxBase64(arqueo, items, checksum);
    await FileSystem.writeAsStringAsync(dir + fileName, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  return { uri: dir + fileName, fileName, mimeType };
}

/**
 * Formato "para almacenar" NUEVO, agrupado por Style Number (solo tiene
 * sentido en arqueos modo beta): una fila por referencia con el total de
 * unidades sumando todas las tallas, más el detalle de qué UPCs aportaron.
 * No reemplaza `generateExportFile` — es una opción adicional.
 */
export async function generateExportFileByStyle(
  arqueo: Arqueo,
  items: ArqueoItem[],
  format: ExportFormat
): Promise<ExportResult> {
  const rows = buildStyleExportRows(items);
  const checksum = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rows.map((r) => `${r.styleNumber}:${r.cantidad}`).join('|')
  );
  const baseName = `Arqueo_${safeFileName(arqueo.nombre)}_PorStyleNumber_${new Date(arqueo.createdAt)
    .toISOString()
    .slice(0, 10)}`;

  let fileName: string;
  let mimeType: string;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';

  if (format === 'txt') {
    fileName = `${baseName}.txt`;
    mimeType = 'text/plain';
    await FileSystem.writeAsStringAsync(dir + fileName, buildTextContentGrouped(arqueo, rows, checksum), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } else if (format === 'csv') {
    fileName = `${baseName}.csv`;
    mimeType = 'text/csv';
    await FileSystem.writeAsStringAsync(dir + fileName, buildCsvContentGrouped(rows), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } else {
    fileName = `${baseName}.xlsx`;
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const base64 = buildXlsxBase64Grouped(arqueo, rows, checksum);
    await FileSystem.writeAsStringAsync(dir + fileName, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  return { uri: dir + fileName, fileName, mimeType };
}

/**
 * Exporta el listado limpio para subir directo al sistema POS: un código
 * por línea, repetido tantas veces como unidades se contaron (sin cantidad,
 * comentarios ni encabezados). `item.codigo` siempre es el UPC real, tanto
 * en modo simple como en modo beta (el style number vive aparte en
 * `styleNumber`), así que esto funciona igual sin importar el modo.
 */
export async function generatePosExportFile(arqueo: Arqueo, items: ArqueoItem[]): Promise<ExportResult> {
  const baseName = `POS_${safeFileName(arqueo.nombre)}_${new Date(arqueo.createdAt).toISOString().slice(0, 10)}`;
  const fileName = `${baseName}.txt`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  await FileSystem.writeAsStringAsync(dir + fileName, buildPosTextContent(items), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return { uri: dir + fileName, fileName, mimeType: 'text/plain' };
}

export async function shareExport(result: ExportResult) {
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Compartir no está disponible en este dispositivo');
  await Sharing.shareAsync(result.uri, { mimeType: result.mimeType, dialogTitle: result.fileName });
}

export async function emailExport(result: ExportResult, subject: string, recipients?: string[]) {
  const available = await MailComposer.isAvailableAsync();
  if (!available) throw new Error('No hay una app de correo configurada en este dispositivo');
  await MailComposer.composeAsync({
    subject,
    body: 'Adjunto el reporte de arqueo generado por KPIManageX.',
    isHtml: false,
    attachments: [result.uri],
    recipients,
  });
}
