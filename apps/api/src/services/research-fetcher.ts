/**
 * Research Fetcher for PodcastIA "Estudo" theme.
 * Takes a user-defined topic, performs ACADEMIC research + Gemini knowledge,
 * and returns content ready for the podcast pipeline.
 *
 * IMPORTANTE: Este fetcher gera conteúdo ACADÊMICO/TÉCNICO de nível universitario,
 * baseado em livros-texto e literatura científica — NAO notícias.
 */

import { fetchNewsForTopics } from './news-fetcher.js';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;

export interface CapturedMessage {
  sender: string;
  content: string;
  group_name: string;
}

function html2text(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

/**
 * Use Gemini to generate comprehensive ACADEMIC content about a topic.
 * Writes as if it were a medical/scientific textbook chapter.
 */
async function researchWithGemini(topic: string): Promise<string> {
  const prompt = `Você e um PROFESSOR UNIVERSITARIO e PESQUISADOR SENIOR com decadas de experiência.
O usuário precisa ESTUDAR o seguinte tema para uma prova ou concurso:

"${topic}"

Gere um conteúdo ACADÊMICO COMPLETO e TÉCNICO sobre este tema, como se fosse um CAPITULO DE LIVRO-TEXTO UNIVERSITARIO. Inclua:

1. DEFINICAO TÉCNICA: Definicao formal e científica do tema, com terminologia correta
2. CLASSIFICACAO: Tipos, subtipos, categorias (se aplicavel) com critérios de classificação
3. FISIOPATOLOGIA / MECANISMO: Explique DETALHADAMENTE os mecanismos biológicos, químicos, físicos ou lógicos envolvidos. Use termos técnicos: vias de sinalização, mediadores, cascatas, processos moleculares/celulares
4. ETIOLOGIA / CAUSAS: Fatores causais, fatores de risco, agentes etiológicos
5. MANIFESTACOES / CARACTERISTICAS: Sinais, sintomas, quadro clínico, apresentação tipica
6. DIAGNOSTICO / IDENTIFICACAO: Criterios diagnósticos, exames, métodos de avaliação
7. TRATAMENTO / INTERVENCAO: Abordagens terapêuticas, protocolos, diretrizes atuais
8. PROGNOSTICO / DESFECHO: Evolucao, complicações, fatores prognosticos
9. CORRELACOES CLINICAS / PRATICAS: Como o conhecimento se aplica na prática profissional
10. REFERENCIAS CLASSICAS: Cite autores e obras de referência (ex: Robbins, Guyton, Harrison, Nelson, etc.)

REGRAS OBRIGATÓRIAS:
- Escreva em português brasileiro com TERMINOLOGIA TÉCNICA/CIENTÍFICA correta
- Nível de profundidade: GRADUAÇÃO/POS-GRADUAÇÃO como um livro-texto de referência
- Use nomenclatura oficial (CID, DSM, nomenclatura anatômica, IUPAC, etc. conforme aplicavel)
- Inclua dados numericos quando relevantes: valores de referência, percentuais, dosagens
- Cite mecanismos moleculares e celulares quando aplicavel (receptores, mediadores, citocinas, enzimas)
- MÍNIMO 3000 caracteres de conteúdo técnico
- NAO simplifique para leigos, o publico são ESTUDANTES e PROFISSIONAIS
- NAO use markdown, apenas texto corrido com paragrafos
- PROIBIDO conteúdo superficial tipo "e muito importante estudar sobre isso", va DIRETO ao conteúdo técnico`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.4 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`[research-fetcher] Gemini error: ${res.status} ${err}`);
    return "";
  }

  const data = (await res.json()) as any;
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((p: any) => p.text)
    ?.map((p: any) => p.text)
    ?.join("\n") || "";
  return text;
}

/**
 * Use Gemini to generate ACADEMIC search queries from a user topic.
 */
async function generateSearchQueries(topic: string): Promise<string[]> {
  const promptText = `Dado o seguinte tema de ESTUDO ACADÊMICO: "${topic}"

Gere EXATAMENTE 6 termos de busca em português para pesquisar CONTEUDO ACADÊMICO E TÉCNICO sobre este assunto.
Os termos devem focar em: fisiopatologia/mecanismo, classificação, diagnóstico, tratamento, e revisao bibliografica.
Adicione palavras como: "fisiopatologia", "mecanismo", "revisao", "artigo", "livro-texto", "protocolo", "diretriz", "tratamento", conforme aplicavel ao tema.

NAO busque notícias. Busque CONTEUDO TÉCNICO E CIENTIFICO.

Retorne APENAS os 6 termos, um por linha, sem numeração, sem explicação.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.3 },
      }),
    }
  );

  if (!res.ok) return [`${topic} fisiopatologia`, `${topic} revisao`];

  const data = (await res.json()) as any;
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((p: any) => p.text)
    ?.map((p: any) => p.text)
    ?.join("\n") || "";

  const queries = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 3);
  return queries.length > 0 ? queries.slice(0, 6) : [`${topic} fisiopatologia`, `${topic} revisao`];
}

/**
 * Fetch academic content from web search.
 * Searches SciELO, PubMed, MSD Manuals, etc. instead of news.
 */
async function fetchAcademicWeb(query: string): Promise<{ title: string; content: string; source: string }[]> {
  const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  try {
    const encodedQuery = encodeURIComponent(query + " site:scielo.br OR site:pubmed.ncbi.nlm.nih.gov OR site:msdmanuals.com OR site:medicinanet.com.br OR filetype:pdf");
    const url = "https://www.google.com/search?q=" + encodedQuery + "&hl=pt-BR&num=8";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    clearTimeout(timeout);
    if (!response.ok) return [];

    const html = await response.text();
    const results: { title: string; content: string; source: string }[] = [];

    const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/g;
    const titles: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = h3Regex.exec(html)) !== null) {
      const title = html2text(match[1]);
      if (title && title.length > 10) titles.push(title);
    }

    const snippetRegex = /<div[^>]*class="[^"]*(?:snippet|description|BNeawe s3v9rd|VwiC3b)[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const snippets: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      const snippet = html2text(match[1]);
      if (snippet && snippet.length > 20) snippets.push(snippet);
    }

    for (let i = 0; i < titles.length; i++) {
      results.push({
        title: titles[i],
        content: snippets[i] || "",
        source: "Academic Search",
      });
    }

    return results;
  } catch (error: any) {
    console.error("[research-fetcher] Academic search error:", error.message);
    return [];
  }
}

/**
 * Fetch comprehensive ACADEMIC study content for a user-defined topic.
 * Combines Gemini academic knowledge + academic web search.
 * NO news sources — only textbook/scientific content.
 */
export async function fetchStudyContent(topic: string): Promise<CapturedMessage[]> {
  const t0 = Date.now();
  console.log(`[research-fetcher] Researching ACADEMIC topic: "${topic}"`);

  const results: CapturedMessage[] = [];

  const [geminiContent, searchQueries] = await Promise.all([
    researchWithGemini(topic),
    generateSearchQueries(topic),
  ]);

  // Gemini academic knowledge base (PRIMARY source)
  if (geminiContent) {
    results.push({
      sender: "PodcastIA Research",
      content: `Conteúdo acadêmico sobre: ${topic}\n\n${geminiContent}`,
      group_name: "Estudo",
    });
    console.log(`[research-fetcher] Gemini academic research: ${geminiContent.length} chars`);
  }

  // Academic web search (secondary — SciELO, PubMed, MSD Manuals, etc.)
  try {
    const academicPromises = searchQueries.map(q => fetchAcademicWeb(q));
    const academicResults = await Promise.allSettled(academicPromises);

    const allArticles: { title: string; content: string; source: string }[] = [];
    for (const result of academicResults) {
      if (result.status === "fulfilled") {
        allArticles.push(...result.value);
      }
    }

    const seen = new Set<string>();
    const unique = allArticles.filter(a => {
      const key = a.title.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    for (const article of unique.slice(0, 10)) {
      results.push({
        sender: "PodcastIA Research",
        content: `${article.title}\n\n${article.content}\n\nFonte: ${article.source}`,
        group_name: "Estudo",
      });
    }
    console.log(`[research-fetcher] Academic web search: ${unique.length} articles from ${searchQueries.length} queries`);
  } catch (err: any) {
    console.error("[research-fetcher] Academic web search error:", err.message);
  }

  console.log(`[research-fetcher] Total: ${results.length} items in ${Date.now() - t0}ms`);
  return results;
}
