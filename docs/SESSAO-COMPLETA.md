# PodcastIA — Contexto Completo (Atualizado 26/03/2026)

## URLs de Produção
- Frontend: https://podcastia.solutionprime.com.br
- API: https://api-podcastia.solutionprime.com.br
- Health: https://api-podcastia.solutionprime.com.br/api/health

## Servidor
- IP: 72.62.13.20 (Hostinger VPS, Ubuntu 24.04, 16GB RAM)
- SSH: root@72.62.13.20 (chave SSH em ~/.ssh/id_ed25519)
- Projeto: /opt/podcastia/
- PM2: podcastia-api (porta 3001), podcastia-web (porta 3002)
- Nginx: /etc/nginx/sites-available/podcastia
- Traefik: /docker/n8n/traefik-dynamic/podcastia.yml
- .env: /opt/podcastia/.env
- Redis: localhost:6379

## Supabase
- Projeto: podcastia (ID: mketzwackpvzgbxubxfs)
- URL: https://mketzwackpvzgbxubxfs.supabase.co
- Regiao: sa-east-1 | Org: actsolutionsdigital@gmail.com (Pro)
- Tabelas: users, user_settings, source_connections, news_preferences, digest_jobs, digests, captured_messages
- Storage: bucket podcasts (privado) | RLS ativo
- Colunas extras user_settings: wa_instance_token, wa_instance_name

## Usuarios
- Raphael: raphaelvmclima@gmail.com / Senha1314* / business / c8babea3-4b83-4173-939e-c386e479b3e9
- Alex: alexjr.palmira@gmail.com / business / 40145793-63d8-47bb-b6e5-ba01b4aa561f

## Stack
- Frontend: Next.js 15 + CSS custom (dark/light/auto, glassmorphism)
- Backend: Fastify 5 + TypeScript (tsx)
- Banco: Supabase PostgreSQL + Auth + Storage
- Filas: BullMQ + Redis
- WhatsApp: UAZAPI multi-instancia (loumarturismo.uazapi.com)
- UAZAPI Admin Token: h2snGisFxSnUq13x7Ht0hRHthq8J6bNvSGhaS68cEciD0YMQaS
- IA: GPT-4o-mini (OpenAI)
- TTS: Gemini 2.5 Flash Preview TTS (multi-speaker Leo + Isa)
- Google API Key: AIzaSyDz1PocPWmDlGmzuF_b5dP6DZvozD_0oqc
- Audio: ffmpeg (PCM - MP3 - mix musica - OGG)
- PWA: manifest.json + service worker

## Arquivos Backend (apps/api/src/)
- server.ts — Fastify CORS (GET,POST,PUT,PATCH,DELETE,OPTIONS)
- routes/auth.ts — register, login, refresh, me, change-password
- routes/sources.ts — CRUD + WhatsApp multi-instancia UAZAPI
- routes/digests.ts — list, detail, generate-now, chat
- routes/settings.ts — get/update
- routes/webhooks.ts — recebe msgs WhatsApp (UAZAPI)
- routes/news.ts — chat IA noticias + auto-cria source
- services/ai.ts — GPT-4o-mini roteiros e chat
- services/tts.ts — Gemini TTS + ffmpeg
- services/uazapi.ts — send text/audio
- services/queue.ts — BullMQ
- services/scheduler.ts — cron cada minuto
- services/rss-processor.ts — parser RSS/Atom
- services/youtube-processor.ts — extrai channel_id + RSS
- services/news-fetcher.ts — Google News + RSS brasileiros
- services/source-fetcher.ts — orquestrador por tipo
- workers/digest.ts — busca TODAS fontes - GPT - TTS - ffmpeg - entrega WA

## Arquivos Frontend (apps/web/src/)
- app/globals.css — design premium 1034 linhas
- components/theme-provider.tsx — dark/light/auto
- app/layout.tsx — PWA + ThemeProvider + Inter
- app/page.tsx — landing
- app/login/page.tsx — login
- app/register/page.tsx — registro
- app/dashboard/layout.tsx — sidebar SVG + bottom nav + theme toggle
- app/dashboard/page.tsx — stats reais
- app/dashboard/fontes/page.tsx — 8 tipos fonte + WA QR
- app/dashboard/noticias/page.tsx — chat Claude AI style
- app/dashboard/resumos/page.tsx — lista paginada
- app/dashboard/resumos/[id]/page.tsx — player + roteiro + chat
- app/dashboard/configuracoes/page.tsx — entrega + horario + audio + tema + senha

## Fontes Funcionais
- WhatsApp: webhook UAZAPI
- Noticias IA: Google search + GPT
- RSS/Blog: parser RSS/Atom (G1, TechCrunch, Folha)
- YouTube: RSS do canal (Fireship)

## Fontes Visuais (nao capturam)
- Instagram, Twitter/X, Telegram, Email

## Fluxo Podcast
1. Scheduler verifica horarios agendados
2. Worker busca conteudo de TODAS fontes ativas
3. GPT gera roteiro (Leo + Isa)
4. Gemini TTS multi-speaker
5. ffmpeg mixa com musica
6. Upload Supabase Storage
7. Envia WhatsApp via UAZAPI

## Podcasts Gerados: 6 (Raphael) + 1 (Alex)

## Problemas Pendentes
- Gemini TTS rate limit 429 em geracoes seguidas
- UAZAPI /group/list trunca resposta 2MB
- Instagram/Twitter/Telegram/Email sao visuais
- Icones PWA sao SVG (browsers querem PNG)


## Ultima atualizacao: 26/03/2026 14:15 UTC

### Prompt do Podcast (atualizado)
- Isa abre: 'Ola pessoal, eu sou a Isa e estou aqui com meu amigo Leo!'
- Leo responde com saudacao propria
- NAO informa total de mensagens nem ranking de usuarios
- Organiza por tema/assunto, destaques primeiro
- Arquivo: /opt/podcastia/apps/api/src/services/ai.ts (funcao generatePodcastScript)

### Podcasts Gerados: 7 (Raphael) + 1 (Alex)
- Ultimo: Mix Tech+Brasil com novo prompt (158s) - RSS G1, TechCrunch, Fireship, Folha

### Fontes configuradas Raphael:
- G1 Tecnologia (rss) - FUNCIONAL
- TechCrunch (rss) - FUNCIONAL  
- Fireship (youtube) - FUNCIONAL
- Folha SP Mercado (rss) - FUNCIONAL
- Noticias personalizado (news)

### Tudo que funciona:
- Login/registro com plano correto
- Dashboard com stats reais
- Sidebar com SVG icons + theme toggle + bottom nav mobile
- Fontes: 8 tipos, WhatsApp QR, RSS/YouTube/News funcionais
- Noticias: chat IA estilo Claude
- Resumos: lista + detalhe com player + roteiro + chat
- Configuracoes: entrega + horario + audio + tema + senha
- Geracao podcast: busca TODAS fontes -> GPT -> Gemini TTS -> ffmpeg -> WhatsApp
- PWA instalavel
- Dark/light/auto theme
- SSL Let Encrypt em podcastia.solutionprime.com.br


## Ultima atualizacao: 26/03/2026 ~15:00 UTC

### Alteracoes desta sessao final:
- api.ts atualizado com AUTO-REFRESH de token (401 -> refresh -> retry -> login redirect)
- Prompt do podcast: Isa abre se apresentando, chama Leo, sem ranking usuarios/msgs
- Constraint captured_messages.source_type atualizada para incluir rss, youtube, etc
- Constraint source_connections.type atualizada para incluir rss, youtube, etc
- RSS processor, YouTube processor, News fetcher, Source fetcher deployados e funcionais
- Worker v3: busca TODAS fontes antes de gerar digest
- 7 podcasts gerados Raphael + 1 Alex
- Fontes Raphael: G1 Tech (rss), TechCrunch (rss), Fireship (youtube), Folha SP (rss), Noticias (news)
- Design: sidebar SVG + bottom nav + theme toggle + glassmorphism
- Config: radio cards + tema visual + troca senha
- SSL: podcastia.solutionprime.com.br + api-podcastia.solutionprime.com.br

### Para continuar na proxima sessao:
1. Ler este arquivo: /opt/podcastia/docs/SESSAO-COMPLETA.md
2. Verificar pm2 status
3. Pendencias: design fontes, Instagram/Twitter/Telegram/Email funcionais, icones PWA PNG
