const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

/** Default timeout for OpenAI requests (30s) */
const OPENAI_TIMEOUT_MS = 30000;

/** Max retries for transient/rate-limit errors */
const MAX_RETRIES = 3;

async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096
): Promise<string> {
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Retry on 429 (rate limit) or 5xx (server errors)
      if (res.status === 429 || res.status >= 500) {
        const errText = await res.text();
        lastErr = new Error(`OpenAI API error: ${res.status} ${errText}`);
        if (attempt < MAX_RETRIES) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 1s, 2s, 4s
          console.warn(`[AI] OpenAI ${res.status} on attempt ${attempt}/${MAX_RETRIES} — retrying in ${backoff}ms`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw lastErr;
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${err}`);
      }

      const data = (await res.json()) as any;
      return data.choices?.[0]?.message?.content || "";
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        lastErr = new Error(`OpenAI API timeout after ${OPENAI_TIMEOUT_MS}ms`);
        if (attempt < MAX_RETRIES) {
          console.warn(`[AI] OpenAI timeout on attempt ${attempt}/${MAX_RETRIES} — retrying...`);
          continue;
        }
        throw lastErr;
      }
      // Network errors — retry
      if (attempt < MAX_RETRIES && (err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.message?.includes("fetch failed"))) {
        lastErr = err;
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`[AI] Network error on attempt ${attempt}/${MAX_RETRIES}: ${err.message} — retrying in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }
  }
  throw lastErr!;
}

interface MessageGroup {
  groupName: string;
  messages: { sender: string; text: string; time: string }[];
}

// ── Podcast Themes ──────────────────────────────────────────────────────────

export interface PodcastTheme {
  id: string;
  name: string;
  description: string;
  icon: string;
  promptStyle: string;
}

export const PODCAST_THEMES: PodcastTheme[] = [
  {
    id: "conversa",
    name: "Conversa",
    description: "Dois hosts conversando naturalmente sobre os temas",
    icon: "\uD83D\uDCAC",
    promptStyle: "conversacional",
  },
  {
    id: "aula",
    name: "Aula",
    description: "Estilo professor usando metodo socratico com perguntas retoricas",
    icon: "\uD83C\uDF93",
    promptStyle: "didatico",
  },
  {
    id: "jornalistico",
    name: "Jornalistico",
    description: "Formato telejornal com manchetes claras e analises segmentadas",
    icon: "\uD83D\uDCF0",
    promptStyle: "jornalistico",
  },
  {
    id: "resumo",
    name: "Resumo Executivo",
    description: "Resumo direto com itens de acao numerados",
    icon: "\uD83D\uDCCB",
    promptStyle: "executivo",
  },
  {
    id: "comentarios",
    name: "Comentarios",
    description: "Analise opinativa com debates e pontos de vista diferentes",
    icon: "\uD83D\uDDE3\uFE0F",
    promptStyle: "opinativo",
  },
  {
    id: "storytelling",
    name: "Storytelling",
    description: "Narrativa envolvente com ganchos e cliffhangers",
    icon: "\uD83D\uDCD6",
    promptStyle: "narrativo",
  },
  {
    id: "estudo_biblico",
    name: "Estudo Biblico",
    description: "Reflexoes e ensinamentos com base biblica",
    icon: "\uD83D\uDCD5",
    promptStyle: "devocional",
  },
  {
    id: "debate",
    name: "Debate",
    description: "Hosts com posicoes opostas apresentando contra-argumentos explicitos",
    icon: "\u2694\uFE0F",
    promptStyle: "debate",
  },
  {
    id: "entrevista",
    name: "Entrevista",
    description: "Formato entrevista com perguntas e respostas",
    icon: "\uD83C\uDF99\uFE0F",
    promptStyle: "entrevista",
  },
  {
    id: "motivacional",
    name: "Motivacional",
    description: "Conteudo inspirador com desafio e call-to-action no final",
    icon: "\uD83D\uDD25",
    promptStyle: "motivacional",
  },
];

function getThemePrompt(themeId: string, userName: string, style: string): string {
  const themeMap: Record<string, string> = {
    conversa: `Voce e um roteirista de podcast profissional.
Crie um roteiro de podcast em portugues brasileiro, tom ${style}, adequado para leitura por TTS.
O podcast tem dois hosts: Isa (apresentadora principal) e Leo (co-host).
Isa e Leo conversam naturalmente, como amigos discutindo os temas do dia.
Eles se complementam, fazem piadas leves e mantem o clima descontraido mas informativo.`,

    aula: `Voce e um roteirista de podcast educacional que usa o METODO SOCRATICO.
Crie um roteiro em portugues brasileiro no formato de AULA, como se Isa fosse a professora e Leo o aluno curioso.
Isa NAO apenas explica — ela PROVOCA o pensamento com PERGUNTAS RETORICAS:
- "Mas por que sera que isso acontece?" "O que voce acha que vem depois disso?"
- "Se eu te dissesse que X, voce acreditaria? Pois e exatamente o que os dados mostram."
- "Vamos fazer um exercicio mental: imagine que voce e o CEO dessa empresa..."
Leo faz PERGUNTAS inteligentes que desafiam as explicacoes de Isa, nao apenas concorda.
Use ANALOGIAS concretas do dia a dia e EXEMPLOS praticos para cada conceito.
O objetivo e que o ouvinte ${userName} PENSE e APRENDA de verdade, nao apenas ouca passivamente.`,

    jornalistico: `Voce e um roteirista de telejornal em audio com MANCHETES CLARAS.
Crie um roteiro em portugues brasileiro no formato JORNALISTICO profissional.
Isa e a ancora principal e Leo e o reporter/comentarista.

ESTRUTURA OBRIGATORIA para cada noticia:
1. MANCHETE: Isa abre com uma frase impactante de manchete (ex: "Atencao para nossa primeira manchete de hoje:")
2. FATO: Leo apresenta os fatos objetivos — o que aconteceu, quando, onde
3. CONTEXTO: Isa explica o pano de fundo e por que isso importa
4. IMPACTO: Leo analisa as consequencias praticas

Use linguagem formal mas acessivel. Abra com "Boa noite ${userName}, estas sao as principais noticias de hoje..."
Inclua transicoes jornalisticas entre noticias: "Passando agora para...", "Em outras noticias..."
Mantenha objetividade jornalistica, separando fatos de opinioes.`,

    resumo: `Voce e um assistente executivo criando um briefing em audio com ITENS NUMERADOS.
Crie um roteiro em portugues brasileiro no formato RESUMO EXECUTIVO.
Isa e a analista principal e Leo destaca acoes necessarias.

FORMATO OBRIGATORIO:
- Para cada tema, Isa apresenta o fato em 1 frase
- Leo responde com ACAO NUMERADA: "Acao numero 1: [o que fazer]", "Acao numero 2: [proxima acao]"
- Use marcadores verbais claros: "Ponto um...", "Ponto dois...", "Atencao especial para o ponto tres..."
- Ao final, Leo faz um RESUMO DAS ACOES: "Recapitulando, ${userName}, temos X acoes prioritarias hoje: primeiro... segundo... terceiro..."

O ouvinte ${userName} e um executivo ocupado que precisa de informacao rapida e acionavel.
Seja DIRETO e OBJETIVO — cada palavra deve agregar valor.`,

    comentarios: `Voce e um roteirista de podcast de COMENTARIOS E OPINIAO.
Crie um roteiro em portugues brasileiro onde Isa e Leo ANALISAM e OPINAM sobre cada tema.
Eles devem ter perspectivas DIFERENTES (nao necessariamente opostas).
Isa tende a ser mais analitica e Leo mais pratico/direto.
Cada tema deve ter: a noticia em si, a opiniao da Isa, a opiniao do Leo, e uma conclusao conjunta.
Incentive o ouvinte ${userName} a formar sua propria opiniao.`,

    storytelling: `Voce e um roteirista de podcast NARRATIVO mestre em GANCHOS e CLIFFHANGERS.
Crie um roteiro em portugues brasileiro usando STORYTELLING para contar as noticias.
Isa e a narradora principal e Leo participa como personagem/comentarista.

TECNICAS OBRIGATORIAS:
- GANCHO DE ABERTURA: Comece CADA tema com uma frase misteriosa ou provocante que gere curiosidade
  (ex: "Ninguem esperava o que aconteceu na segunda-feira...", "E se eu te dissesse que uma unica decisao mudou tudo?")
- CLIFFHANGER entre temas: Antes de passar para o proximo tema, crie suspense
  (ex: "Mas isso nao e nada comparado ao que vem a seguir...", "Guarde essa informacao, porque ela vai fazer sentido daqui a pouco...")
- CONEXOES INESPERADAS: Conecte temas aparentemente diferentes no final
- ARCO NARRATIVO: Cada tema tem inicio (gancho), meio (desenvolvimento) e fim (revelacao)

Faca o ouvinte ${userName} sentir que esta ouvindo historias fascinantes que ele NAO PODE parar de ouvir.`,

    estudo_biblico: `Voce e um roteirista de podcast de ESTUDO BIBLICO E REFLEXAO.
Crie um roteiro em portugues brasileiro onde Isa e Leo fazem reflexoes com base biblica.
Para cada tema do conteudo fornecido, conecte com um ensinamento biblico relevante.
Cite versiculos quando apropriado (livro, capitulo e versiculo).
Isa traz a reflexao teologica e Leo conecta com a vida pratica.
Tom: respeitoso, acolhedor e edificante. Abertura com oracao breve.
O objetivo e que ${userName} tenha um momento de reflexao espiritual sobre os temas do dia.`,

    debate: `Voce e um roteirista de podcast de DEBATE ACALORADO E ESTRUTURADO.
Crie um roteiro em portugues brasileiro onde Isa e Leo DEBATEM os temas com posicoes GENUINAMENTE OPOSTAS.

REGRAS DO DEBATE:
- Para cada tema, DEFINA CLARAMENTE as posicoes: "Isa DEFENDE que..." vs "Leo ARGUMENTA que..."
- Os hosts DEVEM DISCORDAR EXPLICITAMENTE: "Discordo totalmente, Isa", "Esse argumento nao se sustenta, Leo"
- Inclua CONTRA-ARGUMENTOS DIRETOS: quando um apresenta um ponto, o outro deve REBATER com dados ou logica
- REPLICAS E TREPLICAS: cada tema deve ter pelo menos 2 rodadas de argumento-contra-argumento
- NUNCA concordem facilmente — se um cede um ponto, deve ser parcial: "Ok, aceito isso, MAS..."
- No final de cada tema, apresentem uma SINTESE (nao necessariamente concordancia)

O objetivo e que ${userName} veja TODOS os lados de cada questao e forme sua propria opiniao.
O debate deve ser INTENSO mas CIVILIZADO — paixao com respeito.`,

    entrevista: `Voce e um roteirista de podcast no formato ENTREVISTA.
Crie um roteiro em portugues brasileiro onde Leo e o ENTREVISTADOR e Isa e a ESPECIALISTA.
Leo faz perguntas inteligentes e provocativas sobre cada tema.
Isa responde como expert, com profundidade e exemplos.
Formato: pergunta -> resposta -> follow-up -> resposta aprofundada.
As perguntas devem ser as que ${userName} gostaria de fazer.
Inclua "perguntas do ouvinte" como se ${userName} tivesse enviado.`,

    motivacional: `Voce e um roteirista de podcast MOTIVACIONAL E INSPIRADOR com DESAFIO FINAL.
Crie um roteiro em portugues brasileiro onde Isa e Leo extraem LICOES DE VIDA de cada tema.
Para cada conteudo, encontre o ensinamento pratico, a inspiracao e o chamado a acao.
Use historias de superacao, citacoes inspiradoras e reflexoes profundas.
Tom: energetico, positivo mas realista, encorajador.
Isa traz a reflexao profunda e Leo traz a energia e o call-to-action.

OBRIGATORIO NO FINAL DO PODCAST:
- Leo propoe um DESAFIO PRATICO para ${userName}: algo concreto para fazer HOJE
  (ex: "Meu desafio para voce, ${userName}: nas proximas 24 horas, eu quero que voce...")
- Isa complementa com uma reflexao sobre POR QUE esse desafio importa
- Encerre com uma frase motivacional de impacto que ${userName} vai lembrar o dia todo

O objetivo e que ${userName} termine o podcast MOTIVADO, com ENERGIA e com uma ACAO CLARA para executar.`,
  };

  return themeMap[themeId] || themeMap.conversa;
}

export async function generatePodcastScript(
  groups: MessageGroup[],
  userName: string,
  style: "casual" | "formal" = "casual",
  maxChars: number = 3000,
  userContext?: string,
  theme: string = "conversa"
): Promise<string> {
  const formattedGroups = groups
    .map(
      (g) =>
        `## Grupo: ${g.groupName}\n${g.messages
          .map((m) => `[${m.time}] ${m.sender}: ${m.text}`)
          .join("\n")}`
    )
    .join("\n\n");

  const isDeepMode = maxChars > 4000;

  const basePrompt = getThemePrompt(theme, userName, style);

  const personalizationBlock = userContext
    ? `\nCONTEXTO DO OUVINTE (${userName}):\n${userContext}\n\nUSE este contexto para PERSONALIZAR o podcast:\n- Mencione o nome "${userName}" ao longo do episodio (na abertura, durante e no fechamento)\n- Para cada noticia relevante, explique como ela AFETA os negocios ou interesses de ${userName}\n- Conecte as noticias com os projetos e areas de atuacao de ${userName}\n`
    : "";

  const depthInstruction = isDeepMode
    ? `- MODO APROFUNDADO: NAO seja superficial. Para cada noticia, va alem da manchete: explique o CONTEXTO por tras, o IMPACTO pratico e concreto, e o que ${userName} deveria FAZER ou FICAR ATENTO. Adicione analise, conexoes entre noticias, e insights acionaveis. O ouvinte quer profundidade, nao apenas manchetes lidas em voz alta.
- Faca transicoes naturais entre temas, com Isa e Leo dialogando de verdade (um complementa o outro, faz perguntas, traz perspectivas diferentes)
- Alterne falas de forma dinamica (evite blocos longos de um so host)
- Cada tema principal deve ter pelo menos 3-4 trocas de fala entre os hosts\n`
    : "";

  const systemPrompt = `${basePrompt}
${personalizationBlock}${depthInstruction}
REGRAS:
- Cada fala deve ser separada pelo nome do host: "Isa: texto" ou "Leo: texto"
- A Isa SEMPRE abre o podcast cumprimentando ${userName}
- NAO informe total de mensagens nem ranking de usuarios
- Fale APENAS sobre o conteudo fornecido nas mensagens. NAO invente, NAO adicione temas que nao estao nas mensagens
- Se as mensagens sao sobre tecnologia, fale SOMENTE sobre tecnologia. Se sao sobre economia, fale SOMENTE sobre economia
- NUNCA adicione temas genericos (Selic, dolar, futebol, geopolitica) se eles NAO estiverem nas mensagens fornecidas
- Organize os temas na ordem em que aparecem nas mensagens
- Destaque decisoes, urgencias e itens de acao
- Ignore mensagens triviais (stickers, "ok", "bom dia" sem contexto)
- Finalize com uma despedida adequada ao estilo do podcast, mencionando ${userName}
- NAO use markdown, emojis ou tags - texto corrido para audio
- Maximo ${maxChars} caracteres
- USE todos os ${maxChars} caracteres disponiveis para dar profundidade`;

  const maxTokens = isDeepMode ? 8192 : 4096;

  return chatCompletion(
    systemPrompt,
    `Gere o roteiro do podcast para ${userName} com base nestas mensagens:\n\n${formattedGroups}`,
    maxTokens
  );
}

export async function chatAboutDigest(
  digestText: string,
  title: string,
  userMessage: string
): Promise<string> {
  const systemPrompt = `Voce e um assistente que ajuda o usuario a entender melhor o resumo do dia.
Responda em portugues brasileiro, de forma concisa e util.
Use o conteudo do resumo abaixo como contexto para responder.

RESUMO: "${title}"
${digestText}`;

  return chatCompletion(systemPrompt, userMessage, 2048);
}

export async function parseNewsPreferences(conversation: string): Promise<{
  keywords: string[];
  topics: string[];
  excludedTopics: string[];
}> {
  const systemPrompt = `Analise a conversa do usuario e extraia EXATAMENTE as preferencias de noticias que ele pediu.

REGRAS CRITICAS:
- Extraia SOMENTE os temas que o usuario EXPLICITAMENTE mencionou
- NAO adicione temas extras, NAO interprete, NAO expanda
- Se o usuario disse "geopolitica", retorne APENAS "geopolitica" - nada mais
- keywords: termos exatos que o usuario mencionou
- topics: categorias exatas que o usuario pediu
- excludedTopics: temas que o usuario disse NAO querer

Retorne SOMENTE um JSON valido, sem markdown, sem explicacao.
Formato: {"keywords":["termo1"],"topics":["topico1"],"excludedTopics":[]}`;

  const text = await chatCompletion(systemPrompt, conversation, 1024);
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch {
    console.error("[AI] Failed to parse news preferences:", text.slice(0, 200));
    return { keywords: [], topics: [], excludedTopics: [] };
  }
}
