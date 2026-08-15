#!/usr/bin/env node
/**
 * Entscheidet, ob sich ein Commit lohnt.
 *
 *   node scripts/should-commit.mjs <alte-index.json>
 *
 * Exit 0  -> committen (Inhalt hat sich geaendert, oder der letzte Commit ist
 *            aelter als MAX_AGE_HOURS, damit generatedAt nicht ewig veraltet)
 * Exit 1  -> ueberspringen
 *
 * Verglichen wird die contentHash aus repos/index.json. Sie ignoriert
 * DownloadCount/LastUpdate, damit hochzaehlende Zaehler keine Commits ausloesen.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_AGE_HOURS = 24;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const oldPath = process.argv[2];

const next = JSON.parse(await readFile(path.join(ROOT, "repos", "index.json"), "utf8"));

let prev = null;
if (oldPath) {
  try {
    prev = JSON.parse(await readFile(oldPath, "utf8"));
  } catch {
    /* erster Lauf, kein Vorgaenger */
  }
}

if (!prev) {
  console.log("commit: kein vorheriger Stand");
  process.exit(0);
}

if (prev.contentHash !== next.contentHash) {
  const delta = next.totalPlugins - (prev.totalPlugins ?? next.totalPlugins);
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  console.log(`commit: Inhalt geaendert (${prev.contentHash} -> ${next.contentHash}, ${sign} Plugins)`);
  process.exit(0);
}

const ageH = (Date.now() - Date.parse(prev.generatedAt)) / 3_600_000;
if (!Number.isFinite(ageH) || ageH >= MAX_AGE_HOURS) {
  console.log(`commit: Auffrischung, letzter Stand ist ${Math.round(ageH)} h alt`);
  process.exit(0);
}

console.log(`ueberspringen: unveraendert (${next.contentHash}), letzter Stand ${Math.round(ageH)} h alt`);
process.exit(1);
