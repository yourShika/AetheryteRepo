/**
 * Kategorie-Definitionen + regelbasierte Zuordnung.
 *
 * Ein Plugin bekommt pro Kategorie einen Score. Treffer werden nach Fundort
 * gewichtet: Name/InternalName/Tags zaehlen mehr als die Description, weil dort
 * viele Plugins fremde Plugin-Namen erwaehnen ("integriert sich mit Penumbra").
 * Hoechster Score gewinnt; bei 0 Punkten faellt es auf die Kategorie der Quelle
 * zurueck, sonst auf "misc".
 */

export const CATEGORIES = [
  {
    id: "glamour",
    name: "Glamour & Charakter",
    emoji: "\u{1F457}",
    description: "Mods, Aussehen, Posing, Sync",
    keywords: [
      "penumbra", "glamour", "glamourer", "customize", "customize+", "mare",
      "synchronos", "sync", "mod loader", "modding", "texture", "appearance",
      "brio", "ktisis", "posing", "pose", "anamnesis", "heels", "honorific",
      "moodles", "meddle", "vfx", "cosmetic", "outfit", "dye", "wardrobe",
      "character editor", "npc appearance", "minion appearance", "skin",
      "aetherment", "glamaholic", "collection", "makeup", "hairstyle",
    ],
  },
  {
    id: "combat",
    name: "Kampf & Rotation",
    emoji: "\u{2694}\u{FE0F}",
    description: "Rotationen, Boss-Timeline, Combos, PvP",
    keywords: [
      "rotation", "combo", "boss mod", "bossmod", "bossmodreborn", "vbm",
      "raid", "dps", "damage", "cooldown", "gcd", "opener", "burst",
      "mitigation", "healer", "tank", "melee", "caster", "pvp", "frontline",
      "party finder", "wrath", "redirect", "reaction", "action", "target",
      "hitbox", "aoe", "timeline", "mechanic", "ultimate", "savage", "extreme",
      "combat", "rotationsolver", "encounter", "dot", "buff timer", "parse",
      "enmity", "aggro",
    ],
  },
  {
    id: "automation",
    name: "Automatisierung",
    emoji: "\u{1F916}",
    description: "AutoDuty, Navmesh, Retainer, Questing, Farming",
    keywords: [
      "auto", "automat", "bot", "macro", "navmesh", "vnavmesh", "pathfind",
      "navigation", "lifestream", "teleport", "autoduty", "duty support",
      "retainer", "autoretainer", "deliveroo", "questionable", "quest",
      "island sanctuary", "workshop", "submarine", "airship", "unattended",
      "afk", "farming", "grind", "loop", "queue", "script", "somethingneeddoing",
      "artisan", "automaton", "dailyduty", "daily", "roulette", "leve",
      "fate farm", "gil farm", "multibox", "headless", "no-clip",
    ],
  },
  {
    id: "crafting",
    name: "Crafting & Gathering",
    emoji: "\u{2692}\u{FE0F}",
    description: "Handwerk, Sammeln, Marktbrett",
    keywords: [
      "craft", "crafting", "crafter", "synthesis", "recipe", "macro solver",
      "simulator", "teamcraft", "gather", "gatherbuddy", "gathering",
      "botanist", "miner", "fisher", "fishing", "fish", "aquarium", "spearfish",
      "market", "marketboard", "universalis", "price", "trade", "hq", "collectable",
      "scrip", "materia", "melding", "desynth", "inventory value", "retainer venture",
    ],
  },
  {
    id: "qol",
    name: "Quality of Life & UI",
    emoji: "\u{2728}",
    description: "Tweaks, Interface, Chat, Inventar, Karten",
    keywords: [
      "tweak", "simple tweaks", "quality of life", "qol", "ui", "hud", "interface",
      "window", "overlay", "browsingway", "theme", "font", "tooltip", "hotbar",
      "keybind", "shortcut", "chat", "chat two", "chatbubble", "filter",
      "notification", "alert", "reminder", "inventory", "bag", "sort",
      "minimap", "map", "waymark", "marker", "compass", "radar", "loot",
      "greed", "need", "timer", "clock", "eorzea time", "weather", "hunt",
      "cactpot", "triple triad", "sightseeing", "achievement", "collection log",
      "wondrous tails", "bozja", "eureka", "occult", "deep dungeon",
      "screenshot", "camera", "fps", "performance", "config", "backup",
      "translate", "translation", "localization", "language",
    ],
  },
  {
    id: "social",
    name: "Social & Roleplay",
    emoji: "\u{1F3AD}",
    description: "RP-Profile, Emotes, Free Company, Discord",
    keywords: [
      "roleplay", "role-play", "rp ", " rp", "rpprofile", "profile", "bio",
      "playertags", "nameplate", "name plate", "title", "honorifics",
      "emote", "dance", "gpose social", "snooper", "linkshell", "free company",
      "fc ", "discord", "rich presence", "friend", "blacklist", "party list",
      "who is", "search info", "story", "immersion", "chat bubble", "speech",
      "wander", "idle", "afk pose", "love", "date", "wedding", "relationship",
    ],
  },
  {
    id: "nsfw",
    name: "Adult (18+)",
    emoji: "\u{1F51E}",
    description: "Nur fuer Erwachsene – standardmaessig NICHT im Master",
    keywords: [
      "nsfw", "18+", "adult", "lewd", "erotic", "kink", "bdsm", "gagspeak",
      "gag speak", "restraint", "bondage", "lovense", "intiface", "buttplug",
      "vibrator", "toy control", "hypno", "petplay", "collar", "leash",
      "sexual", "explicit",
    ],
  },
  {
    id: "housing",
    name: "Housing & Deko",
    emoji: "\u{1F3E1}",
    description: "Moebel, Layouts, Grundstuecke",
    keywords: [
      "housing", "house", "furniture", "furnishing", "makeplace", "remakeplace",
      "decorat", "layout", "estate", "apartment", "plot", "yard", "garden",
      "lightingmod", "interior", "chair", "aetheryte ticket",
    ],
  },
  {
    id: "audio",
    name: "Audio & Voice",
    emoji: "\u{1F50A}",
    description: "Voicechat, TTS, Musik, Sound",
    keywords: [
      "audio", "sound", "voice", "voicechat", "proximity", "microphone",
      "tts", "text to speech", "texttotalk", "speech", "orchestrion", "bgm",
      "music", "song", "volume", "mute", "sfx", "soundfilter", "soundsetter",
      "elevenlabs", "narrat",
    ],
  },
  {
    id: "dev",
    name: "Developer & Data",
    emoji: "\u{1F6E0}\u{FE0F}",
    description: "Debugging, Datenexplorer, Editoren",
    keywords: [
      "developer", "debug", "debugger", "data explorer", "excel sheet",
      "lumina", "ipc", "api", "logger", "log viewer", "packet", "network",
      "memory", "hook", "sig", "signature", "inspect", "editor", "vfxeditor",
      "vfx editor", "avfx", "tmb", "pap", "scd", "atex", "exporter", "importer",
      "dev tool", "test plugin", "template", "boilerplate", "benchmark",
    ],
  },
  {
    id: "misc",
    name: "Sonstiges",
    emoji: "\u{1F4E6}",
    description: "Alles ohne klare Zuordnung",
    keywords: [],
  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/** Kategorien, die NICHT in den grossen Master-Feed wandern. */
export const EXCLUDED_FROM_MASTER = new Set(["nsfw"]);

const FIELD_WEIGHTS = [
  ["Name", 4],
  ["InternalName", 3],
  ["Tags", 4],
  ["Punchline", 2],
  ["Description", 1],
];

function haystack(plugin, field) {
  const v = plugin[field];
  if (!v) return "";
  if (Array.isArray(v)) return v.join(" ");
  return String(v);
}

/**
 * @param {object} plugin  normalisiertes Manifest
 * @param {string} fallback  Kategorie der Quelle
 * @param {Record<string,string>} overrides  InternalName (lowercase) -> categoryId
 */
export function categorize(plugin, fallback = "misc", overrides = {}) {
  const key = String(plugin.InternalName || "").toLowerCase();
  if (overrides[key]) return { category: overrides[key], reason: "override" };

  const scores = new Map();
  for (const [field, weight] of FIELD_WEIGHTS) {
    const text = " " + haystack(plugin, field).toLowerCase() + " ";
    if (text.trim() === "") continue;
    for (const cat of CATEGORIES) {
      for (const kw of cat.keywords) {
        if (text.includes(kw)) {
          scores.set(cat.id, (scores.get(cat.id) || 0) + weight);
        }
      }
    }
  }

  // NSFW ist bewusst dominant: lieber einmal zu viel als versehentlich im
  // allgemeinen Master-Feed.
  if ((scores.get("nsfw") || 0) >= 4) return { category: "nsfw", reason: "keyword" };

  let best = null;
  let bestScore = 0;
  for (const [id, score] of scores) {
    if (score > bestScore || (score === bestScore && best && CATEGORY_IDS.indexOf(id) < CATEGORY_IDS.indexOf(best))) {
      best = id;
      bestScore = score;
    }
  }

  if (!best || bestScore < 4) {
    return { category: fallback && fallback !== "mixed" ? fallback : "misc", reason: "source-fallback" };
  }
  return { category: best, reason: `keyword(${bestScore})` };
}
