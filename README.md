# PodcastIA

SaaS para geracao automatica de podcasts utilizando Inteligencia Artificial.

## Funcionalidades

- **Geracao de Podcasts**: Criacao automatica de episodios com IA
- **Gestao de Fontes**: Importacao e gerenciamento de fontes de conteudo
- **Resumos Automaticos**: Geracao de resumos inteligentes
- **Integracao WhatsApp**: Envio automatico via UAZAPI
- **Automacao**: Pipelines n8n para captura e geracao de conteudo

## Estrutura do Projeto

```
/opt/podcastia
├── apps/           # Aplicacoes (frontend e API)
├── packages/       # Pacotes compartilhados
├── infra/          # Configuracoes de infraestrutura
└── docs/           # Documentacao
```

## Stack

- **Frontend**: React + Vite
- **Backend**: Node.js
- **Banco de Dados**: Supabase (PostgreSQL)
- **WhatsApp**: UAZAPI (multi-instancia)
- **Automacao**: n8n
- **Deploy**: PM2 + Nginx

## URLs

- Frontend: https://podcastia.solutionprime.com.br
- API: https://api-podcastia.solutionprime.com.br
