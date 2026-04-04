"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface Source {
  id: string;
  type: string;
  name: string;
  active: boolean;
  config?: Record<string, any>;
  podcast_theme?: string;
  created_at: string;
}

interface WaGroup {
  id: string;
  name: string;
  type: "group" | "contact";
}

interface FormField {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password" | "select" | "textarea";
  options?: string[];
  optional?: boolean;
}

const SOURCE_TYPES = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    desc: "Grupos e contatos",
    color: "var(--success)",
    bg: "var(--success-subtle)",
    status: "active",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    id: "rss",
    name: "RSS",
    desc: "Feeds de notícias",
    color: "#FF8C00",
    bg: "var(--warning-subtle)",
    status: "active",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a9 9 0 0 1 9 9" />
        <path d="M4 4a16 16 0 0 1 16 16" />
        <circle cx="5" cy="19" r="1" />
      </svg>
    ),
  },
  {
    id: "youtube",
    name: "YouTube",
    desc: "Canais e playlists",
    color: "#FF0000",
    bg: "rgba(255, 0, 0, 0.08)",
    status: "active",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
      </svg>
    ),
  },
  {
    id: "http_request",
    name: "HTTP Request",
    desc: "APIs e endpoints",
    color: "#10B981",
    bg: "#ecfdf5",
    status: "active",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    id: "webhook",
    name: "Webhook",
    desc: "Receber dados externos",
    color: "#F59E0B",
    bg: "var(--warning-subtle)",
    status: "active",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
        <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
        <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8H12" />
      </svg>
    ),
  },
  {
    id: "file",
    name: "Arquivo",
    desc: "PDFs, imagens e textos",
    color: "#06B6D4",
    bg: "rgba(6, 182, 212, 0.12)",
    status: "active",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    id: "instagram",
    name: "Instagram",
    desc: "Posts e stories",
    color: "#E1306C",
    bg: "#fce4ec",
    status: "soon",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    desc: "Perfis e buscas",
    color: "var(--fg)",
    bg: "var(--bg-secondary)",
    status: "soon",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: "telegram",
    name: "Telegram",
    desc: "Canais e grupos",
    color: "#0088cc",
    bg: "#e3f2fd",
    status: "soon",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
  },
  {
    id: "email",
    name: "Email",
    desc: "Newsletters",
    color: "var(--primary)",
    bg: "var(--primary-subtle)",
    status: "soon",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    id: "noticias-ia",
    name: "Notícias IA",
    desc: "Curadoria com IA",
    color: "#8B5CF6",
    bg: "#ede9fe",
    status: "active",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    id: "passagens",
    name: "Passagens Aéreas",
    desc: "Monitore preços por destino",
    color: "#0EA5E9",
    bg: "rgba(14, 165, 233, 0.12)",
    status: "active",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
      </svg>
    ),
  },
  {
    id: "crm",
    name: "CRM",
    desc: "Integre seu CRM (HubSpot, FlwChat)",
    color: "#F97316",
    bg: "rgba(249, 115, 22, 0.12)",
    status: "active",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: "google_calendar",
    name: "Google Agenda",
    desc: "Resumo de compromissos e reuniões",
    color: "#4285F4",
    bg: "rgba(66, 133, 244, 0.12)",
    status: "active",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>
      </svg>
    ),
  },
  {
    id: "google_shopping",
    name: "Precos de Produtos",
    desc: "Monitore precos em lojas online",
    color: "#EA4335",
    bg: "rgba(234, 67, 53, 0.12)",
    status: "active",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
    ),
  },
];

const FORM_FIELDS: Record<string, FormField[]> = {
  rss: [{ key: "url", label: "URL do Feed RSS", placeholder: "https://exemplo.com/feed.xml" }],
  youtube: [{ key: "url", label: "URL do Canal ou Playlist", placeholder: "https://youtube.com/@canal" }],
  instagram: [{ key: "url", label: "URL do Perfil", placeholder: "https://instagram.com/perfil" }],
  twitter: [{ key: "url", label: "URL do Perfil ou Busca", placeholder: "https://x.com/perfil" }],
  telegram: [
    { key: "url", label: "URL do Canal", placeholder: "https://t.me/canal" },
    { key: "bot_token", label: "Token do Bot (BotFather)", placeholder: "123456:ABC-DEF1234...", optional: true },
  ],
  email: [
    { key: "email", label: "Endereço de Email", placeholder: "newsletter@exemplo.com" },
    { key: "imap_host", label: "Servidor IMAP", placeholder: "imap.gmail.com" },
    { key: "imap_port", label: "Porta IMAP", placeholder: "993", optional: true },
    { key: "password", label: "Senha / App Password", placeholder: "", type: "password" },
  ],
  http_request: [
    { key: "url", label: "URL do Endpoint", placeholder: "https://api.exemplo.com/data" },
    { key: "method", label: "Método HTTP", placeholder: "GET", type: "select", options: ["GET", "POST", "PUT", "PATCH"] },
    { key: "headers", label: "Headers (JSON)", placeholder: '{"Authorization": "Bearer token123"}', type: "textarea", optional: true },
    { key: "body", label: "Body (JSON)", placeholder: '{"key": "value"}', type: "textarea", optional: true },
  ],
  webhook: [],
  crm: [
    { key: "provider", label: "Provedor CRM", placeholder: "flw", type: "select", options: ["flw", "hubspot", "custom"] },
    { key: "apiUrl", label: "URL da API", placeholder: "https://api.flw.chat" },
    { key: "apiToken", label: "Token da API", placeholder: "seu-token-aqui", type: "password" },
    { key: "filters", label: "Filtros (opcional)", placeholder: "departamento, status...", optional: true },
  ],
  passagens: [
    { key: "keywords", label: "Destinos ou palavras-chave (separados por virgula)", placeholder: "Lisboa, Orlando, Paris" },
    { key: "feedUrls", label: "URLs de feeds RSS (opcional, um por linha)", placeholder: "https://www.melhoresdestinos.com.br/feed", type: "textarea", optional: true },
  ],
  google_calendar: [
    { key: "icalUrl", label: "URL do calendario iCal (.ics)", placeholder: "https://calendar.google.com/calendar/ical/...@group.calendar.google.com/public/basic.ics" },
  ],
  google_shopping: [
    { key: "products", label: "Produtos para monitorar (separados por virgula)", placeholder: "iPhone 15 Pro, MacBook Air M3, Galaxy S24" },
    { key: "region", label: "Regiao (opcional)", placeholder: "Brasil", optional: true },
    { key: "feedUrls", label: "URLs de feeds de promocoes (opcional, um por linha)", placeholder: "https://www.promobit.com.br/feed", type: "textarea", optional: true },
  ],
};

const COMING_SOON = new Set(["instagram", "twitter", "telegram", "email"]);

const PODCAST_THEMES = [
  { id: "conversa", name: "Conversa", icon: "\u{1F4AC}", desc: "Dois hosts conversando naturalmente" },
  { id: "aula", name: "Aula", icon: "\u{1F393}", desc: "Professor explicando de forma did\u00e1tica" },
  { id: "jornalistico", name: "Jornal\u00edstico", icon: "\u{1F4F0}", desc: "Formato telejornal profissional" },
  { id: "resumo", name: "Resumo Executivo", icon: "\u{1F4CB}", desc: "Direto ao ponto, focado em a\u00e7\u00e3o" },
  { id: "comentarios", name: "Coment\u00e1rios", icon: "\u{1F5E3}\uFE0F", desc: "An\u00e1lise opinativa com debates" },
  { id: "storytelling", name: "Storytelling", icon: "\u{1F4D6}", desc: "Not\u00edcias como hist\u00f3rias envolventes" },
  { id: "estudo_biblico", name: "Estudo B\u00edblico", icon: "\u{1F4D5}", desc: "Reflex\u00f5es com base b\u00edblica" },
  { id: "debate", name: "Debate", icon: "\u2694\uFE0F", desc: "Hosts debatendo com posi\u00e7\u00f5es opostas" },
  { id: "entrevista", name: "Entrevista", icon: "\u{1F3A4}", desc: "Formato pergunta e resposta" },
  { id: "motivacional", name: "Motivacional", icon: "\u{1F525}", desc: "Conte\u00fado inspirador e pr\u00e1tico" },
];



export default function FontesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<{ connected: boolean; qrcode?: string } | null>(null);
  const [waGroups, setWaGroups] = useState<WaGroup[]>([]);
  const [waSearch, setWaSearch] = useState("");
  const [waFilter, setWaFilter] = useState<"all" | "groups" | "contacts">("all");
  const [selectedGroups, setSelectedGroups] = useState<WaGroup[]>([]);
  const [formName, setFormName] = useState("");
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("conversa");
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [editingThemeValue, setEditingThemeValue] = useState("conversa");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      const res = await api("/api/sources");
      const raw = res?.sources || res || [];
      setSources(raw.map((s: any) => ({ ...s, active: s.is_active ?? s.active ?? false })));
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleTypeClick = async (typeId: string) => {
    if (COMING_SOON.has(typeId)) {
      setShowTypeSelector(false);
      return;
    }
    setShowTypeSelector(false);

    if (typeId === "noticias-ia") {
      window.location.href = "/dashboard/noticias";
      return;
    }
    if (typeId === "file") {
      setActivePanel("file");
      return;
    }
    if (typeId === "whatsapp") {
      setActivePanel("wa-connect");
      try {
        const res = await api("/api/sources/whatsapp/status");
        setWaStatus(res);
        if (res?.connected) {
          setActivePanel("wa-groups");
          loadGroups();
        }
      } catch {
        /* empty */
      }
      return;
    }
    setActivePanel(typeId);
    setFormName("");
    setFormConfig(typeId === "http_request" ? { method: "GET" } : {});
    setSelectedTheme("conversa");
  };

  const loadGroups = async (search?: string, filter?: string) => {
    setLoadingGroups(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter && filter !== "all") params.set("filter", filter);
      const res = await api(`/api/sources/whatsapp/groups?${params.toString()}`);
      setWaGroups(res?.items || res?.groups || res || []);
    } catch {
      /* empty */
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleWaConnect = async () => {
    try {
      const res = await api("/api/sources/whatsapp/connect", { method: "POST" });
      setWaStatus(res);
      if (res?.qrcode && !res?.connected) {
        const pollInterval = window.setInterval(async () => {
          try {
            const status = await api("/api/sources/whatsapp/status");
            if (status?.connected) {
              window.clearInterval(pollInterval);
              setWaStatus({ connected: true });
              setActivePanel("wa-groups");
              loadGroups();
            }
          } catch { /* ignore */ }
        }, 3000);
        setTimeout(() => window.clearInterval(pollInterval), 120000);
      }
    } catch {
      /* empty */
    }
  };

  const handleWaDisconnect = async () => {
    try {
      await api("/api/sources/whatsapp/disconnect", { method: "POST" });
      setWaStatus({ connected: false });
      setActivePanel(null);
    } catch {
      /* empty */
    }
  };

  const handleWaRefreshGroups = async () => {
    try {
      await api("/api/sources/whatsapp/refresh-groups", { method: "POST" });
      loadGroups(waSearch, waFilter);
    } catch {
      /* empty */
    }
  };

  const handleSaveWaGroups = async () => {
    if (selectedGroups.length === 0) return;
    setSaving(true);
    try {
      await api("/api/sources/whatsapp/groups", {
        method: "POST",
        body: JSON.stringify({ groups: selectedGroups.map((g) => ({ id: g.id, name: g.name })), podcast_theme: selectedTheme }),
      });
      setSelectedGroups([]);
      setActivePanel(null);
      fetchSources();
    } catch {
      /* empty */
    } finally {
      setSaving(false);
    }
  };

  const handleAddSource = async () => {
    if (!formName.trim() || !activePanel) return;

    const fields = FORM_FIELDS[activePanel] || [];
    const requiredFields = fields.filter((f) => !f.optional);
    if (activePanel !== "webhook" && requiredFields.some((f) => !formConfig[f.key]?.trim())) return;

    setSaving(true);
    try {
      // Transform config for source types that need arrays
      const finalConfig: Record<string, any> = { ...formConfig };
      if (activePanel === "passagens") {
        if (finalConfig.keywords) finalConfig.keywords = finalConfig.keywords.split(",").map((s: string) => s.trim()).filter(Boolean);
        if (finalConfig.feedUrls) finalConfig.feedUrls = finalConfig.feedUrls.split("\n").map((s: string) => s.trim()).filter(Boolean);
      }
      if (activePanel === "google_shopping") {
        if (finalConfig.products) finalConfig.products = finalConfig.products.split(",").map((s: string) => s.trim()).filter(Boolean);
        if (finalConfig.feedUrls) finalConfig.feedUrls = finalConfig.feedUrls.split("\n").map((s: string) => s.trim()).filter(Boolean);
      }
      const res = await api("/api/sources", {
        method: "POST",
        body: JSON.stringify({ type: activePanel, name: formName, config: finalConfig, podcast_theme: selectedTheme }),
      });
      setActivePanel(null);
      setShowTypeSelector(false);
      fetchSources();
    } catch {
      /* empty */
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api(`/api/sources/${id}/toggle`, { method: "PATCH" });
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
    } catch {
      /* empty */
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/api/sources/${id}`, { method: "DELETE" });
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch {
      /* empty */
    }
  };

  const toggleGroupSelection = (group: WaGroup) => {
    setSelectedGroups((prev) =>
      prev.find((g) => g.id === group.id) ? prev.filter((g) => g.id !== group.id) : [...prev, group]
    );
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const session = JSON.parse(localStorage.getItem("podcastia_session") || "{}");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/sources/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload falhou");
      const data = await res.json();
      fetchSources();
      setActivePanel(null);
    } catch (err: any) {
      setUploadError("Erro no upload: " + err.message);
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setUploading(false);
    }
  };


  useEffect(() => {
    if (activePanel === "wa-groups") {
      loadGroups(waSearch, waFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waSearch, waFilter]);

  const getTypeInfo = (typeId: string) => SOURCE_TYPES.find((t) => t.id === typeId);

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    background: "var(--bg)",
    color: "var(--fg)",
    fontSize: "var(--text-sm)",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  const renderFormField = (field: FormField) => {
    if (field.type === "select") {
      return (
        <select
          value={formConfig[field.key] || field.options?.[0] || ""}
          onChange={(e) => setFormConfig((c) => ({ ...c, [field.key]: e.target.value }))}
          style={inputStyle}
        >
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    if (field.type === "textarea") {
      return (
        <textarea
          placeholder={field.placeholder}
          value={formConfig[field.key] || ""}
          onChange={(e) => setFormConfig((c) => ({ ...c, [field.key]: e.target.value }))}
          style={{ ...inputStyle, minHeight: "60px", resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
          rows={3}
        />
      );
    }
    return (
      <input
        type={field.type || "text"}
        placeholder={field.placeholder}
        value={formConfig[field.key] || ""}
        onChange={(e) => setFormConfig((c) => ({ ...c, [field.key]: e.target.value }))}
        style={inputStyle}
      />
    );
  };

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--fg)", margin: 0 }}>Fontes</h1>
        <button
          className={showTypeSelector ? "btn-ghost" : "btn-primary"}
          onClick={() => {
            setShowTypeSelector(!showTypeSelector);
            if (showTypeSelector) setActivePanel(null);
          }}
          style={{ fontSize: "var(--text-sm)" }}
        >
          {showTypeSelector ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Cancelar
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adicionar fonte
            </>
          )}
        </button>
      </div>

      {/* Source type selector */}
      {showTypeSelector && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", margin: 0 }}>
            Escolha o tipo de fonte para adicionar:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
            {SOURCE_TYPES.map((type) => (
              <div
                key={type.id}
                className="card card-interactive"
                onClick={() => handleTypeClick(type.id)}
                style={{
                  padding: "14px 10px",
                  cursor: type.status === "soon" ? "default" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  textAlign: "center",
                  opacity: type.status === "soon" ? 0.5 : 1,
                  position: "relative",
                }}
              >
                {type.status === "soon" && (
                  <span style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "#F59E0B",
                    background: "var(--warning-subtle)",
                    padding: "1px 5px",
                    borderRadius: "4px",
                    border: "1px solid #FDE68A",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}>
                    Em breve
                  </span>
                )}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: type.bg,
                    color: type.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {type.icon}
                </div>
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--fg)" }}>{type.name}</div>
                  <div style={{ fontSize: "10px", color: "var(--fg-muted)", marginTop: "2px" }}>{type.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WhatsApp Connect Panel */}
      {activePanel === "wa-connect" && (
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--fg)", margin: 0 }}>Conectar WhatsApp</h2>
            <button className="btn-ghost" onClick={() => setActivePanel(null)} style={{ fontSize: "var(--text-sm)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {waStatus?.connected ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--success)", fontSize: "var(--text-sm)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Conectado
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn-primary" onClick={() => { setActivePanel("wa-groups"); loadGroups(); }}>
                  Selecionar grupos
                </button>
                <button className="btn-ghost" onClick={handleWaDisconnect} style={{ color: "var(--danger)" }}>
                  Desconectar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
              {waStatus?.qrcode ? (
                <div style={{ padding: "16px", background: "white", borderRadius: "var(--radius-md)" }}>
                  <img src={waStatus.qrcode} alt="QR Code" style={{ width: "200px", height: "200px" }} />
                </div>
              ) : (
                <div style={{ width: "200px", height: "200px", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>QR Code</span>
                </div>
              )}
              <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", margin: 0, textAlign: "center" }}>
                Escaneie o QR code com seu WhatsApp para conectar
              </p>
              <button className="btn-primary" onClick={handleWaConnect}>Gerar QR Code</button>
            </div>
          )}
        </div>
      )}

      {/* WhatsApp Groups Panel */}
      {activePanel === "wa-groups" && (
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--fg)", margin: 0 }}>Selecionar grupos e contatos</h2>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn-ghost" onClick={handleWaRefreshGroups} style={{ fontSize: "var(--text-sm)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
              <button className="btn-ghost" onClick={() => setActivePanel(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          <div style={{ position: "relative", marginBottom: "12px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar..."
              value={waSearch}
              onChange={(e) => setWaSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "36px" }}
            />
          </div>
          <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
            {(["all", "groups", "contacts"] as const).map((f) => (
              <button
                key={f}
                className={f === waFilter ? "btn-primary" : "btn-ghost"}
                onClick={() => setWaFilter(f)}
                style={{ fontSize: "var(--text-xs)", padding: "4px 12px" }}
              >
                {f === "all" ? "Todos" : f === "groups" ? "Grupos" : "Contatos"}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "16px" }}>
            {loadingGroups ? (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="skeleton" style={{ height: "40px", borderRadius: "var(--radius-md)" }} />
                ))}
              </>
            ) : waGroups.length === 0 ? (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", textAlign: "center", padding: "24px 0" }}>
                Nenhum resultado encontrado
              </p>
            ) : (
              waGroups.map((group) => {
                const isSelected = selectedGroups.some((g) => g.id === group.id);
                return (
                  <div
                    key={group.id}
                    onClick={() => toggleGroupSelection(group)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      background: isSelected ? "var(--primary-subtle)" : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "4px",
                        border: isSelected ? "none" : "2px solid var(--border)",
                        background: isSelected ? "var(--primary)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {group.name}
                      </div>
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--fg-faint)", flexShrink: 0 }}>
                      {group.type === "group" ? "Grupo" : "Contato"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          {/* Estilo do Podcast para WhatsApp */}
          {selectedGroups.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", marginBottom: "6px", display: "block" }}>
                Estilo do Podcast para estes grupos
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "6px" }}>
                {PODCAST_THEMES.map((t) => {
                  const sel = selectedTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTheme(t.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 10px",
                        border: `2px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                        borderRadius: "var(--radius-md)",
                        background: sel ? "var(--primary-subtle)" : "var(--bg)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                        width: "100%",
                      }}
                    >
                      <span style={{ fontSize: "16px", flexShrink: 0 }}>{t.icon}</span>
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: sel ? 600 : 400, color: sel ? "var(--primary)" : "var(--fg)" }}>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
              {selectedGroups.length} selecionado{selectedGroups.length !== 1 ? "s" : ""}
            </span>
            <button className="btn-primary" onClick={handleSaveWaGroups} disabled={selectedGroups.length === 0 || saving} style={{ fontSize: "var(--text-sm)" }}>
              {saving ? "Salvando..." : "Salvar seleção"}
            </button>
          </div>
        </div>
      )}

      {/* File Upload Panel */}
      {activePanel === "file" && (
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--fg)", margin: 0 }}>
              Upload de Arquivo
            </h2>
            <button className="btn-ghost" onClick={() => setActivePanel(null)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#06B6D4"; e.currentTarget.style.background = "rgba(6, 182, 212, 0.08)"; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-secondary)"; }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background = "var(--bg-secondary)";
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
            style={{
              border: "2px dashed var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "40px 24px",
              textAlign: "center",
              background: "var(--bg-secondary)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFileUpload(file);
              };
              input.click();
            }}
          >
            {uploading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div className="skeleton" style={{ width: "48px", height: "48px", borderRadius: "50%" }} />
                <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", margin: 0 }}>Enviando arquivo...</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(6, 182, 212, 0.12)", color: "#06B6D4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--fg)", margin: "0 0 4px 0" }}>
                    Arraste um arquivo aqui ou clique para selecionar
                  </p>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", margin: 0 }}>
                    PDF, PNG, JPG, WebP, TXT, CSV
                  </p>
                </div>
              </div>
            )}
          </div>
          {uploadError && (
            <div style={{
              marginTop: "12px",
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "var(--danger-subtle)",
              color: "var(--danger)",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
            }}>
              {uploadError}
            </div>
          )}
        </div>
      )}

      {/* Generic add source form */}
      {activePanel && !["wa-connect", "wa-groups", "file"].includes(activePanel) && (
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--fg)", margin: 0 }}>
              Adicionar {getTypeInfo(activePanel)?.name}
            </h2>
            <button className="btn-ghost" onClick={() => setActivePanel(null)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {COMING_SOON.has(activePanel) && (
            <div style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "var(--warning-subtle)",
              border: "1px solid #FDE68A",
              marginBottom: "16px",
              fontSize: "var(--text-sm)",
              color: "var(--warning)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Este tipo de fonte está em desenvolvimento. Você pode salvar a configuração e ela será ativada automaticamente quando disponível.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", marginBottom: "4px", display: "block" }}>
                Nome da fonte
              </label>
              <input
                type="text"
                placeholder="Ex: Minha fonte de dados"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={inputStyle}
              />
            </div>

            {activePanel === "webhook" && (
              <div style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                fontSize: "var(--text-sm)",
                color: "var(--fg-muted)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <strong style={{ color: "var(--fg)" }}>Como funciona:</strong>
                </div>
                Ao salvar, uma URL única será gerada. Envie dados via POST para essa URL e eles serao capturados automaticamente como conteudo para seus podcasts.
                <br /><br />
                <strong>Formato aceito:</strong> JSON com campos <code style={{ background: "var(--bg)", padding: "1px 4px", borderRadius: "3px" }}>content</code> ou <code style={{ background: "var(--bg)", padding: "1px 4px", borderRadius: "3px" }}>text</code> (ou qualquer JSON sera capturado).
              </div>
            )}

            {(FORM_FIELDS[activePanel] || []).map((field) => (
              <div key={field.key}>
                <label style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                  {field.label}
                  {field.optional && <span style={{ fontSize: "10px", color: "var(--fg-faint)" }}>(opcional)</span>}
                </label>
                {renderFormField(field)}
              </div>
            ))}

            {/* Estilo do Podcast */}
            <div>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", marginBottom: "6px", display: "block" }}>
                Estilo do Podcast para esta fonte
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "6px" }}>
                {PODCAST_THEMES.map((t) => {
                  const sel = selectedTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTheme(t.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 10px",
                        border: `2px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                        borderRadius: "var(--radius-md)",
                        background: sel ? "var(--primary-subtle)" : "var(--bg)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                        width: "100%",
                      }}
                    >
                      <span style={{ fontSize: "16px", flexShrink: 0 }}>{t.icon}</span>
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: sel ? 600 : 400, color: sel ? "var(--primary)" : "var(--fg)" }}>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button className="btn-ghost" onClick={() => setActivePanel(null)} style={{ fontSize: "var(--text-sm)" }}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleAddSource}
                disabled={
                  !formName.trim() ||
                  saving ||
                  (activePanel !== "webhook" &&
                    (FORM_FIELDS[activePanel] || [])
                      .filter((f) => !f.optional)
                      .some((f) => !formConfig[f.key]?.trim()))
                }
                style={{ fontSize: "var(--text-sm)" }}
              >
                {saving ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active sources list */}
      <div>
        <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--fg)", marginBottom: "12px" }}>
          Fontes ativas
        </h2>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: "48px", borderRadius: "var(--radius-md)" }} />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="card" style={{ padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", margin: 0 }}>
              Nenhuma fonte configurada ainda. Clique em &quot;Adicionar fonte&quot; para começar.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {sources.map((source) => {
              const typeInfo = getTypeInfo(source.type);
              const webhookUrl = source.config?.webhook_url;
              return (
                <div
                  key={source.id}
                  className="card"
                  style={{ padding: "10px 16px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: typeInfo?.bg || "var(--bg-secondary)",
                        color: typeInfo?.color || "var(--fg-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {typeInfo ? (
                        <div style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>{typeInfo.icon}</div>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {source.name}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-faint)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span>{typeInfo?.name || source.type}</span>
                        {source.config?.url && (
                          <span style={{ opacity: 0.7 }}>{source.config.url.length > 30 ? source.config.url.slice(0, 30) + "..." : source.config.url}</span>
                        )}
                        {(() => {
                          const th = PODCAST_THEMES.find((t) => t.id === (source.podcast_theme || "conversa"));
                          return th ? (
                            <span
                              onClick={(e) => { e.stopPropagation(); setEditingThemeId(editingThemeId === source.id ? null : source.id); setEditingThemeValue(source.podcast_theme || "conversa"); }}
                              style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "1px 6px", borderRadius: "8px", background: "var(--primary-subtle)", color: "var(--primary)", fontSize: "10px", fontWeight: 500, cursor: "pointer", border: "1px solid var(--primary)", whiteSpace: "nowrap" }}
                              title="Clique para alterar o estilo"
                            >
                              {th.icon} {th.name}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(source.id)}
                      style={{
                        width: "36px",
                        height: "20px",
                        borderRadius: "10px",
                        border: "none",
                        background: source.active ? "var(--success)" : "var(--border)",
                        cursor: "pointer",
                        position: "relative",
                        flexShrink: 0,
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "white",
                          position: "absolute",
                          top: "2px",
                          left: source.active ? "18px" : "2px",
                          transition: "left 0.2s",
                        }}
                      />
                    </button>
                    {/* Delete */}
                    <button
                      className="btn-ghost"
                      onClick={() => handleDelete(source.id)}
                      style={{ padding: "4px", color: "var(--fg-muted)", flexShrink: 0 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>

                  {/* Webhook URL display */}
                  {webhookUrl && (
                    <div style={{
                      marginTop: "8px",
                      padding: "6px 10px",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}>
                      <code style={{
                        flex: 1,
                        fontSize: "11px",
                        color: "var(--fg-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        {webhookUrl}
                      </code>
                      <button
                        className="btn-ghost"
                        onClick={() => copyToClipboard(webhookUrl, source.id)}
                        style={{ padding: "2px 6px", fontSize: "11px", flexShrink: 0 }}
                      >
                        {copiedUrl === source.id ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                  )}

                  {/* Inline theme editor */}
                  {editingThemeId === source.id && (
                    <div style={{ marginTop: "8px", padding: "10px", borderRadius: "var(--radius-md)", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", marginBottom: "6px" }}>Alterar estilo do podcast:</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "4px" }}>
                        {PODCAST_THEMES.map((t) => {
                          const sel = editingThemeValue === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setEditingThemeValue(t.id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "5px 8px",
                                border: `1.5px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                                borderRadius: "var(--radius-sm)",
                                background: sel ? "var(--primary-subtle)" : "var(--bg)",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontWeight: sel ? 600 : 400,
                                color: sel ? "var(--primary)" : "var(--fg)",
                                transition: "all 0.15s",
                              }}
                            >
                              <span>{t.icon}</span> {t.name}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "8px" }}>
                        <button className="btn-ghost" onClick={() => setEditingThemeId(null)} style={{ fontSize: "var(--text-xs)", padding: "4px 10px" }}>Cancelar</button>
                        <button className="btn-primary" onClick={async () => {
                          try {
                            await api(`/api/sources/${source.id}/theme`, { method: "PATCH", body: JSON.stringify({ podcast_theme: editingThemeValue }) });
                            setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, podcast_theme: editingThemeValue } : s));
                            setEditingThemeId(null);
                          } catch { /* empty */ }
                        }} style={{ fontSize: "var(--text-xs)", padding: "4px 10px" }}>Salvar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
