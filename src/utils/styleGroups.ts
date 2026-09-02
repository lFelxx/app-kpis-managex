import { ArqueoItem, ResolutionSource } from '../types';

/**
 * Agrupación puramente visual: no transforma ni guarda nada, solo junta los
 * ítems (cada uno con su UPC real intacto) que comparten style number para
 * mostrarlos como una sola fila en la lista del modo beta.
 */
export interface StyleGroup {
  key: string;
  label: string;
  cantidad: number;
  detalle: string | null;
  resolutionSource: ResolutionSource | null;
  ultimoEscaneo: string;
  items: ArqueoItem[];
}

export function groupByStyle(items: ArqueoItem[]): StyleGroup[] {
  const map = new Map<string, StyleGroup>();
  for (const item of items) {
    const key = item.styleNumber ?? item.codigo;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        label: key,
        cantidad: 0,
        detalle: item.detalle,
        resolutionSource: item.resolutionSource,
        ultimoEscaneo: item.ultimoEscaneo,
        items: [],
      };
      map.set(key, group);
    }
    group.cantidad += item.cantidad;
    group.items.push(item);
    if (!group.detalle && item.detalle) group.detalle = item.detalle;
    if ((!group.resolutionSource || group.resolutionSource === 'none') && item.resolutionSource && item.resolutionSource !== 'none') {
      group.resolutionSource = item.resolutionSource;
    }
    if (item.ultimoEscaneo > group.ultimoEscaneo) group.ultimoEscaneo = item.ultimoEscaneo;
  }
  return Array.from(map.values()).sort((a, b) => (a.ultimoEscaneo < b.ultimoEscaneo ? 1 : -1));
}

/** Ítem "representativo" de un grupo, solo para pintar la fila con ItemRow. */
export function groupToDisplayItem(group: StyleGroup): ArqueoItem {
  const first = group.items[0];
  let comentario = first.comentario;
  if (group.items.length > 1) {
    const conNota = group.items.filter((i) => i.comentario).length;
    comentario = conNota > 0
      ? `⚠ ${conNota} con nota · ${group.items.length} códigos distintos`
      : `${group.items.length} códigos distintos`;
  }
  return {
    ...first,
    codigo: group.label,
    cantidad: group.cantidad,
    comentario,
    detalle: group.detalle,
    resolutionSource: group.resolutionSource,
    ultimoEscaneo: group.ultimoEscaneo,
  };
}
