/**
 * Google Search Service for PodcastIA
 * Uses Gemini with Google Search grounding to search for flights and products
 */

const GEMINI_MODEL = "gemini-2.5-flash";

// Map of Brazilian city names to IATA codes
const IATA_CODES: Record<string, string> = {
  "sao paulo": "GRU", "rio de janeiro": "GIG", "brasilia": "BSB", "salvador": "SSA",
  "fortaleza": "FOR", "recife": "REC", "belo horizonte": "CNF", "curitiba": "CWB",
  "porto alegre": "POA", "manaus": "MAO", "belem": "BEL", "goiania": "GYN",
  "florianopolis": "FLN", "vitoria": "VIX", "natal": "NAT", "maceio": "MCZ",
  "joao pessoa": "JPA", "aracaju": "AJU", "sao luis": "SLZ", "teresina": "THE",
  "cuiaba": "CGB", "campo grande": "CGR", "foz do iguacu": "IGU", "londrina": "LDB",
  "maringa": "MGF", "uberlandia": "UDI", "ribeirao preto": "RAO", "campinas": "VCP",
  "santos": "GRU", "guarulhos": "GRU", "galeao": "GIG", "confins": "CNF",
  "porto seguro": "BPS", "ilheus": "IOS", "petrolina": "PNZ", "imperatriz": "IMP",
  "macapa": "MCP", "boa vista": "BVB", "rio branco": "RBR", "palmas": "PMW",
  "navegantes": "NVT", "joinville": "JOI", "chapeco": "XAP", "cascavel": "CAC",
  "foz": "IGU", "sp": "GRU", "rj": "GIG", "bh": "CNF", "poa": "POA",
  "cwb": "CWB", "bsb": "BSB", "ssa": "SSA", "rec": "REC",
  // International
  "buenos aires": "EZE", "santiago": "SCL", "lima": "LIM", "bogota": "BOG",
  "miami": "MIA", "nova york": "JFK", "new york": "JFK", "orlando": "MCO",
  "lisboa": "LIS", "madrid": "MAD", "paris": "CDG", "londres": "LHR",
  "roma": "FCO", "cancun": "CUN", "cidade do mexico": "MEX",
};

function getIATA(city: string): string {
  const normalized = city.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*(\/\w+)?\s*$/, "").trim();
  return IATA_CODES[normalized] || city.toUpperCase();
}

/**
 * Search for cheapest flights in cash (BRL)
 */
async function searchFlightsCash(
  origin: string, originCode: string, destination: string, destCode: string,
  paxInfo: string, dateInfo: string
): Promise<string> {
  const prompt = `Search Google Flights and Brazilian travel websites for the cheapest round-trip flights from ${origin} (${originCode}) to ${destination} (${destCode})${paxInfo}. Period: ${dateInfo}.

Search these sites: google.com/travel/flights, skyscanner.com.br, decolar.com, kayak.com.br, 123milhas.com

Return ONLY in Portuguese BR, this exact format (NO markdown, NO bold, NO asterisks):
PASSAGENS ${origin.toUpperCase()} (${originCode}) -> ${destination.toUpperCase()} (${destCode})

1. R$ [price] - [airline]
   Ida: [duration] - [Direct OR 1 stop in CITY/CODE (Xh connection)]
   Volta: [duration] - [Direct OR 1 stop in CITY/CODE (Xh connection)]
   Periodo: [dates or month]
   Reservar: [URL]

2. (same format)
3. (same format)
4. (same format)
5. (same format)

MELHOR PERIODO: [cheapest month/week]
VOO MAIS RAPIDO: [fastest option]
DICA: [tip to save money on this route]

List 5 cheapest options. Include layover city, airport code and connection time.`;

  return geminiSearchGrounding(prompt);
}

/**
 * Search for flights using miles (loyalty programs)
 */
async function searchFlightsMiles(
  origin: string, originCode: string, destination: string, destCode: string,
  paxInfo: string, dateInfo: string
): Promise<string> {
  const prompt = `Search Google for estimated miles pricing for round-trip flights from ${origin} (${originCode}) to ${destination} (${destCode})${paxInfo}. Period: ${dateInfo}.

Search: "smiles ${originCode} ${destCode} milhas", "maxmilhas ${origin} ${destination}", "123milhas milhas ${origin} ${destination}", "latam pass ${originCode} ${destCode}"

Return ONLY in Portuguese BR (NO markdown, NO bold, NO asterisks):
MILHAS ${origin.toUpperCase()} -> ${destination.toUpperCase()}

Smiles (GOL): ~[estimated miles] milhas ida+volta | Taxas: ~R$ [estimated taxes]
LATAM Pass: ~[estimated miles] milhas ida+volta | Taxas: ~R$ [estimated taxes]
TudoAzul (Azul): ~[estimated miles] milhas ida+volta | Taxas: ~R$ [estimated taxes]
MaxMilhas: a partir de ~R$ [price] (milhas de terceiros)

DICA MILHAS: [1 sentence tip - best program for this route, best time to redeem]
VEREDICTO: [compare cash price vs miles value in 1 sentence]

Use approximate/estimated values based on search results. If exact data unavailable, use typical ranges for this distance/route.`;

  return geminiSearchGrounding(prompt);
}

/**
 * Search Google via Gemini grounding for cheapest flights
 * Runs cash and miles searches in parallel to avoid truncation
 */
export async function searchFlights(
  origin: string,
  destination: string,
  opts?: { dates?: string; passengers?: number; children?: number; flexible?: boolean }
): Promise<string> {
  const originCode = getIATA(origin);
  const destCode = getIATA(destination);
  const pax = opts?.passengers || 1;
  const kids = opts?.children || 0;
  const dateInfo = opts?.dates || "any month in 2026, find the cheapest period";
  const paxInfo = pax > 1 || kids > 0
    ? ` for ${pax} adult${pax > 1 ? "s" : ""}${kids > 0 ? ` and ${kids} child${kids > 1 ? "ren" : ""}` : ""}`
    : "";

  // Run cash and miles searches in parallel
  const [cashResult, milesResult] = await Promise.allSettled([
    searchFlightsCash(origin, originCode, destination, destCode, paxInfo, dateInfo),
    searchFlightsMiles(origin, originCode, destination, destCode, paxInfo, dateInfo),
  ]);

  const cashText = cashResult.status === "fulfilled" ? cashResult.value : "Nao consegui buscar passagens em dinheiro.";
  const milesText = milesResult.status === "fulfilled" ? milesResult.value : "Nao consegui buscar passagens com milhas.";

  return cashText + "\n\n---\n\n" + milesText;
}

/**
 * Search Google via Gemini grounding for cheapest products
 */
export async function searchProducts(query: string): Promise<string> {
  const prompt = `Search Google Shopping and Brazilian e-commerce for the cheapest prices for: ${query}

Search: google.com/shopping, mercadolivre.com.br, amazon.com.br, magazineluiza.com.br, americanas.com.br, casasbahia.com.br, kabum.com.br

Return ONLY in Portuguese BR, this format (NO markdown, NO bold):
MELHORES PRECOS: ${query.toUpperCase()}

1. R$ [price] - [full product name] - [store name]
   Link: [real URL]
2. R$ [price] - [full product name] - [store name]
   Link: [real URL]
3. R$ [price] - [full product name] - [store name]
   Link: [real URL]
4. R$ [price] - [full product name] - [store name]
   Link: [real URL]
5. R$ [price] - [full product name] - [store name]
   Link: [real URL]

MENOR PRECO: R$ [value] em [store]
MELHOR CUSTO-BENEFICIO: [option number and why]

Order cheapest first. Prices in BRL. Include real store URLs.`;

  return geminiSearchGrounding(prompt);
}

/**
 * General Google search via Gemini grounding
 */
export async function searchGoogle(query: string): Promise<string> {
  const prompt = `Search Google: ${query}
Return top 5 results in Portuguese BR with title, short description and link. No markdown.`;
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
          generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(60000),
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
