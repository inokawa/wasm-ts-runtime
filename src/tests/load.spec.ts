import { promises as fs } from "fs";
import { it, expect } from "@jest/globals";
import { WasmBuffer, WasmModule } from "../wasm";

it("load module.wat", async () => {
  const code = await fs.readFile("data/module.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule(wasmBuffer);
  expect(new Uint8Array([0x00, 0x61, 0x73, 0x6d])).toEqual(wasmModule.magic);
  expect(new Uint8Array([0x01, 0x00, 0x00, 0x00])).toEqual(wasmModule.version);
});

it("load const.wat", async () => {
  const code = await fs.readFile("data/const.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule(wasmBuffer);
  expect(wasmModule.sections.length).toBe(3);
});

it("load local.wat", async () => {
  const code = await fs.readFile("data/local.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule(wasmBuffer);
  expect(wasmModule.sections.length).toBe(3);
});

it("load add.wat", async () => {
  const code = await fs.readFile("data/add.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule(wasmBuffer);
  expect(wasmModule.sections.length).toBe(4);
});
