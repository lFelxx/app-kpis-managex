import { useEffect, useState } from 'react';

/**
 * Registro en memoria (no persistido) de qué ítems están resolviéndose en
 * segundo plano (OCR/UPCitemdb) en cada arqueo. Vive fuera de cualquier
 * pantalla a propósito: la resolución sigue corriendo aunque el usuario
 * navegue de Scanner a ArqueoDetail (o cierre la pantalla) antes de que
 * termine, y cualquier pantalla que esté mirando ese arqueo puede
 * suscribirse para refrescarse sola en cuanto se resuelve.
 */
const pending = new Map<number, Set<number>>();
const listeners = new Map<number, Set<() => void>>();

function notify(arqueoId: number) {
  listeners.get(arqueoId)?.forEach((cb) => cb());
}

export function startResolution(arqueoId: number, itemId: number) {
  if (!pending.has(arqueoId)) pending.set(arqueoId, new Set());
  pending.get(arqueoId)!.add(itemId);
  notify(arqueoId);
}

export function finishResolution(arqueoId: number, itemId: number) {
  pending.get(arqueoId)?.delete(itemId);
  notify(arqueoId);
}

export function getPendingCount(arqueoId: number): number {
  return pending.get(arqueoId)?.size ?? 0;
}

export function subscribeResolutionQueue(arqueoId: number, cb: () => void): () => void {
  if (!listeners.has(arqueoId)) listeners.set(arqueoId, new Set());
  listeners.get(arqueoId)!.add(cb);
  return () => listeners.get(arqueoId)?.delete(cb);
}

/** Número de ítems de este arqueo resolviéndose ahora mismo; se actualiza solo. */
export function usePendingResolutions(arqueoId: number): number {
  const [count, setCount] = useState(() => getPendingCount(arqueoId));
  useEffect(() => {
    setCount(getPendingCount(arqueoId));
    return subscribeResolutionQueue(arqueoId, () => setCount(getPendingCount(arqueoId)));
  }, [arqueoId]);
  return count;
}
