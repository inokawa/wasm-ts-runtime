import { promises as fs } from "fs";
import { it, expect } from "@jest/globals";
import { WasmBuffer, WasmModule } from "../wasm";

it("store module.wasm", async () => {
  const code = await fs.readFile("data/module.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule(wasmBuffer);
  const newCode = new Uint8Array(wasmBuffer.byteLength);
  const storeBuffer = new WasmBuffer(newCode);
  wasmModule.store(storeBuffer);
  expect(new Uint8Array(code)).toEqual(newCode);
});
