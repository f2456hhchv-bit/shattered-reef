/** Explicit classic query wins over the build flag, including screenshot and save review sessions. */
export function bellwetherRedesignEnabled(query: string, buildFlag: string | undefined): boolean {
  const selection = new URLSearchParams(query).get('bellwether');
  return selection === 'classic' ? false : selection === 'phase2' || buildFlag === '1';
}
export const BELLWETHER_REDESIGN = bellwetherRedesignEnabled(
  typeof location === 'undefined' ? '' : location.search,
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_BELLWETHER_REDESIGN,
);
export const BELLWETHER_GEOMETRY_REVISION = 'bellwether-phase2-v1';
