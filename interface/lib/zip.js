"use strict";
// Gera um arquivo .zip pelo metodo "store" (sem compressao) — zero dependencias.
// Suficiente porque PNG/MP4/JPEG ja sao formatos comprimidos: deflate quase nao reduziria.
// Monta os headers do formato ZIP (APPNOTE) a mao: local headers + central directory + EOCD.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Converte um Date para os campos data/hora no formato MS-DOS usado pelo ZIP.
function dosDateTime(d) {
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
  const year = Math.max(1980, d.getFullYear());
  const date = (((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  return { time, date };
}

// files: [{ name: "slides/slide_1.png", buffer: Buffer, mtime?: Date }]
function zipStore(files, when) {
  const fallback = when || new Date();
  const parts = [];   // corpo (local headers + dados)
  const central = []; // registros do diretorio central
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8");
    const data = f.buffer;
    const crc = crc32(data);
    const { time, date } = dosDateTime(f.mtime || fallback);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);      // assinatura local file header
    lfh.writeUInt16LE(20, 4);              // versao necessaria (2.0)
    lfh.writeUInt16LE(0x0800, 6);          // flags: bit 11 = nome em UTF-8
    lfh.writeUInt16LE(0, 8);               // metodo 0 = store
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(data.length, 18);    // tamanho comprimido
    lfh.writeUInt32LE(data.length, 22);    // tamanho original
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);              // extra field len
    parts.push(lfh, nameBuf, data);

    const cdr = Buffer.alloc(46);
    cdr.writeUInt32LE(0x02014b50, 0);      // assinatura central directory
    cdr.writeUInt16LE(20, 4);              // version made by
    cdr.writeUInt16LE(20, 6);              // version needed
    cdr.writeUInt16LE(0x0800, 8);          // flags UTF-8
    cdr.writeUInt16LE(0, 10);              // metodo store
    cdr.writeUInt16LE(time, 12);
    cdr.writeUInt16LE(date, 14);
    cdr.writeUInt32LE(crc, 16);
    cdr.writeUInt32LE(data.length, 20);
    cdr.writeUInt32LE(data.length, 24);
    cdr.writeUInt16LE(nameBuf.length, 28);
    cdr.writeUInt16LE(0, 30);              // extra len
    cdr.writeUInt16LE(0, 32);              // comment len
    cdr.writeUInt16LE(0, 34);              // disk number start
    cdr.writeUInt16LE(0, 36);              // internal attrs
    cdr.writeUInt32LE(0, 38);              // external attrs
    cdr.writeUInt32LE(offset, 42);         // offset do local header
    central.push(cdr, nameBuf);

    offset += lfh.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);       // End Of Central Directory
  eocd.writeUInt16LE(0, 4);                // disco
  eocd.writeUInt16LE(0, 6);                // disco onde comeca o CD
  eocd.writeUInt16LE(files.length, 8);     // entradas neste disco
  eocd.writeUInt16LE(files.length, 10);    // entradas totais
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);          // offset do inicio do CD
  eocd.writeUInt16LE(0, 20);               // tamanho do comentario

  return Buffer.concat(parts.concat([centralBuf, eocd]));
}

module.exports = { zipStore, crc32 };
