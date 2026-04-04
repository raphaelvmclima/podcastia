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
    id: "estudo",
    name: "Estudo",
    description: "Podcast educativo sobre qualquer tema que voce quiser aprender",
    icon: "\uD83D\uDCD5",
    promptStyle: "educativo",
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
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

  const themeMap: Record<string, string> = {
    conversa: `Isa e Leo sao dois amigos em um bar conversando sobre as noticias. REGRAS OBRIGATORIAS:
- Linguagem INFORMAL: use "cara", "mano", "tipo assim", "nao acredito", "serio?"
- Interrupcoes constantes: um corta o outro no meio da frase
- Reacoes emocionais: "PARA TUDO!", "Espera, deixa eu terminar!", "Ha ha ha"
- Tangentes e piadas: eles desviam do assunto e voltam
- Frases CURTAS, nunca mais de 15 palavras por fala
- Leo sempre conta uma experiencia pessoal (invente uma relacionada ao tema)
- Isa sempre faz uma piada ou comentario sarcastico
- PROIBIDO tom informativo ou jornalistico. Isso e uma CONVERSA DE BAR.
- Abertura: cumprimentar ${userName} como amigo ("E ai ${userName}! Senta ai que hoje tem historia!")
- Encerramento: despedida casual de bar`,

    aula: `Isa e a PROFESSORA e Leo e o ALUNO. Isa esta DANDO UMA AULA sobre o conteudo. REGRAS OBRIGATORIAS:
- Isa NUNCA le noticias. Ela ENSINA o conceito por tras de cada tema.
- SEMPRE comece cada tema com uma PERGUNTA: "Leo, voce sabe por que...?" ou "O que voce acha que acontece quando...?"
- Leo TENTA responder (as vezes errado) e Isa CORRIGE de forma gentil
- Use ANALOGIAS obrigatoriamente: "Pense assim: e como se voce tivesse uma padaria e..."
- Use EXEMPLOS do dia a dia: "Imagina que voce vai ao mercado e..."
- REPITA conceitos chave 2 vezes com palavras diferentes
- Inclua "exercicios mentais": "Agora tenta pensar: se isso continuar, o que acontece?"
- Isa diz: "Muito bem!" ou "Quase!" quando Leo responde
- Tom de SALA DE AULA, nao de noticiario
- Foco em ENTENDER o porque, nao o que aconteceu
- PROIBIDO ler manchetes ou listar noticias. ENSINE.
- Abertura: "Ola ${userName}! Eu sou a Isa, e hoje eu e o Leo vamos aprender juntos!"
- Encerramento: Isa faz resumo didatico, Leo faz auto-avaliacao`,

    jornalistico: `Isa e Leo sao APRESENTADORES DE TELEJORNAL. REGRAS OBRIGATORIAS:
- Abertura FORMAL: "Boa noite, ${userName}. Voce esta ouvindo o PodcastIA Jornal, edicao de hoje."
- Cada noticia DEVE seguir EXATAMENTE esta estrutura:
  MANCHETE: uma frase de impacto
  FATO: o que aconteceu (2 frases max)
  CONTEXTO: por que isso importa (2 frases)
  IMPACTO: o que muda na pratica (1 frase)
- Transicoes PROFISSIONAIS: "Passamos agora para...", "Em outras noticias...", "Nosso destaque de hoje..."
- ZERO opiniao pessoal, ZERO piadas, ZERO informalidade
- Tom SERIO e AUTORITATIVO o tempo todo
- Leo faz papel de "reporter de campo" trazendo detalhes extras
- Fechamento: "Essas foram as noticias de hoje. ${userName}, obrigado por nos ouvir. Ate amanha." `,

    resumo: `Isa e Leo estao fazendo um BRIEFING EXECUTIVO. ${userName} tem 2 minutos e precisa saber o essencial. REGRAS OBRIGATORIAS:
- Abertura DIRETA: "Bom dia ${userName}. Seu briefing tem N pontos. Vamos direto."
- Cada ponto DEVE ter EXATAMENTE:
  PONTO [numero]: [frase unica do fato]
  IMPACTO: [uma frase]
  ACAO: [o que ${userName} deveria fazer]
- Frases NUNCA acima de 15 palavras
- ZERO enrolacao, ZERO contexto longo
- Leo lista, Isa complementa com acao
- Fechamento: "Resumo rapido: listar todas as acoes em 1 frase cada. E isso. Bom dia, ${userName}."
- Tom EXECUTIVO: como um assistente de CEO
- VELOCIDADE: ritmo mais rapido que os outros estilos`,

    comentarios: `Isa e Leo DISCORDAM sobre os temas. REGRAS OBRIGATORIAS:
- Isa e ANALITICA (visao macro, dados, tendencias globais)
- Leo e PRATICO (visao micro, experiencia pessoal, impacto no dia a dia)
- Para CADA tema: Isa da uma opiniao -> Leo DISCORDA parcialmente -> Isa REBATE -> conclusao conjunta
- Use expressoes: "Eu vejo diferente...", "Entendo seu ponto, mas...", "Na teoria sim, na pratica..."
- NUNCA concordem completamente. Sempre ha tensao
- Perguntem ao ouvinte: "E voce, ${userName}, o que acha?"
- Tom engajado e apaixonado, mas respeitoso
- Abertura: Isa diz "Hoje tem assunto polemico, Leo!" Leo: "Adoro, vamos nessa!"
- Encerramento: cada um resume posicao em UMA frase`,

    storytelling: `Isa e Leo estao CONTANDO HISTORIAS. REGRAS OBRIGATORIAS:
- NUNCA comece com a noticia. Comece com uma CENA: "Era uma manha de terca-feira quando..."
- Use PERSONAGENS: de nomes e personalidade a quem esta na noticia
- SUSPENSE entre temas: "Mas voce nao vai acreditar no que aconteceu depois..."
- DETALHES SENSORIAIS: "O escritorio estava silencioso, so se ouvia o teclado..."
- ARCO NARRATIVO: comeco (contexto) -> meio (conflito/surpresa) -> fim (resolucao/reflexao)
- Isa narra, Leo reage como ouvinte surpreso: "Nao!", "E dai?", "Serio isso?"
- NO FINAL: conecte TODAS as historias com uma reflexao inesperada
- Tom de CONTACAO DE HISTORIAS ao pe do fogo, nao de noticiario
- Abertura: frase cinematografica que mergulha o ouvinte na historia
- Encerramento: revelacao do fio condutor + despedida para ${userName}`,

    estudo: `Isa e a PESQUISADORA ESPECIALISTA e Leo e o ESTUDANTE CURIOSO. Este e um PODCAST EDUCATIVO APROFUNDADO. REGRAS OBRIGATORIAS:
- Isa pesquisou EXTENSIVAMENTE sobre o tema e traz conhecimento DETALHADO
- Leo faz perguntas que o ouvinte faria: "Mas como assim?", "Me da um exemplo?", "E na pratica?"
- ESTRUTURA do episodio:
  1. INTRODUCAO: Isa apresenta o tema e por que e importante aprender sobre isso
  2. FUNDAMENTOS: Conceitos basicos explicados com ANALOGIAS do dia a dia
  3. APROFUNDAMENTO: Mecanismos, processos, como funciona por dentro
  4. EXEMPLOS REAIS: Casos praticos, aplicacoes, numeros e dados
  5. CONTROVERSIAS: Diferentes pontos de vista e debates sobre o tema
  6. CURIOSIDADES: Fatos surpreendentes que Leo reage com "Nao sabia disso!"
  7. TENDENCIAS: O que ha de mais recente e para onde caminha
  8. RESUMO: Leo recapitula os pontos principais, Isa complementa
- Isa CITA FONTES: "Segundo pesquisas recentes...", "De acordo com estudos da...", "Especialistas como X afirmam que..."
- Leo usa expressoes de descoberta: "Ah, agora faz sentido!", "Entao quer dizer que...", "Isso muda minha visao sobre..."
- Tom de SALA DE AULA UNIVERSITARIA mas acessivel: profundo sem ser inacessivel
- PROIBIDO ser superficial. Va ALEM da definicao basica. Ensine o PORQUE e o COMO.
- PROIBIDO inventar dados ou fatos. Use APENAS o conteudo das pesquisas fornecidas.
- Abertura: "Ola ${userName}! Hoje vamos mergulhar fundo em um tema fascinante. Eu sou a Isa, fiz uma pesquisa completa, e o Leo vai fazer as perguntas que voce faria!"
- Encerramento: "Espero que voce tenha aprendido tanto quanto eu, ${userName}! Se quiser se aprofundar mais, e so pedir outro estudo."`,

    debate: `Isa e Leo estao em um DEBATE ACALORADO. REGRAS OBRIGATORIAS:
- Para cada tema, Isa defende posicao A e Leo defende posicao B (OPOSTAS)
- Estrutura POR TEMA: Tese (Isa) -> Antitese (Leo) -> Replica (Isa) -> Treplica (Leo)
- Use: "Discordo completamente!", "Os numeros nao mentem:", "Voce esta ignorando que..."
- CONCESSOES PARCIAIS: "Ok, voce tem um ponto NESSE aspecto, mas..."
- ESCALADA de intensidade ao longo do podcast
- NO FINAL de cada tema: "Nao vamos resolver isso aqui. ${userName}, voce decide."
- Tom APAIXONADO e INTENSO, mas NUNCA desrespeitoso
- Abertura: "Hoje a gente vai discordar em TUDO." "Veremos. Que comece o embate!"
- Encerramento: "Como sempre, o veredito e seu, ${userName}!" `,

    entrevista: `Leo e um JORNALISTA INVESTIGATIVO entrevistando Isa, que e uma ESPECIALISTA. REGRAS OBRIGATORIAS:
- Formato CLARO: "Leo: [pergunta]" seguido de "Isa: [resposta]"
- Leo faz perguntas PROVOCATIVAS: "Mas sera que isso nao e exagero?", "Alguns criticos dizem que..."
- Isa NUNCA desvia: responde com DADOS e EXEMPLOS concretos
- FOLLOW-UPS obrigatorios: "Voce poderia dar um exemplo?", "E se alguem argumentar que...?"
- Inclua: "Pergunta do nosso ouvinte ${userName}: ..." (pelo menos 1 vez)
- Isa pode dizer: "Otima pergunta" ou "Essa e a pergunta que todo mundo deveria fazer"
- Tom PROFISSIONAL mas dinamico
- Abertura: "Hoje eu tenho a especialista Isa aqui e vou fazer as perguntas que VOCE faria."
- Encerramento: "Obrigado, Isa. E obrigado a voce, ${userName}, por ouvir!" `,

    motivacional: `Isa e Leo estao INSPIRANDO e MOTIVANDO ${userName}. REGRAS OBRIGATORIAS:
- ENERGIA ALTISSIMA desde o inicio: "VOCE ESTA PRONTO? Porque as noticias de hoje vao te mostrar que TUDO E POSSIVEL!"
- Para cada tema, extraia uma LICAO DE VIDA e um EXEMPLO DE SUPERACAO
- Use CITACOES reais (atribua ao autor): "Como disse Steve Jobs: Stay hungry, stay foolish"
- ESCALE a energia ao longo do podcast (comece forte, termine FORTISSIMO)
- Cada tema: noticia -> licao -> como aplicar NA SUA VIDA
- Leo traz energia ("VAI, ${userName}!") e Isa traz profundidade
- FECHAMENTO com DESAFIO CONCRETO: "Nas proximas 24 horas, eu quero que voce FACA isso: [acao especifica]"
- FRASE FINAL de poder: "Voce e mais forte do que imagina. Vai la e faz acontecer, ${userName}!"
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
