// RuneScape-style curve, continued past 99. XP is the source of truth; level is derived.

export const MAX_XP = 200_000_000;

const TABLE: number[] = (() => {
  const t = [0, 0]; // t[level] = total xp needed; level 1 = 0
  let points = 0;
  for (let lvl = 1; ; lvl++) {
    points += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    const xp = Math.floor(points / 4);
    if (xp > MAX_XP) break;
    t.push(xp);
  }
  return t;
})();

export const MAX_LEVEL = TABLE.length - 1; // 126

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return TABLE[Math.min(level, MAX_LEVEL)];
}

export function levelForXp(xp: number): number {
  let lo = 1, hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (TABLE[mid] <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Progress 0..1 through the current level. */
export function levelProgress(xp: number): number {
  const l = levelForXp(xp);
  if (l >= MAX_LEVEL) return 1;
  const a = xpForLevel(l), b = xpForLevel(l + 1);
  return (xp - a) / (b - a);
}
