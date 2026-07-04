#!/usr/bin/env node
// Asset generator (docs/ASSETS.md pipeline).
//
// Usage:
//   node scripts/gen-assets.mjs packA          # generate one pack
//   node scripts/gen-assets.mjs packA plank    # single asset by id
//
// Routing: alpha assets → OpenAI gpt-image-1.5 (native transparent PNG),
// full-frame scenes → Gemini Nano Banana (style anchor via reference images).
// Keys: $OPENAI_API_KEY / $GEMINI_API_KEY → macOS Keychain (chewy-openai /
// chewy-gemini) → .env. Output: prototype/public/assets/gen/<pack>/<id>.png
// so the prototype can use results immediately.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_BASE = path.join(ROOT, "prototype/public/assets/gen");

const OPENAI_MODEL = "gpt-image-1.5"; // gpt-image-2 has no transparency
const QUALITY = "medium";

// One style voice for every asset — keeps 30 generations in one world.
const STYLE = `Hand-drawn 2D cartoon game asset in a cozy camp-adventure style
(Adventure Time energy): thick black ink outlines, flat vibrant colors with
soft painterly shading, warm palette (wood browns, forest greens, campfire
orange). Single isolated object, no text, no watermark, no background scenery.`;

const PACKS = {
  packA: [
    { id: "plank", prompt: "Horizontal wooden sign plank for a game banner: two rough wood boards bound with rope at the corners, slightly curved, empty surface for text overlay" },
    { id: "scroll", prompt: "Vertical parchment scroll unrolled, curled edges top and bottom, aged paper texture, wooden rollers" },
    { id: "parchment_map", prompt: "Tall aged parchment map sheet, torn edges, faded compass rose in a corner, mostly empty surface" },
    { id: "leather_panel", prompt: "Leather backpack panel with stitched pockets grid, brass buckles, worn edges" },
    { id: "coin", prompt: "Single gold coin with an embossed campfire emblem, chunky cartoon proportions" },
    { id: "orb_map", prompt: "Small folded treasure map tied with string, game icon" },
    { id: "orb_compass", prompt: "Brass compass with wooden rim, needle pointing up-right, game icon" },
    { id: "orb_backpack", prompt: "Small adventurer's canvas backpack with bedroll on top, game icon" },
  ],
};

function keychain(service) {
  try {
    return execFileSync("security", ["find-generic-password", "-s", service, "-w"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function loadKey(envName, service) {
  if (process.env[envName]) return process.env[envName].trim();
  const kc = keychain(service);
  if (kc) return kc;
  const dotenv = path.join(ROOT, ".env");
  if (fs.existsSync(dotenv)) {
    const m = fs.readFileSync(dotenv, "utf8").match(new RegExp(`^${envName}=(.+)$`, "m"));
    if (m) return m[1].trim();
  }
  return null;
}

async function genOpenAI(key, prompt) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      prompt: `${STYLE}\n\n${prompt}`,
      size: "1024x1024",
      quality: QUALITY,
      background: "transparent",
      n: 1,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 200)}`);
  return Buffer.from(b64, "base64");
}

async function main() {
  const [packName, onlyId] = process.argv.slice(2);
  const pack = PACKS[packName];
  if (!pack) {
    console.error(`Usage: node scripts/gen-assets.mjs <${Object.keys(PACKS).join("|")}> [assetId]`);
    process.exit(1);
  }
  const key = loadKey("OPENAI_API_KEY", "chewy-openai");
  if (!key) {
    console.error("No OpenAI key (env OPENAI_API_KEY / keychain chewy-openai / .env)");
    process.exit(1);
  }

  const items = onlyId ? pack.filter((a) => a.id === onlyId) : pack;
  if (items.length === 0) {
    console.error(`No asset "${onlyId}" in ${packName}`);
    process.exit(1);
  }
  const outDir = path.join(OUT_BASE, packName);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`${packName}: ${items.length} asset(s) → ${path.relative(ROOT, outDir)} (model ${OPENAI_MODEL}, ${QUALITY})`);
  let ok = 0;
  for (const item of items) {
    const started = Date.now();
    process.stdout.write(`  ${item.id} ... `);
    try {
      const png = await genOpenAI(key, item.prompt);
      fs.writeFileSync(path.join(outDir, `${item.id}.png`), png);
      ok++;
      console.log(`ok (${((Date.now() - started) / 1000).toFixed(1)}s, ${(png.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  }
  console.log(`done: ${ok}/${items.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
