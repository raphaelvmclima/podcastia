import "dotenv/config";
import { generatePodcastScript } from "./apps/api/src/services/ai.js";
import { generateAudio } from "./apps/api/src/services/tts.js";
import { writeFileSync, copyFileSync } from "fs";

const THEMES = [
  "conversa", "aula", "jornalistico", "resumo", "comentarios",
  "storytelling", "estudo_biblico", "debate", "entrevista", "motivacional"
];

const NEWS_CONTENT = [
  {
    groupName: "Noticias do Dia",
    messages: [
      { sender: "Editor", text: "OpenAI lancou o GPT-4o, primeiro modelo que processa texto, audio e video nativamente. Tempo de resposta de audio caiu para 320ms.", time: "08:00" },
      { sender: "Editor", text: "Banco Central do Brasil cortou a Selic para 10,5 por cento. Gabriel Galipolo assumiu a presidencia do BC em janeiro 2025.", time: "08:05" },
      { sender: "Editor", text: "SpaceX conseguiu capturar o booster do Starship com bracos mecanicos na torre de lancamento pela primeira vez. O foguete tem 121 metros.", time: "08:10" },
      { sender: "Editor", text: "Uniao Europeia aprovou o AI Act, primeira regulamentacao abrangente de inteligencia artificial do mundo. Multas podem chegar a 35 milhoes de euros.", time: "08:15" },
      { sender: "Editor", text: "Brasil recebeu 6,6 milhoes de turistas internacionais em 2024, recorde pos-pandemia. Foz do Iguacu teve 2 milhoes de visitantes nas Cataratas.", time: "08:20" },
      { sender: "Editor", text: "Pix processou mais de 42 bilhoes de transacoes em 2024. Banco Central lancou Pix por aproximacao e avanca com o Drex, a moeda digital brasileira.", time: "08:25" },
    ]
  }
];

async function main() {
  const results: { theme: string; scriptPreview: string; duration: number; path: string }[] = [];

  for (const theme of THEMES) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Generating: ${theme}`);
    console.log(`${"=".repeat(60)}`);

    try {
      // Step 1: Generate script
      console.log(`[${theme}] Generating script...`);
      const script = await generatePodcastScript(
        NEWS_CONTENT,
        "Raphael",
        "casual",
        2000,
        undefined,
        theme
      );

      console.log(`[${theme}] Script generated (${script.length} chars)`);
      console.log(`[${theme}] Preview: ${script.substring(0, 200)}...`);

      // Save script for reference
      writeFileSync(`/tmp/script_v3_${theme}.txt`, script);

      // Step 2: Generate audio
      console.log(`[${theme}] Generating audio via TTS...`);
      const { audioPath, duration } = await generateAudio(script, undefined, theme);

      // Copy to final location
      const finalPath = `/tmp/example_v3_${theme}.ogg`;
      copyFileSync(audioPath, finalPath);

      console.log(`[${theme}] Audio generated: ${finalPath} (${duration}s)`);

      results.push({
        theme,
        scriptPreview: script.substring(0, 300),
        duration,
        path: finalPath
      });

    } catch (err: any) {
      console.error(`[${theme}] ERROR: ${err.message}`);
      results.push({
        theme,
        scriptPreview: `ERROR: ${err.message}`,
        duration: 0,
        path: ""
      });
    }
  }

  console.log("\n\n" + "=".repeat(80));
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(80));
  for (const r of results) {
    console.log(`\n--- ${r.theme} (${r.duration}s) ---`);
    console.log(`Path: ${r.path}`);
    console.log(`Preview: ${r.scriptPreview}`);
  }

  // Save results as JSON
  writeFileSync("/tmp/examples_v3_results.json", JSON.stringify(results, null, 2));
  console.log("\nResults saved to /tmp/examples_v3_results.json");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
