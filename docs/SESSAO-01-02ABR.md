# PodcastIA — Sessao 01-02/Abril/2026

## Resumo da Sessao
Diagnostico completo do sistema que nao enviava podcasts desde 28/03. Corrigidos 10+ bugs, adicionadas features de YouTube com Gemini e processamento de midia WhatsApp (audio, imagem, video, PDF).

---

## 1. Problemas Encontrados e Corrigidos

### 1.1 Google API Key Expirada (CAUSA RAIZ)
- Key antiga `AIzaSyDz1PocPWmDlGmzuF_b5dP6DZvozD_0oqc` expirou
- Nova key: `AIzaSyCQ4jjp5AHoSXKTtc5YdxJ4LBGsHqN4QLM` (billing ativo, projeto 1023306039794)
- Modelo `gemini-2.0-flash` descontinuado para novas keys -> atualizado para `gemini-2.5-flash`
- TTS usa `gemini-2.5-flash-preview-tts` (funciona)
- **CRITICO**: maxOutputTokens deve ser 8192 (Gemini 2.5 gasta ~1400 tokens em "thinking", 1024 nao sobra nada)

### 1.2 Scheduler Parado Desde 28/03
- **Causa**: Cron callback async sem try/catch -> erro silencioso matava o cron
- **Fix**: try/catch em todo o callback + heartbeat a cada 30min (`*/30 * * * *`)
- **Timezone**: Servidor em UTC, usuarios em BRT. Scheduler agora converte para BRT (-3h)
- Arquivo: `apps/api/src/services/scheduler.ts`

### 1.3 Worker Supabase Writes Silenciosos
- Inserts/updates no Supabase sem error checking -> falhas silenciosas
- **Fix**: Adicionado destructuring de `{ error }` + console.error em todas operacoes
- **CRITICO**: Apos PM2 restart, Supabase client pode ter conexao stale. Esperar ~15s antes de usar
- Arquivo: `apps/api/src/workers/digest.ts`

### 1.4 Webhook Timestamps Invalidos (Ano 58205+)
- UAZAPI manda messageTimestamp em formatos inconsistentes (s ou ms)
- **Fix**: Valida range 2020-2030, usa `new Date()` como fallback
- Arquivo: `apps/api/src/routes/webhooks.ts`

### 1.5 QR Code WhatsApp Nao Aparecia
- Backend retornava `qrcode` mas frontend esperava `qr`
- **Fix 1**: Alterado frontend para usar `qrcode` + tipo TypeScript atualizado
- **Fix 2**: Adicionado polling a cada 3s apos exibir QR (detecta conexao automaticamente)
- Arquivo: `apps/web/src/app/dashboard/fontes/page.tsx`

### 1.6 GPT Inventava Temas (Selic, futebol, etc.)
- Prompt tinha estrutura fixa: "Organize: 1) Economia 2) Geopolitica 3) Tech 4) SaaS 5) Futebol"
- GPT preenchia todos os temas mesmo com fontes so de tecnologia
- **Fix**: "Fale APENAS sobre o conteudo das fontes. NUNCA invente temas que nao estao nas mensagens"
- Arquivo: `apps/api/src/services/ai.ts`

### 1.7 Fontes Toggle Nao Persistia
- API retorna `is_active` mas frontend lia `source.active`
- **Fix**: Mapeamento `is_active -> active` no fetchSources
- Arquivo: `apps/web/src/app/dashboard/fontes/page.tsx`

### 1.8 Configuracoes Nao Salvavam
- **Problema 1**: handleSave mandava TODO o objeto settings (incluindo `id`, `user_id`, `wa_instance_token`) -> Supabase rejeitava
- **Fix**: Manda apenas campos editaveis: delivery_channel, delivery_target, schedule_times, timezone, audio_style, audio_voice
- **Problema 2**: Frontend usa `"self"/"contact"/"group"/"email"` mas backend usa `"whatsapp"` com delivery_target
- **Fix**: Mapeamento bidirecional no load (whatsapp->self) e save (self->whatsapp, target="self")
- **Problema 3**: schedule_times e array no banco `["08:00"]` mas input type="time" espera string
- **Fix**: Converte array->string no load, string->array no save
- Arquivo: `apps/web/src/app/dashboard/configuracoes/page.tsx`

### 1.9 Chat de Noticias Sem Resposta
- **Problema 1**: API retorna `res.response` mas frontend lia `res.message || res.content`
- **Fix**: Adicionado `res.response` como primeiro fallback
- **Problema 2**: parseNewsPreferences retornava keywords/topics vazios (GPT retornava markdown, JSON.parse falhava)
- **Fix**: Regex extrator de JSON + prompt mais estrito ("SOMENTE JSON, sem markdown")
- **Problema 3**: GPT adicionava temas extras alem do pedido pelo usuario
- **Fix**: Prompt "Extraia SOMENTE os temas que o usuario EXPLICITAMENTE mencionou"
- Arquivos: `apps/web/src/app/dashboard/noticias/page.tsx`, `apps/api/src/services/ai.ts`

---

## 2. Features Novas

### 2.1 YouTube Processor com Gemini fileData
- Reescrito do zero para suportar **canais** E **videos individuais**
- Gemini 2.5 Flash CONSEGUE assistir videos do YouTube via `fileData.fileUri` (timeout 120s)
- Se fileData falha (timeout), fallback: oEmbed titulo + Gemini pesquisa por texto
- oEmbed funciona sem auth para titulos, mas retorna 403 para alguns videos
- YouTube Data API v3 **NAO** esta ativada no projeto Google (1023306039794) — se ativada, o processor usa automaticamente para descriptions completas
- URL para ativar: https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=1023306039794
- Source-fetcher passa `source.name` para YouTube processor como fallback de titulo
- Arquivo: `apps/api/src/services/youtube-processor.ts`

### 2.2 Processamento de Midia WhatsApp
- **Novo arquivo**: `apps/api/src/services/media-processor.ts`
- Audio/PTT -> Whisper local (localhost:5005, endpoint `/transcrever`, JSON `{arquivo: path}`)
- Imagem -> Gemini 2.5 Flash Vision (inlineData base64)
- Video -> ffmpeg extrai audio -> Whisper transcreve
- PDF -> pdf-parse (import dinamico: `await import("pdf-parse")`)
- Webhook atualizado para detectar e processar midia antes de descartar
- Body limit do Fastify aumentado para 50MB
- No podcast aparece como: `[Audio transcrito]`, `[Imagem]`, `[Video transcrito]`, `[PDF]`
- Arquivos: `apps/api/src/services/media-processor.ts`, `apps/api/src/routes/webhooks.ts`, `apps/api/src/server.ts`

---

## 3. Estado Atual dos Usuarios

### Raphael (c8babea3-4b83-4173-939e-c386e479b3e9)
- Schedule: 08:00 BRT (alteravel pelo frontend, agora funciona)
- WhatsApp: conectado (5545988445934), instancia pdia_c8babea34b83
- Fontes ativas: 2 videos G4 YouTube + G1 RSS + TechCrunch RSS + Folha SP RSS + Fireship YouTube + Noticias (IA, startups, SaaS)
- Podcasts entregues com sucesso nesta sessao: 5+

### Alex (40145793-63d8-47bb-b6e5-ba01b4aa561f)
- Schedule: 08:00 BRT
- WhatsApp: conectado (5511994319826), instancia pdia_4014579363d8
- Fontes ativas: WhatsApp "DIRETORIA - SOLUTION PRIME" + Noticias personalizadas (muitos keywords)
- Podcast entregue com sucesso nesta sessao: 1

---

## 4. Arquivos Modificados Nesta Sessao

### Backend (apps/api/src/)
- `server.ts` — bodyLimit 50MB para midia
- `services/scheduler.ts` — try/catch + BRT timezone + heartbeat 30min
- `services/ai.ts` — prompt sem temas fixos + parseNewsPreferences estrito
- `services/youtube-processor.ts` — REESCRITO: fileData + oEmbed + video individual + fallback
- `services/source-fetcher.ts` — passa source.name para YouTube processor
- `services/media-processor.ts` — NOVO: audio/imagem/video/PDF processing
- `services/tts.ts` — modelo atualizado (gemini-2.5-flash-preview-tts)
- `workers/digest.ts` — error logging Supabase
- `routes/webhooks.ts` — REESCRITO: processa midia + timestamps validos
- `routes/sources.ts` — sem alteracao

### Frontend (apps/web/src/)
- `app/dashboard/fontes/page.tsx` — QR code fix (qr->qrcode) + polling + is_active mapping
- `app/dashboard/configuracoes/page.tsx` — save apenas campos editaveis + delivery_channel mapping + schedule_times array/string
- `app/dashboard/noticias/page.tsx` — res.response fix
- `lib/api.ts` — sem alteracao

### Raiz
- `.env` — GOOGLE_API_KEY atualizada

---

## 5. Pendencias para Proxima Sessao

### Alta Prioridade
- [ ] Ativar YouTube Data API v3 no Google Cloud (descriptions completas dos videos)
- [ ] Testar processamento de midia em producao (mandar audio/imagem/PDF num grupo monitorado e gerar podcast)
- [ ] Monitorar se scheduler roda corretamente as 08:00 BRT (primeiro teste real sera amanha)
- [ ] WhatsApp instancia do Raphael desconectou antes ("logged out from another device") — monitorar estabilidade

### Media Prioridade
- [ ] Erro client-side nas paginas Fontes e Resumos (pendencia antiga, nao investigada)
- [ ] Gemini fileData timeout em videos longos (>120s) — considerar aumentar ou usar fallback mais agressivo
- [ ] Frontend: quando fonte de noticias e configurada via chat, a lista de fontes nao atualiza automaticamente
- [ ] Considerar adicionar mais tipos de fonte: Telegram, Instagram, Email

### Baixa Prioridade
- [ ] Remover debug console.logs do frontend (handleSave)
- [ ] pm2 save para persistir configuracao apos reboot do servidor
- [ ] Commit + push das alteracoes no Git

---

## 6. Comandos Uteis

```bash
# Restart API
pm2 restart podcastia-api --update-env

# Build + restart frontend
cd /opt/podcastia/apps/web && npx next build && pm2 restart podcastia-web

# Verificar scheduler
grep 'Heartbeat\|Scheduler\|Queued' /root/.pm2/logs/podcastia-api-out.log | tail -20

# Verificar worker
grep 'Worker\|Digest\|Duration\|delivered' /root/.pm2/logs/podcastia-api-out.log | tail -20

# Verificar erros
tail -30 /root/.pm2/logs/podcastia-api-error.log

# Gerar podcast manualmente (de dentro de /opt/podcastia)
DOTENV_CONFIG_PATH=/opt/podcastia/.env node --input-type=module -e "
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const redis = new Redis(process.env.REDIS_URL);
const queue = new Queue('digest-generation', { connection: redis });
const { data: job } = await supabase.from('digest_jobs').insert({ user_id: 'USER_ID_AQUI', status: 'pending', scheduled_at: new Date().toISOString() }).select().single();
await queue.add('generate', { jobId: job.id, userId: 'USER_ID_AQUI' });
console.log('Queued:', job.id);
await redis.quit(); process.exit(0);
"

# User IDs
# Raphael: c8babea3-4b83-4173-939e-c386e479b3e9
# Alex: 40145793-63d8-47bb-b6e5-ba01b4aa561f
```
