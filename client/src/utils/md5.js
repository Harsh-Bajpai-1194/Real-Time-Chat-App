const md5 = (string) => {
    const utf8 = unescape(encodeURIComponent(string));
    let h0 = 0x67452301;
    let h1 = 0xefcdab89;
    let h2 = 0x98badcfe;
    let h3 = 0x10325476;
  
    const leftRotate = (x, c) => (x << c) | (x >>> (32 - c));
  
    const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));
    const r = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  
    const bytes = [];
    for (let i = 0; i < utf8.length; i++) {
      bytes.push(utf8.charCodeAt(i));
    }
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0x00);
    for (let i = 0; i < 8; i++) {
      bytes.push((bitLen >>> (8 * i)) & 0xff);
    }
  
    const words = [];
    for (let i = 0; i < bytes.length; i += 4) {
      words.push(bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24));
    }
  
    for (let i = 0; i < words.length; i += 16) {
      const oldH0 = h0, oldH1 = h1, oldH2 = h2, oldH3 = h3;
  
      for (let j = 0; j < 64; j++) {
        let f, g;
        if (j < 16) { f = (h1 & h2) | (~h1 & h3); g = j; }
        else if (j < 32) { f = (h3 & h1) | (~h3 & h2); g = (5 * j + 1) % 16; }
        else if (j < 48) { f = h1 ^ h2 ^ h3; g = (3 * j + 5) % 16; }
        else { f = h2 ^ (h1 | ~h3); g = (7 * j) % 16; }
        const temp = h3; h3 = h2; h2 = h1;
        h1 = h1 + leftRotate((h0 + f + k[j] + words[i + g]) >>> 0, r[j]);
        h1 >>>= 0; h0 = temp;
      }
  
      h0 = (h0 + oldH0) >>> 0; h1 = (h1 + oldH1) >>> 0; h2 = (h2 + oldH2) >>> 0; h3 = (h3 + oldH3) >>> 0;
    }
  
    const toHex = (num) => num.toString(16).padStart(8, '0');
    return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3);
};

export default md5;