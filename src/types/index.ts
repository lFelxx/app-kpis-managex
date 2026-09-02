export interface User {
  id: number;
  username: string;
  displayName: string;
  passwordHash: string;
  pin: string | null;
  isAdmin: boolean;
  createdAt: string;
}

export type ArqueoStatus = 'abierto' | 'cerrado';
export type ArqueoModo = 'simple' | 'style_beta';

export interface Arqueo {
  id: number;
  nombre: string;
  zona: string | null;
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
  status: ArqueoStatus;
  notas: string | null;
  checksum: string | null;
  synced: boolean;
  modo: ArqueoModo;
}

export type ResolutionSource = 'cache' | 'ocr' | 'api_model' | 'api_regex' | 'manual' | 'none';

export interface ArqueoItem {
  id: number;
  arqueoId: number;
  codigo: string;
  cantidad: number;
  comentario: string | null;
  primerEscaneo: string;
  ultimoEscaneo: string;
  escaneadoPor: string;
  styleNumber: string | null;
  resolutionSource: ResolutionSource | null;
  detalle: string | null;
}

export interface ResolvedProduct {
  styleNumber: string | null;
  brand: string | null;
  title: string | null;
  source: ResolutionSource;
  /** true solo cuando este style number no existía antes en la caché — para pedir confirmación una vez. */
  isNewStyle?: boolean;
}

export interface AuditLogEntry {
  id: number;
  arqueoId: number;
  itemId: number | null;
  campo: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  cambiadoPor: string;
  cambiadoEn: string;
}

export type ExportFormat = 'txt' | 'csv' | 'xlsx';
export type ExportMode = 'pos' | 'completo' | 'completo_style';

export const COMENTARIO_SUGERIDOS = [
  'Verificado',
  'Faltante',
  'Dañado',
  'Vencido',
  'Sin etiqueta',
  'Sobrante',
] as const;
