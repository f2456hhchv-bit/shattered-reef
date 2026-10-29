import { describe, expect, it } from 'vitest';
import { gameCameraDistance } from './playerCharacterPreviewCamera';

describe('player character preview gameplay camera', () => {
  it('uses the game renderer distance at a portrait mobile aspect ratio', () => {
    expect(gameCameraDistance(390, 844)).toBeCloseTo(68.65, 2);
  });

  it('keeps the camera at the game minimum distance on a wide screen', () => {
    expect(gameCameraDistance(844, 390)).toBe(29);
  });
});
