/**
 * generate-icon.js
 *
 * Generates a 256x256 PNG icon for REITLens using only Node.js built-in
 * modules (no native addons required). Writes to build/icon.png.
 *
 * The icon features:
 *   - Dark navy gradient background in a rounded-square shape
 *   - "RL" text rendered in white/light-blue
 *   - A subtle lens/chart geometric accent
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Dimensions ──────────────────────────────────────────────────────────────
const W = 256;
const H = 256;

// ── Colours ─────────────────────────────────────────────────────────────────
const BG_TOP    = [1, 4, 9];       // #010409
const BG_BOT    = [2, 21, 43];     // #02152b
const ACCENT    = [56, 189, 248];   // #38bdf8  sky-400
const ORANGE    = [255, 157, 60];   // #FF9D3C  pumpkin
const WHITE     = [255, 255, 255];

// ── Helpers ─────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Signed distance from a rounded rect centered at (cx, cy). */
function sdRoundedRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - hw + r;
  const dy = Math.abs(py - cy) - hh + r;
  const outside = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - r;
  const inside  = Math.min(Math.max(dx, dy), 0);
  return outside + inside;
}

/** Distance from point to a line segment. */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

/** Simple 1-bit glyph rasterizer for "R" and "L" using line segments. */
function distToChar(ch, px, py, ox, oy, scale) {
  // Normalised coords relative to glyph origin
  const x = (px - ox) / scale;
  const y = (py - oy) / scale;

  let minD = 1e9;
  const segs = GLYPHS[ch];
  if (!segs) return minD;
  for (const [x1, y1, x2, y2] of segs) {
    minD = Math.min(minD, distToSegment(x, y, x1, y1, x2, y2));
  }
  return minD * scale; // back to pixel space
}

// Glyph definitions – coordinates in a 0-1 unit box (origin top-left)
// Each glyph is an array of [x1,y1, x2,y2] line segments.
const GLYPHS = {
  R: [
    // Vertical stem
    [0, 0,   0, 1],
    // Top horizontal
    [0, 0,   0.55, 0],
    // Right curve top (approximated with segments)
    [0.55, 0,  0.7, 0.08],
    [0.7, 0.08, 0.75, 0.2],
    [0.75, 0.2, 0.7, 0.33],
    [0.7, 0.33, 0.55, 0.42],
    // Middle horizontal
    [0, 0.42,  0.55, 0.42],
    // Diagonal leg
    [0.45, 0.42, 0.78, 1],
  ],
  L: [
    // Vertical stem
    [0, 0,   0, 1],
    // Bottom horizontal
    [0, 1,   0.65, 1],
  ],
};

// ── Pixel buffer (RGBA) ─────────────────────────────────────────────────────
const pixels = Buffer.alloc(W * H * 4);

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  pixels[i]     = clamp(Math.round(r), 0, 255);
  pixels[i + 1] = clamp(Math.round(g), 0, 255);
  pixels[i + 2] = clamp(Math.round(b), 0, 255);
  pixels[i + 3] = clamp(Math.round(a), 0, 255);
}

// ── Render ──────────────────────────────────────────────────────────────────
const RADIUS = 48; // corner radius for the rounded square
const HALF   = W / 2;
const MARGIN = 6;  // transparent margin around the icon

// Text layout
const GLYPH_H = 80;
const R_W = GLYPH_H * 0.78;
const L_W = GLYPH_H * 0.65;
const KERNING = 8;
const TEXT_W = R_W + KERNING + L_W;
const TEXT_X = (W - TEXT_W) / 2;
const TEXT_Y = (H - GLYPH_H) / 2 + 8; // nudge down slightly for visual centering with accent

// Accent: a small "lens" arc above the text + subtle chart bars below
const LENS_CX = W / 2;
const LENS_CY = TEXT_Y - 22;
const LENS_R  = 32;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // --- Background rounded rect with gradient ---
    const d = sdRoundedRect(x, y, HALF, HALF, HALF - MARGIN, HALF - MARGIN, RADIUS);

    if (d > 1.5) {
      // Outside the icon shape – transparent
      setPixel(x, y, 0, 0, 0, 0);
      continue;
    }

    // Vertical gradient
    const t = y / H;
    let [cr, cg, cb] = lerpColor(BG_TOP, BG_BOT, t);

    // Subtle radial highlight in upper-left quadrant
    const hlDist = Math.sqrt((x - W * 0.35) ** 2 + (y - H * 0.3) ** 2);
    const hlT = clamp(1 - hlDist / (W * 0.5), 0, 1);
    cr += hlT * 18;
    cg += hlT * 28;
    cb += hlT * 40;

    // --- Geometric accent: lens arc ---
    const arcDist = Math.abs(Math.sqrt((x - LENS_CX) ** 2 + (y - LENS_CY) ** 2) - LENS_R);
    // Only draw the bottom half of the arc (y >= LENS_CY) for a "lens" look
    const inArcZone = y >= LENS_CY - 4 && y <= LENS_CY + LENS_R * 0.55;
    if (inArcZone && arcDist < 3.0) {
      const arcAlpha = clamp(1 - arcDist / 3.0, 0, 1) * 0.55;
      cr = lerp(cr, ACCENT[0], arcAlpha);
      cg = lerp(cg, ACCENT[1], arcAlpha);
      cb = lerp(cb, ACCENT[2], arcAlpha);
    }

    // --- Geometric accent: small chart bars at bottom ---
    const barBaseY = TEXT_Y + GLYPH_H + 18;
    const barW = 5;
    const barGap = 8;
    const barHeights = [14, 22, 18, 28, 20];
    const barsTotal = barHeights.length * barW + (barHeights.length - 1) * barGap;
    const barStartX = (W - barsTotal) / 2;

    for (let bi = 0; bi < barHeights.length; bi++) {
      const bx = barStartX + bi * (barW + barGap);
      const bh = barHeights[bi];
      const by = barBaseY - bh;
      if (x >= bx && x < bx + barW && y >= by && y < barBaseY) {
        const barColor = bi % 2 === 0 ? ACCENT : ORANGE;
        const barAlpha = 0.45;
        cr = lerp(cr, barColor[0], barAlpha);
        cg = lerp(cg, barColor[1], barAlpha);
        cb = lerp(cb, barColor[2], barAlpha);
      }
    }

    // --- "RL" text ---
    const dR = distToChar('R', x, y, TEXT_X, TEXT_Y, GLYPH_H);
    const dL = distToChar('L', x, y, TEXT_X + R_W + KERNING, TEXT_Y, GLYPH_H);
    const STROKE = 7.5; // half-stroke width

    // R glyph
    if (dR < STROKE + 1.5) {
      const alpha = clamp(1 - (dR - STROKE) / 1.5, 0, 1);
      // Slight gradient on R: white at top, light-blue at bottom
      const glyphT = clamp((y - TEXT_Y) / GLYPH_H, 0, 1);
      const rCol = lerpColor(WHITE, ACCENT, glyphT * 0.35);
      cr = lerp(cr, rCol[0], alpha);
      cg = lerp(cg, rCol[1], alpha);
      cb = lerp(cb, rCol[2], alpha);
    }

    // L glyph
    if (dL < STROKE + 1.5) {
      const alpha = clamp(1 - (dL - STROKE) / 1.5, 0, 1);
      const glyphT = clamp((y - TEXT_Y) / GLYPH_H, 0, 1);
      const lCol = lerpColor(WHITE, ACCENT, glyphT * 0.35);
      cr = lerp(cr, lCol[0], alpha);
      cg = lerp(cg, lCol[1], alpha);
      cb = lerp(cb, lCol[2], alpha);
    }

    // Anti-aliased edge of the rounded rect
    let alpha = 255;
    if (d > -1.5) {
      alpha = clamp((1.5 - d) / 1.5, 0, 1) * 255;
    }

    setPixel(x, y, cr, cg, cb, alpha);
  }
}

// ── Encode PNG (minimal valid PNG) ──────────────────────────────────────────
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePNG(w, h, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT – raw image data with filter byte (0 = None) per row
  const rowLen = w * 4 + 1;
  const raw = Buffer.alloc(rowLen * h);
  for (let y = 0; y < h; y++) {
    raw[y * rowLen] = 0; // filter: None
    rgba.copy(raw, y * rowLen + 1, y * w * 4, (y + 1) * w * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', iend),
  ]);
}

const png = encodePNG(W, H, pixels);
const outDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'icon.png');
fs.writeFileSync(outPath, png);
console.log(`Icon written to ${outPath} (${png.length} bytes)`);
