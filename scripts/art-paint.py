#!/usr/bin/env python3
"""Painted item icons: cut a generated picture out of its white background, and recolour a painted steel icon for
the other metal tiers (only the grey metal is tinted: leather, wood, brass and gems keep their colours).

  python3 scripts/art-paint.py cut  <in.webp|png> <out.png>
  python3 scripts/art-paint.py tint <steel.png> <out.png> <#rrggbb> [force]   (force: tint every colour, not just grey)
"""
import sys, colorsys
from collections import deque
from PIL import Image, ImageFilter

SIZE = 256

def cut(src, dst):
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    px = im.load()
    # flood the near-white background in from the border (white inside the item, a highlight, survives)
    near = lambda c: c[0] > 228 and c[1] > 228 and c[2] > 228
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1): q.append((x, y))
    for y in range(h):
        for x in (0, w - 1): q.append((x, y))
    bg = bytearray(w * h)
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]: continue
        seen[i] = 1
        if not near(px[x, y]): continue
        bg[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    mask = Image.new('L', (w, h), 255)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            if bg[y * w + x]: mp[x, y] = 0
    # soften the edge a touch so it doesn't look stamped out
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    im.putalpha(mask)
    box = mask.point(lambda a: 255 if a > 24 else 0).getbbox()
    im = im.crop(box)
    side = int(max(im.size) * 1.08)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.size[0]) // 2, (side - im.size[1]) // 2), im)
    sq.resize((SIZE, SIZE), Image.LANCZOS).save(dst)

def tint(src, dst, hexcol, force=False):
    im = Image.open(src).convert('RGBA')
    r0, g0, b0 = (int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5))
    th, tl, ts = colorsys.rgb_to_hls(r0, g0, b0)
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if l < 0.07 or (not force and s > 0.28 and l > 0.12): continue  # coloured: leather, wood, brass, gems keep their colour
            # metal: take the tier's hue and saturation; shift the shading toward the tier's lightness
            nl = min(1, max(0, l + (tl - 0.62) * 0.75 * (1 - abs(l - 0.5))))
            nr, ng, nb = colorsys.hls_to_rgb(th, nl, min(1, ts * 0.95))
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    im.save(dst)

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'cut': cut(sys.argv[2], sys.argv[3])
    elif cmd == 'tint': tint(sys.argv[2], sys.argv[3], sys.argv[4], len(sys.argv) > 5)
