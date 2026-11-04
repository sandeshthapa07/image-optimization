/**
 * image-header.mjs - read image dimensions from the first bytes of a file. No dependencies.
 * Used by image-size.mjs and check-social-meta.mjs.
 *
 * sizeFromBuffer(buf, nameOrExt?) -> { format, width, height, storedWidth, storedHeight, swapped, note } | null
 * Formats: JPEG (EXIF orientation), PNG, GIF, WebP, AVIF/HEIC (irot), SVG, BMP.
 */

function exifOrientation(buf, tiff, end) {
  if (tiff + 8 > end) return null;
  const order = buf.toString('latin1', tiff, tiff + 2);
  const le = order === 'II';
  if (!le && order !== 'MM') return null;
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return null;
  const count = u16(ifd);
  for (let k = 0; k < count; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > end) break;
    if (u16(e) === 0x0112) return u16(e + 8);
  }
  return null;
}

function jpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let i = 2;
  let orientation = 1;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; } // fill byte
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) break; // end of image / start of scan
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xe1 && buf.toString('latin1', i + 4, i + 10) === 'Exif\0\0') {
      orientation = exifOrientation(buf, i + 10, Math.min(buf.length, i + 2 + len)) ?? orientation;
    }
    if (SOF.has(marker) && i + 9 <= buf.length) {
      return { format: 'jpeg', width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), orientation };
    }
    i += 2 + len;
  }
  return null;
}

function png(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function gif(buf) {
  if (buf.length < 10 || !/^GIF8[79]a$/.test(buf.toString('latin1', 0, 6))) return null;
  return { format: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function webp(buf) {
  if (buf.length < 30 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('latin1', 12, 16);
  if (chunk === 'VP8 ') return { format: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
    return { format: 'webp', width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
  }
  if (chunk === 'VP8X') return { format: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  return null;
}

function heif(buf) {
  if (buf.length < 16 || buf.toString('latin1', 4, 8) !== 'ftyp') return null;
  const brand = buf.toString('latin1', 8, 12);
  let format = null;
  if (/^avi[fs]$/.test(brand)) format = 'avif';
  else if (/^(heic|heix|hevc|hevx)$/.test(brand)) format = 'heic';
  else if (/^(mif1|msf1)$/.test(brand)) format = 'heif/avif';
  if (!format) return null;
  let best = null;
  for (let idx = buf.indexOf('ispe'); idx !== -1 && idx + 16 <= buf.length; idx = buf.indexOf('ispe', idx + 4)) {
    const width = buf.readUInt32BE(idx + 8), height = buf.readUInt32BE(idx + 12);
    if (!best || width * height > best.width * best.height) best = { width, height };
  }
  if (!best) return null;
  const irot = buf.indexOf('irot');
  const angle = irot !== -1 && irot + 5 <= buf.length ? buf[irot + 4] & 0x3 : 0; // x 90 degrees
  return { format, width: best.width, height: best.height, rotated: angle % 2 === 1 };
}

function bmp(buf) {
  if (buf.length < 26 || buf.toString('latin1', 0, 2) !== 'BM') return null;
  return { format: 'bmp', width: Math.abs(buf.readInt32LE(18)), height: Math.abs(buf.readInt32LE(22)) };
}

function svg(buf) {
  const text = buf.toString('utf8');
  const m = /<svg\b[^>]*>/i.exec(text);
  if (!m) return null;
  const tag = m[0];
  const attr = (n) => { const r = new RegExp(`\\s${n}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag); return r ? r[1].trim() : null; };
  const px = (v) => (v && /^\d+(\.\d+)?(px)?$/.test(v) ? parseFloat(v) : null);
  const vb = attr('viewBox');
  const vbParts = vb ? vb.split(/[\s,]+/).map(Number) : null;
  const w = px(attr('width')), h = px(attr('height'));
  if (w && h) return { format: 'svg', width: w, height: h };
  if (vbParts && vbParts.length === 4 && vbParts[2] > 0 && vbParts[3] > 0) {
    return { format: 'svg', width: vbParts[2], height: vbParts[3], note: 'from viewBox (no absolute width/height): use these numbers for the ratio' };
  }
  return { format: 'svg', width: null, height: null, note: 'no width/height or viewBox: add a viewBox to the SVG' };
}

export function sizeFromBuffer(buf, nameOrExt = '') {
  const isSvgName = /\.svg$|^svg$|image\/svg/i.test(nameOrExt);
  const r = jpeg(buf) || png(buf) || gif(buf) || webp(buf) || heif(buf) || bmp(buf) ||
    (isSvgName || /^\s*(<\?xml[^>]*>\s*)?<svg\b/i.test(buf.subarray(0, 512).toString('utf8')) ? svg(buf) : null);
  if (!r) return null;
  let { width, height } = r;
  const swapped = Boolean((r.orientation && r.orientation >= 5 && r.orientation <= 8) || r.rotated);
  if (swapped) [width, height] = [height, width];
  return { format: r.format, width, height, storedWidth: r.width, storedHeight: r.height, swapped, note: r.note };
}

const COMMON = [[1, 1], [4, 3], [3, 4], [3, 2], [2, 3], [16, 9], [9, 16], [4, 5], [5, 4], [21, 9], [2, 1], [1, 2], [16, 10], [5, 3], [1.91, 1]];
export function ratioLabel(w, h) {
  if (!w || !h) return '?';
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(Math.round(w), Math.round(h));
  const exact = `${Math.round(w) / g}:${Math.round(h) / g}`;
  const r = w / h;
  const near = COMMON.find(([a, b]) => Math.abs(a / b - r) / r < 0.01);
  if (near && exact !== `${near[0]}:${near[1]}`) return `${exact} (~${near[0]}:${near[1]})`;
  return exact.length <= 9 ? exact : `${r.toFixed(3)}:1`;
}
