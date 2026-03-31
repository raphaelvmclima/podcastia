"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface Source {
  id: string;
  type: string;
  name: string;
  active: boolean;
  config?: { url?: string };
  created_at: string;
}

interface WaGroup {
  id: string;
  name: string;
  type: "group" | "contact";
}

const SOURCE_TYPES = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    desc: "Grupos e contatos",
    color: "var(--success)",
    bg: "var(--success-subtle)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    id: "instagram",
    name: "Instagram",
    desc: "Posts e stories",
    color: "#E1306C",
    bg: "#fce4ec",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    id: "rss",
    name: "RSS",
    desc: "Feeds de notícias",
    color: "#FF8C00",
    bg: "var(--warning-subtle)",
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
    bg: "#ffebee",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
      </svg>
    ),
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    desc: "Perfis e buscas",
    color: "var(--fg)",
    bg: "var(--bg-secondary)",
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
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    id: "notícias-ia",
    name: "Notícias IA",
    desc: "Curadoria com IA",
    color: "#8B5CF6",
    bg: "#ede9fe",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
];

export default function FontesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<{ connected: boolean; qr?: string } | null>(null);
  const [waGroups, setWaGroups] = useState<WaGroup[]>([]);
  const [waSearch, setWaSearch] = useState("");
  const [waFilter, setWaFilter] = useState<"all" | "groups" | "contacts">("all");
  const [selectedGroups, setSelectedGroups] = useState<WaGroup[]>([]);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const fetchSources = useCallback(async () => {
    try {
      const res = await api("/api/sources");
      setSources(res?.sources || res || []);
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
    if (typeId === "notícias-ia") {
      window.location.href = "/dashboard/noticias";
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
    setFormUrl("");
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
        body: JSON.stringify({ groups: selectedGroups.map((g) => ({ id: g.id, name: g.name })) }),
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
    if (!formName.trim() || !formUrl.trim() || !activePanel) return;
    setSaving(true);
    try {
      await api("/api/sources", {
        method: "POST",
        body: JSON.stringify({ type: activePanel, name: formName, config: { url: formUrl } }),
      });
      setActivePanel(null);
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

  useEffect(() => {
    if (activePanel === "wa-groups") {
      loadGroups(waSearch, waFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waSearch, waFilter]);

  const getTypeInfo = (typeId: string) => SOURCE_TYPES.find((t) => t.id === typeId);

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--fg)", margin: 0 }}>Fontes</h1>
        <button className="btn-primary" onClick={() => setActivePanel(null)} style={{ fontSize: "var(--text-sm)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Adicionar fonte
        </button>
      </div>

      {/* Source type cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        {SOURCE_TYPES.map((type) => (
          <div
            key={type.id}
            className="card card-interactive"
            onClick={() => handleTypeClick(type.id)}
            style={{ padding: "16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center" }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
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
              <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", marginTop: "2px" }}>{type.desc}</div>
            </div>
          </div>
        ))}
      </div>

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
              {waStatus?.qr ? (
                <div style={{ padding: "16px", background: "white", borderRadius: "var(--radius-md)" }}>
                  <img src={waStatus.qr} alt="QR Code" style={{ width: "200px", height: "200px" }} />
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

          {/* Search */}
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
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg)",
                color: "var(--fg)",
                fontSize: "var(--text-sm)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Filter tabs */}
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

          {/* Group list */}
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

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
              {selectedGroups.length} selecionado{selectedGroups.length !== 1 ? "s" : ""}
            </span>
            <button className="btn-primary" onClick={handleSaveWaGroups} disabled={selectedGroups.length === 0 || saving} style={{ fontSize: "var(--text-sm)" }}>
              {saving ? "Salvando..." : "Salvar selecao"}
            </button>
          </div>
        </div>
      )}

      {/* Add source form (non-WhatsApp) */}
      {activePanel && activePanel !== "wa-connect" && activePanel !== "wa-groups" && activePanel !== "notícias-ia" && (
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
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", marginBottom: "4px", display: "block" }}>Nome</label>
              <input
                type="text"
                placeholder="Ex: Blog da empresa"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg)",
                  color: "var(--fg)",
                  fontSize: "var(--text-sm)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", marginBottom: "4px", display: "block" }}>URL</label>
              <input
                type="text"
                placeholder="https://..."
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg)",
                  color: "var(--fg)",
                  fontSize: "var(--text-sm)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button className="btn-ghost" onClick={() => setActivePanel(null)} style={{ fontSize: "var(--text-sm)" }}>Cancelar</button>
              <button className="btn-primary" onClick={handleAddSource} disabled={!formName.trim() || !formUrl.trim() || saving} style={{ fontSize: "var(--text-sm)" }}>
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
              Nenhuma fonte configurada ainda. Escolha um tipo acima para começar.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {sources.map((source) => {
              const typeInfo = getTypeInfo(source.type);
              return (
                <div
                  key={source.id}
                  className="card"
                  style={{
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
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
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-faint)" }}>
                      {typeInfo?.name || source.type}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
