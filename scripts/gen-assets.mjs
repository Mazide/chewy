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
const GEMINI_MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"]; // nano banana, newest first
const QUALITY = "medium";
const STYLE_REF = "/private/tmp/claude-501/-Users-looseconfetti-Dev-chewy/a82c88de-7292-4f68-a676-24634873855c/scratchpad/camp_frame.jpg";

// One style voice for every asset — keeps 30 generations in one world.
const STYLE = `Hand-drawn 2D cartoon game asset in a cozy camp-adventure style
(Adventure Time energy): thick black ink outlines, flat vibrant colors with
soft painterly shading, warm palette (wood browns, forest greens, campfire
orange). Single isolated object, no text, no watermark, no background scenery.`;

const SCENE_STYLE = `Full-frame background for a cozy cartoon food-adventure
game, matching the reference image's hand-drawn style exactly: thick ink
outlines, flat vibrant colors, soft painterly shading. Vertical phone screen
composition with calm empty space in the middle third (UI will sit there).
No text, no characters, no watermark.`;

const PACKS = {
  packA: [
    { id: "plank", prompt: "Horizontal wooden sign plank for a game banner: two rough wood boards bound with rope at the corners, slightly curved, empty surface for text overlay" },
    { id: "scroll", prompt: "Vertical parchment scroll unrolled, curled edges top and bottom, aged paper texture, wooden rollers" },
    { id: "parchment_map", prompt: "Tall aged parchment map sheet, torn edges, faded compass rose in a corner, mostly empty surface" },
    { id: "leather_panel", prompt: "Plain worn leather panel with stitched edges, subtle scratches, warm brown, flat surface with no pockets and no buckles — a background texture for a shop grid" },
    { id: "coin", prompt: "Single gold coin with an embossed campfire emblem, chunky cartoon proportions" },
    { id: "orb_map", prompt: "Small folded treasure map tied with string, game icon" },
    { id: "orb_compass", prompt: "Brass compass with wooden rim, needle pointing up-right, game icon" },
    { id: "orb_backpack", prompt: "Small adventurer's canvas backpack with bedroll on top, game icon" },
  ],
  // camp decor + pets + theme icons: double duty as scene objects and shop icons
  packB: [
    { id: "flowers", prompt: "Small clump of cheerful wildflowers in a patch of grass, yellow and white petals" },
    { id: "lantern", prompt: "Hanging camp lantern on a short wooden post, warm glowing glass" },
    { id: "flag", prompt: "Small triangular camp pennant flag on a wooden stick, red with a cream stripe" },
    { id: "herbs", prompt: "Bundle of drying herbs tied with twine, hanging from a small wooden hook" },
    { id: "shelter", prompt: "Tiny lean-to log shelter with a mossy roof" },
    { id: "tent", prompt: "Cozy small camping tent, orange canvas with wooden poles and a patch" },
    { id: "owl", prompt: "Cute round owl sitting, big friendly eyes, brown feathers, front view" },
    { id: "squirrel", prompt: "Cute fluffy squirrel sitting upright holding an acorn, side view" },
    { id: "theme_lab_icon", prompt: "Small glass laboratory flask with bubbling green liquid, game shop icon" },
    { id: "theme_magic_icon", prompt: "Small glowing purple crystal ball on a tiny brass stand, game shop icon" },
  ],
  // analysis-theme dressing: full-frame backgrounds (nano banana + style ref)
  // and photo-window frames (transparent, openai)
  packC: [
    { id: "bg_tavern", route: "gemini", aspect: "9:16", prompt: "Warm wooden tavern interior wall: dark timber planks, a shelf with mugs and bread high up, soft candle light from the sides" },
    { id: "bg_lab", route: "gemini", aspect: "9:16", prompt: "Cartoon alchemy laboratory wall: cool gray-blue metal panels, rivets, a few pipes and gauges along the edges, soft teal glow" },
    { id: "bg_magic", route: "gemini", aspect: "9:16", prompt: "Night wizard study wall: deep purple-blue starry gloom, faint runes and sparkles along the edges, cozy not scary" },
    { id: "frame_tavern", prompt: "Round cast-iron cauldron rim viewed from directly above, empty center hole, wooden spoon resting on the edge — a circular frame, game UI" },
    { id: "frame_lab", prompt: "Round brass microscope lens ring with tiny screws and a small gauge, empty center hole — a circular frame, game UI" },
    { id: "frame_magic", prompt: "Round crystal-ball brass holder with tiny stars and a moon charm — a circular ring frame for game UI. The center of the ring is a cut-out hole: fully transparent, nothing inside, see-through" },
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

async function genGemini(key, prompt, aspect = "9:16") {
  const parts = [{ text: `${SCENE_STYLE}\n\n${prompt}` }];
  if (fs.existsSync(STYLE_REF)) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(STYLE_REF).toString("base64") } });
  }
  let lastErr;
  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
        }),
      },
    );
    if (!res.ok) {
      lastErr = new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    const json = await res.json();
    const img = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
    const b64 = img?.inlineData?.data ?? img?.inline_data?.data;
    if (!b64) {
      lastErr = new Error(`${model}: no image part`);
      continue;
    }
    return Buffer.from(b64, "base64");
  }
  throw lastErr;
}

async function main() {
  const [packName, onlyId] = process.argv.slice(2);
  const pack = PACKS[packName];
  if (!pack) {
    console.error(`Usage: node scripts/gen-assets.mjs <${Object.keys(PACKS).join("|")}> [assetId]`);
    process.exit(1);
  }

  const items = onlyId ? pack.filter((a) => a.id === onlyId) : pack;
  if (items.length === 0) {
    console.error(`No asset "${onlyId}" in ${packName}`);
    process.exit(1);
  }
  const needsOpenAI = items.some((a) => (a.route ?? "openai") === "openai");
  const needsGemini = items.some((a) => a.route === "gemini");
  const openaiKey = needsOpenAI ? loadKey("OPENAI_API_KEY", "chewy-openai") : null;
  const geminiKey = needsGemini ? loadKey("GEMINI_API_KEY", "chewy-gemini") : null;
  if (needsOpenAI && !openaiKey) {
    console.error("No OpenAI key (env OPENAI_API_KEY / keychain chewy-openai / .env)");
    process.exit(1);
  }
  if (needsGemini && !geminiKey) {
    console.error("No Gemini key (env GEMINI_API_KEY / keychain chewy-gemini / .env)");
    process.exit(1);
  }

  const outDir = path.join(OUT_BASE, packName);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`${packName}: ${items.length} asset(s) → ${path.relative(ROOT, outDir)}`);
  let ok = 0;
  for (const item of items) {
    const started = Date.now();
    const route = item.route ?? "openai";
    process.stdout.write(`  ${item.id} (${route}) ... `);
    try {
      const png =
        route === "gemini"
          ? await genGemini(geminiKey, item.prompt, item.aspect)
          : await genOpenAI(openaiKey, item.prompt);
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
