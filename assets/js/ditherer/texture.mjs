// Shared by the image ditherer and the fireplace.
export function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function fract(value) {
  return value - Math.floor(value);
}

export function ign(x, y) {
  return fract(52.9829189 * fract(0.06711056 * x + 0.00583715 * y));
}

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function bayer(x, y) {
  return (BAYER_4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

export function paletteIndex(value, size, threshold) {
  const scaled = Math.max(0, Math.min(1, value)) * (size - 1);
  const lower = Math.floor(scaled);
  return Math.min(size - 1, lower + (scaled - lower > threshold ? 1 : 0));
}
