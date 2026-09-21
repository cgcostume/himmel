#!/usr/bin/env node
// Dev script: converts src/data/brightstars.csv into the binary asset
// consumed at runtime (src/data/brightstars.bin), a flat little-endian
// Float32Array, matching the original C++ `float` precision. Not part of
// the published package's runtime. Run via `pnpm generate:catalog`
// whenever brightstars.csv changes.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const inPath = new URL("../src/data/brightstars.csv", import.meta.url);
const outPath = new URL("../src/data/brightstars.bin", import.meta.url);

const lines = readFileSync(inPath, "utf8").trim().split("\n");
const [header, ...rows] = lines;
const columns = header.split(",").length;

const values = new Float32Array(rows.length * columns);
for (let i = 0; i < rows.length; i++) {
    const parts = rows[i].split(",").map(Number);
    if (parts.length !== columns || parts.some(Number.isNaN)) {
        throw new Error(`Row ${i} did not parse into ${columns} numbers: "${rows[i]}"`);
    }
    values.set(parts, i * columns);
}

writeFileSync(outPath, Buffer.from(values.buffer));

console.log(
    `Wrote ${rows.length} stars x ${columns} fields (${values.byteLength.toLocaleString()} bytes) to ${fileURLToPath(outPath)}`,
);
