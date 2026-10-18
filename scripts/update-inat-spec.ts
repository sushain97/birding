#!/usr/bin/env -S npx tsx

import { writeFile } from "node:fs/promises";
import path from "node:path";

const SPECS = [
  {
    url: "https://api.inaturalist.org/v1/swagger.json",
    filename: "inat-swagger.json",
  },
  {
    url: "https://api.inaturalist.org/v2/api-docs",
    filename: "inat-v2-openapi.json",
  },
];

async function main() {
  for (const { url, filename } of SPECS) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
      );
    }
    const spec: unknown = await response.json();
    const outputPath = path.join(import.meta.dirname, "..", "data", filename);
    await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`);
    console.log(`Wrote ${outputPath}`);
  }
}

void main();
