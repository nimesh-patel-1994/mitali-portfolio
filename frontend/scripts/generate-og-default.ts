/**
 * Generates `public/og-default.png` (1200 x 630), the default Open Graph image (UI-004) when a page has no cover,
 * thumbnail or portrait. Original artwork: the deepest background with a rotated green tape band (DES-010,
 * DES-040 colours, copied from docs/design-brief.md). Uses only Node's zlib; run with `tsx scripts/generate-og-default.ts`.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const WIDTH = 1200;
const HEIGHT = 630;
const BG = [0x03, 0x05, 0x00] as const; // --color-bg-deepest
const TAPE = [0x70, 0xff, 0x00] as const; // --color-primary
const ANGLE = (-4 * Math.PI) / 180; // --tape-rotate

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function isTape(x: number, y: number): boolean {
  // Band centred at (600, 315), 760 x 150, rotated by --tape-rotate.
  const dx = x - 600;
  const dy = y - 315;
  const rx = dx * Math.cos(-ANGLE) - dy * Math.sin(-ANGLE);
  const ry = dx * Math.sin(-ANGLE) + dy * Math.cos(-ANGLE);
  return Math.abs(rx) <= 380 && Math.abs(ry) <= 75;
}

export function generateOgDefault(): Buffer {
  const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    const row = y * (WIDTH * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < WIDTH; x += 1) {
      const [r, g, b] = isTape(x, y) ? TAPE : BG;
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = fileURLToPath(new URL("../public/og-default.png", import.meta.url));
writeFileSync(out, generateOgDefault());
console.log(`wrote ${out}`);
