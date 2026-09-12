// Minimal PNG encoder (8-bit RGB, no dependencies beyond node:zlib) for seed post
// images. Deterministic: the same spec always produces the same bytes.
import { deflateSync } from "node:zlib";

type RGB = readonly [number, number, number];

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const encodePng = (width: number, height: number, pixel: (x: number, y: number) => RGB) => {
  const stride = width * 3 + 1; // leading filter byte (0 = none) per row
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * stride + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const hsl = (h: number, s: number, l: number): RGB => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

export type PostImageSpec = { hueA: number; hueB: number; style: number };

/** A square placeholder: diagonal wash, stage spotlight, or striped poster. */
export const postImage = ({ hueA, hueB, style }: PostImageSpec, size = 512) => {
  const light = hsl(hueA, 0.65, 0.55);
  const dark = hsl(hueB, 0.55, 0.18);
  return encodePng(size, size, (x, y) => {
    const u = x / size;
    const v = y / size;
    if (style === 0) return mix(light, dark, (u + v) / 2);
    if (style === 1) return mix(light, dark, Math.min(1, Math.hypot(u - 0.5, v - 0.3) / 0.8));
    const stripe = Math.floor(v * 6) % 2 === 0 ? 0 : 0.15;
    return mix(light, dark, Math.min(1, v + stripe));
  });
};
