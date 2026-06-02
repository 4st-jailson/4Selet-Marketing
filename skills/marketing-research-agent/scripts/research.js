// research.js — empacotado com a skill marketing-research-agent (persiste com a skill).
// Roda as 5 buscas Tavily se TAVILY_API_KEY existir; senao, avisa e sai 0 (modo simulado).
// Rodar a partir da RAIZ do projeto.
// Uso: node skills/marketing-research-agent/scripts/research.js --task <t> --date <d> --topic "<topico>" --out <dir>
const fs = require("fs");
const path = require("path");

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const task = arg("task", "research_task");
const date = arg("date", new Date().toISOString().slice(0, 10));
const topic = arg(
  "topic",
  "plataforma de pagamentos para produtor digital estabelecido (4Selet, campanha Taxa Zero)"
);
const outDir = path.resolve(arg("out", `outputs/${task}_${date}`));

const ano = new Date(date).getFullYear() || new Date().getFullYear();
const queries = [
  { focus: "tendencias", q: `tendencias ${topic} ${ano}` },
  { focus: "mercado", q: `taxas e prazos de plataformas de pagamento para infoproduto mercado ${ano}` },
  { focus: "audiencia", q: `dores do produtor digital estabelecido taxas prazos aprovacao de cartao` },
  { focus: "ad_hooks", q: `angulos e hooks de anuncio que convertem ${topic}` },
  { focus: "topicos_virais", q: `topicos em alta discussoes ${topic} redes sociais` },
];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const key = process.env.TAVILY_API_KEY;

  if (!key) {
    console.log(
      "[research] TAVILY_API_KEY ausente -> modo SIMULADO. " +
        "O agente deve sintetizar research_results.json a partir dos knowledge files " +
        "e rotular com _simulated: true. (Para busca real: npm i @tavily/core + setar TAVILY_API_KEY.)"
    );
    process.exit(0);
  }

  let tavily;
  try {
    ({ tavily } = require("@tavily/core"));
  } catch (e) {
    console.error(
      "[research] TAVILY_API_KEY presente, mas @tavily/core nao instalado. Rode: npm i @tavily/core"
    );
    process.exit(1);
  }

  const client = tavily({ apiKey: key });
  const raw = { task_name: task, task_date: date, topic, searches: {} };

  for (const { focus, q } of queries) {
    try {
      const res = await client.search(q, { maxResults: 5, searchDepth: "advanced" });
      raw.searches[focus] = {
        query: q,
        results: (res.results || []).map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        })),
      };
      console.log(`[research] ok: ${focus} (${(res.results || []).length} resultados)`);
    } catch (err) {
      raw.searches[focus] = { query: q, error: err.message };
      console.error(`[research] falha em ${focus}: ${err.message}`);
    }
  }

  const outFile = path.join(outDir, "research_raw.json");
  fs.writeFileSync(outFile, JSON.stringify(raw, null, 2), "utf8");
  console.log(`[research] research_raw.json -> ${outFile}`);
  console.log("[research] Proximo: o agente sintetiza research_raw.json -> research_results.json (schema/contrato).");
})().catch((err) => {
  console.error("[research] FALHA:", err.message);
  process.exit(1);
});
