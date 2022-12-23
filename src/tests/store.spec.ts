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

it("store const.wasm", async () => {
  const code = await fs.readFile("data/const.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule(wasmBuffer);
  const newCode = new Uint8Array(wasmBuffer.byteLength);
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer);
  expect(new Uint8Array(code)).toEqual(newCode);
});

it("store local.wasm", async () => {
  const code = await fs.readFile("data/local.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule(wasmBuffer);
  const newCode = new Uint8Array(wasmBuffer.byteLength);
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer);
  expect(new Uint8Array(code)).toEqual(newCode);
});

it("store add.wasm", async () => {
  const code = await fs.readFile("data/add.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule(wasmBuffer);
  const newCode = new Uint8Array(wasmBuffer.byteLength);
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer);
  expect(new Uint8Array(code)).toEqual(newCode);
});

it("store if.wasm", async () => {
  const code = await fs.readFile("data/if.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule(wasmBuffer);
  const newCode = new Uint8Array(wasmBuffer.byteLength);
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer);
  expect(new Uint8Array(code)).toEqual(newCode);
});

it("store loop.wasm", async () => {
  const code = await fs.readFile("data/loop.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule(wasmBuffer);
  const newCode = new Uint8Array(wasmBuffer.byteLength);
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer);
  expect(new Uint8Array(code)).toEqual(newCode);
});
