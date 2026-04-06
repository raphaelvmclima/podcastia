#!/bin/bash
# save-session.sh — Salva contexto de sessão para retomar depois
# Uso: ./save-session.sh "Descricao curta do que foi feito"
# Ou sem argumento para apenas atualizar timestamp

DOCS_DIR="/opt/podcastia/docs"
SESSION_FILE="$DOCS_DIR/SESSAO-ATUAL.md"
BACKUP_DIR="$DOCS_DIR/historico"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)
DATE_LABEL=$(date +%d/%b/%Y)

mkdir -p "$BACKUP_DIR"

# Se já existe sessão de outro dia, arquivar
if [ -f "$SESSION_FILE" ]; then
    OLD_DATE=$(head -5 "$SESSION_FILE" | grep "Data:" | grep -oP '\d{4}-\d{2}-\d{2}')
    if [ -n "$OLD_DATE" ] && [ "$OLD_DATE" != "$DATE" ]; then
        cp "$SESSION_FILE" "$BACKUP_DIR/sessao-${OLD_DATE}.md"
        echo "[BACKUP] Sessao anterior arquivada em $BACKUP_DIR/sessao-${OLD_DATE}.md"
    fi
fi

# Se não existe, criar com template
if [ ! -f "$SESSION_FILE" ]; then
    cat > "$SESSION_FILE" << EOF
# PodcastIA — Sessão Ativa

## Info
- **Data:** $DATE
- **Inicio:** $TIME BRT
- **Ultima atualizacao:** $TIME BRT

## Contexto Inicial
- PM2 status: $(pm2 jlist 2>/dev/null | python3 -c "import sys,json; [print(f\"  - {p['name']}: {p['pm2_env']['status']}\") for p in json.load(sys.stdin)]" 2>/dev/null || echo "N/A")
- Git: $(cd /opt/podcastia && git log --oneline -1 2>/dev/null || echo "N/A")
- Disk: $(df -h /opt/podcastia | tail -1 | awk '{print $4 " livre"}')

## O que foi feito
_(atualizar conforme progresso)_

## Onde paramos
_(atualizar antes de encerrar)_

## Proximos passos
_(pendencias identificadas)_

## Arquivos modificados
_(listar arquivos alterados nesta sessao)_

## Notas tecnicas
_(bugs, decisoes, descobertas)_
EOF
    echo "[CRIADO] $SESSION_FILE"
else
    # Atualizar timestamp
    sed -i "s/^- \*\*Ultima atualizacao:\*\*.*/- **Ultima atualizacao:** $TIME BRT/" "$SESSION_FILE"
fi

# Se recebeu descrição, adicionar ao log
if [ -n "$1" ]; then
    # Adicionar entrada no "O que foi feito"
    sed -i "/## O que foi feito/a\- [$TIME] $1" "$SESSION_FILE"
    echo "[LOG] Adicionado: $1"
fi

# Atualizar PARA-CONTINUAR.md com referência
cat > "$DOCS_DIR/PARA-CONTINUAR.md" << EOF
# PodcastIA — Para Continuar

## Ultima Sessao: $DATE_LABEL (atualizado $TIME BRT)
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
EOF

echo "[OK] Sessao salva em $SESSION_FILE"
echo "[OK] PARA-CONTINUAR.md atualizado"
