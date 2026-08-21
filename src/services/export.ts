import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as Crypto from 'expo-crypto';
import * as XLSX from 'xlsx';
import { Arqueo, ArqueoItem, ExportFormat } from '../types';

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
 * Exporta el listado limpio para subir directo al sistema POS: un código
 * por línea, repetido tantas veces como unidades se contaron (sin cantidad,
 * comentarios ni encabezados).
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
