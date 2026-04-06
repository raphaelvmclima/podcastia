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
    description: "Estilo professor usando método socrático com perguntas retóricas",
    icon: "\uD83C\uDF93",
    promptStyle: "didático",
  },
  {
    id: "jornalístico",
    name: "Jornalistico",
    description: "Formato telejornal com manchetes claras e análises segmentadas",
    icon: "\uD83D\uDCF0",
    promptStyle: "jornalístico",
  },
  {
    id: "resumo",
    name: "Resumo Executivo",
    description: "Resumo direto com itens de ação numerados",
    icon: "\uD83D\uDCCB",
    promptStyle: "executivo",
  },
  {
    id: "comentários",
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
    id: "estudo",
    name: "Estudo",
    description: "Podcast educativo sobre qualquer tema que você quiser aprender",
    icon: "\uD83D\uDCD5",
    promptStyle: "educativo",
  },
  {
    id: "debate",
    name: "Debate",
    description: "Hosts com posições opostas apresentando contra-argumentos explícitos",
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
    description: "Conteúdo inspirador com desafio e call-to-action no final",
    icon: "\uD83D\uDD25",
    promptStyle: "motivacional",
  },
];

function getThemePrompt(themeId: string, userName: string, style: string): string {
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

  const themeMap: Record<string, string> = {
    conversa: `Maia e Raphael são dois amigos em um bar conversando sobre as notícias. REGRAS OBRIGATÓRIAS:
- Linguagem INFORMAL: use "cara", "mano", "tipo assim", "não acredito", "serio?"
- Interrupções constantes: um corta o outro no meio da frase
- Reações emocionais: "PARA TUDO!", "Espera, deixa eu terminar!", "Ha ha ha"
- Tangentes e piadas: eles desviam do assunto e voltam
- Frases CURTAS, nunca mais de 15 palavras por fala
- Raphael sempre conta uma experiência pessoal (invente uma relacionada ao tema)
- Maia sempre faz uma piada ou comentário sarcástico
- PROIBIDO tom informativo ou jornalístico. Isso e uma CONVERSA DE BAR.
- Abertura: cumprimentar ${userName} como amigo ("E ai ${userName}! Senta ai que hoje tem historia!")
- Encerramento: despedida casual de bar`,

    aula: `Maia e a PROFESSORA e Raphael e o ALUNO. Maia está DANDO UMA AULA sobre o conteúdo. REGRAS OBRIGATÓRIAS:
- Maia NUNCA le notícias. Ela ENSINA o conceito por tras de cada tema.
- SEMPRE comece cada tema com uma PERGUNTA: "Raphael, você sabe por que...?" ou "O que você acha que acontece quando...?"
- Raphael TENTA responder (as vezes errado) e Maia CORRIGE de forma gentil
- Use ANALOGIAS obrigatoriamente: "Pense assim: e como se você tivesse uma padaria e..."
- Use EXEMPLOS do dia a dia: "Imagina que você vai ao mercado e..."
- REPITA conceitos chave 2 vezes com palavras diferentes
- Inclua "exercícios mentais": "Agora tenta pensar: se isso continuar, o que acontece?"
- Maia diz: "Muito bem!" ou "Quase!" quando Raphael responde
- Tom de SALA DE AULA, não de noticiário
- Foco em ENTENDER o porque, não o que aconteceu
- PROIBIDO ler manchetes ou listar notícias. ENSINE.
- Abertura: "Ola ${userName}! Eu sou a Maia, e hoje eu e o Raphael vamos aprender juntos!"
- Encerramento: Maia faz resumo didático, Raphael faz auto-avaliação`,

    jornalístico: `Maia e Raphael são APRESENTADORES DE TELEJORNAL. REGRAS OBRIGATÓRIAS:
- Abertura FORMAL: "Boa noite, ${userName}. Você está ouvindo o PodcastIA Jornal, edição de hoje."
- Cada noticia DEVE seguir EXATAMENTE está estrutura:
  MANCHETE: uma frase de impacto
  FATO: o que aconteceu (2 frases max)
  CONTEXTO: por que isso importa (2 frases)
  IMPACTO: o que muda na prática (1 frase)
- Transições PROFISSIONAIS: "Passamos agora para...", "Em outras notícias...", "Nosso destaque de hoje..."
- ZERO opiniao pessoal, ZERO piadas, ZERO informalidade
- Tom SERIO e AUTORITATIVO o tempo todo
- Raphael faz papel de "reporter de campo" trazendo detalhes extras
- Fechamento: "Essas foram as notícias de hoje. ${userName}, obrigado por nos ouvir. Até amanha." `,

    resumo: `Maia e Raphael estão fazendo um BRIEFING EXECUTIVO. ${userName} tem 2 minutos e precisa saber o essencial. REGRAS OBRIGATÓRIAS:
- Abertura DIRETA: "Bom dia ${userName}. Seu briefing tem N pontos. Vamos direto."
- Cada ponto DEVE ter EXATAMENTE:
  PONTO [número]: [frase única do fato]
  IMPACTO: [uma frase]
  ACAO: [o que ${userName} deveria fazer]
- Frases NUNCA acima de 15 palavras
- ZERO enrolação, ZERO contexto longo
- Raphael lista, Maia complementa com ação
- Fechamento: "Resumo rápido: listar todas as ações em 1 frase cada. E isso. Bom dia, ${userName}."
- Tom EXECUTIVO: como um assistente de CEO
- VELOCIDADE: ritmo mais rápido que os outros estilos`,

    comentários: `Maia e Raphael DISCORDAM sobre os temas. REGRAS OBRIGATÓRIAS:
- Maia e ANALITICA (visao macro, dados, tendências globais)
- Raphael e PRATICO (visao micro, experiência pessoal, impacto no dia a dia)
- Para CADA tema: Maia da uma opiniao -> Raphael DISCORDA parcialmente -> Maia REBATE -> conclusão conjunta
- Use expressoes: "Eu vejo diferente...", "Entendo seu ponto, mas...", "Na teoria sim, na prática..."
- NUNCA concordem completamente. Sempre ha tensao
- Perguntem ao ouvinte: "E você, ${userName}, o que acha?"
- Tom engajado e apaixonado, mas respeitoso
- Abertura: Maia diz "Hoje tem assunto polêmico, Raphael!" Raphael: "Adoro, vamos nessa!"
- Encerramento: cada um resume posição em UMA frase`,

    storytelling: `Maia e Raphael estão CONTANDO HISTORIAS. REGRAS OBRIGATÓRIAS:
- NUNCA comece com a noticia. Comece com uma CENA: "Era uma manha de terca-feira quando..."
- Use PERSONAGENS: de nomes e personalidade a quem está na noticia
- SUSPENSE entre temas: "Mas você não vai acreditar no que aconteceu depois..."
- DETALHES SENSORIAIS: "O escritorio estava silencioso, só se ouvia o teclado..."
- ARCO NARRATIVO: comeco (contexto) -> meio (conflito/surpresa) -> fim (resolução/reflexão)
- Maia narra, Raphael reage como ouvinte surpreso: "Não!", "E dai?", "Serio isso?"
- NO FINAL: conecte TODAS as historias com uma reflexão inesperada
- Tom de CONTACAO DE HISTORIAS ao pe do fogo, não de noticiário
- Abertura: frase cinematográfica que mergulha o ouvinte na historia
- Encerramento: revelação do fio condutor + despedida para ${userName}`,

    estudo: `Maia e a PROFESSORA UNIVERSITARIA ESPECIALISTA e Raphael e o ESTUDANTE DE GRADUAÇÃO/POS-GRADUAÇÃO. Este e um PODCAST ACADÊMICO DE NIVEL UNIVERSITARIO. O conteúdo deve ser TÉCNICO, como um livro-texto (Robbins, Guyton, Harrison, etc). REGRAS OBRIGATÓRIAS:
- Maia fala como PROFESSORA UNIVERSITARIA: usa TERMINOLOGIA TÉCNICA/CIENTÍFICA correta, cita nomenclaturas oficiais, explica mecanismos moleculares e celulares
- Raphael faz perguntas INTELIGENTES de estudante: "Mas qual a via de sinalização envolvida?", "E a fisiopatologia disso?", "Quais os critérios diagnósticos?", "E na prática clínica, como aplica?"
- ESTRUTURA ACADÊMICA do episodio:
  1. DEFINICAO TÉCNICA: Maia define formalmente o tema com terminologia científica correta
  2. CLASSIFICACAO: Tipos, subtipos, critérios de classificação (se aplicavel)
  3. FISIOPATOLOGIA/MECANISMO: Explicacao DETALHADA dos mecanismos biológicos/químicos/físicos — vias de sinalização, mediadores, cascatas, processos moleculares e celulares
  4. ETIOLOGIA: Fatores causais, fatores de risco, agentes etiológicos
  5. MANIFESTACOES CLINICAS: Sinais, sintomas, quadro clínico, apresentação tipica
  6. DIAGNOSTICO: Criterios diagnósticos, exames, métodos de avaliação, valores de referência
  7. TRATAMENTO: Protocolos, diretrizes atuais, abordagens terapêuticas com doses e mecanismos de ação
  8. PROGNOSTICO: Evolucao, complicações, fatores prognosticos
  9. CORRELACAO CLINICA: Raphael pergunta como aplica na prática, Maia da exemplos de casos
  10. REVISAO FINAL: Raphael recapitula os pontos-chave para memorizar, Maia válida e complementa
- Maia CITA REFERENCIAS ACADEMICAS: "Segundo o Robbins...", "De acordo com o Harrison...", "O Guyton descreve que...", "Estudos publicados no Lancet/NEJM mostram que..."
- Raphael usa expressoes de entendimento acadêmico: "Ah, então a cascata e...", "Então o mecanismo envolve...", "Isso explica por que clinicamente vemos..."
- Tom de AULA UNIVERSITARIA DE ALTO NIVEL: técnico, preciso, com profundidade de livro-texto
- PROIBIDO ser superficial ou generico. PROIBIDO usar linguagem de noticiário ou divulgacao científica simplificada
- PROIBIDO inventar dados. Use APENAS o conteúdo das pesquisas fornecidas. Cite números, percentuais, valores de referência
- Use termos técnicos SEM simplificar: citocinas, interleucinas, receptores, enzimas, vias metabólicas, cascatas de sinalização
- Abertura: "Ola ${userName}! Hoje temos uma aula completa sobre um tema fundamental. Eu sou a Maia, preparei o material baseado na literatura de referência, e o Raphael vai fazer as perguntas que todo estudante faria!"
- Encerramento: "Revisamos os pontos principais, ${userName}. Esse conteúdo e de nível universitario, então recomendo revisar as referências que citamos. Até a proxima aula!"`,

    debate: `Maia e Raphael estão em um DEBATE ACALORADO. REGRAS OBRIGATÓRIAS:
- Para cada tema, Maia defende posição A e Raphael defende posição B (OPOSTAS)
- Estrutura POR TEMA: Tese (Maia) -> Antítese (Raphael) -> Réplica (Maia) -> Tréplica (Raphael)
- Use: "Discordo completamente!", "Os números não mentem:", "Você está ignorando que..."
- CONCESSOES PARCIAIS: "Ok, você tem um ponto NESSE aspecto, mas..."
- ESCALADA de intensidade ao longo do podcast
- NO FINAL de cada tema: "Não vamos resolver isso aqui. ${userName}, você decide."
- Tom APAIXONADO e INTENSO, mas NUNCA desrespeitoso
- Abertura: "Hoje a gente vai discordar em TUDO." "Veremos. Que comece o embate!"
- Encerramento: "Como sempre, o veredito e seu, ${userName}!" `,

    entrevista: `Raphael e um JORNALISTA INVESTIGATIVO entrevistando Maia, que e uma ESPECIALISTA. REGRAS OBRIGATÓRIAS:
- Formato CLARO: "Raphael: [pergunta]" seguido de "Maia: [resposta]"
- Raphael faz perguntas PROVOCATIVAS: "Mas será que isso não e exagero?", "Alguns criticos dizem que..."
- Maia NUNCA desvia: responde com DADOS e EXEMPLOS concretos
- FOLLOW-UPS obrigatórios: "Você poderia dar um exemplo?", "E se alguem argumentar que...?"
- Inclua: "Pergunta do nosso ouvinte ${userName}: ..." (pelo menos 1 vez)
- Maia pode dizer: "Otima pergunta" ou "Essa e a pergunta que todo mundo deveria fazer"
- Tom PROFISSIONAL mas dinâmico
- Abertura: "Hoje eu tenho a especialista Maia aqui e vou fazer as perguntas que VOCE faria."
- Encerramento: "Obrigado, Maia. E obrigado a você, ${userName}, por ouvir!" `,

    motivacional: `Maia e Raphael estão INSPIRANDO e MOTIVANDO ${userName}. REGRAS OBRIGATÓRIAS:
- ENERGIA ALTISSIMA desde o início: "VOCE ESTA PRONTO? Porque as notícias de hoje vao te mostrar que TUDO E POSSIVEL!"
- Para cada tema, extraia uma LICAO DE VIDA e um EXEMPLO DE SUPERACAO
- Use CITACOES reais (atribua ao autor): "Como disse Steve Jobs: Stay hungry, stay foolish"
- ESCALE a energia ao longo do podcast (comece forte, termine FORTISSIMO)
- Cada tema: noticia -> licao -> como aplicar NA SUA VIDA
- Raphael traz energia ("VAI, ${userName}!") e Maia traz profundidade
- FECHAMENTO com DESAFIO CONCRETO: "Nas proximas 24 horas, eu quero que você FACA isso: [ação específica]"
- FRASE FINAL de poder: "Você e mais forte do que imagina. Vai la e faz acontecer, ${userName}!"
- PROIBIDO tom calmo ou informativo. Isso e um PODCAST MOTIVACIONAL.`,

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
    ? `\nCONTEXTO DO OUVINTE (${userName}):\n${userContext}\n\nUSE este contexto para PERSONALIZAR o podcast:\n- Mencione o nome "${userName}" ao longo do episodio (na abertura, durante e no fechamento)\n- Para cada noticia relevante, explique como ela AFETA os negocios ou interesses de ${userName}\n- Conecte as notícias com os projetos e areas de atuacao de ${userName}\n`
    : "";

  const depthInstruction = isDeepMode
    ? `- MODO APROFUNDADO: NAO seja superficial. Para cada noticia, va além da manchete: explique o CONTEXTO por tras, o IMPACTO prático e concreto, e o que ${userName} deveria FAZER ou FICAR ATENTO. Adicione análise, conexões entre notícias, e insights acionaveis. O ouvinte quer profundidade, não apenas manchetes lidas em voz alta.
- Faca transições naturais entre temas, com Maia e Raphael dialogando de verdade (um complementa o outro, faz perguntas, traz perspectivas diferentes)
- Alterne falas de forma dinâmica (evite blocos longos de um só host)
- Cada tema principal deve ter pelo menos 3-4 trocas de fala entre os hosts\n`
    : "";

  const systemPrompt = `${basePrompt}
${personalizationBlock}${depthInstruction}
REGRAS:
- Cada fala deve ser separada pelo nome do host: "Maia: texto" ou "Raphael: texto"
- A Maia SEMPRE abre o podcast cumprimentando ${userName}
- NAO informe total de mensagens nem ranking de usuários
- Fale APENAS sobre o conteúdo fornecido nas mensagens. NAO invente, NAO adicione temas que não estão nas mensagens
- Se as mensagens são sobre tecnologia, fale SOMENTE sobre tecnologia. Se são sobre economia, fale SOMENTE sobre economia
- NUNCA adicione temas genericos (Selic, dolar, futebol, geopolitica) se eles NAO estiverem nas mensagens fornecidas
- Organize os temas na ordem em que aparecem nas mensagens
- Destaque decisoes, urgencias e itens de ação
- Ignore mensagens triviais (stickers, "ok", "bom dia" sem contexto)
- Finalize com uma despedida adequada ao estilo do podcast, mencionando ${userName}
- NAO use markdown, emojis ou tags - texto corrido para audio
- Máximo ${maxChars} caracteres
- USE todos os ${maxChars} caracteres disponíveis para dar profundidade`;

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
  const systemPrompt = `Você e um assistente que ajuda o usuário a entender melhor o resumo do dia.
Responda em português brasileiro, de forma concisa e útil.
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
  const systemPrompt = `Analise a conversa do usuário e extraia EXATAMENTE as preferencias de notícias que ele pediu.

REGRAS CRITICAS:
- Extraia SOMENTE os temas que o usuário EXPLICITAMENTE mencionou
- NAO adicione temas extras, NAO interprete, NAO expanda
- Se o usuário disse "geopolitica", retorne APENAS "geopolitica" - nada mais
- keywords: termos exatos que o usuário mencionou
- topics: categorias exatas que o usuário pediu
- excludedTopics: temas que o usuário disse NAO querer

Retorne SOMENTE um JSON válido, sem markdown, sem explicação.
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
