# PodcastIA — Sessao 03/Abril/2026

## Resumo
Auditoria completa do sistema, correcao de pendencias acumuladas e implementacao de audio tematico por estilo de podcast.

## Mudancas Realizadas

### 1. UAZAPI_URL Corrigido
- .env: `severo.uazapi.com` -> `loumarturismo.uazapi.com`
- Causa raiz do Alex nao receber podcasts (delivery_target="self" falhava ao resolver numero)

### 2. Fix Delivery do Alex
- Com UAZAPI_URL correto, a resolucao de "self" via /instance/status agora funciona
- catch silencioso substituido por console.error com mensagem
- Alex: 5511994319826 (numero resolve automaticamente da instancia UAZAPI)

### 3. Audio Tematico por Estilo (NOVO)
Cada tema agora tem configuracao de audio unica no TTS:

| Tema | Direcao de Voz | Temperatura | Volume Musica |
|------|---------------|-------------|---------------|
| conversa | Entusiastico, brincalhao | 1.2 | 0.08 |
| aula | Didatico, paciente, pedagogico | 0.9 | 0.05 |
| jornalistico | Profissional, serio, cadenciado | 0.8 | 0.06 |
| resumo | Direto, objetivo, assertivo | 0.7 | 0.04 |
| comentarios | Analitico, engajado | 1.1 | 0.07 |
| storytelling | Envolvente, dramatico | 1.3 | 0.10 |
| estudo_biblico | Reverente, sereno | 0.8 | 0.06 |
| debate | Energico, apaixonado | 1.3 | 0.07 |
| entrevista | Profissional, curioso | 1.0 | 0.06 |
| motivacional | MUITO energico, inspirador | 1.4 | 0.09 |

Arquivos: `tts.ts` (voice direction + temperature + music volume), `digest.ts` (passa theme ao TTS)

### 4. Titulos e Mensagens por Tema
- Digest title: "Jornal do dia", "Aula do dia", "Reflexao do dia", etc. (em vez de generico "Resumo do dia")
- WhatsApp: emoji + label do tema na mensagem de entrega

### 5. Console.logs Removidos
- `configuracoes/page.tsx:251,257` — [Settings] Saving/Save result
- `resumos/page.tsx:19` — Digests API response

### 6. Git Commit + Push
- 28 arquivos, 5369 insercoes, 1092 delecoes
- Push para github.com/raphaelvmclima/podcastia.git (main)
- PM2 save para persistir apos reboot

## Estado Atual
- API + Web online e funcionando
- Scheduler com heartbeat a cada 30min (BRT)
- Raphael: podcast as 17:00 BRT, tema conversa
- Alex: podcast as 08:00 BRT — agora deve receber corretamente
- 10 temas de podcast com audio diferenciado
- Webhooks WhatsApp recebendo normalmente

## Pendencias Restantes
- [ ] YouTube Data API v3 (nice-to-have, funciona sem ela via Gemini fileData)
- [ ] Investigar 245 restarts do PM2 (possivel memory leak)
- [ ] Testar processamento de midia em producao (enviar audio/PDF num grupo)
