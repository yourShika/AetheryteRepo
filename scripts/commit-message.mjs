#!/usr/bin/env node
/**
 * Baut die Commit-Message fuer die update-Action. Gibt Betreff auf Zeile 1 aus,
 * danach eine Leerzeile und den Body.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stats = JSON.parse(await readFile(path.join(ROOT, "repos", "index.json"), "utf8"));

const bad = stats.sources.filter((s) => s.status !== "ok");
const subject =
  `chore: ${stats.masterPlugins} Plugins im Master, ${stats.totalPlugins} gesamt` +
  (bad.length ? ` (${bad.length} Quelle(n) nicht frisch)` : "");

const body = [
  `Quellen: ${stats.sources.length}`,
  `Kategorien: ${stats.categories.filter((c) => c.count > 0).map((c) => `${c.name} ${c.count}`).join(", ")}`,
  bad.length ? `Nicht frisch: ${bad.map((s) => `${s.name} [${s.status}]`).join(", ")}` : "",
  "",
  "Automatisch erzeugt von scripts/aggregate.mjs",
]
  .filter(Boolean)
  .join("\n");

process.stdout.write(`${subject}\n\n${body}\n`);
