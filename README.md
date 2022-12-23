# wasm-ts-runtime

A toy WebAssembly runtime implementation with TypeScript.

This follows https://github.com/technohippy/makewasm but using Node.js instead of Deno.

## Setup

```sh
git clone git@github.com:inokawa/wasm-ts-runtime.git
npm install
```

### Load

```
npm start -- data/xxxx.wasm
```

### Save

```
npm start -- data/xxxx.wasm -s
```
