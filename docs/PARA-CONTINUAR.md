# PodcastIA — Para Continuar

## Ultima Sessao: 03/Abril/2026
## Historico Completo: /opt/podcastia/docs/SESSAO-03ABR-COMPLETA.md

## Comandos Rapidos
pm2 status
pm2 logs podcastia-api --lines 20 --nostream
pm2 logs podcastia-web --lines 5 --nostream
curl -s http://localhost:3001/api/health
cd /opt/podcastia && git log --oneline -5

## Stack
- API: Fastify + BullMQ + Redis (porta 3001)
- Web: Next.js 15 standalone (porta 3002)
- DB: Supabase (mketzwackpvzgbxubxfs)
- TTS: Gemini 2.5 Flash Preview TTS
- Script: GPT-4o-mini
- WhatsApp: UAZAPI (loumarturismo.uazapi.com)
- Transcricao: Whisper (localhost:5005)

## Users
- Raphael: c8babea3-4b83-4173-939e-c386e479b3e9 (17:00 BRT)
- Alex: 40145793-63d8-47bb-b6e5-ba01b4aa561f (08:00 BRT)

## Pendencias
- Ativar YouTube Data API v3 no Google Cloud (projeto 1023306039794)
- Testar media processing end-to-end (enviar audio num grupo)
- Instagram, Twitter, Telegram, Email sources (em breve)
