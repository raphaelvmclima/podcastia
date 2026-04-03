# PodcastIA - Sessão 03/Abril/2026

## Resumo da Sessão
Sessão de otimização completa do PodcastIA: LP, temas de podcast, upload de arquivos, integrações, revisão ortográfica e correção de bugs críticos.

## Alterações Realizadas

### 1. Backend - 10 Temas de Podcast
- Arquivo: 
- Adicionados 10 temas com prompts únicos: Conversa, Aula, Jornalístico, Resumo Executivo, Comentários, Storytelling, Estudo Bíblico, Debate, Entrevista, Motivacional
- Cada tema tem uid=197610(rapha) gid=197610 groups=197610, , , ,  e prompt GPT customizado
- Função  gera prompt específico por tema
-  aceita parâmetro  (default: conversa)
- Coluna  adicionada em  (Supabase)

### 2. Backend - Upload de Arquivos
- Arquivo: 
- Endpoint  com multipart
- Suporta PDF (pdf-parse), imagens (Gemini Vision), texto
- Bucket  criado no Supabase Storage
- Pacotes: ,  instalados
- Arquivo:  - multipart registrado

### 3. Backend - Bugs Críticos Corrigidos
- **RLS Supabase**: Adicionadas políticas  em TODAS as 7 tabelas
- **TTS fade-out**:  escapado para  (shell passthrough)
- **Audio URL 24h**: Signed URLs regeneradas on-demand no GET /api/digests/:id
- **Data BRT**: Removido , substituído por cálculo BRT manual
- **UAZAPI URL**: Agora usa  em vez de hardcoded
- **Música cache**: Background music cacheada localmente em 
- **RSS dedup**: Deduplicação por conteúdo antes de inserir mensagens
- **Limite msgs**:  no fetch de mensagens não processadas
- **Storage error**: Adicionada verificação de erro no upload Supabase Storage
- **Themes endpoint**: Movido  para fora do auth middleware
- **CHECK constraint**: Adicionados , , ,  ao constraint de source_type

### 4. Frontend - Landing Page
- Arquivo: 
- Nova seção Estilos de Podcast com 10 cards interativos + auto-rotação
- Fonte Arquivos adicionada com ícone
- 4 integrações futuras: Passagens Aéreas, CRM, Google Agenda, Preços (badge Em breve)
- Hero atualizado: badge, stats (10 estilos, 11 fontes)
- FAQ expandido com perguntas sobre temas e upload
- Pricing atualizado com features de upload
- Nav com link Estilos
-  simplificado (return true) para evitar crashes de rendering

### 5. Frontend - Dashboard
- **Configurações** (): Seletor visual de temas com 10 cards
- **Fontes** (): Upload drag-and-drop + 4 integrações Em breve
- **Vozes**: Corrigido de OpenAI (onyx/nova) para Gemini TTS (Sadachbia=Leo, Leda=Isa)

### 6. Revisão Ortográfica (~100+ correções)
Arquivos corrigidos: page.tsx, configuracoes, fontes, ai.ts, noticias, register, layout
- Todas as palavras sem acento corrigidas (Ouça, Começar, Jornalístico, etc.)
- MIME type  corrigido para  em noticias
- Cores hardcoded substituídas por CSS variables

### 7. CSS
- Arquivo: 
- Adicionados estilos para grid de temas (.lp-themes-grid)
- Demo player styles
- Responsive improvements (380px, 480px, 640px, tablet, desktop)
- Badge Em breve (.lp-badge-soon)
- Removidos CSS duplicados e  (problemas de compositing)

## Teste dos 10 Temas de Podcast
Todos testados com conteúdo real (Tech, Economia, Turismo, Negócios):
- Conversa: 4min 39s ✅
- Aula: 6min 31s ✅
- Jornalístico: 5min 05s ✅
- Resumo: 5min 48s ✅
- Comentários: 6min 09s ✅
- Storytelling: 5min 22s ✅
- Estudo Bíblico: 6min 22s ✅
- Debate: 5min 42s ✅
- Entrevista: (em andamento)
- Motivacional: (em andamento)

## Pendências
- Scroll reveal animation (desativado por performance - useInView retorna true)
- Integrações futuras: Passagens, CRM, Google Agenda, Preços (stubs Em breve)
- Email delivery (não implementado no backend, mostrado como opção)
- Google News scraping pode quebrar (HTML regex frágil)
- WhatsApp instance tokens em plain text no DB

## Stack
- Frontend: Next.js 15.3 + React 19 + CSS custom
- Backend: Fastify 5 + BullMQ + Redis
- IA: GPT-4o-mini (script) + Gemini 2.5 Flash TTS (áudio)
- DB: Supabase (PostgreSQL)
- WhatsApp: UAZAPI multi-instance
- Deploy: PM2 (podcastia-api:3001, podcastia-web:3002)
