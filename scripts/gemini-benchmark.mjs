#!/usr/bin/env node
// Gemini plate-proportions benchmark (TODO #0 / AGENT_BACKLOG A13).
//
// Usage:
//   node scripts/gemini-benchmark.mjs [photos-dir] [--dry-run]
//
// photos-dir defaults to scripts/benchmark-photos/. Drop ~30 real meal photos there
// (jpg/png/heic), including mixed dishes (борщ, паста, бутерброд) and 1-2 non-food shots.
// Results: scripts/benchmark-results.csv + console summary. Then eyeball the CSV against
// reality and count misreads (target: <20%, see docs/TODO.md).
//
// API key resolution order: $GEMINI_API_KEY → chewy/chewy/Secrets.plist → .env
// Images are downscaled to 768px JPEG via `sips` (macOS) to match the app pipeline.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MODEL = "gemini-2.5-flash";
// USD per 1M tokens, gemini-2.5-flash list price as of 2025-06 — update if plan changes.
const PRICE_IN = 0.3;
const PRICE_OUT = 2.5;

const PROMPT = `You are the analyzer for a food-logging app that scores PLATE PROPORTIONS (Harvard plate model), never calories.

Look at the photo and classify the visible edible content into four buckets by share of total edible volume (integers, must sum to 100):
- veg_fruit: vegetables and fruits (NOT potatoes/starchy tubers)
- protein: meat, fish, eggs, legumes, tofu, cottage cheese/dairy protein
- grains: bread, pasta, rice, cereals, dough, potatoes and other starchy sides
- other: sauces, sweets, pure fats, drinks, anything that fits nowhere

Also return:
- is_food: false if there is no edible food in the photo
- confidence: "high" | "medium" | "low" — low when the image is unclear or the dish is hard to decompose (soups, casseroles, wraps)
- wholeness: 0.0-1.0 — 1.0 whole/minimally processed food, ~0.5 home-cooked mixed, ~0.2 ultra-processed (chips, candy, soda)
- dish: short dish name in Russian
- note: one short remark in Russian about ambiguity, "" if none

If is_food is false: sectors all 0, wholeness 0, dish and note explain what you see.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    is_food: { type: "boolean" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    dish: { type: "string" },
    sectors: {
      type: "object",
      properties: {
        veg_fruit: { type: "integer" },
        protein: { type: "integer" },
        grains: { type: "integer" },
        other: { type: "integer" },
      },
      required: ["veg_fruit", "protein", "grains", "other"],
    },
    wholeness: { type: "number" },
    note: { type: "string" },
  },
  required: ["is_food", "confidence", "dish", "sectors", "wholeness", "note"],
};

function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();

  const plist = path.join(ROOT, "chewy/chewy/Secrets.plist");
  if (fs.existsSync(plist)) {
    const xml = fs.readFileSync(plist, "utf8");
    const m = xml.match(/<key>GEMINI_API_KEY<\/key>\s*<string>([^<]+)<\/string>/);
    if (m && m[1] !== "YOUR_API_KEY_HERE") return m[1].trim();
  }

  const dotenv = path.join(ROOT, ".env");
  if (fs.existsSync(dotenv)) {
    const m = fs.readFileSync(dotenv, "utf8").match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

function listPhotos(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`No photos dir: ${dir}\nCreate it and drop meal photos (jpg/png/heic).`);
    process.exit(1);
  }
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|heic|heif|webp)$/i.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

// Match the app: max side 768, JPEG. sips ships with macOS.
function preprocess(file, tmpDir) {
  const out = path.join(tmpDir, path.basename(file).replace(/\.[^.]+$/, "") + ".jpg");
  execFileSync("sips", ["-Z", "768", "-s", "format", "jpeg", "-s", "formatOptions", "70", file, "--out", out], {
    stdio: "pipe",
  });
  return out;
}

async function analyze(apiKey, jpegPath) {
  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(jpegPath).toString("base64") } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const started = Date.now();

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 3) throw new Error(`HTTP ${res.status} after ${attempt} attempts`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`empty candidates: ${JSON.stringify(json).slice(0, 200)}`);
    const usage = json.usageMetadata ?? {};
    return {
      parsed: JSON.parse(text),
      latencyMs: Date.now() - started,
      inTokens: usage.promptTokenCount ?? 0,
      outTokens: usage.candidatesTokenCount ?? 0,
    };
  }
}

const csvEscape = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dir = path.resolve(args.find((a) => !a.startsWith("--")) ?? path.join(ROOT, "scripts/benchmark-photos"));

  const photos = listPhotos(dir);
  if (photos.length === 0) {
    console.error(`Photos dir is empty: ${dir}`);
    process.exit(1);
  }
  console.log(`${photos.length} photo(s) in ${dir}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chewy-bench-"));
  const apiKey = loadApiKey();
  if (!apiKey && !dryRun) {
    console.error("No GEMINI_API_KEY (env / chewy/chewy/Secrets.plist / .env). Run with --dry-run to test preprocessing only.");
    process.exit(1);
  }

  const rows = [];
  for (const [i, photo] of photos.entries()) {
    const name = path.basename(photo);
    process.stdout.write(`[${i + 1}/${photos.length}] ${name} ... `);
    try {
      const jpeg = preprocess(photo, tmpDir);
      if (dryRun) {
        console.log(`ok (preprocessed → ${(fs.statSync(jpeg).size / 1024).toFixed(0)} KB)`);
        continue;
      }
      const { parsed, latencyMs, inTokens, outTokens } = await analyze(apiKey, jpeg);
      const s = parsed.sectors ?? {};
      const cost = (inTokens * PRICE_IN + outTokens * PRICE_OUT) / 1e6;
      rows.push({
        file: name,
        is_food: parsed.is_food,
        confidence: parsed.confidence,
        dish: parsed.dish,
        veg_fruit: s.veg_fruit,
        protein: s.protein,
        grains: s.grains,
        other: s.other,
        wholeness: parsed.wholeness,
        latency_ms: latencyMs,
        in_tokens: inTokens,
        out_tokens: outTokens,
        cost_usd: cost.toFixed(6),
        note: parsed.note,
        error: "",
      });
      console.log(`${parsed.dish} | v${s.veg_fruit}/p${s.protein}/g${s.grains}/o${s.other} | ${parsed.confidence} | ${latencyMs}ms`);
    } catch (e) {
      rows.push({ file: name, error: e.message });
      console.log(`ERROR: ${e.message}`);
    }
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (dryRun) return;

  const columns = [
    "file", "is_food", "confidence", "dish", "veg_fruit", "protein", "grains", "other",
    "wholeness", "latency_ms", "in_tokens", "out_tokens", "cost_usd", "note", "error",
  ];
  const csvPath = path.join(ROOT, "scripts/benchmark-results.csv");
  fs.writeFileSync(
    csvPath,
    [columns.join(","), ...rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","))].join("\n") + "\n"
  );

  const ok = rows.filter((r) => !r.error);
  const flagged = ok.filter(
    (r) =>
      r.is_food === false ||
      r.confidence === "low" ||
      Math.abs(r.veg_fruit + r.protein + r.grains + r.other - 100) > 5
  );
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  console.log(`\n=== Summary ===`);
  console.log(`analyzed: ${ok.length}/${rows.length}  errors: ${rows.length - ok.length}`);
  console.log(`avg latency: ${Math.round(avg(ok.map((r) => r.latency_ms)))}ms`);
  console.log(`total cost: $${ok.reduce((a, r) => a + Number(r.cost_usd), 0).toFixed(4)}`);
  console.log(`flagged (non-food / low confidence / sectors≠100): ${flagged.length}`);
  for (const r of flagged) console.log(`  - ${r.file}: ${r.dish} (${r.confidence}${r.is_food === false ? ", not food" : ""})`);
  console.log(`\nCSV → ${path.relative(process.cwd(), csvPath)}`);
  console.log(`Next: eyeball each row vs reality, count misreads. Misread >20% → rethink (docs/TODO.md #0).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
