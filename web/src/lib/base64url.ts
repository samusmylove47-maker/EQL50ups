/**
 * base64url over UTF-8, implemented locally.
 *
 * Hand-rolled rather than leaning on `btoa`/`atob` so that the codec behaves
 * identically in the browser, in Node under Vitest, and for any string the
 * game's item names can throw at it (apostrophes, accents, non-Latin scripts).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const LOOKUP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i] as string] = i;
  // Accept standard base64 punctuation too, so a link mangled by a chat client
  // that "helpfully" re-encodes it still decodes.
  map['+'] = 62;
  map['/'] = 63;
  return map;
})();

export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += ALPHABET[b0 >> 2];
    if (b1 === undefined) {
      out += ALPHABET[(b0 & 0x03) << 4];
      break;
    }
    out += ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    if (b2 === undefined) {
      out += ALPHABET[(b1 & 0x0f) << 2];
      break;
    }
    out += ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)];
    out += ALPHABET[b2 & 0x3f];
  }
  return out;
}

export function base64UrlToBytes(text: string): Uint8Array {
  const clean = text.replace(/[=\s]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = LOOKUP[ch];
    if (v === undefined) throw new Error(`invalid base64url character: ${ch}`);
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

export function encodeText(text: string): string {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

export function decodeText(encoded: string): string {
  return new TextDecoder().decode(base64UrlToBytes(encoded));
}
