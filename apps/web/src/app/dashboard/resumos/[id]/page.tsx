"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";

interface Digest {
  id: string;
  title: string;
  audio_url: string;
  audio_duration_seconds: number;
  sources_summary: any;
  text_content: string;
  script_content: string;
  created_at: string;
  delivered_at: string | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function getProgressKey(id: string): string {
  return `podcastia_progress_${id}`;
}

function saveProgress(id: string, time: number) {
  try { localStorage.setItem(getProgressKey(id), String(time)); } catch { /* quota */ }
}

function loadProgress(id: string): number {
  try {
    const val = localStorage.getItem(getProgressKey(id));
    return val ? parseFloat(val) : 0;
  } catch { return 0; }
}

function saveSpeed(speed: number) {
  try { localStorage.setItem("podcastia_playback_speed", String(speed)); } catch { /* quota */ }
}

function loadSpeed(): number {
  try {
    const val = localStorage.getItem("podcastia_playback_speed");
    if (val) { const p = parseFloat(val); if (PLAYBACK_SPEEDS.includes(p)) return p; }
    return 1;
  } catch { return 1; }
}
export default function DigestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const progressSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDigest = useCallback(async () => {
    try {
      const res = await api(`/api/digests/${id}`);
      setDigest(res?.digest || res);
    } catch { /* empty */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchDigest(); setPlaybackSpeed(loadSpeed()); }, [fetchDigest]);

  useEffect(() => {
    if (!digest || !audioRef.current) return;
    const savedTime = loadProgress(id);
    if (savedTime > 0 && audioRef.current) { audioRef.current.currentTime = savedTime; setCurrentTime(savedTime); }
  }, [digest, id]);

  useEffect(() => {
    if (isPlaying) {
      progressSaveRef.current = setInterval(() => {
        if (audioRef.current) saveProgress(id, audioRef.current.currentTime);
      }, 5000);
    } else {
      if (progressSaveRef.current) { clearInterval(progressSaveRef.current); progressSaveRef.current = null; }
      if (audioRef.current && currentTime > 0) saveProgress(id, currentTime);
    }
    return () => { if (progressSaveRef.current) clearInterval(progressSaveRef.current); };
  }, [isPlaying, id, currentTime]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = playbackSpeed; }, [playbackSpeed]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioError) { setAudioError(null); setAudioLoading(true); audioRef.current.load(); return; }
    if (isPlaying) { audioRef.current.pause(); } else {
      audioRef.current.play().catch(() => setAudioError("Nao foi possivel reproduzir o audio."));
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration); setAudioLoading(false); setAudioError(null);
    audioRef.current.playbackRate = playbackSpeed;
    const savedTime = loadProgress(id);
    if (savedTime > 0 && savedTime < audioRef.current.duration - 1) { audioRef.current.currentTime = savedTime; setCurrentTime(savedTime); }
  };

  const handleAudioError = () => {
    setAudioLoading(false); setIsPlaying(false);
    const audio = audioRef.current;
    if (audio?.error) {
      switch (audio.error.code) {
        case MediaError.MEDIA_ERR_ABORTED: setAudioError("Reproducao cancelada."); break;
        case MediaError.MEDIA_ERR_NETWORK: setAudioError("Erro de rede ao carregar audio. Tente novamente."); break;
        case MediaError.MEDIA_ERR_DECODE: setAudioError("Erro ao decodificar audio. Formato nao suportado."); break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: setAudioError("Formato de audio nao suportado pelo navegador."); break;
        default: setAudioError("Erro desconhecido ao carregar audio.");
      }
    } else { setAudioError("Erro ao carregar audio."); }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = pct * duration;
    audioRef.current.currentTime = newTime; setCurrentTime(newTime); saveProgress(id, newTime);
  };

  const cycleSpeed = () => {
    const idx = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const newSpeed = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    setPlaybackSpeed(newSpeed); saveSpeed(newSpeed);
  };

  const skipForward = () => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 15, duration); };
  const skipBackward = () => { if (audioRef.current) audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 15, 0); };

  const handleSendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);
    try {
      const res = await api(`/api/digests/${id}/chat`, { method: "POST", body: JSON.stringify({ message: msg }) });
      setChatMessages((prev) => [...prev, { role: "assistant", content: res?.response || res?.message || res?.content || "" }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Erro ao processar sua mensagem. Tente novamente." }]);
    } finally { setChatLoading(false); }
  };
  if (loading) {
    return (
      <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="skeleton" style={{ height: "20px", width: "120px", borderRadius: "var(--radius-md)" }} />
        <div className="skeleton" style={{ height: "28px", width: "60%", borderRadius: "var(--radius-md)" }} />
        <div className="skeleton" style={{ height: "80px", borderRadius: "var(--radius-md)" }} />
        <div className="skeleton" style={{ height: "120px", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="animate-in" style={{ padding: "48px", textAlign: "center" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>Resumo não encontrado.</p>
        <Link href="/dashboard/resumos" style={{ fontSize: "var(--text-sm)", color: "var(--primary)", textDecoration: "none" }}>
          Voltar para resumos
        </Link>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Áudio element */}
      {digest.audio_url && (
        <audio
          ref={audioRef}
          src={digest.audio_url}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => { setIsPlaying(false); saveProgress(id, 0); }}
          onError={handleAudioError}
          onWaiting={() => setAudioLoading(true)}
          onCanPlay={() => setAudioLoading(false)}
        />
      )}

      {/* Back link */}
      <Link
        href="/dashboard/resumos"
        style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--text-sm)", color: "var(--fg-muted)", textDecoration: "none" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Voltar para resumos
      </Link>

      {/* Title and meta */}
      <div>
        <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--fg)", margin: "0 0 8px 0" }}>{digest.title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
            {formatDate(digest.created_at)}
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--fg-faint)" }}>
            {formatDuration(digest.audio_duration_seconds)}
          </span>
          {digest.delivered_at ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "var(--text-xs)", color: "var(--success)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Entregue
            </span>
          ) : (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--warning)" }}>Pendente</span>
          )}
        </div>
      </div>

      {/* Áudio player */}
      <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {audioError && (
          <div style={{ padding: "8px 12px", borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: "var(--text-xs)", display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            {audioError}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={togglePlay}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "var(--primary-subtle)",
            color: "var(--primary)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
          <div
            onClick={handleSeek}
            style={{
              width: "100%",
              height: "6px",
              borderRadius: "3px",
              background: "var(--bg-secondary)",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                borderRadius: "3px",
                background: "var(--primary)",
                transition: "width 0.1s linear",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>{formatDuration(currentTime)}</span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>{formatDuration(duration || digest.audio_duration_seconds)}</span>
          </div>
        </div>
        </div>
      </div>

      {/* Sources summary */}
      {digest.sources_summary && (
        <div>
          <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--fg)", marginBottom: "8px" }}>Fontes</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {(Array.isArray(digest.sources_summary) ? digest.sources_summary : (digest.sources_summary as any).groups || []).map((source: any, i: number) => (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-secondary)",
                  fontSize: "var(--text-xs)",
                  color: "var(--fg-muted)",
                }}
              >
                {source.name}
                <span style={{ fontWeight: 600, color: "var(--fg)" }}>{source.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Script content */}
      {digest.text_content && (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <button
            onClick={() => setScriptExpanded(!scriptExpanded)}
            style={{
              width: "100%",
              padding: "14px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--fg)",
            }}
          >
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Roteiro completo</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: scriptExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {scriptExpanded && (
            <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", lineHeight: 1.7, margin: "12px 0 0 0", whiteSpace: "pre-wrap" }}>
                {digest.text_content}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Chat section */}
      <div>
        <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--fg)", marginBottom: "12px" }}>Perguntas sobre este resumo</h2>
        <div className="card" style={{ padding: "0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Messages */}
          <div style={{ padding: "16px", minHeight: "120px", maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            {chatMessages.length === 0 && !chatLoading && (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-faint)", textAlign: "center", padding: "24px 0", margin: 0 }}>
                Faça uma pergunta sobre o conteúdo deste resumo
              </p>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "8px 14px",
                    borderRadius: "var(--radius-lg)",
                    background: msg.role === "user" ? "var(--primary)" : "var(--bg-secondary)",
                    color: msg.role === "user" ? "white" : "var(--fg)",
                    fontSize: "var(--text-sm)",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "8px 14px",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg-secondary)",
                    display: "flex",
                    gap: "4px",
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "var(--fg-faint)",
                        animation: `dotPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <input
              type="text"
              placeholder="Pergunte algo sobre o resumo..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg)",
                color: "var(--fg)",
                fontSize: "var(--text-sm)",
                outline: "none",
              }}
            />
            <button
              className="btn-primary"
              onClick={handleSendChat}
              disabled={!chatInput.trim() || chatLoading}
              style={{ padding: "8px 12px", flexShrink: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
