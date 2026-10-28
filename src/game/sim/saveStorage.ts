/** Prototype voyages import the original read-only and then persist in their own slot. */
type VoyageStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function readVoyage(storage: VoyageStorage, key: string, classicKey: string): string | null {
  return storage.getItem(key) ?? (key !== classicKey ? storage.getItem(classicKey) : null);
}
export function resetVoyage(storage: VoyageStorage, key: string, classicKey: string, fresh: string) {
  if (key === classicKey) storage.removeItem(key);
  else storage.setItem(key, fresh); // a reset prototype must not re-import the original on reload
}
