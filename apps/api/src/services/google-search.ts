/**
 * Google Search Service for PodcastIA
 * Uses Gemini with Google Search grounding to search for flights and products
 */

const GEMINI_MODEL = "gemini-2.5-flash";

interface SearchResult {
  text: string;
  sources?: string[];
}

/**
 * Search Google via Gemini grounding for cheapest flights
 */
export async function searchFlights(origin: string, destination: string, dates?: string): Promise<string> {
  const dateInfo = dates ? ` nas datas ${dates}` : " nos proximos 30 dias";
  const prompt = `Busque no Google as passagens aereas mais baratas de ${origin} para ${destination} ida e volta${dateInfo}.

RETORNE EXATAMENTE neste formato (sem markdown, sem asteriscos, sem negrito):
PASSAGENS ${origin.toUpperCase()} -> ${destination.toUpperCase()} (ida e volta)

1. R$ [preco] - [companhia aerea] - [duracao] - [escalas]
   Link: [url do site]
2. R$ [preco] - [companhia aerea] - [duracao] - [escalas]
   Link: [url do site]
3. R$ [preco] - [companhia aerea] - [duracao] - [escalas]
   Link: [url do site]

Dica: [melhor epoca ou dica para economizar]

Se nao encontrar precos exatos, estime com base nos resultados. Ordene do mais barato ao mais caro. Inclua links reais dos sites de busca (Google Flights, Decolar, 123milhas, MaxMilhas, Skyscanner).`;

  return geminiSearchGrounding(prompt);
}

/**
 * Search Google via Gemini grounding for cheapest products
 */
export async function searchProducts(query: string): Promise<string> {
  const prompt = `Busque no Google Shopping e na web os precos mais baratos para: ${query}

RETORNE EXATAMENTE neste formato (sem markdown, sem asteriscos, sem negrito):
MELHORES PRECOS: ${query.toUpperCase()}

1. R$ [preco] - [nome do produto] - [loja]
   Link: [url]
2. R$ [preco] - [nome do produto] - [loja]
   Link: [url]
3. R$ [preco] - [nome do produto] - [loja]
   Link: [url]

Menor preco encontrado: R$ [valor] em [loja]

Ordene do mais barato ao mais caro. Use precos em Reais (BRL). Inclua links reais das lojas.`;

  return geminiSearchGrounding(prompt);
}

/**
 * General Google search via Gemini grounding
 */
export async function searchGoogle(query: string): Promise<string> {
  const prompt = `Busque no Google: ${query}

Retorne os 5 resultados mais relevantes com titulo, descricao curta e link. Formato simples sem markdown.`;

  return geminiSearchGrounding(prompt);
}

/**
 * Core function: Gemini with Google Search grounding
 */
async function geminiSearchGrounding(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return "Erro: GOOGLE_API_KEY nao configurada.";

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[google-search] Gemini error:", res.status, errText.slice(0, 200));
      return "Desculpa, nao consegui buscar no Google agora. Tenta de novo em alguns segundos.";
    }

    const data = (await res.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return "Nao encontrei resultados para essa busca.";

    // Clean markdown formatting for WhatsApp
    return text
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#{1,3}\s/g, "")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
      .trim();
  } catch (err: any) {
    console.error("[google-search] Error:", err.message);
    if (err.name === "TimeoutError") return "A busca demorou demais. Tenta de novo?";
    return "Erro na busca: " + err.message;
  }
}
