# PodcastIA - Sessao 06/Abril/2026 (COMPLETA)

## Resumo
Sessao de finalizacao de pendencias + nova feature Google Search (passagens e produtos).

---

## 1. Pendencias Concluidas (da sessao 04-05/Abr)

### 1.1 Git Commit + Push
- 6 commits pushados para main nesta sessao
- Todos arquivos da Maia, estudo academico, admin, acentuacao commitados

### 1.2 Debug Logs Removidos
- Webhook-Debug e FULL MSG removidos de webhooks.ts
- API reiniciada sem debug logs

### 1.3 YouTube Data API v3
- API ativada no Google Cloud Console (projeto gen-lang-client-0664294595 / numero 1023306039794)
- Nova API key "PodcastIA YouTube Key" criada (restrita a YouTube Data API v3)
- YOUTUBE_API_KEY adicionada ao .env e env.ts
- youtube-processor.ts atualizado: linhas 73,121 usam YOUTUBE_API_KEY, linhas 185,259 mantém GOOGLE_API_KEY
- **CRITICO**: Generative Language API e YouTube Data API NAO podem ser combinadas na mesma key restriction

### 1.4 Teste E2E Completo
- Fonte YouTube criada via API (Rick Astley como teste)
- Pipeline completo: YouTube Data API → Gemini fileData → GPT script → Gemini TTS → WhatsApp delivery
- Tempo total: 102.5 segundos, audio 165s (2:45min)
- Entregue com sucesso para 5545988445934

### 1.5 Modelo GPT Upgrade
- Maia conversa principal: gpt-4o-mini → gpt-4o (melhor ACTION tags)
- Chat digest mantém gpt-4o-mini (nao precisa de ACTION tags)

---

## 2. Nova Feature: Google Search Integration

### 2.1 Arquitetura
- Novo servico: apps/api/src/services/google-search.ts
- Usa Gemini com Google Search grounding (busca direto no Google em tempo real)
- NAO precisa de Programmable Search Engine (Custom Search API ativada mas nao usada)
- maxOutputTokens: 8192 (Gemini 2.5 gasta tokens em thinking)

### 2.2 Busca de Passagens (SEARCH_FLIGHTS)
- 2 novas actions na Maia: SEARCH_FLIGHTS e SEARCH_PRODUCTS (total 14 acoes)
- Mapa IATA com 50+ cidades brasileiras + internacionais
- Prompt em ingles para Gemini (melhores resultados)
- Retorna: precos em dinheiro, companhia, escalas (cidade + codigo + tempo conexao), duracao, melhor periodo
- Busca tambem precos em MILHAS: Smiles, LATAM Pass, TudoAzul, MaxMilhas
- Compara milhas vs dinheiro com veredicto
- Suporta: passengers (adultos), children (criancas), dates (periodo flexivel)

### 2.3 Busca de Produtos (SEARCH_PRODUCTS)
- Busca Google Shopping + e-commerce brasileiro
- Sites: MercadoLivre, Amazon, Magazine Luiza, Americanas, Casas Bahia, Kabum
- Retorna: 5 opcoes mais baratas com loja, preco e link

### 2.4 Fluxo da Maia para Passagens
- OBRIGATORIO perguntar antes de buscar:
  1) Origem e destino
  2) Quantos adultos
  3) Tem crianca? Quantas?
  4) Periodo/datas
- Se usuario informou tudo na mesma mensagem, busca direto
- Intent detection: detecta "passagem de X para Y" automaticamente

### 2.5 Podcast de Exemplo Gerado
- Fortaleza (FOR) → Foz do Iguacu (IGU), 1 adulto
- 5 opcoes encontradas: R$980 (GOL/GRU) a R$1.350 (LATAM/GRU)
- Script gerado via GPT-4o-mini: conversa Raphael + Maia
- Audio TTS gerado via Gemini: 2:36min, 2.4MB MP3
- Enviado via WhatsApp (UAZAPI) para 5545988445934
- Token UAZAPI correto: user_settings.wa_instance_token (NAO .env UAZAPI_TOKEN)

### 2.6 Custom Search API
- Ativada no Google Cloud mas NAO usada (Gemini grounding é superior)
- Pode ser usada no futuro para buscas mais estruturadas

---

## 3. Otimizacoes

- maxOutputTokens aumentado de 3000 para 8192 no google-search.ts
- temperature 0.1 para resultados mais consistentes
- Prompt em ingles para Gemini grounding (retorna dados mais reais)
- Limpeza de markdown nas respostas (WhatsApp nao suporta)

---

## 4. Arquivos Modificados/Criados

1. apps/api/src/services/google-search.ts (NOVO) - Gemini Google Search grounding
2. apps/api/src/services/isa.ts - 14 acoes, SEARCH_FLIGHTS/PRODUCTS, fluxo passagens
3. apps/api/src/services/youtube-processor.ts - YOUTUBE_API_KEY separada
4. apps/api/src/lib/env.ts - YOUTUBE_API_KEY adicionada
5. apps/api/src/routes/webhooks.ts - debug logs removidos

---

## 5. Commits

1. feat: Maia WhatsApp assistant, estudo academico, admin, acentuacao (21 files)
2. fix: separate YouTube API key, remove debug logs, enable YouTube Data API v3
3. feat: upgrade Maia to gpt-4o for better ACTION tag compliance
4. feat: Google Search integration — flights & products via Gemini grounding
5. feat: enhanced flight search — passenger details, layovers, IATA codes
6. feat: add miles pricing to flight search, increase maxOutputTokens to 8192

---

## 6. CRITICOs desta sessao

- **CRITICO**: YOUTUBE_API_KEY separada da GOOGLE_API_KEY (Generative Language nao combina com YouTube)
- **CRITICO**: Maia usa gpt-4o (conversa) e gpt-4o-mini (chat_digest)
- **CRITICO**: Token UAZAPI para enviar mensagem = user_settings.wa_instance_token (NAO .env)
- **CRITICO**: Gemini 2.5 gasta ~1400 tokens em thinking, maxOutputTokens precisa ser 8192+
- **CRITICO**: Prompt de busca em INGLES para Gemini grounding retorna dados melhores
- **CRITICO**: PCM audio do Gemini TTS precisa converter: ffmpeg -f s16le -ar 24000 -ac 1 -i input -codec:a libmp3lame output.mp3

---

## Para Retomar
1. Ler este arquivo: /opt/podcastia/docs/SESSAO-06ABR-COMPLETA.md
2. PM2: podcastia-api (porta 3001), podcastia-web
3. Git: github.com/raphaelvmclima/podcastia.git (branch main, up to date)
4. Google Cloud: projeto gen-lang-client-0664294595 (3 API keys, 3 APIs ativas)
5. Pendente: refinar busca de milhas (Gemini trunca), testar fluxo Maia WhatsApp completo com passagens
