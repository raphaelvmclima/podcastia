# PodcastIA - Sessao 04/Abril/2026 (COMPLETA)

## Resumo
Sessao massiva de evolucao da Maia (assistente WhatsApp) e melhorias no tema Estudo.

## 1. Sistema de Salvamento Automatico de Sessao
- Criado /opt/podcastia/save-session.sh - salva contexto com PM2 status, git, disco
- Criado /usr/local/bin/save-session - comando global multi-projeto
- Arquivo ativo: docs/SESSAO-ATUAL.md - backup automatico por dia em docs/historico/

## 2. Tema Estudo Academico
- research-fetcher.ts reescrito: prompt Gemini tipo livro-texto (Robbins, Guyton, Harrison)
- Busca academica: SciELO, PubMed, MSD Manuals (substituiu Google News + RSS)
- Temperature 0.7 para 0.4, minimo 3000 chars tecnicos
- ai.ts prompt estudo: estrutura 10 passos academicos
- tts.ts voice direction: tom de aula universitaria

## 3. Renomeacao Isa para Maia, Leo para Raphael
- 6 arquivos: ai.ts, tts.ts, isa.ts, digest.ts, webhooks.ts, page.tsx
- Regex ativacao/desativacao agora usa maia
- Redis keys: maia:active, maia:chat, maia:sent, maia:user
- TTS speakers: Raphael (Sadachbia) + Maia (Leda)

## 4. Frontend 404 Corrigido
- Next.js standalone nao copia static/public automaticamente
- Fix: copiar .next/static e public para dentro do standalone

## 5. Maia - Evolucao Completa

### 5.1 Processa Midia
- Audio/voz: Whisper transcreve, Maia responde
- Imagem: Gemini descreve, Maia entende
- Documento/PDF: extrai texto, Maia le
- Video: extrai audio, transcreve
- UAZAPI download: POST /message/download com campo id (formato owner:messageid)

### 5.2 Acoes (12 total)
1. CREATE_SOURCE - qualquer tipo (rss, youtube, news, http_request, webhook, google_shopping, estudo)
2. SEARCH_URL - busca URL via DuckDuckGo
3. UPDATE_SCHEDULE - alterar horarios
4. LIST_SOURCES - listar fontes ativas
5. DELETE_SOURCE - remover fonte
6. TOGGLE_SOURCE - ativar/desativar
7. CHANGE_THEME - mudar tema do audio
8. GENERATE_NOW - gerar podcast imediato
9. DASHBOARD_STATS - estatisticas
10. LIST_DIGESTS - historico podcasts
11. CHAT_DIGEST - tirar duvidas sobre conteudo dos podcasts
12. SHOW_THEMES - lista formatada de temas de audio

### 5.3 Anti-loop
- wasSentByApi=true filtra audios da propria Maia
- Dedup por messageid (Map com TTL 30s) - UAZAPI manda 2 webhooks por mensagem

### 5.4 Ativacao por Voz
- Audio "Ola Maia" transcreve via Whisper e detecta frase de ativacao

### 5.5 Sessao e Historico
- Session TTL: 1800s (30 minutos), refresh a cada mensagem
- Timeout notification: envia texto de despedida quando sessao expira
- Historico: Redis (cache 7 dias) + Supabase maia_chat_history (permanente 30 dias)
- MAX_HISTORY: 50 mensagens
- Nao apaga historico ao desativar - retoma onde parou

### 5.6 Greeting Contextual
- Primeira vez: se apresenta completo
- Retornando: "Boa tarde, Raphael! No que posso te ajudar?"

### 5.7 Resposta
- So audio (removido envio de texto)
- "Maia gravando um audio..." enviado antes do processamento
- Auto-deteccao de pergunta sobre temas envia lista formatada por texto + audio
- TTS com retry (2 tentativas) + fallback texto se Gemini falhar
- Foco em podcasts - nao responde assuntos fora do escopo

## 6. Acentuacao
- 422 correcoes em 3 passadas (regex com word boundaries)
- ai.ts (225), isa.ts (97), research-fetcher.ts (74), tts.ts (18), digest.ts (4), webhooks.ts (4)

## 7. Podcast Sepse Gerado
- Gemini: 17.497 chars conteudo academico
- Script: 6.089 chars, TTS: 407s (~6:47min)
- Entregue WhatsApp 5545988445934

## Tabela Supabase Criada
- maia_chat_history (id, user_id, role, content, created_at) + index + RLS + cleanup 30 dias

## Arquivos Modificados
1. apps/api/src/services/isa.ts
2. apps/api/src/services/ai.ts
3. apps/api/src/services/tts.ts
4. apps/api/src/services/research-fetcher.ts
5. apps/api/src/routes/webhooks.ts
6. apps/api/src/workers/digest.ts
7. apps/web/src/app/dashboard/configuracoes/page.tsx
8. save-session.sh (novo)

## Pendencias
- Git commit + push
- Remover logs de debug (Webhook-Debug, FULL MSG) apos estabilizar
- Ativar YouTube Data API v3 no Google Cloud (projeto 1023306039794)
- Testar lista de temas em texto (auto-deteccao ampliada)
- Testar fluxo completo: criar fonte, perguntar tema, confirmar, gerar

## Para Retomar
Leia este arquivo: /opt/podcastia/docs/SESSAO-04ABR-COMPLETA.md
