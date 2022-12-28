import { program } from "commander";

import { promises as fs } from "fs";
import { WasmBuffer, WasmModule } from "./wasm";
import pkg from "../package.json";

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .argument("<file-path>", "file path")
  .option("-s", "save")
  .parse();

const filename = program.args[0];
const { s } = program.opts();

(async () => {
  if (filename) {
    const code = await fs.readFile(filename);
    const wasmBuffer = new WasmBuffer(code);
    const wasmModule = new WasmModule(wasmBuffer);

    if (!s) {
      console.log(JSON.stringify(wasmModule, null, "  "));
    } else {
      const u8s = new Uint8Array(code.byteLength);
      const outBuffer = new WasmBuffer(u8s);
      wasmModule.store(outBuffer);
      await fs.writeFile("out.wasm", new Uint8Array(outBuffer.buffer));
    }
  } else {
    console.error("no filename");
    process.exitCode = 1;
  }
})();
