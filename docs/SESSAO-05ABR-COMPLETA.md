# PodcastIA - Sessao 04-05/Abril/2026 (COMPLETA)

## Resumo
Sessao massiva: evolucao completa da Maia (assistente WhatsApp), tema Estudo academico, renomeacao personagens, acentuacao.

---

## 1. Sistema de Salvamento Automatico
- /opt/podcastia/save-session.sh - salva contexto com PM2 status, git, disco
- /usr/local/bin/save-session - comando global multi-projeto
- docs/SESSAO-ATUAL.md - backup automatico por dia em docs/historico/

## 2. Tema Estudo Academico
- research-fetcher.ts REESCRITO: prompt Gemini tipo livro-texto (Robbins, Guyton, Harrison)
- Busca academica: SciELO, PubMed, MSD Manuals (substituiu Google News + RSS)
- Temperature 0.7->0.4, minimo 3000 chars tecnicos
- ai.ts prompt estudo: estrutura 10 passos (definicao, classificacao, fisiopatologia, etiologia, manifestacoes, diagnostico, tratamento, prognostico, correlacao clinica, revisao)
- tts.ts voice direction: tom de aula universitaria
- Podcast Sepse gerado: 17.497 chars, 6:47min audio, entregue WhatsApp

## 3. Renomeacao Isa->Maia, Leo->Raphael
- 6 arquivos: ai.ts, tts.ts, isa.ts, digest.ts, webhooks.ts, page.tsx
- Regex ativacao: /^maia/ | Redis keys: maia:active, maia:chat, maia:sent, maia:user
- TTS speakers: Raphael (Sadachbia) + Maia (Leda)

## 4. Frontend 404 Corrigido
- cp -r .next/static e public para dentro do standalone (Next.js nao copia automaticamente)

## 5. Acentuacao
- 422 correcoes em 3 passadas: ai.ts(225), isa.ts(97), research-fetcher.ts(74), tts.ts(18), digest.ts(4), webhooks.ts(4)

## 6. Maia - Assistente WhatsApp (Estado Final)

### 6.1 Midia
- Audio/voz: UAZAPI /message/download (campo id, formato owner:messageid) -> Whisper transcreve
- Imagem: Gemini descreve | Documento/PDF: extrai texto | Video: extrai audio -> transcreve
- Ativacao por voz: audio "Ola Maia" -> transcreve -> detecta frase

### 6.2 Anti-loop e Dedup
- wasSentByApi=true filtra audios da propria Maia
- Dedup por messageid (Map com TTL 30s) - UAZAPI manda 2 webhooks por mensagem

### 6.3 Sessao e Historico
- Session TTL: 1800s (30min), refresh a cada mensagem
- Timeout: envia texto despedida quando sessao expira
- Historico: Redis (cache 7 dias) + Supabase maia_chat_history (permanente 30 dias, MAX 50 msgs)
- NAO apaga historico ao desativar - retoma onde parou

### 6.4 Greeting Contextual
- Primeira vez: se apresenta | Retornando: "No que posso te ajudar?"

### 6.5 Resposta
- So audio (sem texto) | "Maia gravando um audio..." antes do processamento
- TTS retry (2 tentativas) + fallback texto se Gemini falhar (429/500)
- Foco em podcasts - nao responde assuntos fora do escopo

### 6.6 Acoes (12 total)
1. CREATE_SOURCE - qualquer tipo (rss, youtube, news, http_request, webhook, google_shopping, estudo)
2. SEARCH_URL - busca URL (youtube.com direto, DuckDuckGo, RSS guess)
3. UPDATE_SCHEDULE | 4. LIST_SOURCES | 5. DELETE_SOURCE
6. TOGGLE_SOURCE | 7. CHANGE_THEME | 8. GENERATE_NOW
9. DASHBOARD_STATS | 10. LIST_DIGESTS
11. CHAT_DIGEST - tira duvidas sobre conteudo dos podcasts
12. SHOW_THEMES - lista formatada de temas de audio

### 6.7 Intent Detector (CRITICO)
GPT-4o-mini frequentemente NAO usa ACTION tags. O intent detector analisa a resposta em linguagem natural:
- Detecta "vou gerar"/"gerando" -> executa GENERATE_NOW
- Detecta "vou criar"/"criei" -> extrai tipo/nome/tema da resposta GPT, extrai URL da msg do usuario
- Detecta URL na msg do usuario + GPT pedindo link -> cria fonte diretamente (anti-loop URL)
- Detecta "suas fontes"/"fontes ativas" -> executa LIST_SOURCES
- Quando action executa com sucesso, SUBSTITUI resposta GPT por confirmacao + "quer agora ou agendado?"

### 6.8 Lista de Temas
- Deteccao restrita: so quando resposta contem "qual estilo"/"qual tema de audio" E NAO contem "vou criar"/"criei"/"pronto"
- Envia texto formatado (10 temas com emojis) + audio FIXO: "Te mandei a lista, escolhe o que combina!"
- NUNCA deixa GPT listar temas no audio (sempre usa frase fixa)

### 6.9 Criacao de Fonte - Fluxo
- YouTube/RSS/HTTP: Maia PEDE o link ao usuario (busca automatica removida - causava loops)
- Estudo/News: cria direto sem link
- Quando usuario manda URL + GPT pede link de novo: detector intercepta e cria direto
- max_tokens: 1500 (era 700) | ACTION parser: indexOf-based (suporta JSON aninhado)

## 7. Tabela Supabase Criada
- maia_chat_history (id, user_id, role, content, created_at) + index + RLS + cleanup 30 dias

## 8. Arquivos Modificados
1. apps/api/src/services/isa.ts - Maia completa (860+ linhas)
2. apps/api/src/services/ai.ts - Prompts todos os temas
3. apps/api/src/services/tts.ts - Speakers + voice directions
4. apps/api/src/services/research-fetcher.ts - Busca academica
5. apps/api/src/routes/webhooks.ts - Media, dedup, typing, temas, TTS retry
6. apps/api/src/workers/digest.ts - Variables renomeadas
7. apps/web/src/app/dashboard/configuracoes/page.tsx - Labels
8. save-session.sh + /usr/local/bin/save-session (novos)

## 9. Pendencias
- Git commit + push das alteracoes
- Remover logs de debug (Webhook-Debug, FULL MSG) apos estabilizar
- Ativar YouTube Data API v3 no Google Cloud (projeto 1023306039794)
- Testar fluxo completo end-to-end: pedir fonte YouTube com link -> escolher tema -> gerar agora -> receber podcast
- Verificar se Gemini TTS rate limit (429) estabilizou
- Considerar trocar GPT-4o-mini por modelo que siga melhor instrucoes de ACTION tags

## Para Retomar
Leia: /opt/podcastia/docs/SESSAO-05ABR-COMPLETA.md
