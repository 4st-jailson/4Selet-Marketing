// upload_supabase.js — empacotado com a skill distribution-agent (persiste com a skill).
// Sobe a midia da task para Supabase se SUPABASE_URL + SUPABASE_KEY existirem; senao gera
// media_urls.json com URLs PLACEHOLDER (modo simulado). Rodar a partir da RAIZ do projeto.
// Uso: node skills/distribution-agent/scripts/upload_supabase.js --task <t> --date <d> --out <dir> [--bucket campaign-uploads]
const fs = require("fs");
const path = require("path");

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const task = arg("task", "task");
const date = arg("date", new Date().toISOString().slice(0, 10));
const outDir = path.resolve(arg("out", `outputs/${task}_${date}`));
const bucket = arg("bucket", "campaign-uploads");

const MEDIA_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov"]);

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (MEDIA_EXT.has(path.extname(entry.name).toLowerCase())) acc.push(full);
  }
  return acc;
}

(async () => {
  if (!fs.existsSync(outDir)) {
    console.error(`[distribution] pasta nao encontrada: ${outDir}`);
    process.exit(1);
  }
  const files = walk(outDir, []);
  if (files.length === 0) {
    console.error(`[distribution] nenhuma midia (${[...MEDIA_EXT].join(", ")}) em ${outDir}`);
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prefix = `${task}_${date}`;
  const media = {};
  let simulated;

  if (url && key) {
    let createClient;
    try {
      ({ createClient } = require("@supabase/supabase-js"));
    } catch (e) {
      console.error("[distribution] config Supabase presente, mas @supabase/supabase-js nao instalado. Rode: npm i @supabase/supabase-js");
      process.exit(1);
    }
    const supabase = createClient(url, key);
    simulated = false;
    for (const file of files) {
      const base = path.basename(file);
      const objectPath = `${prefix}/${base}`;
      const buf = fs.readFileSync(file);
      const up = await supabase.storage.from(bucket).upload(objectPath, buf, { upsert: true });
      if (up.error) {
        console.error(`[distribution] falha no upload de ${base}: ${up.error.message}`);
        continue;
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      media[base] = { local: path.relative(outDir, file).replace(/\\/g, "/"), public_url: data.publicUrl };
      console.log(`[distribution] upload ok: ${objectPath}`);
    }
  } else {
    simulated = true;
    console.log("[distribution] SUPABASE_URL/KEY ausente -> modo SIMULADO (URLs placeholder; nada hospedado).");
    for (const file of files) {
      const base = path.basename(file);
      media[base] = {
        local: path.relative(outDir, file).replace(/\\/g, "/"),
        public_url: `https://PLACEHOLDER.supabase.co/storage/v1/object/public/${bucket}/${prefix}/${base}`,
      };
    }
  }

  const payload = {
    task_name: task,
    task_date: date,
    bucket,
    media,
    _simulated: simulated,
  };
  if (simulated) payload._label = "TESTE/SIMULADO - URLs placeholder, nenhuma midia hospedada";

  const outFile = path.join(outDir, "media_urls.json");
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[distribution] media_urls.json -> ${outFile} (${Object.keys(media).length} arquivos, simulated=${simulated})`);
})().catch((err) => {
  console.error("[distribution] FALHA:", err.message);
  process.exit(1);
});
