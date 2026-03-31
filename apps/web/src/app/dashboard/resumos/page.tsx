"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

export default function ResumosPage() {
  const [digests, setDigests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    setLoading(true);
    setFetchError("");
    api("/api/digests?page=" + page + "&limit=20")
      .then((res) => {
        console.log("Digests API response:", res);
        setDigests(res?.digests || []);
        setTotal(res?.total || 0);
      })
      .catch((err) => {
        console.error("Digests fetch failed:", err);
        setFetchError(err?.message || "Erro desconhecido");
      })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <div className="animate-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Resumos</h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>
          {loading ? "Carregando..." : `${total} resumo(s)`}
        </p>
      </div>

      {fetchError && (
        <div className="card" style={{ padding: 16, marginBottom: 16, color: "var(--danger)", fontSize: "var(--text-sm)" }}>
          Erro: {fetchError}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      ) : digests.length === 0 && !fetchError ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "var(--fg-muted)", fontSize: "var(--text-sm)" }}>
            Nenhum resumo encontrado.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {digests.map((d: any) => {
            const duration = d.audio_duration_seconds || 0;
            const mins = Math.floor(duration / 60);
            const secs = duration % 60;
            let msgs = 0;
            if (d.sources_summary && typeof d.sources_summary.totalMessages === "number") {
              msgs = d.sources_summary.totalMessages;
            }

            return (
              <Link key={d.id} href={`/dashboard/resumos/${d.id}`} style={{ textDecoration: "none" }}>
                <div className="card card-interactive" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "var(--primary-subtle)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--fg)" }}>{d.title}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)", marginTop: 2 }}>
                        {new Date(d.created_at).toLocaleDateString("pt-BR")} | {mins}:{String(secs).padStart(2, "0")} {msgs > 0 ? `| ${msgs} msgs` : ""}
                      </div>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-faint)" strokeWidth="2"><polyline points="9,18 15,12 9,6" /></svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16, alignItems: "center" }}>
          <button className="btn-ghost" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Anterior</button>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>{page} / {totalPages}</span>
          <button className="btn-ghost" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>Próximo</button>
        </div>
      )}
    </div>
  );
}
