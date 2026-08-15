#!/usr/bin/env node
/**
 * Aetheryte Repo – Aggregator
 *
 * Holt alle Quell-Repos aus data/sources.json, normalisiert die Manifeste,
 * entfernt Duplikate, kategorisiert und schreibt:
 *
 *   repos/master.json          alle Plugins (ohne 18+)
 *   repos/master-full.json     alle Plugins INKLUSIVE 18+
 *   repos/<kategorie>.json     ein Feed pro Kategorie
 *   repos/index.json           Metadaten (fuer die Webseite / Debugging)
 *   cache/<source-id>.json     Last-Known-Good pro Quelle
 *   docs/plugins.json          Datensatz fuer die GitHub-Pages-Seite
 *   STATUS.md                  Health-Report
 *
 * Wichtig: faellt eine Quelle aus (404, Timeout, kaputtes JSON), wird der
 * Cache-Stand benutzt statt die Plugins aus dem Master zu werfen. Sonst wuerde
 * ein kurzer GitHub-Ausfall allen Nutzern die Plugins deinstallierbar machen.
 */

import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, CATEGORY_IDS, EXCLUDED_FROM_MASTER, categorize } from "./lib/categories.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (...s) => path.join(ROOT, ...s);

const CONCURRENCY = 6;
const TIMEOUT_MS = 45_000;
const RETRIES = 3;
const UA = "AetheryteRepo/1.0 (+https://github.com/yourShika/AetheryteRepo)";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const OFFLINE = args.has("--offline");

/* ------------------------------------------------------------------ utils */

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn("  !", ...a);

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Felder, die sich staendig aendern, ohne dass sich inhaltlich etwas tut.
 * Sie fliegen aus der Pruefsumme, sonst wuerde die Action alle 3 Stunden
 * committen, nur weil ein Downloadzaehler hochgezaehlt hat.
 */
const VOLATILE = new Set(["DownloadCount", "LastUpdate", "LastUpdated", "TestingLastUpdated"]);

function contentHashOf(plugins) {
  const canonical = plugins.map((p) =>
    Object.keys(p)
      .filter((k) => !VOLATILE.has(k))
      .sort()
      .map((k) => `${k}=${JSON.stringify(p[k])}`)
      .join("")
  );
  canonical.sort();
  return createHash("sha256").update(canonical.join("")).digest("hex").slice(0, 16);
}

/** Semver-artiger Vergleich fuer Dalamud-Versionen ("1.6.1.12"). */
function compareVersions(a, b) {
  const pa = String(a ?? "0").split(/[.\-+]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b ?? "0").split(/[.\-+]/).map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Dalamud schreibt Booleans mal als true, mal als "True" – beides akzeptieren. */
function toBool(v, dflt = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.trim().toLowerCase() === "true";
  if (typeof v === "number") return v !== 0;
  return dflt;
}

async function fetchWithRetry(url) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*" },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      if (!text.trim()) throw new Error("leere Antwort");
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt < RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt * attempt));
      }
    }
  }
  throw lastErr;
}

async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

/* -------------------------------------------------------------- normalize */

/** Manche Feeds liefern ein Array, manche {Plugins:[...]}. */
function extractPluginArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    for (const key of ["Plugins", "plugins", "Manifests", "manifests", "data"]) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    // Einzelnes Manifest ohne Array-Wrapper
    if (parsed.InternalName) return [parsed];
  }
  return null;
}

const LINK_FIELDS = ["DownloadLinkInstall", "DownloadLinkUpdate", "DownloadLinkTesting"];

function absolutize(link, baseUrl) {
  if (!link || typeof link !== "string") return link;
  if (/^https?:\/\//i.test(link)) return link;
  try {
    return new URL(link, baseUrl).href;
  } catch {
    return link;
  }
}

function normalize(raw, source) {
  if (!raw || typeof raw !== "object") return null;

  const internal = String(raw.InternalName || raw.Name || "").trim();
  if (!internal) return null;

  const p = { ...raw };
  p.InternalName = internal;
  p.Name = String(raw.Name || internal).trim();

  for (const f of LINK_FIELDS) {
    if (p[f]) p[f] = absolutize(p[f], source.url);
  }
  // Update faellt auf Install zurueck und umgekehrt – Dalamud braucht beides.
  if (!p.DownloadLinkInstall && p.DownloadLinkUpdate) p.DownloadLinkInstall = p.DownloadLinkUpdate;
  if (!p.DownloadLinkUpdate && p.DownloadLinkInstall) p.DownloadLinkUpdate = p.DownloadLinkInstall;
  if (!p.DownloadLinkInstall) return null; // ohne Download ist der Eintrag wertlos

  p.IsHide = toBool(p.IsHide, false);
  p.IsTestingExclusive = toBool(p.IsTestingExclusive, false);
  p.ApplicableVersion = p.ApplicableVersion || "any";
  p.AssemblyVersion = String(p.AssemblyVersion || p.TestingAssemblyVersion || "0.0.0.0");
  if (typeof p.DalamudApiLevel !== "number") {
    const n = parseInt(p.DalamudApiLevel, 10);
    p.DalamudApiLevel = Number.isFinite(n) ? n : undefined;
  }
  if (Array.isArray(p.Tags)) p.Tags = p.Tags.filter((t) => typeof t === "string");
  else if (p.Tags) p.Tags = [String(p.Tags)];

  // Herkunft mitschreiben. Dalamud ignoriert unbekannte Felder beim Parsen.
  p._SourceId = source.id;
  p._SourceName = source.name;
  p._SourceUrl = source.url;

  return p;
}

/* ------------------------------------------------------------------- main */

async function main() {
  const cfg = await readJson(P("data", "sources.json"));
  if (!cfg?.sources?.length) throw new Error("data/sources.json fehlt oder ist leer");

  const overridesFile = (await readJson(P("data", "overrides.json"), {})) || {};
  const categoryOverrides = Object.fromEntries(
    Object.entries(overridesFile.categories || {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const blocklist = new Set((overridesFile.blocklist || []).map((s) => s.toLowerCase()));

  const sources = cfg.sources.filter((s) => s.enabled !== false);
  log(`Aetheryte Repo – ${sources.length} aktive Quellen\n`);

  /* --- 1. Fetch ---------------------------------------------------- */

  const results = await pool(sources, CONCURRENCY, async (source) => {
    const cacheFile = P("cache", `${source.id}.json`);
    const cached = await readJson(cacheFile);

    if (OFFLINE) {
      if (cached) return { source, plugins: cached.plugins, status: "cache", note: "offline mode" };
      return { source, plugins: [], status: "failed", note: "offline, kein Cache" };
    }

    try {
      const text = await fetchWithRetry(source.url);
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        throw new Error(`kein gueltiges JSON (${e.message})`);
      }
      const arr = extractPluginArray(parsed);
      if (!arr) throw new Error("unbekanntes Feed-Format");

      const plugins = arr.map((r) => normalize(r, source)).filter(Boolean);
      if (plugins.length === 0 && arr.length > 0) {
        throw new Error(`${arr.length} Eintraege, aber keiner brauchbar`);
      }
      // Eine Quelle, die vorher Plugins hatte und jetzt leer antwortet, ist
      // fast immer ein kaputter Deploy und keine Absicht. Cache gewinnt.
      if (plugins.length === 0 && cached?.plugins?.length) {
        throw new Error("Feed ist leer, hatte vorher aber Plugins");
      }
      log(`  ok    ${String(plugins.length).padStart(3)} Plugins  ${source.name}`);
      return { source, plugins, status: "ok" };
    } catch (err) {
      const note = err?.message || String(err);
      if (cached?.plugins?.length) {
        warn(`${source.name}: ${note} -> nutze Cache vom ${cached.fetchedAt} (${cached.plugins.length})`);
        return { source, plugins: cached.plugins, status: "stale", note };
      }
      warn(`${source.name}: ${note} -> keine Daten`);
      return { source, plugins: [], status: "failed", note };
    }
  });

  /* --- 2. Cache schreiben ------------------------------------------ */

  if (!DRY_RUN) {
    for (const r of results) {
      if (r.status !== "ok") continue;
      const file = P("cache", `${r.source.id}.json`);
      // Nur schreiben, wenn sich wirklich etwas geaendert hat – sonst wuerde
      // schon der taegliche Datumswechsel 21 Cache-Dateien anfassen.
      const old = await readJson(file);
      if (old && contentHashOf(old.plugins || []) === contentHashOf(r.plugins)) continue;
      await writeJson(file, {
        sourceId: r.source.id,
        url: r.source.url,
        fetchedAt: new Date().toISOString().slice(0, 10),
        count: r.plugins.length,
        plugins: r.plugins,
      });
    }
    // Caches verwaister Quellen aufraeumen
    if (existsSync(P("cache"))) {
      const known = new Set(cfg.sources.map((s) => `${s.id}.json`));
      for (const f of await readdir(P("cache"))) {
        if (f.endsWith(".json") && !known.has(f)) await unlink(P("cache", f));
      }
    }
  }

  /* --- 3. Dedupe --------------------------------------------------- */

  const byInternal = new Map();
  const duplicates = [];

  for (const r of results) {
    const prio = r.source.priority ?? 50;
    for (const p of r.plugins) {
      const key = p.InternalName.toLowerCase();
      if (blocklist.has(key)) continue;

      const prev = byInternal.get(key);
      if (!prev) {
        byInternal.set(key, { plugin: p, priority: prio, source: r.source });
        continue;
      }
      const cmp = compareVersions(p.AssemblyVersion, prev.plugin.AssemblyVersion);
      const wins = cmp > 0 || (cmp === 0 && prio > prev.priority);
      duplicates.push({
        internalName: p.InternalName,
        kept: wins ? r.source.name : prev.source.name,
        dropped: wins ? prev.source.name : r.source.name,
        keptVersion: wins ? p.AssemblyVersion : prev.plugin.AssemblyVersion,
        droppedVersion: wins ? prev.plugin.AssemblyVersion : p.AssemblyVersion,
      });
      if (wins) byInternal.set(key, { plugin: p, priority: prio, source: r.source });
    }
  }

  /* --- 4. Kategorisieren ------------------------------------------- */

  const buckets = Object.fromEntries(CATEGORY_IDS.map((id) => [id, []]));
  const all = [];

  for (const { plugin, source } of byInternal.values()) {
    const { category } = categorize(plugin, source.category, categoryOverrides);
    const final = { ...plugin, _Category: category };
    buckets[category].push(final);
    all.push(final);
  }

  const sortFn = (a, b) => a.Name.localeCompare(b.Name, "en", { sensitivity: "base" });
  all.sort(sortFn);
  for (const id of CATEGORY_IDS) buckets[id].sort(sortFn);

  const master = all.filter((p) => !EXCLUDED_FROM_MASTER.has(p._Category));

  /* --- 5. Schreiben ------------------------------------------------ */

  const generatedAt = new Date().toISOString();
  const stats = {
    generatedAt,
    contentHash: contentHashOf(all),
    totalPlugins: all.length,
    masterPlugins: master.length,
    sources: results.map((r) => ({
      id: r.source.id,
      name: r.source.name,
      url: r.source.url,
      status: r.status,
      count: r.plugins.length,
      note: r.note || null,
    })),
    categories: CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      description: c.description,
      count: buckets[c.id].length,
      file: `repos/${c.id}.json`,
    })),
    duplicates,
  };

  if (DRY_RUN) {
    log("\n--- DRY RUN, nichts geschrieben ---");
    console.table(stats.categories.map(({ id, name, count }) => ({ id, name, count })));
    log(`total=${all.length} master=${master.length} duplikate=${duplicates.length}`);
    const failed = results.filter((r) => r.status === "failed");
    if (failed.length) log(`FEHLGESCHLAGEN: ${failed.map((f) => f.source.name).join(", ")}`);
    return;
  }

  await writeJson(P("repos", "master.json"), master);
  await writeJson(P("repos", "master-full.json"), all);
  for (const id of CATEGORY_IDS) await writeJson(P("repos", `${id}.json`), buckets[id]);
  await writeJson(P("repos", "index.json"), stats);
  await writeJson(P("docs", "plugins.json"), {
    generatedAt,
    categories: stats.categories,
    sources: stats.sources,
    plugins: all.map((p) => ({
      name: p.Name,
      internalName: p.InternalName,
      author: p.Author || "",
      punchline: p.Punchline || (p.Description || "").split("\n")[0].slice(0, 160),
      version: p.AssemblyVersion,
      apiLevel: p.DalamudApiLevel ?? null,
      repoUrl: p.RepoUrl || "",
      iconUrl: p.IconUrl || "",
      downloads: p.DownloadCount || 0,
      category: p._Category,
      source: p._SourceName,
      testingOnly: p.IsTestingExclusive === true,
      hidden: p.IsHide === true,
    })),
  });

  await writeFile(P("STATUS.md"), renderStatus(stats), "utf8");
  await updateReadme(stats, process.env.GITHUB_REPOSITORY || cfg.repository || "yourShika/AetheryteRepo");

  log("\n--- fertig ---");
  log(`  ${master.length} Plugins im Master, ${all.length} inkl. 18+`);
  log(`  ${duplicates.length} Duplikate aufgeloest`);
  for (const c of stats.categories) if (c.count) log(`  ${String(c.count).padStart(3)}  ${c.name}`);
  const bad = results.filter((r) => r.status !== "ok");
  if (bad.length) log(`  ${bad.length} Quelle(n) nicht frisch: ${bad.map((b) => `${b.source.name}[${b.status}]`).join(", ")}`);
}

/** Ersetzt die Feed-Tabelle zwischen den FEEDS-Markern in der README. */
async function updateReadme(stats, repository) {
  const file = P("README.md");
  let md;
  try {
    md = await readFile(file, "utf8");
  } catch {
    return;
  }
  const start = "<!-- FEEDS:START -->";
  const end = "<!-- FEEDS:END -->";
  if (!md.includes(start) || !md.includes(end)) return;

  const base = `https://raw.githubusercontent.com/${repository}/main/`;
  const rows = [
    `| ⭐ **Master** | Alles außer 18+ | ${stats.masterPlugins} | \`${base}repos/master.json\` |`,
  ];
  const nsfw = stats.categories.find((c) => c.id === "nsfw");
  if (nsfw?.count) {
    rows.push(`| 🌐 **Master inkl. 18+** | Wirklich alles | ${stats.totalPlugins} | \`${base}repos/master-full.json\` |`);
  }
  for (const c of stats.categories) {
    if (!c.count) continue;
    rows.push(`| ${c.emoji} ${c.name} | ${c.description} | ${c.count} | \`${base}${c.file}\` |`);
  }

  const block = [
    start,
    "",
    "| Feed | Inhalt | Plugins | URL |",
    "|---|---|---:|---|",
    ...rows,
    "",
    end,
  ].join("\n");

  const next = md.replace(new RegExp(`${start}[\\s\\S]*?${end}`), () => block);
  if (next !== md) await writeFile(file, next, "utf8");
}

function renderStatus(stats) {
  const icon = { ok: "✅", stale: "⚠️", cache: "\u{1F4BE}", failed: "❌" };
  const lines = [
    "# Status",
    "",
    `Zuletzt aktualisiert: **${stats.generatedAt.replace("T", " ").slice(0, 16)} UTC**`,
    "",
    `- Plugins im Master-Feed: **${stats.masterPlugins}**`,
    `- Plugins insgesamt (inkl. 18+): **${stats.totalPlugins}**`,
    `- Quellen: **${stats.sources.length}**`,
    "",
    "## Quellen",
    "",
    "| | Quelle | Plugins | Status |",
    "|---|---|---:|---|",
    ...stats.sources.map(
      (s) => `| ${icon[s.status] || "?"} | [${s.name}](${s.url}) | ${s.count} | ${s.status}${s.note ? ` – \`${String(s.note).replace(/\|/g, "/").slice(0, 90)}\`` : ""} |`
    ),
    "",
    "## Kategorien",
    "",
    "| Kategorie | Plugins | Feed |",
    "|---|---:|---|",
    ...stats.categories.filter((c) => c.count > 0).map((c) => `| ${c.emoji} ${c.name} | ${c.count} | \`${c.file}\` |`),
    "",
  ];

  if (stats.duplicates.length) {
    lines.push(
      "## Aufgeloeste Duplikate",
      "",
      "Gleiches Plugin in mehreren Quellen – die hoehere Version gewinnt.",
      "",
      "| Plugin | Behalten | Verworfen |",
      "|---|---|---|",
      ...stats.duplicates.map(
        (d) => `| \`${d.internalName}\` | ${d.kept} \`${d.keptVersion}\` | ${d.dropped} \`${d.droppedVersion}\` |`
      ),
      ""
    );
  }

  lines.push("<sub>Automatisch erzeugt von `scripts/aggregate.mjs` – nicht von Hand bearbeiten.</sub>", "");
  return lines.join("\n");
}

main().catch((err) => {
  console.error("\nFEHLER:", err?.stack || err);
  process.exit(1);
});
