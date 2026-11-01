// Dominant-colour extraction from RGBA pixel data (used on a downscaled logo in the browser).

const toHex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

/**
 * Buckets pixels into a 4-bit-per-channel grid and returns the most common colours,
 * skipping transparent, near-white, near-black and grey pixels (backgrounds/outlines).
 */
export function dominantColors(rgba: ArrayLike<number>, count = 4): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i],
      g = rgba[i + 1],
      b = rgba[i + 2],
      a = rgba[i + 3];
    if (a < 128) continue;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    if (max > 240 && min > 230) continue; // white
    if (max < 25) continue; // black
    if (max - min < 20) continue; // grey
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .sort((x, y) => y.n - x.n)
    .slice(0, count)
    .map((x) => toHex(Math.round(x.r / x.n), Math.round(x.g / x.n), Math.round(x.b / x.n)));
}
