#!/usr/bin/env node
/**
 * Prueft data/sources.json und data/overrides.json auf Fehler, die erst im
 * Produktivlauf auffallen wuerden. Laeuft in der validate-Action bei jedem PR.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORY_IDS } from "./lib/categories.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];

const cfg = JSON.parse(await readFile(path.join(ROOT, "data", "sources.json"), "utf8"));
const overrides = JSON.parse(await readFile(path.join(ROOT, "data", "overrides.json"), "utf8"));

if (!Array.isArray(cfg.sources)) errors.push("sources.json: 'sources' ist kein Array");

const seenIds = new Set();
const seenUrls = new Set();

for (const [i, s] of (cfg.sources || []).entries()) {
  const where = `sources[${i}] (${s?.id || s?.name || "?"})`;

  if (!s.id) errors.push(`${where}: 'id' fehlt`);
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id)) errors.push(`${where}: 'id' nur klein, a-z0-9 und '-'`);
  else if (seenIds.has(s.id)) errors.push(`${where}: doppelte id '${s.id}'`);
  else seenIds.add(s.id);

  if (!s.name) errors.push(`${where}: 'name' fehlt`);

  if (!s.url) {
    errors.push(`${where}: 'url' fehlt`);
  } else {
    if (!/^https:\/\//i.test(s.url)) errors.push(`${where}: 'url' muss https sein`);
    const key = s.url.replace(/\/+$/, "").toLowerCase();
    if (seenUrls.has(key)) errors.push(`${where}: doppelte url '${s.url}'`);
    else seenUrls.add(key);

    if (/^https:\/\/github\.com\//i.test(s.url) && !/\/raw\//.test(s.url)) {
      errors.push(`${where}: zeigt auf die GitHub-Projektseite, nicht auf die rohe JSON`);
    }
  }

  if (s.category && !CATEGORY_IDS.includes(s.category)) {
    errors.push(`${where}: unbekannte Kategorie '${s.category}' (erlaubt: ${CATEGORY_IDS.join(", ")})`);
  }
  if (s.priority != null && (typeof s.priority !== "number" || s.priority < 0)) {
    errors.push(`${where}: 'priority' muss eine Zahl >= 0 sein`);
  }
  if (s.enabled === false) warnings.push(`${where}: deaktiviert`);
}

for (const [key, cat] of Object.entries(overrides.categories || {})) {
  if (!CATEGORY_IDS.includes(cat)) errors.push(`overrides.categories["${key}"]: unbekannte Kategorie '${cat}'`);
  if (key !== key.toLowerCase()) errors.push(`overrides.categories["${key}"]: Key muss klein geschrieben sein`);
}
if (overrides.blocklist && !Array.isArray(overrides.blocklist)) {
  errors.push("overrides.blocklist muss ein Array sein");
}

for (const w of warnings) console.log(`  hinweis: ${w}`);

if (errors.length) {
  console.error(`\n${errors.length} Fehler:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`OK – ${cfg.sources.length} Quellen, ${Object.keys(overrides.categories || {}).length} Overrides, keine Fehler.`);
