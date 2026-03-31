import { env } from "../lib/env.js";

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

export async function generatePodcastScript(
  groups: MessageGroup[],
  userName: string,
  style: "casual" | "formal" = "casual",
  maxChars: number = 3000,
  userContext?: string
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

  const personalizationBlock = userContext
    ? `\nCONTEXTO DO OUVINTE (${userName}):\n${userContext}\n\nUSE este contexto para PERSONALIZAR o podcast:\n- Mencione o nome "${userName}" ao longo do episodio (na abertura, durante e no fechamento)\n- Para cada noticia relevante, explique como ela AFETA os negocios ou interesses de ${userName}\n- Conecte as noticias com os projetos e areas de atuacao de ${userName}\n`
    : "";

  const depthInstruction = isDeepMode
    ? `- MODO APROFUNDADO: NAO seja superficial. Para cada noticia, va alem da manchete: explique o CONTEXTO por tras, o IMPACTO pratico e concreto, e o que ${userName} deveria FAZER ou FICAR ATENTO. Adicione analise, conexoes entre noticias, e insights acionaveis. O ouvinte quer profundidade, nao apenas manchetes lidas em voz alta.
- Faça transicoes naturais entre temas, com Isa e Leo dialogando de verdade (um complementa o outro, faz perguntas, traz perspectivas diferentes)
- Alterne falas de forma dinamica (evite blocos longos de um so host)
- Cada tema principal deve ter pelo menos 3-4 trocas de fala entre os hosts\n`
    : "";

  const systemPrompt = `Voce e um roteirista de podcast profissional e assistente de informacao pessoal.
Crie um roteiro de podcast em portugues brasileiro, tom ${style}, adequado para leitura por TTS.
${personalizationBlock}${depthInstruction}
REGRAS:
- O podcast tem dois hosts: Isa (apresentadora principal) e Leo (co-host)
- Cada fala deve ser separada pelo nome do host: "Isa: texto" ou "Leo: texto"
- A Isa SEMPRE abre o podcast se apresentando primeiro: "Isa: Ola ${userName}, eu sou a Isa e estou aqui com meu amigo Leo!"
- Depois o Leo responde com uma saudacao propria: "Leo: E ai ${userName}, bora conferir o que rolou hoje!"
- NAO informe total de mensagens nem ranking de usuarios
- Organize na seguinte ordem: 1) Economia/Macro (Selic, dolar, Ibovespa), 2) Geopolitica rapida, 3) Tecnologia e IA, 4) SaaS + Marketing + WhatsApp, 5) Futebol por ultimo
- Destaque decisoes, urgencias e itens de acao
- Ignore mensagens triviais (stickers, "ok", "bom dia" sem contexto)
- Finalize com: "Amanha tem mais um episodio... e bora pra cima, ${userName}!"
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
  const systemPrompt = `Analise a mensagem do usuario e extraia preferencias de noticias.
Retorne APENAS um JSON valido com: { "keywords": [...], "topics": [...], "excludedTopics": [...] }`;

  const text = await chatCompletion(systemPrompt, conversation, 1024);
  try {
    return JSON.parse(text);
  } catch {
    return { keywords: [], topics: [], excludedTopics: [] };
  }
}
