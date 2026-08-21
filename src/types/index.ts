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
}

export interface ArqueoItem {
  id: number;
  arqueoId: number;
  codigo: string;
  cantidad: number;
  comentario: string | null;
  primerEscaneo: string;
  ultimoEscaneo: string;
  escaneadoPor: string;
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
export type ExportMode = 'pos' | 'completo';

export const COMENTARIO_SUGERIDOS = [
  'Verificado',
  'Faltante',
  'Dañado',
  'Vencido',
  'Sin etiqueta',
  'Sobrante',
] as const;
