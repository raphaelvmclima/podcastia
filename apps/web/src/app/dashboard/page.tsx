"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [digests, setDigests] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [digestTotal, setDigestTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api("/api/auth/me").catch(() => null),
      api("/api/sources").catch(() => ({ sources: [] })),
      api("/api/digests?limit=5").catch(() => ({ digests: [] })),
      api("/api/settings").catch(() => ({ settings: null })),
    ]).then(([me, src, dig, set]) => {
      setUser(me?.user || null);
      setSources(src?.sources || []);
      setDigests(dig?.digests || []);
      setDigestTotal(dig?.total || 0);
      setSettings(set?.settings || null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <div className="skeleton" style={{ width: 200, height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 300, height: 16 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      </div>
    );
  }

  const activeSources = sources.filter((s: any) => s.is_active).length;
  const plan = (user?.plan || "free").charAt(0).toUpperCase() + (user?.plan || "free").slice(1);
  const nextTime = settings?.schedule_times?.[0] || "--:--";

  const statCards = [
    { label: "Fontes ativas", value: activeSources, sub: "conectadas" },
    { label: "Resumos gerados", value: digestTotal, sub: "total" },
    { label: "Plano atual", value: plan, sub: "ativo" },
    { label: "Próximo resumo", value: nextTime, sub: "agendado" },
  ];

  return (
    <div className="animate-in">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 4 }}>Olá, {user?.name || "usuário"}</h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>
          Visão geral da sua conta
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 40 }}>
        {statCards.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-card-label">{stat.label}</div>
            <div className="stat-card-value">{stat.value}</div>
            <div className="stat-card-sub">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 40 }}>
        <h4 style={{ marginBottom: 16 }}>Ações rápidas</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <Link href="/dashboard/fontes" style={{ textDecoration: "none" }}>
            <div className="card card-interactive" style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--primary-subtle)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </div>
              <div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--fg)" }}>Adicionar fonte</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>Conecte WhatsApp, Instagram e mais</div>
              </div>
            </div>
          </Link>
          <Link href="/dashboard/noticias" style={{ textDecoration: "none" }}>
            <div className="card card-interactive" style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--success-subtle)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
              </div>
              <div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--fg)" }}>Configurar notícias</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>Diga à IA o que te interessa</div>
              </div>
            </div>
          </Link>
          <Link href="/dashboard/configuracoes" style={{ textDecoration: "none" }}>
            <div className="card card-interactive" style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--warning-subtle)", color: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
              </div>
              <div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--fg)" }}>Configurações</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>Horários, voz e entrega</div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h4>Resumos recentes</h4>
          <Link href="/dashboard/resumos" style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>Ver todos</Link>
        </div>
        {digests.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
            <p style={{ color: "var(--fg-muted)", fontSize: "var(--text-sm)" }}>
              Nenhum resumo gerado ainda. Adicione fontes e aguarde o horário agendado.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {digests.map((d: any) => (
              <Link key={d.id} href={`/dashboard/resumos/${d.id}`} style={{ textDecoration: "none" }}>
                <div className="card card-interactive" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "var(--primary-subtle)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5,3 19,12 5,21 5,3" /></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--fg)" }}>{d.title}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
                        {new Date(d.created_at).toLocaleDateString("pt-BR")} · {d.audio_duration_seconds ? `${Math.floor(d.audio_duration_seconds / 60)}:${String(d.audio_duration_seconds % 60).padStart(2, "0")}` : "--"} · {d.sources_summary?.totalMessages || 0} msgs
                      </div>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-faint)" strokeWidth="2"><polyline points="9,18 15,12 9,6" /></svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
