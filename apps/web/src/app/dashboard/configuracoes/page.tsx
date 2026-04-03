"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { api } from "@/lib/api";

type DeliveryChannel = "self" | "contact" | "group" | "email";

interface Settings {
  delivery_channel: DeliveryChannel;
  delivery_target: string;
  schedule_times: string;
  timezone: string;
  audio_style: string;
  audio_voice: string;
  podcast_theme: string;
}

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const MailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const MonitorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const deliveryOptions: {
  value: DeliveryChannel;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "self",
    label: "Para mim mesmo",
    desc: "Receba no seu próprio WhatsApp",
    icon: <PhoneIcon />,
  },
  {
    value: "contact",
    label: "Para um contato",
    desc: "Envie para outro número",
    icon: <UserIcon />,
  },
  {
    value: "group",
    label: "Para um grupo",
    desc: "Envie para um grupo do WhatsApp",
    icon: <UsersIcon />,
  },
  {
    value: "email",
    label: "Por email",
    desc: "Receba por email com link do áudio",
    icon: <MailIcon />,
  },
];

const timezones = [
  { value: "America/Sao_Paulo", label: "Brasilia (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/Recife", label: "Recife (GMT-3)" },
  { value: "America/Cuiaba", label: "Cuiabá (GMT-4)" },
  { value: "America/Porto_Velho", label: "Porto Velho (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/New_York", label: "Nova York (GMT-5)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0)" },
];

const voiceOptions = [
  { value: "Sadachbia", label: "Leo (masculina, host principal)" },
  { value: "Leda", label: "Isa (feminina, co-host)" },
];



const podcastThemes = [
  { id: "conversa", name: "Conversa", icon: "💬", desc: "Dois hosts conversando naturalmente" },
  { id: "aula", name: "Aula", icon: "🎓", desc: "Professor explicando de forma didática" },
  { id: "jornalistico", name: "Jornalístico", icon: "📰", desc: "Formato telejornal profissional" },
  { id: "resumo", name: "Resumo Executivo", icon: "📋", desc: "Direto ao ponto, focado em ação" },
  { id: "comentarios", name: "Comentários", icon: "🗣️", desc: "Análise opinativa com debates" },
  { id: "storytelling", name: "Storytelling", icon: "📖", desc: "Notícias como histórias envolventes" },
  { id: "estudo_biblico", name: "Estudo Bíblico", icon: "📕", desc: "Reflexões com base bíblica" },
  { id: "debate", name: "Debate", icon: "⚔️", desc: "Hosts debatendo com posições opostas" },
  { id: "entrevista", name: "Entrevista", icon: "🎤", desc: "Formato pergunta e resposta" },
  { id: "motivacional", name: "Motivacional", icon: "🔥", desc: "Conteúdo inspirador e prático" },
];

const inputStyles: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: "var(--text-sm)",
  color: "var(--fg)",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  outline: "none",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

const labelStyles: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-sm)",
  fontWeight: 500,
  color: "var(--fg)",
  marginBottom: 6,
};

export default function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>({
    delivery_channel: "self",
    delivery_target: "",
    schedule_times: "07:00",
    timezone: "America/Sao_Paulo",
    audio_style: "casual",
    audio_voice: "Sadachbia",
    podcast_theme: "conversa",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  useEffect(() => {
    api("/api/settings")
      .then((data) => {
        if (data.settings) {
          const s = { ...data.settings };
          // schedule_times is stored as array in DB, convert to string for input
          if (Array.isArray(s.schedule_times)) {
            s.schedule_times = s.schedule_times[0] || "08:00";
          }
          // Map backend delivery_channel to frontend values
          if (s.delivery_channel === "whatsapp") {
            if (!s.delivery_target || s.delivery_target === "self") {
              s.delivery_channel = "self";
              s.delivery_target = "";
            } else {
              s.delivery_channel = "contact";
            }
          }
          setSettings((prev) => ({ ...prev, ...s }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload = {
        delivery_channel: ["self", "contact", "group"].includes(settings.delivery_channel)
          ? "whatsapp"
          : settings.delivery_channel,
        delivery_target: settings.delivery_channel === "self"
          ? "self"
          : settings.delivery_target,
        schedule_times: Array.isArray(settings.schedule_times)
          ? settings.schedule_times
          : [settings.schedule_times],
        timezone: settings.timezone,
        audio_style: settings.audio_style,
        audio_voice: settings.audio_voice,
        podcast_theme: settings.podcast_theme,
      };
      console.log("[Settings] Saving:", JSON.stringify(payload));
      const result = await api("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("[Settings] Save result:", JSON.stringify(result));
      setSaveMessage({ type: "success", text: "Configurações salvas com sucesso!" });
    } catch (err: any) {
      console.error("[Settings] Save error:", err.message);
      setSaveMessage({ type: "error", text: "Erro ao salvar: " + err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: "error", text: "Preencha todos os campos." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "As senhas não coincidem." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }
    setChangingPassword(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordMessage({ type: "success", text: "Senha alterada com sucesso!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMessage({ type: "error", text: "Erro ao alterar senha. Verifique a senha atual." });
    } finally {
      setChangingPassword(false);
      setTimeout(() => setPasswordMessage(null), 4000);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="skeleton" style={{ width: 200, height: 28, borderRadius: "var(--radius-md)" }} />
        <div className="skeleton" style={{ width: "100%", height: 200, borderRadius: "var(--radius-lg)" }} />
        <div className="skeleton" style={{ width: "100%", height: 120, borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--fg)", margin: 0 }}>
          Configurações
        </h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", margin: "4px 0 0" }}>
          Personalize como e quando você recebe seus resumos
        </p>
      </div>

      {/* Podcast theme */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--fg)", margin: "0 0 4px" }}>
          Estilo do Podcast
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", margin: "0 0 16px" }}>
          Escolha o formato e tom do seu podcast gerado
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {podcastThemes.map((t) => {
            const selected = settings.podcast_theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSettings((prev) => ({ ...prev, podcast_theme: t.id }))}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 6,
                  padding: "14px 16px",
                  border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                  borderRadius: "var(--radius-lg)",
                  background: selected ? "var(--primary-subtle)" : "var(--bg)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  width: "100%",
                }}
              >
                <span style={{ fontSize: 24 }}>{t.icon}</span>
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: selected ? "var(--primary)" : "var(--fg)" }}>
                  {t.name}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", lineHeight: 1.3 }}>
                  {t.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Delivery channel */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--fg)", margin: "0 0 4px" }}>
          Entrega do resumo
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", margin: "0 0 16px" }}>
          Escolha como deseja receber seu resumo diario
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {deliveryOptions.map((opt) => {
            const selected = settings.delivery_channel === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    delivery_channel: opt.value,
                    delivery_target: opt.value === "self" ? "" : prev.delivery_target,
                  }))
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                  borderRadius: "var(--radius-lg)",
                  background: selected ? "var(--primary-subtle)" : "var(--bg)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  width: "100%",
                }}
              >
                {/* Custom radio circle */}
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `2px solid ${selected ? "var(--primary)" : "var(--border-hover)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "border-color 0.15s ease",
                  }}
                >
                  {selected && (
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "var(--primary)",
                      }}
                    />
                  )}
                </span>

                <span
                  style={{
                    color: selected ? "var(--primary)" : "var(--fg-muted)",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {opt.icon}
                </span>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 600,
                      color: selected ? "var(--fg)" : "var(--fg)",
                    }}
                  >
                    {opt.label}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--fg-muted)",
                      marginTop: 2,
                    }}
                  >
                    {opt.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Conditional input fields */}
        {settings.delivery_channel === "contact" && (
          <div style={{ marginTop: 16 }}>
            <label style={labelStyles}>Número do contato</label>
            <input
              type="tel"
              placeholder="+55 11 99999-9999"
              value={settings.delivery_target}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, delivery_target: e.target.value }))
              }
              style={inputStyles}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-subtle)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
        )}

        {settings.delivery_channel === "group" && (
          <div style={{ marginTop: 16 }}>
            <label style={labelStyles}>ID do grupo</label>
            <input
              type="text"
              placeholder="Ex: 120363000000000000@g.us"
              value={settings.delivery_target}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, delivery_target: e.target.value }))
              }
              style={inputStyles}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-subtle)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
        )}

        {settings.delivery_channel === "email" && (
          <div style={{ marginTop: 16 }}>
            <label style={labelStyles}>Endereço de email</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={settings.delivery_target}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, delivery_target: e.target.value }))
              }
              style={inputStyles}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-subtle)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
        )}
      </div>

      {/* Schedule */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--fg)", margin: "0 0 4px" }}>
          Horario
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", margin: "0 0 16px" }}>
          Defina o horário e fuso para receber o resumo
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyles}>Horário de envio</label>
            <input
              type="time"
              value={settings.schedule_times}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, schedule_times: e.target.value }))
              }
              style={inputStyles}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-subtle)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
          <div>
            <label style={labelStyles}>Fuso horário</label>
            <select
              value={settings.timezone}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, timezone: e.target.value }))
              }
              style={{ ...inputStyles, cursor: "pointer" }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-subtle)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Audio */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--fg)", margin: "0 0 4px" }}>
          Audio
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", margin: "0 0 16px" }}>
          Personalize o estilo e a voz do seu podcast
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyles}>Estilo</label>
            <select
              value={settings.audio_style}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, audio_style: e.target.value }))
              }
              style={{ ...inputStyles, cursor: "pointer" }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-subtle)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
            </select>
          </div>
          <div>
            <label style={labelStyles}>Vozes dos hosts</label>
            <select
              value={settings.audio_voice}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, audio_voice: e.target.value }))
              }
              style={{ ...inputStyles, cursor: "pointer" }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-subtle)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {voiceOptions.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--fg)", margin: "0 0 4px" }}>
          Tema
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", margin: "0 0 16px" }}>
          Escolha a aparencia da interface
        </p>

        <div style={{ display: "flex", gap: 12 }}>
          {([
            { value: "dark", label: "Escuro", icon: <MoonIcon /> },
            { value: "light", label: "Claro", icon: <SunIcon /> },
            { value: "auto", label: "Automático", icon: <MonitorIcon /> },
          ] as const).map((opt) => {
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "16px 12px",
                  border: `2px solid ${active ? "var(--primary)" : "var(--border)"}`,
                  borderRadius: "var(--radius-lg)",
                  background: active ? "var(--primary-subtle)" : "var(--bg)",
                  color: active ? "var(--primary)" : "var(--fg-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontWeight: 500,
                  fontSize: "var(--text-sm)",
                }}
              >
                {opt.icon}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Change password */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ color: "var(--fg-muted)", display: "flex" }}>
            <LockIcon />
          </span>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--fg)", margin: 0 }}>
            Alterar senha
          </h2>
        </div>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", margin: "0 0 16px" }}>
          Atualize sua senha de acesso
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 400 }}>
          <div>
            <label style={labelStyles}>Senha atual</label>
            <div style={{ position: "relative" }}>
              <input
                type={showCurrentPw ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual"
                style={{ ...inputStyles, paddingRight: 40 }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-subtle)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--fg-faint)",
                  display: "flex",
                  padding: 2,
                }}
              >
                {showCurrentPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyles}>Nova senha</label>
            <div style={{ position: "relative" }}>
              <input
                type={showNewPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
                style={{ ...inputStyles, paddingRight: 40 }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-subtle)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--fg-faint)",
                  display: "flex",
                  padding: 2,
                }}
              >
                {showNewPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyles}>Confirmar nova senha</label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirmPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
                style={{ ...inputStyles, paddingRight: 40 }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-subtle)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--fg-faint)",
                  display: "flex",
                  padding: 2,
                }}
              >
                {showConfirmPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {passwordMessage && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                background:
                  passwordMessage.type === "success"
                    ? "var(--success-subtle)"
                    : "var(--danger-subtle)",
                color:
                  passwordMessage.type === "success"
                    ? "var(--success)"
                    : "var(--danger)",
              }}
            >
              {passwordMessage.text}
            </div>
          )}

          <button
            className="btn-ghost"
            onClick={handleChangePassword}
            disabled={changingPassword}
            style={{
              alignSelf: "flex-start",
              padding: "10px 20px",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: changingPassword ? "not-allowed" : "pointer",
              opacity: changingPassword ? 0.6 : 1,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg)",
              color: "var(--fg)",
              transition: "all 0.15s ease",
            }}
          >
            {changingPassword ? "Alterando..." : "Alterar senha"}
          </button>
        </div>
      </div>

      {/* Save message */}
      {saveMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            background:
              saveMessage.type === "success"
                ? "var(--success-subtle)"
                : "var(--danger-subtle)",
            color:
              saveMessage.type === "success"
                ? "var(--success)"
                : "var(--danger)",
          }}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Save button */}
      <button
        className="btn-primary"
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%",
          padding: "14px 24px",
          fontSize: "var(--text-base)",
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
          border: "none",
          borderRadius: "var(--radius-lg)",
          background: "var(--primary)",
          color: "#fff",
          transition: "all 0.15s ease",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {saving ? "Salvando..." : "Salvar configurações"}
      </button>

      {/* Responsive styles for grid */}
      <style>{`
        @media (max-width: 480px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
