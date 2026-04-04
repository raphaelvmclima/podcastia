# PodcastIA — Sessao Completa 03/Abril/2026

## Resumo Geral
Sessao massiva de auditoria, correcao de todas pendencias, otimizacao completa do sistema e implementacao de novas features.

---

## FASE 1: Auditoria e Correcoes

### 1.1 UAZAPI_URL Corrigido
- .env: `severo.uazapi.com` -> `loumarturismo.uazapi.com`
- Era a causa raiz do Alex nao receber podcasts
- delivery_target="self" falhava ao resolver numero via UAZAPI errado

### 1.2 Fix Delivery Alex
- Com URL correta, /instance/status resolve para 5511994319826
- catch silencioso substituido por console.error

### 1.3 Console.logs Removidos
- configuracoes/page.tsx:251,257 — [Settings] Saving/Save result
- resumos/page.tsx:19 — Digests API response

### 1.4 PM2 Crash Loop Resolvido
- CAUSA: podcastia-web usava `npx next start` mas config tem `output: "standalone"`
- FIX: ecosystem.config.cjs criado com standalone server.js
- API max_memory_restart elevado de 500MB para 1GB
- Exponential backoff restart delay adicionado
- De 245 restarts para 0 unstable restarts

---

## FASE 2: Audio Tematico por Estilo

### 2.1 TTS com Voice Direction por Tema
Arquivo: apps/api/src/services/tts.ts

| Tema | Direcao de Voz | Temperatura | Volume Musica |
|------|---------------|-------------|---------------|
| conversa | Brincalhao, descontraido | 1.2 | 0.08 |
| aula | Didatico, Socratico, paciente | 0.9 | 0.05 |
| jornalistico | Profissional, serio, cadenciado | 0.8 | 0.06 |
| resumo | Direto, objetivo, assertivo | 0.7 | 0.04 |
| comentarios | Analitico, engajado | 1.1 | 0.07 |
| storytelling | Envolvente, dramatico | 1.3 | 0.10 |
| estudo_biblico | Reverente, sereno | 0.8 | 0.06 |
| debate | Energico, apaixonado | 1.3 | 0.07 |
| entrevista | Profissional, curioso | 1.0 | 0.06 |
| motivacional | MUITO energico, inspirador | 1.4 | 0.09 |

### 2.2 Prompts Reescritos do Zero
Arquivo: apps/api/src/services/ai.ts

Cada tema agora gera podcast COMPLETAMENTE diferente:
- conversa: bar com amigos, interrupcoes, slang
- aula: metodo Socratico 5 passos, repeticao de conceitos
- jornalistico: Manchete/Fato/Contexto/Impacto rigoroso
- resumo: acoes numeradas, max 20 palavras/frase
- comentarios: visoes contrastantes (macro vs micro)
- storytelling: narrativa cinematica, cliffhangers, arcos
- estudo_biblico: oracao + versiculos especificos + reflexao
- debate: Tese/Antitese/Replica/Treplica, sem resolucao
- entrevista: Q&A investigativo com follow-ups
- motivacional: energia escalante, desafio concreto 24h

### 2.3 Titulos e Mensagens por Tema
- Digest title: "Jornal do dia", "Aula do dia", "Reflexao do dia", etc
- WhatsApp: emoji + label do tema na mensagem de entrega

---

## FASE 3: Otimizacoes Backend

### 3.1 YouTube Data API v3
Arquivo: apps/api/src/services/youtube-processor.ts
- 3-tier: API v3 (metadata) -> Gemini fileData (assiste video) -> oEmbed+texto
- Fallback graceful se API nao habilitada no Google Cloud

### 3.2 Health Check
- GET /api/health retorna status, uptime, memory, version
- Arquivo: apps/api/src/server.ts

### 3.3 Rate Limiting
- 100 req/min/IP nos webhooks
- Map in-memory com cleanup a cada 5min
- Arquivo: apps/api/src/routes/webhooks.ts

### 3.4 CORS Hardened
- Apenas dominio producao + localhost dev
- Arquivo: apps/api/src/server.ts

### 3.5 Graceful Shutdown
- SIGTERM + SIGINT handlers
- Arquivo: apps/api/src/server.ts

### 3.6 OpenAI Retry
- Timeout 30s + retry exponential backoff (3x)
- Arquivo: apps/api/src/services/ai.ts

### 3.7 Worker Timing
- Logs [Worker][TIMING] para cada step
- Retry 2x para WhatsApp delivery
- Content summary salvo junto com digest
- Arquivo: apps/api/src/workers/digest.ts

### 3.8 News Diversity
- Max 8 items por fonte
- Dedup mantem versao mais longa
- Arquivo: apps/api/src/services/news-fetcher.ts

### 3.9 Source Fetcher Timeouts
- RSS 20s, YouTube 60s, News 45s, HTTP 30s
- Arquivo: apps/api/src/services/source-fetcher.ts

---

## FASE 4: Otimizacoes Frontend

### 4.1 Audio Player
- Controle velocidade (0.5x, 1x, 1.25x, 1.5x, 2x)
- Progresso persistente (localStorage)
- Skip +-15s
- Error handling com retry
- Arquivo: apps/web/src/app/dashboard/resumos/[id]/page.tsx

### 4.2 API Client Retry
- 3 retries com exponential backoff
- Network failures + 429/502/503/504
- Arquivo: apps/web/src/lib/api.ts

### 4.3 SEO
- OpenGraph + Twitter cards + robots
- Arquivo: apps/web/src/app/layout.tsx

### 4.4 PWA Service Worker v3
- Precache dashboard routes
- Cache audio files
- Offline JSON responses
- Arquivo: apps/web/public/sw.js

### 4.5 Theme FOUC Prevention
- Script inline antes da hidratacao
- Arquivo: apps/web/src/components/theme-provider.tsx

### 4.6 Dashboard Scroll Fix
- overflow-y: auto no .dashboard-main
- Arquivo: apps/web/src/app/globals.css

### 4.7 Digest Count Exato
- Total da API em vez de contagem aproximada
- Arquivo: apps/web/src/app/dashboard/page.tsx

---

## FASE 5: Novas Fontes (4 processadores)

### 5.1 CRM (crm-processor.ts)
- FlwChat, HubSpot, custom HTTP
- Filtra ultimas 24h de atividade

### 5.2 Passagens Aereas (flights-processor.ts)
- RSS Melhores Destinos + Passagens Promo
- Keywords e filtros configuraveis

### 5.3 Google Agenda (calendar-processor.ts)
- Parser iCal (.ics) para calendarios publicos/compartilhados
- Eventos hoje e amanha (timezone BRT)

### 5.4 Precos de Produtos (prices-processor.ts)
- Google Shopping scraper + RSS promos (Promobit)
- Ate 5 produtos em paralelo

### 5.5 Source Fetcher Atualizado
- Imports e switch cases para os 4 novos tipos
- Timeouts especificos por tipo

### 5.6 Frontend Atualizado
- Removidos do COMING_SOON
- Form fields adicionados para cada tipo

---

## FASE 6: Landing Page

### 6.1 Precos Atualizados
- Gratuito: R$0, Starter: R$120, Pro: R$200, Business: R$350

### 6.2 Plano Personalizado (5o plano)
- Calculadora interativa com sliders
- Formula: Base R$30 + R$15/fonte + R$25/podcast extra + R$50 WhatsApp
- Preco calculado em tempo real

### 6.3 Conteudo Atualizado
- Hero menciona todas as fontes
- 15+ tipos de fonte listados
- 10 temas de podcast
- Features atualizadas
- FAQ expandido (10 perguntas)
- Testimonials com features reais

### 6.4 Mobile Optimization
- Grids 1 coluna no mobile
- Touch targets 44px
- iOS smooth scroll
- Horizontal overflow prevention
- Font sizes reduzidos
- Pricing hover fix (glow nao cobre texto)

---

## FASE 7: Pricing Analysis

### Custos por usuario/mes (USD $1 = R$5)
| Item | Free | Starter | Pro | Business |
|------|------|---------|-----|----------|
| GPT-4o-mini | $0.045 | $0.045 | $0.09 | $0.135 |
| Gemini TTS | $0.90 | $0.90 | $1.80 | $2.70 |
| Gemini YouTube | $0.30 | $0.60 | $1.80 | $1.80 |
| Supabase | $0.25 | $0.25 | $0.25 | $0.50 |
| VPS | $0.30 | $0.30 | $0.30 | $0.50 |
| UAZAPI | $0 | $10 | $10 | $10 |
| **Total BRL** | **R$9** | **R$60** | **R$71** | **R$78** |

### Precos Finais
| Plano | Custo | Preco | Markup |
|-------|-------|-------|--------|
| Gratuito | R$9 | R$0 | Funil |
| Starter | R$60 | R$120 | 2.0x |
| Pro | R$71 | R$200 | 2.8x |
| Business | R$78 | R$350 | 4.5x |

### Plan Limits (auth.ts)
- Free: 3 fontes, 1 podcast/dia, 5min audio, app only
- Starter: 5 fontes, 1 podcast/dia, 10min, WhatsApp
- Pro: 10 fontes, 2 podcasts/dia, 20min, WhatsApp + Email
- Business: ilimitado, 3 podcasts/dia, 30min, todos canais + webhook

---

## FASE 8: Exemplos de Podcast Gerados
10 podcasts de exemplo gerados com conteudo real e enviados via WhatsApp:
- conversa (93s), aula (117s), jornalistico (88s), resumo (95s)
- comentarios (116s), storytelling (97s), estudo_biblico (125s)
- debate (110s), entrevista (118s), motivacional (107s)
- Arquivos: /tmp/example_*.ogg

---

## FASE 9: Tema por Fonte (em andamento)
- Podcast theme movido de Settings para cada fonte individual
- Coluna podcast_theme adicionada em source_connections
- Worker agrupa por tema e gera podcasts separados
- Calculadora de preco na LP calcula com base nas fontes

---

## Git Commits desta Sessao
1. `71ff048` — Audio tematico + fix delivery (28 files, +5369 -1092)
2. `46dfcf5` — Otimizacoes completas (15 files, +1165 -507)
3. `29502df` — Novas fontes + prompts + mobile LP + pricing (12 files, +1880 -177)
4. Proximo commit: tema por fonte + historico

## Arquivos Modificados (total)
### Backend (apps/api/src/)
- server.ts — health, CORS, graceful shutdown, timing logs
- middleware/auth.ts — plan limits atualizados
- routes/webhooks.ts — rate limiting
- routes/sources.ts — novos tipos de fonte
- routes/settings.ts — sem alteracao nesta sessao
- routes/digests.ts — sem alteracao nesta sessao
- services/ai.ts — prompts reescritos, retry, timeout
- services/tts.ts — voice direction por tema
- services/youtube-processor.ts — YouTube Data API v3
- services/source-fetcher.ts — novos processadores + timeouts
- services/news-fetcher.ts — diversidade + dedup
- services/crm-processor.ts — NOVO
- services/flights-processor.ts — NOVO
- services/calendar-processor.ts — NOVO
- services/prices-processor.ts — NOVO
- services/media-processor.ts — sem alteracao (ja funcionava)
- workers/digest.ts — timing, retry WhatsApp, content summary, tema por fonte

### Frontend (apps/web/src/)
- app/page.tsx — LP completa refeita
- app/layout.tsx — SEO metadata
- app/globals.css — mobile, scroll, pricing fix, custom plan
- app/dashboard/page.tsx — digest count exato
- app/dashboard/layout.tsx — sem alteracao
- app/dashboard/configuracoes/page.tsx — tema removido (movido para fontes)
- app/dashboard/fontes/page.tsx — tema selector, novos tipos
- app/dashboard/noticias/page.tsx — sem alteracao
- app/dashboard/resumos/page.tsx — console.log removido
- app/dashboard/resumos/[id]/page.tsx — audio player melhorado
- components/theme-provider.tsx — FOUC prevention
- lib/api.ts — retry logic

### Infra
- ecosystem.config.cjs — NOVO
- .env — UAZAPI_URL + GOOGLE_API_KEY atualizado
- docs/SESSAO-03ABR-COMPLETA.md — este arquivo

## Estado dos Servicos
- podcastia-api: online, 0 unstable restarts
- podcastia-web: online (standalone mode), 0 unstable restarts
- Scheduler: ativo, heartbeat 30min
- Worker: ativo, concurrency 2
- Whisper: ativo (localhost:5005)
- UAZAPI: conectado (Raphael + Alex)

## Para Continuar
1. Ler este arquivo para contexto completo
2. Verificar pm2 status
3. Verificar git log --oneline -5
4. Verificar pm2 logs podcastia-api --lines 20 --nostream
