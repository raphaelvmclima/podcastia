const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096
): Promise<string> {
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
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content || "";
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
    icon: "💬",
    promptStyle: "conversacional",
  },
  {
    id: "aula",
    name: "Aula",
    description: "Estilo professor explicando o conteúdo de forma didática",
    icon: "🎓",
    promptStyle: "didático",
  },
  {
    id: "jornalistico",
    name: "Jornalístico",
    description: "Formato telejornal com notícias objetivas e análises",
    icon: "📰",
    promptStyle: "jornalistico",
  },
  {
    id: "resumo",
    name: "Resumo Executivo",
    description: "Resumo direto ao ponto, focado em ação e decisões",
    icon: "📋",
    promptStyle: "executivo",
  },
  {
    id: "comentarios",
    name: "Comentários",
    description: "Análise opinativa com debates e pontos de vista diferentes",
    icon: "🗣️",
    promptStyle: "opinativo",
  },
  {
    id: "storytelling",
    name: "Storytelling",
    description: "Narrativa envolvente contando as notícias como histórias",
    icon: "📖",
    promptStyle: "narrativo",
  },
  {
    id: "estudo_biblico",
    name: "Estudo Bíblico",
    description: "Reflexões e ensinamentos com base bíblica",
    icon: "📕",
    promptStyle: "devocional",
  },
  {
    id: "debate",
    name: "Debate",
    description: "Hosts com posições opostas debatendo os temas",
    icon: "⚔️",
    promptStyle: "debate",
  },
  {
    id: "entrevista",
    name: "Entrevista",
    description: "Formato entrevista com perguntas e respostas",
    icon: "🎤",
    promptStyle: "entrevista",
  },
  {
    id: "motivacional",
    name: "Motivacional",
    description: "Conteúdo inspirador com lições práticas de vida",
    icon: "🔥",
    promptStyle: "motivacional",
  },
];

function getThemePrompt(themeId: string, userName: string, style: string): string {
  const themeMap: Record<string, string> = {
    conversa: `Você é um roteirista de podcast profissional.
Crie um roteiro de podcast em portugues brasileiro, tom ${style}, adequado para leitura por TTS.
O podcast tem dois hosts: Isa (apresentadora principal) e Leo (co-host).
Isa e Leo conversam naturalmente, como amigos discutindo os temas do dia.
Eles se complementam, fazem piadas leves e mantem o clima descontraído mas informativo.`,

    aula: `Você é um roteirista de podcast educacional.
Crie um roteiro em portugues brasileiro no formato de AULA, como se Isa fosse a professora e Leo o aluno curioso.
Isa EXPLICA cada tema de forma didática, com analogias e exemplos do dia a dia.
Leo faz PERGUNTAS inteligentes que ajudam a aprofundar o assunto.
Use expressoes como "vamos entender isso melhor", "na prática isso significa", "um exemplo disso e".
O objetivo e que o ouvinte ${userName} APRENDA de verdade sobre cada tema.`,

    jornalistico: `Você é um roteirista de telejornal em audio.
Crie um roteiro em portugues brasileiro no formato JORNALÍSTICO profissional.
Isa e a ancora principal e Leo e o reporter/comentarista.
Use linguagem formal mas acessivel. Cada noticia deve ter: FATO, CONTEXTO e IMPACTO.
Isa apresenta as manchetes e Leo traz aprofundamento e dados.
Formato: "Boa noite ${userName}, estas sao as principais notícias de hoje..."
Mantenha objetividade jornalística, separando fatos de opinioes.`,

    resumo: `Você é um assistente executivo criando um briefing em audio.
Crie um roteiro em portugues brasileiro no formato RESUMO EXECUTIVO.
Isa e a analista principal e Leo destaca acoes necessarias.
Seja DIRETO: para cada tema, apresente o FATO em 1 frase, o IMPACTO em 1 frase e a ACAO sugerida.
Use bullet-points verbais: "Primeiro ponto...", "Segundo ponto...", "Atenção para...".
O ouvinte ${userName} e um executivo ocupado que precisa de informação rápida e acionável.`,

    comentarios: `Você é um roteirista de podcast de COMENTÁRIOS E OPINIÃO.
Crie um roteiro em portugues brasileiro onde Isa e Leo ANALISAM e OPINAM sobre cada tema.
Eles devem ter perspectivas DIFERENTES (nao necessariamente opostas).
Isa tende a ser mais analitica e Leo mais prático/direto.
Cada tema deve ter: a noticia em si, a opinião da Isa, a opinião do Leo, e uma conclusao conjunta.
Incentive o ouvinte ${userName} a formar sua propria opinião.`,

    storytelling: `Você é um roteirista de podcast NARRATIVO.
Crie um roteiro em portugues brasileiro usando STORYTELLING para contar as notícias.
Isa e a narradora principal e Leo participa como personagem/comentarista.
Transforme cada tema em uma HISTORIA envolvente com inicio, meio e fim.
Use recursos narrativos: suspense, surpresa, conexoes inesperadas entre temas.
Faca o ouvinte ${userName} sentir que esta ouvindo histórias fascinantes, nao apenas notícias.`,

    estudo_biblico: `Você é um roteirista de podcast de ESTUDO BÍBLICO E REFLEXÃO.
Crie um roteiro em portugues brasileiro onde Isa e Leo fazem reflexoes com base bíblica.
Para cada tema do conteúdo fornecido, conecte com um ensinamento biblico relevante.
Cite versículos quando apropriado (livro, capítulo e versículo).
Isa traz a reflexão teológica e Leo conecta com a vida prática.
Tom: respeitoso, acolhedor e edificante. Abertura com oração breve.
O objetivo e que ${userName} tenha um momento de reflexão espiritual sobre os temas do dia.`,

    debate: `Você é um roteirista de podcast de DEBATE.
Crie um roteiro em portugues brasileiro onde Isa e Leo DEBATEM os temas com posições OPOSTAS.
Para cada tema, um defende uma posição e o outro defende a contraria.
Ambos devem apresentar ARGUMENTOS solidos e respeitosos.
Inclua replicas e contra-argumentos. O debate deve ser acalorado mas civilizado.
No final de cada tema, apresentem um ponto de convergencia.
O objetivo e que ${userName} veja todos os lados de cada questão.`,

    entrevista: `Você é um roteirista de podcast no formato ENTREVISTA.
Crie um roteiro em portugues brasileiro onde Leo e o ENTREVISTADOR e Isa e a ESPECIALISTA.
Leo faz perguntas inteligentes e provocativas sobre cada tema.
Isa responde como expert, com profundidade e exemplos.
Formato: pergunta -> resposta -> follow-up -> resposta aprofundada.
As perguntas devem ser as que ${userName} gostaria de fazer.
Inclua "perguntas do ouvinte" como se ${userName} tivesse enviado.`,

    motivacional: `Você é um roteirista de podcast MOTIVACIONAL E INSPIRADOR.
Crie um roteiro em portugues brasileiro onde Isa e Leo extraem LIÇÕES DE VIDA de cada tema.
Para cada conteúdo, encontre o ensinamento prático, a inspiração e o chamado a ação.
Use histórias de superação, citações inspiradoras e reflexoes profundas.
Tom: energético, positivo mas realista, encorajador.
Isa traz a reflexão profunda e Leo traz a energia e o call-to-action.
O objetivo e que ${userName} termine o podcast motivado e com vontade de agir.`,
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
    ? `\nCONTEXTO DO OUVINTE (${userName}):\n${userContext}\n\nUSE este contexto para PERSONALIZAR o podcast:\n- Mencione o nome "${userName}" ao longo do episódio (na abertura, durante e no fechamento)\n- Para cada noticia relevante, explique como ela AFETA os negocios ou interesses de ${userName}\n- Conecte as notícias com os projetos e areas de atuação de ${userName}\n`
    : "";

  const depthInstruction = isDeepMode
    ? `- MODO APROFUNDADO: NAO seja superficial. Para cada noticia, va alem da manchete: explique o CONTEXTO por tras, o IMPACTO prático e concreto, e o que ${userName} deveria FAZER ou FICAR ATENTO. Adicione analise, conexoes entre notícias, e insights acionaveis. O ouvinte quer profundidade, nao apenas manchetes lidas em voz alta.
- Faca transicoes naturais entre temas, com Isa e Leo dialogando de verdade (um complementa o outro, faz perguntas, traz perspectivas diferentes)
- Alterne falas de forma dinâmica (evite blocos longos de um so host)
- Cada tema principal deve ter pelo menos 3-4 trocas de fala entre os hosts\n`
    : "";

  const systemPrompt = `${basePrompt}
${personalizationBlock}${depthInstruction}
REGRAS:
- Cada fala deve ser separada pelo nome do host: "Isa: texto" ou "Leo: texto"
- A Isa SEMPRE abre o podcast cumprimentando ${userName}
- NAO informe total de mensagens nem ranking de usuarios
- Fale APENAS sobre o conteúdo fornecido nas mensagens. NAO invente, NAO adicione temas que nao estao nas mensagens
- Se as mensagens sao sobre tecnologia, fale SOMENTE sobre tecnologia. Se sao sobre economia, fale SOMENTE sobre economia
- NUNCA adicione temas genericos (Selic, dolar, futebol, geopolitica) se eles NAO estiverem nas mensagens fornecidas
- Organize os temas na ordem em que aparecem nas mensagens
- Destaque decisões, urgencias e itens de ação
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
  const systemPrompt = `Você é um assistente que ajuda o usuario a entender melhor o resumo do dia.
Responda em portugues brasileiro, de forma concisa e util.
Use o conteúdo do resumo abaixo como contexto para responder.

RESUMO: "${title}"
${digestText}`;

  return chatCompletion(systemPrompt, userMessage, 2048);
}

export async function parseNewsPreferences(conversation: string): Promise<{
  keywords: string[];
  topics: string[];
  excludedTopics: string[];
}> {
  const systemPrompt = `Analise a conversa do usuario e extraia EXATAMENTE as preferencias de notícias que ele pediu.

REGRAS CRITICAS:
- Extraia SOMENTE os temas que o usuario EXPLICITAMENTE mencionou
- NAO adicione temas extras, NAO interprete, NAO expanda
- Se o usuario disse "geopolitica", retorne APENAS "geopolitica" - nada mais
- keywords: termos exatos que o usuario mencionou
- topics: categorias exatas que o usuario pediu
- excludedTopics: temas que o usuario disse NAO querer

Retorne SOMENTE um JSON valido, sem markdown, sem explicação.
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
