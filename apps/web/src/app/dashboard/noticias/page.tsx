"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
  files?: string[];
}

interface Preference {
  id: string;
  label: string;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Ola! Sou seu assistente de notícias com IA. Posso ajudar a configurar quais topicos você quer acompanhar, com que frequencia e de quais fontes. O que gostaria de configurar?",
  suggestions: ["Quero notícias de tecnologia", "Configurar frequencia", "Ver minhas preferencias"],
};

export default function NotíciasPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await api("/api/news/preferences");
      setPreferences(res?.preferences || []);
    } catch {
      /* empty */
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const maxHeight = 4 * 24; // ~4 rows
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, maxHeight) + "px";
    }
  };

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const fileNames = files.map((f) => f.name);
    const userMsg: ChatMessage = { role: "user", content: msg, files: fileNames.length > 0 ? fileNames : undefined };
    setMessages((prev) => [...prev, userMsg]);
    setFiles([]);
    setLoading(true);

    try {
      const res = await api("/api/news/configure", {
        method: "POST",
        body: JSON.stringify({ message: msg }),
      });
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.message || res.content || "",
        suggestions: res.suggestions || [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
      fetchPreferences();
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Erro ao processar sua mensagem. Tente novamente.", suggestions: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    // Reset so same file can be selected again
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div
      className="animate-in"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 80px)",
        maxHeight: "calc(100vh - 80px)",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: "16px 0",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--fg)", margin: 0 }}>
            Configurar notícias
          </h1>
        </div>
        {preferences.length > 0 && (
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {preferences.map((pref) => (
              <span
                key={pref.id}
                style={{
                  padding: "2px 8px",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--primary-subtle)",
                  color: "var(--primary)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 500,
                }}
              >
                {pref.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 0",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {messages.map((msg, i) => (
          <div key={i}>
            {/* Message bubble */}
            <div
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "75%",
                  padding: "10px 16px",
                  borderRadius: "var(--radius-lg)",
                  background: msg.role === "user" ? "var(--primary)" : "var(--bg-secondary)",
                  color: msg.role === "user" ? "white" : "var(--fg)",
                  fontSize: "var(--text-sm)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.content}
              </div>
            </div>

            {/* File chips on user messages */}
            {msg.files && msg.files.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px", marginTop: "4px" }}>
                {msg.files.map((name, fi) => (
                  <span
                    key={fi}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-secondary)",
                      fontSize: "var(--text-xs)",
                      color: "var(--fg-muted)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    {name}
                  </span>
                ))}
              </div>
            )}

            {/* Suggestion chips after assistant messages */}
            {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && (
              <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                {msg.suggestions.map((suggestion, si) => (
                  <button
                    key={si}
                    className="btn-ghost"
                    onClick={() => handleSend(suggestion)}
                    style={{
                      padding: "4px 12px",
                      fontSize: "var(--text-xs)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Loading dots */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-secondary)",
                display: "flex",
                gap: "5px",
                alignItems: "center",
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "var(--fg-faint)",
                    animation: `dotBounce 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* File chips above input */}
      {files.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            padding: "8px 0 0 0",
          }}
        >
          {files.map((file, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-secondary)",
                fontSize: "var(--text-xs)",
                color: "var(--fg-muted)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              {file.name}
              <button
                onClick={() => removeFile(i)}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  color: "var(--fg-faint)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          padding: "12px 0",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: "8px",
          alignItems: "flex-end",
          flexShrink: 0,
        }}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,áudio/*,.pdf,.doc,.docx"
          multiple
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />

        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: "36px",
            height: "36px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--fg-muted)",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          placeholder="Digite sua mensagem..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoResize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg)",
            color: "var(--fg)",
            fontSize: "var(--text-sm)",
            outline: "none",
            resize: "none",
            lineHeight: "24px",
            maxHeight: `${4 * 24}px`,
            fontFamily: "inherit",
          }}
        />

        {/* Send button */}
        <button
          className="btn-primary"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          style={{
            width: "36px",
            height: "36px",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
