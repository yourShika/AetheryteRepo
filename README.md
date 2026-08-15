# Aetheryte Repo

**Ein Dalamud-Repo statt zwanzig.**

Dieses Repository sammelt die Plugin-Feeds vieler FFXIV-/Dalamud-Entwickler ein, führt sie
zu einem einzigen Feed zusammen und bietet zusätzlich einen Feed pro Kategorie.
Statt 20+ URLs in den Dalamud-Einstellungen pflegst du eine.

Der Abgleich läuft **alle 3 Stunden automatisch** über GitHub Actions. Sobald eine
Quelle eine neue Plugin-Version veröffentlicht, ist sie hier spätestens 3 Stunden später drin.

> [!IMPORTANT]
> Hier werden **keine Plugins gehostet**. Die Feeds enthalten nur die Download-Links der
> jeweiligen Entwickler. Updates, Support und Verantwortung liegen weiterhin bei den
> ursprünglichen Autoren.

---

## Einrichten

1. In FFXIV: `/xlsettings` → Reiter **Experimental**
2. Unter *Custom Plugin Repositories* alle alten URLs entfernen
3. Diese URL einfügen, **Enter** drücken, Haken setzen, **Save and Close**

```
https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/master.json
```

4. Dalamud neu laden (`/xlplugins` → Plugin-Installer öffnet sich neu befüllt)

## Alle Feeds

Du musst nicht alles nehmen. Jede Kategorie ist ein eigenständiger Feed und lässt sich
beliebig mit anderen kombinieren — die Tabelle wird bei jedem Lauf automatisch aktualisiert.

<!-- FEEDS:START -->

| Feed | Inhalt | Plugins | URL |
|---|---|---:|---|
| ⭐ **Master** | Alles außer 18+ | 85 | `https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/master.json` |
| 👗 Glamour & Charakter | Mods, Aussehen, Posing, Sync | 14 | `https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/glamour.json` |
| ⚔️ Kampf & Rotation | Rotationen, Boss-Timeline, Combos, PvP | 12 | `https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/combat.json` |
| 🤖 Automatisierung | AutoDuty, Navmesh, Retainer, Questing, Farming | 27 | `https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/automation.json` |
| ⚒️ Crafting & Gathering | Handwerk, Sammeln, Marktbrett | 6 | `https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/crafting.json` |
| ✨ Quality of Life & UI | Tweaks, Interface, Chat, Inventar, Karten | 16 | `https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/qol.json` |
| 🎭 Social & Roleplay | RP-Profile, Emotes, Free Company, Discord | 3 | `https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/social.json` |
| 🏡 Housing & Deko | Moebel, Layouts, Grundstuecke | 1 | `https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/housing.json` |
| 🔊 Audio & Voice | Voicechat, TTS, Musik, Sound | 2 | `https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/audio.json` |
| 🛠️ Developer & Data | Debugging, Datenexplorer, Editoren | 3 | `https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/dev.json` |
| 📦 Sonstiges | Alles ohne klare Zuordnung | 1 | `https://raw.githubusercontent.com/yourShika/AetheryteRepo/main/repos/misc.json` |

<!-- FEEDS:END -->

Der Zustand jeder einzelnen Quelle steht in **[STATUS.md](STATUS.md)**,
zum Durchstöbern gibt es die **[Webseite](https://yourshika.github.io/AetheryteRepo/)**.

---

## Warum ein Master-Feed?

- **Ein Eintrag statt 20.** Dalamud fragt jede Repo-URL beim Start einzeln ab; jede tote
  oder langsame Quelle verzögert den Plugin-Installer.
- **Keine Duplikat-Warnungen.** Liegt dasselbe Plugin in zwei Quellen, gewinnt hier die
  höhere Version — Dalamud sieht es nur einmal.
- **Ausfallsicher.** Ist eine Quelle offline, wird der zuletzt erfolgreich geladene Stand
  aus `cache/` benutzt. Ein GitHub-Ausfall entfernt dir also keine Plugins.
- **Absolute Download-Links.** Relative Pfade werden gegen die Quell-URL aufgelöst.

---

## Wie es funktioniert

```
data/sources.json ──► scripts/aggregate.mjs ──► repos/*.json
                             │                  cache/*.json
                             │                  docs/plugins.json
                             └────────────────► STATUS.md
```

`scripts/aggregate.mjs` macht pro Lauf:

1. **Holen** — alle Quellen aus `data/sources.json` parallel (6 gleichzeitig, 3 Versuche,
   45 s Timeout).
2. **Normalisieren** — Feed-Formate vereinheitlichen (Array, `{Plugins:[…]}` oder einzelnes
   Manifest), Booleans wie `"False"` → `false`, relative Download-Links absolut machen,
   `DownloadLinkUpdate`/`Install` gegenseitig auffüllen. Einträge ohne `InternalName` oder
   ohne Download-Link fliegen raus.
3. **Cachen** — jede erfolgreiche Quelle nach `cache/<id>.json`. Bei einem Fehlschlag wird
   dieser Stand weiterverwendet.
4. **Entdoppeln** — nach `InternalName`. Höhere `AssemblyVersion` gewinnt, bei Gleichstand
   die Quelle mit höherer `priority`. Jede Auflösung landet in `STATUS.md`.
5. **Kategorisieren** — Score über Name/Tags/Punchline/Description
   (siehe `scripts/lib/categories.mjs`), korrigierbar über `data/overrides.json`.
6. **Schreiben** — Master-Feeds, Kategorie-Feeds, `docs/plugins.json` für die Webseite,
   `STATUS.md`.

Zur Herkunft bekommt jedes Manifest die Zusatzfelder `_SourceId`, `_SourceName`,
`_SourceUrl` und `_Category`. Dalamud ignoriert unbekannte Felder beim Parsen.

---

## Mitmachen

### Eine Quelle hinzufügen

`data/sources.json` ergänzen und einen PR aufmachen:

```json
{
  "id": "kurz-und-eindeutig",
  "name": "Anzeigename",
  "maintainer": "GitHub-Handle",
  "url": "https://raw.githubusercontent.com/USER/REPO/main/repo.json",
  "category": "qol",
  "priority": 50,
  "enabled": true
}
```

- `url` muss die **rohe JSON** sein, nicht die GitHub-Projektseite.
- `category` ist nur der Fallback, falls die Auto-Erkennung nichts findet.
- `priority` entscheidet ausschließlich bei identischer Versionsnummer (Standard 50).
- `enabled: false` deaktiviert eine Quelle, ohne sie zu löschen.

Die `validate`-Action prüft PRs automatisch auf doppelte IDs/URLs und lässt den
Aggregator einmal trocken laufen.

### Eine Kategorie korrigieren

In `data/overrides.json` unter `categories` eintragen (Key = `InternalName`, klein):

```json
{ "categories": { "meinplugin": "combat" } }
```

`blocklist` wirft ein Plugin aus allen Feeds.

### Lokal ausführen

```bash
node scripts/aggregate.mjs --dry-run   # nur anzeigen, nichts schreiben
node scripts/aggregate.mjs             # Dateien erzeugen
node scripts/aggregate.mjs --offline   # nur aus cache/ bauen
```

Braucht Node 22+, keine Abhängigkeiten.

---

## Aktualisierung erzwingen

Der Cron läuft alle 3 Stunden. Sofort auslösen geht über:

- **Actions → Update repos → Run workflow** im GitHub-UI, oder
- ```bash
  gh workflow run update.yml -R yourShika/AetheryteRepo
  ```
- oder per Webhook aus einem anderen Repo:
  ```bash
  gh api repos/yourShika/AetheryteRepo/dispatches -f event_type=source-updated
  ```

---

## Für Entwickler von Quell-Repos

Du möchtest **nicht**, dass dein Repo hier auftaucht? Mach ein Issue auf oder schreib
kurz — die Quelle wird dann entfernt. Es werden ausschließlich öffentlich als
Dalamud-Repo veröffentlichte Feeds eingelesen, es wird nichts gespiegelt und nichts
neu gehostet.

## Lizenz

Der Code in `scripts/` steht unter der MIT-Lizenz (siehe [LICENSE](LICENSE)).
Die aggregierten Manifest-Daten in `repos/` und `cache/` gehören den jeweiligen
Plugin-Autoren und unterliegen deren Lizenzen.
