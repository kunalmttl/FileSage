import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const assets = [
  {
    from: "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
    to: "public/pdf.worker.min.mjs",
  },
  {
    from: "node_modules/@wllama/wllama/esm/wasm/wllama.wasm",
    to: "public/wllama/wllama.wasm",
  },
];

for (const asset of assets) {
  mkdirSync(dirname(asset.to), { recursive: true });
  copyFileSync(asset.from, asset.to);
}
