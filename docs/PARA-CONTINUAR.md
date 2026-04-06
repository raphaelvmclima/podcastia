# PodcastIA — Para Continuar

## Ultima Sessao: 06/Apr/2026 (atualizado 02:17 BRT)
## Sessao Ativa: /opt/podcastia/docs/SESSAO-ATUAL.md
## Historico Completo: /opt/podcastia/docs/historico/

## Comandos Rapidos
pm2 status
pm2 logs podcastia-api --lines 20 --nostream
pm2 logs podcastia-web --lines 5 --nostream
curl -s http://localhost:3001/api/health
cd /opt/podcastia && git log --oneline -5
cat /opt/podcastia/docs/SESSAO-ATUAL.md

## Para retomar sessao com Claude:
# "Leia /opt/podcastia/docs/SESSAO-ATUAL.md e continue de onde paramos"

## Stack
- API: Fastify + BullMQ + Redis (porta 3001)
- Web: Next.js 15 standalone (porta 3002)
- DB: Supabase (mketzwackpvzgbxubxfs)
- TTS: Gemini 2.5 Flash Preview TTS
- Script: GPT-4o-mini
- WhatsApp: UAZAPI (loumarturismo.uazapi.com)

## Users
- Raphael: c8babea3-4b83-4173-939e-c386e479b3e9 (17:00 BRT)
- Alex: 40145793-63d8-47bb-b6e5-ba01b4aa561f (08:00 BRT)
