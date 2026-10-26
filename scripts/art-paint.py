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
    # white pockets the outline encloses (inside a helmet's brim, between a bow and its string) are background too;
    # small white bits are highlights and stay
    lim = max(60, int(w * h * 0.004))
    for sy in range(h):
        for sx in range(w):
            i0 = sy * w + sx
            if bg[i0] or seen[i0] == 2 or not near(px[sx, sy]): continue
            comp, st = [], [(sx, sy)]
            seen[i0] = 2
            while st:
                x, y = st.pop(); comp.append(y * w + x)
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if seen[j] != 2 and not bg[j] and near(px[nx, ny]): seen[j] = 2; st.append((nx, ny))
            if len(comp) > lim:
                for j in comp: bg[j] = 1
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

def tint(src, dst, hexcol, force=False, lmax=1.0):
    im = Image.open(src).convert('RGBA')
    r0, g0, b0 = (int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5))
    th, tl, ts = colorsys.rgb_to_hls(r0, g0, b0)
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if l < 0.07 or l > lmax or (not force and s > 0.28 and l > 0.12): continue  # coloured: leather, wood, brass, gems keep their colour
            # metal: take the tier's hue and saturation; shift the shading toward the tier's lightness
            nl = min(1, max(0, l + (tl - 0.62) * 0.75 * (1 - abs(l - 0.5))))
            nr, ng, nb = colorsys.hls_to_rgb(th, nl, min(1, ts * 0.95))
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    im.save(dst)

def regem(src, dst, gem, band=None):
    """Tom's painted ring with its green gem recoloured (and its gold band turned silver when band='silver')."""
    im = Image.open(src).convert('RGBA')
    gr, gg, gb = (int(gem[i:i + 2], 16) / 255 for i in (1, 3, 5))
    gh, gl, gs = colorsys.rgb_to_hls(gr, gg, gb)
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if 0.2 < h < 0.5 and s > 0.25:  # the gem
                nl = min(1, max(0, l + (gl - 0.45) * 0.8))
                nr, ng, nb = colorsys.hls_to_rgb(gh, nl, gs)
            elif band == 'silver' and 0.06 < h < 0.18 and s > 0.25:  # gold band to silver
                nr, ng, nb = colorsys.hls_to_rgb(0.58, min(1, l * 1.08), 0.08)
            else: continue
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    im.save(dst)

def rewood(src, dst, hexcol):
    """A painted wooden item (bow, staff, log) in another wood: the orange-brown wood takes the new colour."""
    im = Image.open(src).convert('RGBA')
    th, tl, ts = colorsys.rgb_to_hls(*(int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5)))
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if not (0.0 <= h < 0.16 and s > 0.2 and l > 0.12): continue
            nl = min(1, max(0, l + (tl - 0.42) * 0.8))
            nr, ng, nb = colorsys.hls_to_rgb(th, nl, min(1, ts * 1.1))
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    im.save(dst)

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'cut': cut(sys.argv[2], sys.argv[3])
    elif cmd == 'tint': tint(sys.argv[2], sys.argv[3], sys.argv[4], len(sys.argv) > 5)
