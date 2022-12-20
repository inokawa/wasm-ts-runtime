import type { Buffer } from "./buffer";

export class ModuleNode {
  magic: Uint8Array;
  version: Uint8Array;

  constructor(buffer: Buffer) {
    this.magic = buffer.readBytes(4);
    this.version = buffer.readBytes(4);
  }
}
