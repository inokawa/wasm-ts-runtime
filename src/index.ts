import { program } from "commander";

import { promises as fs } from "fs";
import { WasmModule } from "./wasm";
import pkg from "../package.json";

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .argument("<file-path>", "file path")
  .parse();

const filename = program.args[0];

if (filename) {
  const code = await fs.readFile(filename);
  const wasmModule = new WasmModule(code);
  console.log(JSON.stringify(wasmModule, null, "  "));
} else {
  console.error("no filename");
  process.exitCode = 1;
}
