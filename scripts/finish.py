# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "opencv-python-headless", "pillow"]
# ///
"""The Motes finish: one painting pass over every painting, so each place reads as painted rather than
generated, and the four places read as one set. Every state of a place (arrival, evening, Halloween)
gets exactly the same treatment.

    uv run scripts/finish.py [name ...]    art/scenes/<name>.png -> .cache/scenes/finished/<name>.png
                                                                and .cache/scenes/finished/<name>@3840.png

Then `node scripts/encode-scenes.mjs` encodes the served tiers from the finished PNGs.

Kyle chose the look on 9 October 2026 from the test in spike/look/look.py: "gouache, light". Image
models give themselves away by surface: detail everywhere at the same sharpness, colour pushed to the
limit, pure blacks, and no medium. Gouache-light answers each of those and nothing more:

1. brush: a generalised Kuwahara filter, radius 4 px at 1672 wide, scaled with the tier so the strokes
   are the same size on every screen. Flat areas become soft dabs of paint; edges stay crisp.
2. inks: one set for every place. Chroma eased off the top, the darkest tone indigo and the lightest
   warm paper, shadows a little cool and lights a little warm.
3. glow: the soft halo round every lamp, window and sign that lofi backgrounds share (strength 0.15).
4. paper: a faint cold-press grain, strongest in the light washes (strength 0.03), seeded by position
   so every state of a place lies on one sheet.

Tried and declined in the same test: print (the inks and paper alone; still read as generated), heavier
gouache (a radius-6 brush; lost the small lights and faces of things), watercolour (blooms and pigment
edges; moved too far from the paintings) and ink and wash (indigo lines where tone turns; busy at
1672). A first grade lifted the ink to 0.13 and every place went milky violet, like a faded print.

All four steps work in place: nothing moves more than a few pixels, so masks, matched evening states,
the water and the lights still line up.

Tiers: base is the master's own 1672 width. Full is 3840: the master upscaled four times with
Real-ESRGAN (realesrgan-ncnn-vulkan v0.2.5.0, BSD-3-Clause, run locally on the GPU; fetched into
.cache/tools/ on first use), cached in .cache/scenes/upscaled/, downsampled with Lanczos to 3840 and
finished at that width. The brush smooths over the upscaler's invented micro-detail. The upscaler's
own tiling leaves faint seams, so the master is cut into overlapping tiles here and feathered back
together, and no tile edge reaches the picture.
"""
import argparse
import hashlib
import io
import platform
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parents[1]
MASTERS = ROOT / 'art' / 'scenes'
CACHE = ROOT / '.cache'
FINISHED = CACHE / 'scenes' / 'finished'
UPSCALED = CACHE / 'scenes' / 'upscaled'

BASE = 1672             # the masters' width, and the width the look was chosen at
FULL = 3840
BRUSH = 4.0             # Kuwahara radius at BASE
GLOW = 0.15
PAPER = 0.03
INK = np.array([0.035, 0.03, 0.075], np.float32)      # the darkest a Motes painting goes: indigo, not black
LIGHT = np.array([0.985, 0.965, 0.93], np.float32)    # and the lightest: warm paper, not white

MODEL = 'realesrgan-x4plus'
TILE, OVERLAP = 448, 48     # master px per upscaler tile, and how far each reaches into its neighbours
RELEASE = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-{}.zip'
BUILDS = {  # platform -> (release asset, sha256)
    'Windows': ('windows', 'abc02804e17982a3be33675e4d471e91ea374e65b70167abc09e31acb412802d'),
    'Darwin': ('macos', 'e0ad05580abfeb25f8d8fb55aaf7bedf552c375b5b4d9bd3c8d59764d2cc333a'),
    'Linux': ('ubuntu', 'e5aa6eb131234b87c0c51f82b89390f5e3e642b7b70f2b9bbe95b6a285a40c96'),
}
TOOL = CACHE / 'tools' / 'realesrgan'


def load(path):
    return np.asarray(Image.open(path).convert('RGB'), np.float32) / 255.0


def save(img, path):
    Image.fromarray(np.clip(img * 255 + 0.5, 0, 255).astype(np.uint8)).save(path)


def lum(img):
    return img @ np.array([0.2126, 0.7152, 0.0722], np.float32)


# ---- the shared paper ---------------------------------------------------------------------

def fbm(h, w, cell, seed, octaves=4):
    """Unit-variance fractal noise with features about `cell` px, the same for every image this size."""
    rng = np.random.default_rng(seed)
    out, amp, c = np.zeros((h, w), np.float32), 1.0, float(cell)
    for _ in range(octaves):
        g = rng.standard_normal((max(2, int(h / c) + 2), max(2, int(w / c) + 2))).astype(np.float32)
        out += amp * cv2.resize(g, (w, h), interpolation=cv2.INTER_CUBIC)
        amp, c = amp * 0.5, c / 2
    return (out - out.mean()) / (out.std() + 1e-6)


def paper(h, w, s):
    """Cold-press paper: a slow mottle, fine tooth, and fibres running mostly one way; `s` scales its features with the tier."""
    mottle = fbm(h, w, 160 * s, 1, 3)
    grain = fbm(h, w, 3 * s, 2, 2)
    fibre = cv2.GaussianBlur(np.random.default_rng(3).standard_normal((h, w)).astype(np.float32), (0, 0), sigmaX=6 * s, sigmaY=0.6 * s)
    fibre = fibre / (fibre.std() + 1e-6)
    return 0.35 * mottle + 0.5 * grain + 0.3 * fibre


def on_paper(img, s):
    """Lays the image on the paper: the tooth shows most in the light washes, as on real paper."""
    h, w = img.shape[:2]
    light = 0.35 + 0.65 * lum(img)
    return np.clip(img * (1 + PAPER * paper(h, w, s) * light)[..., None], 0, 1)


# ---- the shared inks ----------------------------------------------------------------------

def grade(img):
    """One set of inks for every place: chroma eased off the top, blacks lifted to indigo and whites
    warmed to paper, shadows a little cool and lights a little warm."""
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2Lab)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    c = np.hypot(a, b) + 1e-6
    k = 75.0 * np.tanh(c / 75.0) / c
    a, b = a * k, b * k
    t = L / 100.0
    a = a + 1.5 * (1 - t) ** 3
    b = b - 4.0 * (1 - t) ** 3 + 3.0 * t ** 4
    out = cv2.cvtColor(np.dstack([L, a, b]).astype(np.float32), cv2.COLOR_Lab2RGB)
    return INK + (LIGHT - INK) * np.clip(out, 0, 1)


def halation(img, s):
    """The soft glow round every light, warmer than the light itself."""
    bright = np.clip((lum(img) - 0.62) / 0.3, 0, 1)[..., None] * img
    glow = cv2.GaussianBlur(bright, (0, 0), 7 * s) * 0.6 + cv2.GaussianBlur(bright, (0, 0), 24 * s) * 0.4
    glow *= np.array([1.0, 0.82, 0.7], np.float32)
    return 1 - (1 - img) * (1 - GLOW * glow)


# ---- the brush ----------------------------------------------------------------------------

def kuwahara(img, r, sectors=8):
    """Generalised Kuwahara: eight overlapping sectors, and each pixel takes the mean of its quietest
    ones, weighted by 1/(1+(255Σσ²)^4)."""
    R = int(np.ceil(r))
    yy, xx = np.mgrid[-R:R + 1, -R:R + 1].astype(np.float32)
    dist = np.hypot(xx, yy)
    ang = np.arctan2(yy, xx)
    radial = np.exp(-(dist ** 2) / (2 * (r / 2) ** 2)) * (dist <= r)
    sq = img * img
    num, den = np.zeros_like(img), np.zeros(img.shape[:2], np.float32)
    for n in range(sectors):
        lobe = np.maximum(0.0, np.cos(ang - 2 * np.pi * n / sectors)) ** 3
        lobe[R, R] = 1.0
        k = (radial * lobe).astype(np.float32)
        k /= k.sum()
        m = cv2.filter2D(img, -1, k, borderType=cv2.BORDER_REFLECT)
        v = (cv2.filter2D(sq, -1, k, borderType=cv2.BORDER_REFLECT) - m * m).clip(0).sum(axis=2)
        wgt = 1.0 / (1.0 + (255.0 * v) ** 4)
        num += m * wgt[..., None]
        den += wgt
    return num / (den[..., None] + 1e-12)


def finish(img):
    """The gouache-light look at this image's width."""
    s = img.shape[1] / BASE
    return on_paper(halation(grade(kuwahara(img, BRUSH * s)), s), s)


# ---- upscaling ----------------------------------------------------------------------------

def realesrgan():
    """The portable Real-ESRGAN build, fetched from its official release and checked on first use."""
    exe = TOOL / ('realesrgan-ncnn-vulkan.exe' if platform.system() == 'Windows' else 'realesrgan-ncnn-vulkan')
    if exe.exists():
        return exe
    asset, digest = BUILDS[platform.system()]
    print('fetching Real-ESRGAN', RELEASE.format(asset))
    data = urllib.request.urlopen(RELEASE.format(asset)).read()
    if hashlib.sha256(data).hexdigest() != digest:
        raise SystemExit('Real-ESRGAN download did not match its checksum')
    TOOL.mkdir(parents=True, exist_ok=True)
    zipfile.ZipFile(io.BytesIO(data)).extractall(TOOL)
    exe.chmod(0o755)
    return exe


def upscale(master, model):
    """Four times the master, cut into overlapping tiles so the upscaler never tiles it itself, and
    feathered back together. Cached by the master's bytes and the model."""
    digest = hashlib.sha256(master.read_bytes()).hexdigest()[:12]
    out = UPSCALED / f'{master.stem}.{model}.{digest}.png'
    if out.exists():
        return load(out)
    src = np.asarray(Image.open(master).convert('RGB'))
    h, w = src.shape[:2]
    work = UPSCALED / 'tiles' / master.stem
    shutil.rmtree(work, ignore_errors=True)
    (work / 'in').mkdir(parents=True)
    (work / 'out').mkdir()
    tiles = []
    for y in range(0, h, TILE):
        for x in range(0, w, TILE):
            box = (max(0, x - OVERLAP), max(0, y - OVERLAP), min(w, x + TILE + OVERLAP), min(h, y + TILE + OVERLAP))
            name = f'{len(tiles):03d}.png'
            Image.fromarray(src[box[1]:box[3], box[0]:box[2]]).save(work / 'in' / name)
            tiles.append((name, box))
    # -t larger than any tile, so each tile is upscaled whole
    subprocess.run([str(realesrgan()), '-i', str(work / 'in'), '-o', str(work / 'out'), '-n', model,
                    '-m', str(TOOL / 'models'), '-s', '4', '-t', str(TILE + 2 * OVERLAP + 32), '-f', 'png'],
                   check=True, capture_output=True)
    acc, weight = np.zeros((4 * h, 4 * w, 3), np.float32), np.zeros((4 * h, 4 * w), np.float32)
    for name, (x0, y0, x1, y1) in tiles:
        tile = np.asarray(Image.open(work / 'out' / name).convert('RGB'), np.float32)
        if tile.shape[:2] != (4 * (y1 - y0), 4 * (x1 - x0)):
            # the build exits 0 and writes a tiny image when the GPU runs out of memory
            raise SystemExit(f'Real-ESRGAN failed on tile {name} of {master.name}')
        ramp = lambda n, lo, hi: np.minimum(
            1.0 if lo == 0 else np.clip((np.arange(n) + 0.5) / (8 * OVERLAP), 0, 1),
            1.0 if hi == 0 else np.clip((n - np.arange(n) - 0.5) / (8 * OVERLAP), 0, 1))
        wy = ramp(tile.shape[0], y0, h - y1)
        wx = ramp(tile.shape[1], x0, w - x1)
        wgt = np.outer(np.broadcast_to(wy, tile.shape[:1]), np.broadcast_to(wx, tile.shape[1:2]))
        acc[4 * y0:4 * y1, 4 * x0:4 * x1] += tile * wgt[..., None]
        weight[4 * y0:4 * y1, 4 * x0:4 * x1] += wgt
    big = np.clip(acc / weight[..., None] + 0.5, 0, 255).astype(np.uint8)
    UPSCALED.mkdir(parents=True, exist_ok=True)
    for stale in UPSCALED.glob(f'{master.stem}.{model}.*.png'):
        stale.unlink()
    Image.fromarray(big).save(out)
    shutil.rmtree(work)
    return big.astype(np.float32) / 255.0


def full_tier(master, model):
    """The full tier before its finish: the upscale, Lanczos-downsampled to FULL wide."""
    big = upscale(master, model)
    h, w = big.shape[:2]
    size = (FULL, round(FULL * h / w))
    return np.asarray(Image.fromarray(np.clip(big * 255 + 0.5, 0, 255).astype(np.uint8)).resize(size, Image.LANCZOS), np.float32) / 255.0


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('names', nargs='*', help='painting names (default: every master)')
    parser.add_argument('--masters', type=Path, default=MASTERS)
    parser.add_argument('--model', default=MODEL)
    args = parser.parse_args()
    FINISHED.mkdir(parents=True, exist_ok=True)
    masters = [args.masters / f'{n}.png' for n in args.names] or sorted(args.masters.glob('*.png'))
    for master in masters:
        src = load(master)
        if src.shape[1] != BASE:
            raise SystemExit(f'{master.name} is {src.shape[1]} px wide; masters are {BASE}')
        save(finish(src), FINISHED / f'{master.stem}.png')
        save(finish(full_tier(master, args.model)), FINISHED / f'{master.stem}@{FULL}.png')
        print('finished', master.stem)


if __name__ == '__main__':
    main()
