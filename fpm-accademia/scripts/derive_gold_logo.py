# Derive a gold version of the original FPM logo WITHOUT altering its shape:
# the alpha mask is the original's brightness above the dark background, so
# every stroke keeps its exact pixel geometry; only the colour is remapped.
import sys
import numpy as np
from PIL import Image, ImageFilter
src, out_t, out_b = sys.argv[1:4]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
mx = im.max(axis=2)
# background is dark navy/purple (max channel ~0.05-0.25); strokes are bright
lo, hi = 0.34, 0.66
a = np.clip((mx - lo) / (hi - lo), 0, 1)
h, w = a.shape
y = np.linspace(0, 1, h)[:, None]
x = np.linspace(0, 1, w)[None, :]
# metallic gold gradient: light highlight top-left -> deep gold bottom-right
t = np.clip(0.55 * y + 0.45 * x, 0, 1)
stops = np.array([[0.98, 0.90, 0.62], [0.90, 0.72, 0.33], [0.80, 0.58, 0.20], [0.62, 0.43, 0.13]])
pos = np.array([0, 0.35, 0.7, 1])
col = np.stack([np.interp(t, pos, stops[:, c]) for c in range(3)], axis=2)
# keep a touch of the original intensity modulation (inner shading)
shade = 0.82 + 0.18 * np.clip((mx - lo) / (1 - lo), 0, 1)
col = np.clip(col * shade[..., None], 0, 1)
rgba = np.dstack([col, a])
img = Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA')
img.save(out_t)
bg = Image.new('RGBA', img.size, (5, 5, 6, 255))
bg.alpha_composite(img)
bg.convert('RGB').save(out_b)
