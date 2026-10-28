/** Development supports a classic override; a published preview always keeps redesigned geography and isolated saves. */
export function bellwetherRedesignEnabled(query: string, buildFlag: string | undefined, previewFlag?: string): boolean {
  if (previewFlag === '1') return true; // a public preview must never select the production save slot
  const selection = new URLSearchParams(query).get('bellwether');
  return selection === 'classic' ? false : selection === 'phase2' || buildFlag === '1';
}
export const BELLWETHER_REDESIGN = bellwetherRedesignEnabled(
  typeof location === 'undefined' ? '' : location.search,
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_BELLWETHER_REDESIGN,
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_BELLWETHER_PREVIEW,
);
export const BELLWETHER_GEOMETRY_REVISION = 'bellwether-phase2-v1';

/** GitHub project sites share an origin: isolate non-voyage settings as well as saves. */
export function worldStorageKey(key: string, redesign = BELLWETHER_REDESIGN): string {
  return redesign ? `${key}.${BELLWETHER_GEOMETRY_REVISION}` : key;
}
