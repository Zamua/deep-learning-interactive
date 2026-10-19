import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
export function scatterPNG(path: string, sets: { pts: Float32Array; rgb: [number, number, number] }[], W = 400, H = 300, dom = [-2.5, 2.5, -1.9, 1.9]) {
  const img = new Uint8Array(W * H * 3).fill(255);
  for (const { pts, rgb } of sets) {
    for (let i = 0; i < pts.length / 2; i++) {
      const px = Math.round(((pts[2 * i]! - dom[0]!) / (dom[1]! - dom[0]!)) * W);
      const py = Math.round(((dom[3]! - pts[2 * i + 1]!) / (dom[3]! - dom[2]!)) * H);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const x = px + dx, y = py + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const o = (y * W + x) * 3;
        img[o] = rgb[0]; img[o + 1] = rgb[1]; img[o + 2] = rgb[2];
      }
    }
  }
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
