/**
 * Research Fetcher for PodcastIA "Estudo" theme.
 * Takes a user-defined topic, performs web research + Gemini knowledge,
 * and returns content ready for the podcast pipeline.
 */

import { fetchNewsForTopics } from './news-fetcher.js';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;

export interface CapturedMessage {
  sender: string;
  content: string;
  group_name: string;
}

/**
 * Use Gemini to generate a comprehensive educational summary about a topic.
 */
async function researchWithGemini(topic: string): Promise<string> {
  const prompt = `Voce e um pesquisador e professor especialista. O usuario quer APRENDER sobre o seguinte tema:

"${topic}"

Gere um conteudo educativo COMPLETO e APROFUNDADO sobre este tema. Inclua:

1. **Introducao**: O que e, por que e importante, contexto historico
2. **Conceitos fundamentais**: Explique os pilares/bases do tema com clareza
3. **Como funciona**: Mecanismos, processos, metodologias envolvidas
4. **Exemplos praticos**: Casos reais, aplicacoes no dia a dia
5. **Dados e fatos**: Numeros, estatisticas, pesquisas relevantes
6. **Controversias e debates**: Pontos de vista diferentes sobre o tema
7. **Tendencias atuais**: O que ha de mais recente e para onde caminha
8. **Curiosidades**: Fatos surpreendentes ou pouco conhecidos

REGRAS:
- Escreva em portugues brasileiro
- Seja DETALHADO — o conteudo sera usado para gerar um podcast educativo de 5-10 minutos
- Use linguagem acessivel mas sem simplificar demais
- Cite fontes e referencias quando possivel
- Minimo 2000 caracteres de conteudo
- NAO use markdown, apenas texto corrido com paragrafos`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`[research-fetcher] Gemini error: ${res.status} ${err}`);
    return '';
  }

  const data = (await res.json()) as any;
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((p: any) => p.text)
    ?.map((p: any) => p.text)
    ?.join('\n') || '';
  return text;
}

/**
 * Use Gemini to generate smart search queries from a user topic description.
 */
async function generateSearchQueries(topic: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Dado o seguinte tema de estudo: "${topic}"

Gere EXATAMENTE 5 termos de busca em portugues para pesquisar sobre este assunto na internet.
Os termos devem cobrir diferentes angulos: conceito basico, aplicacoes praticas, novidades, debates, e curiosidades.

Retorne APENAS os 5 termos, um por linha, sem numeracao, sem explicacao.` }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.5 },
      }),
    }
  );

  if (!res.ok) return [topic];

  const data = (await res.json()) as any;
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((p: any) => p.text)
    ?.map((p: any) => p.text)
    ?.join('\n') || '';

  const queries = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 3);
  return queries.length > 0 ? queries.slice(0, 5) : [topic];
}

/**
 * Fetch comprehensive study content for a user-defined topic.
 * Combines web research (Google News) + Gemini knowledge base.
 */
export async function fetchStudyContent(topic: string): Promise<CapturedMessage[]> {
  const t0 = Date.now();
  console.log(`[research-fetcher] Researching topic: "${topic}"`);

  const results: CapturedMessage[] = [];

  // Run in parallel: Gemini deep research + web search
  const [geminiContent, searchQueries] = await Promise.all([
    researchWithGemini(topic),
    generateSearchQueries(topic),
  ]);

  // Gemini knowledge base (primary source)
  if (geminiContent) {
    results.push({
      sender: 'PodcastIA Research',
      content: `Pesquisa aprofundada sobre: ${topic}\n\n${geminiContent}`,
      group_name: 'Estudo',
    });
    console.log(`[research-fetcher] Gemini research: ${geminiContent.length} chars`);
  }

  // Web search with generated queries
  try {
    const webArticles = await fetchNewsForTopics(searchQueries, []);
    for (const article of webArticles.slice(0, 10)) {
      results.push({
        sender: 'PodcastIA Research',
        content: `${article.title}\n\n${article.content}\n\nFonte: ${article.source}`,
        group_name: 'Estudo',
      });
    }
    console.log(`[research-fetcher] Web search: ${webArticles.length} articles from ${searchQueries.length} queries`);
  } catch (err: any) {
    console.error(`[research-fetcher] Web search error:`, err.message);
  }

  console.log(`[research-fetcher] Total: ${results.length} items in ${Date.now() - t0}ms`);
  return results;
}
