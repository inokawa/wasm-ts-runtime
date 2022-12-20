export class Buffer {
  #cursor = 0;
  #buffer: ArrayBuffer;

  constructor({ buffer }: { buffer: ArrayBuffer }) {
    this.#buffer = buffer;
  }

  readBytes(size: number): Uint8Array {
    const nextCursor = this.#cursor + size;
    if (this.#buffer.byteLength < nextCursor) {
      return new Uint8Array(0);
    }

    const slice = this.#buffer.slice(this.#cursor, nextCursor);
    this.#cursor = nextCursor;
    return new Uint8Array(slice);
  }
}
