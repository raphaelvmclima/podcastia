"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface AdminStats {
  totalUsers: number;
  byPlan: { free: number; starter: number; pro: number; business: number };
  podcastsLast30: number;
  activeSources: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  role: string;
  sources_count: number;
  digests_count: number;
  last_activity: string | null;
}

const PLANS = ["free", "starter", "pro", "business"];
const PLAN_COLORS: Record<string, string> = {
  free: "var(--fg-muted)",
  starter: "var(--primary)",
  pro: "var(--success)",
  business: "var(--warning)",
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const limit = 50;

  const fetchData = useCallback(async (p: number) => {
    try {
      const [me, statsRes, usersRes] = await Promise.all([
        api("/api/auth/me").catch(() => null),
        api("/api/admin/stats").catch(() => null),
        api(`/api/admin/users?page=${p}&limit=${limit}`).catch(() => null),
      ]);

      const currentUser = me?.user;
      if (!currentUser || currentUser.role !== "super_admin") {
        router.replace("/dashboard");
        return;
      }

      setUser(currentUser);
      setStats(statsRes?.stats || null);
      setUsers(usersRes?.users || []);
      setTotalUsers(usersRes?.total || 0);
      setLoading(false);
    } catch {
      setError("Erro ao carregar dados do painel admin.");
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData(page);
  }, [page, fetchData]);

  const handlePlanChange = async (userId: string, newPlan: string) => {
    setChangingPlan(userId);
    try {
      await api(`/api/admin/users/${userId}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ plan: newPlan }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan: newPlan } : u))
      );
    } catch {
      setError("Erro ao alterar plano.");
    }
    setChangingPlan(null);
  };

  const handleRoleToggle = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "super_admin" ? "user" : "super_admin";
    setChangingRole(userId);
    try {
      await api(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch {
      setError("Erro ao alterar role.");
    }
    setChangingRole(null);
  };

  const totalPages = Math.ceil(totalUsers / limit);

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <div className="skeleton" style={{ width: 240, height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 320, height: 16 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-in">
        <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <p style={{ color: "var(--danger, #ef4444)", fontSize: "var(--text-sm)" }}>{error}</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => { setError(null); setLoading(true); fetchData(page); }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Total Usuarios", value: stats?.totalUsers ?? 0, sub: "cadastrados" },
    {
      label: "Por Plano",
      value: "",
      sub: "",
      custom: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {PLANS.map((p) => (
            <span key={p} style={{
              fontSize: "var(--text-xs)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm, 4px)",
              background: "var(--bg-subtle, rgba(255,255,255,0.05))",
              color: PLAN_COLORS[p],
              fontWeight: 600,
            }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}: {stats?.byPlan?.[p as keyof typeof stats.byPlan] ?? 0}
            </span>
          ))}
        </div>
      ),
    },
    { label: "Podcasts (30 dias)", value: stats?.podcastsLast30 ?? 0, sub: "gerados" },
    { label: "Fontes Ativas", value: stats?.activeSources ?? 0, sub: "conectadas" },
  ];

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "var(--radius-md)",
            background: "var(--primary-subtle)", color: "var(--primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2>Painel Administrativo</h2>
        </div>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>
          Gerencie usuarios, planos e monitore a plataforma
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 40 }}>
        {statCards.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-card-label">{stat.label}</div>
            {stat.custom ? (
              stat.custom
            ) : (
              <>
                <div className="stat-card-value">{stat.value}</div>
                <div className="stat-card-sub">{stat.sub}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h4>Usuarios ({totalUsers})</h4>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                className="btn btn-ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ fontSize: "var(--text-sm)", padding: "4px 12px" }}
              >
                Anterior
              </button>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>
                {page}/{totalPages}
              </span>
              <button
                className="btn btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{ fontSize: "var(--text-sm)", padding: "4px 12px" }}
              >
                Proximo
              </button>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
                  {["Nome", "Email", "Plano", "Role", "Fontes", "Podcasts", "Ultima Atividade", "Acoes"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        color: "var(--fg-muted)",
                        fontWeight: 500,
                        fontSize: "var(--text-xs)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.05))" }}
                  >
                    <td style={{ padding: "12px 16px", color: "var(--fg)", fontWeight: 500, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "var(--primary-subtle)", color: "var(--primary)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "var(--text-xs)", fontWeight: 600, flexShrink: 0,
                        }}>
                          {u.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        {u.name || "--"}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                      {u.email}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <select
                        value={u.plan || "free"}
                        disabled={changingPlan === u.id}
                        onChange={(e) => handlePlanChange(u.id, e.target.value)}
                        style={{
                          background: "var(--bg-subtle, rgba(255,255,255,0.05))",
                          color: PLAN_COLORS[u.plan || "free"],
                          border: "1px solid var(--border, rgba(255,255,255,0.1))",
                          borderRadius: "var(--radius-sm, 4px)",
                          padding: "4px 8px",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          cursor: changingPlan === u.id ? "wait" : "pointer",
                          opacity: changingPlan === u.id ? 0.5 : 1,
                        }}
                      >
                        {PLANS.map((p) => (
                          <option key={p} value={p} style={{ color: "var(--fg)", background: "var(--bg-card, #1a1a2e)" }}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className="badge"
                        style={{
                          background: u.role === "super_admin" ? "var(--danger-subtle, rgba(239,68,68,0.15))" : "var(--bg-subtle, rgba(255,255,255,0.05))",
                          color: u.role === "super_admin" ? "var(--danger, #ef4444)" : "var(--fg-muted)",
                          padding: "2px 8px",
                          borderRadius: "var(--radius-sm, 4px)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                        }}
                      >
                        {u.role === "super_admin" ? "Admin" : "User"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fg-muted)", textAlign: "center" }}>
                      {u.sources_count ?? 0}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fg-muted)", textAlign: "center" }}>
                      {u.digests_count ?? 0}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fg-muted)", whiteSpace: "nowrap", fontSize: "var(--text-xs)" }}>
                      {u.last_activity
                        ? new Date(u.last_activity).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : "--"
                      }
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        className="btn btn-ghost"
                        disabled={changingRole === u.id || u.id === user?.id}
                        onClick={() => handleRoleToggle(u.id, u.role)}
                        title={u.id === user?.id ? "Voce nao pode alterar seu proprio role" : u.role === "super_admin" ? "Remover admin" : "Tornar admin"}
                        style={{
                          fontSize: "var(--text-xs)",
                          padding: "4px 10px",
                          opacity: changingRole === u.id ? 0.5 : u.id === user?.id ? 0.3 : 1,
                          cursor: changingRole === u.id || u.id === user?.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {changingRole === u.id ? "..." : u.role === "super_admin" ? "Remover Admin" : "Tornar Admin"}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: "40px 16px", textAlign: "center", color: "var(--fg-muted)" }}>
                      Nenhum usuario encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards (hidden on desktop via media query in global CSS) */}
        <div className="admin-mobile-cards" style={{ display: "none" }}>
          {users.map((u) => (
            <div key={u.id} className="card" style={{ padding: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "var(--primary-subtle)", color: "var(--primary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "var(--text-sm)", fontWeight: 600, flexShrink: 0,
                }}>
                  {u.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: "var(--fg)", fontSize: "var(--text-sm)" }}>{u.name || "--"}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                </div>
                <span
                  className="badge"
                  style={{
                    background: u.role === "super_admin" ? "var(--danger-subtle, rgba(239,68,68,0.15))" : "var(--bg-subtle, rgba(255,255,255,0.05))",
                    color: u.role === "super_admin" ? "var(--danger, #ef4444)" : "var(--fg-muted)",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm, 4px)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                  }}
                >
                  {u.role === "super_admin" ? "Admin" : "User"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12, fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
                <div>
                  <div style={{ fontWeight: 500, color: "var(--fg)", marginBottom: 2 }}>Plano</div>
                  <select
                    value={u.plan || "free"}
                    disabled={changingPlan === u.id}
                    onChange={(e) => handlePlanChange(u.id, e.target.value)}
                    style={{
                      background: "var(--bg-subtle, rgba(255,255,255,0.05))",
                      color: PLAN_COLORS[u.plan || "free"],
                      border: "1px solid var(--border, rgba(255,255,255,0.1))",
                      borderRadius: "var(--radius-sm, 4px)",
                      padding: "2px 4px",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      width: "100%",
                    }}
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p} style={{ color: "var(--fg)", background: "var(--bg-card, #1a1a2e)" }}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: "var(--fg)", marginBottom: 2 }}>Fontes</div>
                  {u.sources_count ?? 0}
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: "var(--fg)", marginBottom: 2 }}>Podcasts</div>
                  {u.digests_count ?? 0}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
                  {u.last_activity
                    ? new Date(u.last_activity).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                    : "Sem atividade"
                  }
                </span>
                <button
                  className="btn btn-ghost"
                  disabled={changingRole === u.id || u.id === user?.id}
                  onClick={() => handleRoleToggle(u.id, u.role)}
                  style={{ fontSize: "var(--text-xs)", padding: "4px 10px" }}
                >
                  {changingRole === u.id ? "..." : u.role === "super_admin" ? "Remover Admin" : "Tornar Admin"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
