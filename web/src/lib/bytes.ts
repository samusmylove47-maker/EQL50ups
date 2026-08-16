/**
 * Minimal byte writer/reader for the share codec.
 *
 * Every read is bounds-checked and throws, because the input is a URL a
 * stranger pasted and a truncated link must fail as `null` rather than hang or
 * return half a plan. The codec catches; nothing here is allowed to guess.
 */

export class ByteWriter {
  private bytes: number[] = [];

  get length(): number {
    return this.bytes.length;
  }

  u8(value: number): void {
    this.bytes.push(value & 0xff);
  }

  /** LEB128 unsigned varint. */
  varint(value: number): void {
    let v = Math.max(0, Math.trunc(value));
    do {
      const byte = v & 0x7f;
      v = Math.floor(v / 128);
      this.bytes.push(v > 0 ? byte | 0x80 : byte);
    } while (v > 0);
  }

  /** Zig-zag then varint, so small negatives stay one byte. */
  signed(value: number): void {
    const v = Math.trunc(value);
    this.varint(v < 0 ? -2 * v - 1 : 2 * v);
  }

  raw(bytes: Uint8Array): void {
    for (const b of bytes) this.bytes.push(b);
  }

  /** Length-prefixed UTF-8. */
  str(text: string): void {
    const encoded = new TextEncoder().encode(text);
    this.varint(encoded.length);
    this.raw(encoded);
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

export class ByteReader {
  private at = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get done(): boolean {
    return this.at >= this.bytes.length;
  }

  get remaining(): number {
    return this.bytes.length - this.at;
  }

  u8(): number {
    if (this.at >= this.bytes.length) throw new Error('truncated');
    return this.bytes[this.at++] as number;
  }

  varint(): number {
    let result = 0;
    let shift = 1;
    // Ten bytes is already past the safe-integer range; anything longer is a
    // corrupt payload rather than a very large number.
    for (let i = 0; i < 10; i++) {
      const byte = this.u8();
      result += (byte & 0x7f) * shift;
      if ((byte & 0x80) === 0) {
        if (!Number.isSafeInteger(result)) throw new Error('varint overflow');
        return result;
      }
      shift *= 128;
    }
    throw new Error('varint overflow');
  }

  signed(): number {
    const v = this.varint();
    return v % 2 === 0 ? v / 2 : -(v + 1) / 2;
  }

  raw(length: number): Uint8Array {
    if (length < 0 || this.at + length > this.bytes.length) throw new Error('truncated');
    const out = this.bytes.subarray(this.at, this.at + length);
    this.at += length;
    return out;
  }

  str(): string {
    return new TextDecoder().decode(this.raw(this.varint()));
  }
}
