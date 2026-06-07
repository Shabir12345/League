/* Generates Clash HQ PWA icons (no dependencies).
   Brand: gold diamond ring on the dark background, echoing the site's diamond motif.
   Run: node scripts/gen-icons.js */
const fs = require('fs');
const zlib = require('zlib');

// CRC32
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td), 0);
  return Buffer.concat([len, td, crc]);
}

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex('#080b14'), GOLD = hex('#c8aa6e'), GOLDB = hex('#f0e6d2');

function png(size, pad) {
  const cx = size / 2, cy = size / 2;
  const rOut = size * (0.5 - pad);          // outer diamond radius
  const rIn = rOut * 0.62;                   // inner cutout
  const rCore = rOut * 0.22;                 // solid centre
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const d = Math.abs(x + 0.5 - cx) + Math.abs(y + 0.5 - cy); // diamond metric
      let col = BG;
      if (d <= rCore) col = GOLDB;
      else if (d <= rIn) col = BG;
      else if (d <= rOut) col = GOLD;
      raw[p++] = col[0]; raw[p++] = col[1]; raw[p++] = col[2]; raw[p++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

fs.mkdirSync('icons', { recursive: true });
fs.writeFileSync('icons/icon-192.png', png(192, 0.16));
fs.writeFileSync('icons/icon-512.png', png(512, 0.16));
fs.writeFileSync('icons/icon-maskable-512.png', png(512, 0.26)); // extra padding for safe zone
console.log('Icons written: icons/icon-192.png, icon-512.png, icon-maskable-512.png');
