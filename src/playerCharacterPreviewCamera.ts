/** Mirrors the renderer's minimum world-width camera framing for a given viewport. */
export function gameCameraDistance(width: number, height: number, verticalFovDegrees = 30): number {
  if (!(width > 0) || !(height > 0) || !(verticalFovDegrees > 0 && verticalFovDegrees < 180)) return 29;
  const aspect = width / height;
  const halfFov = verticalFovDegrees * Math.PI / 360;
  return Math.max(29, 17 / (2 * Math.tan(halfFov) * aspect));
}
