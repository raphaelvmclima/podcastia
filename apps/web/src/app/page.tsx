"use client";

import { useState, useEffect, useRef, useCallback, type RefObject } from "react";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";

/* ── Scroll reveal (simplified) ── */
function useInView(_ref: RefObject<HTMLElement | null>, _threshold = 0.15) {
  return true;
}

/* ── Animated counter ── */
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, 0.5);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = Math.ceil(target / 40);
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(id); }
      else setVal(start);
    }, 30);
    return () => clearInterval(id);
  }, [target, visible]);
  return <span ref={ref}>{val.toLocaleString("pt-BR")}{suffix}</span>;
}

/* ── FAQ Accordion ── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => { if (contentRef.current) setHeight(contentRef.current.scrollHeight); }, [a, open]);
  return (
    <div className="lp-faq-item" onClick={() => setOpen(!open)}>
      <div className="lp-faq-q">
        <span>{q}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lp-faq-chevron${open ? " lp-faq-chevron-open" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
      </div>
      <div className="lp-faq-a-wrapper" style={{ maxHeight: open ? height + 20 : 0, opacity: open ? 1 : 0 }}>
        <div ref={contentRef} className="lp-faq-a">{a}</div>
      </div>
    </div>
  );
}

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20,6 9,17 4,12" /></svg>
);

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, 0.1);
  return (
    <div ref={ref} className={`lp-reveal${visible ? " lp-visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function SourceCard({ children }: { children: React.ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.transform = `perspective(600px) rotateX(${((y - rect.height/2) / (rect.height/2)) * -6}deg) rotateY(${((x - rect.width/2) / (rect.width/2)) * 6}deg) scale(1.02)`;
    card.style.setProperty("--shine-x", `${(x / rect.width) * 100}%`);
    card.style.setProperty("--shine-y", `${(y / rect.height) * 100}%`);
  }, []);
  const handleMouseLeave = useCallback(() => { if (cardRef.current) cardRef.current.style.transform = "perspective(600px) rotateX(0) rotateY(0) scale(1)"; }, []);
  return (<div ref={cardRef} className="lp-source-card lp-tilt-card" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>{children}</div>);
}

function Waveform() {
  return (<div className="lp-waveform" aria-hidden="true">{Array.from({ length: 32 }).map((_, i) => (<div key={i} className="lp-waveform-bar" style={{ animationDelay: `${i * 0.07}s`, height: `${12 + Math.sin(i * 0.7) * 10}px` }} />))}</div>);
}

function ParticleGrid() {
  return (<div className="lp-particles" aria-hidden="true">{Array.from({ length: 40 }).map((_, i) => (<div key={i} className="lp-particle" style={{ left: `${(i % 8) * 13 + Math.random() * 5}%`, top: `${Math.floor(i / 8) * 20 + Math.random() * 10}%`, animationDelay: `${Math.random() * 5}s`, animationDuration: `${3 + Math.random() * 4}s` }} />))}</div>);
}

function CtaParticles() {
  return (<div className="lp-cta-particles" aria-hidden="true">{Array.from({ length: 20 }).map((_, i) => (<div key={i} className="lp-cta-sparkle" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 6}s`, animationDuration: `${2 + Math.random() * 3}s` }} />))}</div>);
}

function DemoPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurTime] = useState(0);
  const [duration, setDur] = useState(125);
  const toggle = () => { if (!audioRef.current) return; if (playing) audioRef.current.pause(); else audioRef.current.play(); setPlaying(!playing); };
  const fmt = (s: number) => { const m = Math.floor(s / 60); return m + ":" + String(Math.floor(s % 60)).padStart(2, "0"); };
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => { if (!audioRef.current || !duration) return; const rect = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration; };
  return (
    <div className="lp-demo-player">
      <audio ref={audioRef} src="/lp-demo-podcast.mp3" preload="metadata" onTimeUpdate={() => { if (!audioRef.current) return; setCurTime(audioRef.current.currentTime); setProgress(audioRef.current.duration ? (audioRef.current.currentTime / audioRef.current.duration) * 100 : 0); }} onLoadedMetadata={() => { if (audioRef.current) setDur(audioRef.current.duration); }} onEnded={() => setPlaying(false)} />
      <div className="lp-demo-player-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
        Ou&#231;a como funciona &mdash; 2 min
      </div>
      <div className="lp-demo-player-inner">
        <button className="lp-demo-play-btn" onClick={toggle} aria-label={playing ? "Pausar" : "Ouvir"}>
          {playing ? (<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>) : (<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>)}
        </button>
        <div className="lp-demo-player-track" onClick={handleSeek}>
          <div className="lp-demo-player-progress" style={{ width: progress + "%" }} />
        </div>
        <span className="lp-demo-player-time">{fmt(currentTime)} / {fmt(duration)}</span>
      </div>
    </div>
  );
}

/* ── Custom Plan Calculator ── */
function CustomPlanCalculator() {
  const [sources, setSources] = useState(5);
  const [podcasts, setPodcasts] = useState(1);
  const [whatsapp, setWhatsapp] = useState(false);

  const price = 30 + (sources * 15) + (Math.max(0, podcasts - 1) * 25) + (whatsapp ? 50 : 0);

  return (
    <div className="lp-custom-plan">
      <div className="lp-custom-plan-inner">
        <div className="lp-custom-plan-header">
          <span className="lp-custom-plan-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
          </span>
          <h3>Personalizado</h3>
          <p className="lp-pricing-desc">Monte o plano ideal para voc&#234;</p>
        </div>

        <div className="lp-custom-plan-controls">
          <div className="lp-custom-control">
            <label>
              <span className="lp-custom-label">Fontes</span>
              <span className="lp-custom-value">{sources}</span>
            </label>
            <input
              type="range"
              min={1}
              max={50}
              value={sources}
              onChange={(e) => setSources(Number(e.target.value))}
              className="lp-custom-slider"
            />
            <div className="lp-custom-range-labels"><span>1</span><span>25</span><span>50</span></div>
          </div>

          <div className="lp-custom-control">
            <label>
              <span className="lp-custom-label">Podcasts por dia</span>
              <span className="lp-custom-value">{podcasts}</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={podcasts}
              onChange={(e) => setPodcasts(Number(e.target.value))}
              className="lp-custom-slider"
            />
            <div className="lp-custom-range-labels"><span>1</span><span>3</span><span>5</span></div>
          </div>

          <div className="lp-custom-control">
            <label className="lp-custom-toggle-label">
              <span className="lp-custom-label">Entrega via WhatsApp</span>
              <button
                type="button"
                className={`lp-custom-toggle${whatsapp ? " lp-custom-toggle-on" : ""}`}
                onClick={() => setWhatsapp(!whatsapp)}
                aria-pressed={whatsapp}
              >
                <span className="lp-custom-toggle-thumb" />
              </button>
            </label>
          </div>
        </div>

        <div className="lp-custom-plan-breakdown">
          <div className="lp-breakdown-row"><span>Base</span><span>R$ 30</span></div>
          <div className="lp-breakdown-row"><span>{sources} fonte{sources > 1 ? "s" : ""} &times; R$ 15</span><span>R$ {sources * 15}</span></div>
          {podcasts > 1 && <div className="lp-breakdown-row"><span>{podcasts - 1} podcast{podcasts > 2 ? "s" : ""} extra &times; R$ 25</span><span>R$ {(podcasts - 1) * 25}</span></div>}
          {whatsapp && <div className="lp-breakdown-row"><span>WhatsApp</span><span>R$ 50</span></div>}
          <div className="lp-breakdown-total"><span>Total</span><span>R$ {price}<small>/m&#234;s</small></span></div>
        </div>

        <Link href="/register" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "1rem" }}>
          Come&#231;ar com plano personalizado
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </Link>
      </div>
    </div>
  );
}

const sourceIcons = {
  whatsapp: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D366"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="#25D366" strokeWidth="1.5" fill="none"/></svg>),
  rss: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1" fill="#FF8C00"/></svg>),
  youtube: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" fill="#FF0000"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="white"/></svg>),
  webhook: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8H12"/></svg>),
  http: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>),
  news: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>),
  file: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>),
  passagens: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>),
  crm: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  calendar: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  shopping: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>),
  instagram: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E4405F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>),
  twitter: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1DA1F2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>),
  telegram: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0088CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a1.09 1.09 0 0 0 .076 2.032l4.248 1.333 1.5 5.467a1 1 0 0 0 1.708.378l2.349-2.487 4.379 3.218a1.286 1.286 0 0 0 2.04-.77l3-15.5a2.25 2.25 0 0 0-1.778-2.386z"/></svg>),
  email: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>),
};

const podcastThemes = [
  { id: "conversa", name: "Conversa", desc: "Dois hosts conversando naturalmente sobre os temas", icon: "\uD83D\uDCAC", color: "var(--primary)" },
  { id: "aula", name: "Aula", desc: "Professor explicando de forma did\u00e1tica com exemplos pr\u00e1ticos", icon: "\uD83C\uDF93", color: "#10B981" },
  { id: "jornalistico", name: "Jornal\u00edstico", desc: "Formato telejornal com not\u00edcias objetivas e diretas", icon: "\uD83D\uDCF0", color: "#3B82F6" },
  { id: "resumo", name: "Resumo Executivo", desc: "Direto ao ponto, focado em a\u00e7\u00e3o e decis\u00f5es estrat\u00e9gicas", icon: "\uD83D\uDCCB", color: "#F59E0B" },
  { id: "comentarios", name: "Coment\u00e1rios", desc: "An\u00e1lise opinativa com diferentes pontos de vista", icon: "\uD83D\uDDE3\uFE0F", color: "#EF4444" },
  { id: "storytelling", name: "Storytelling", desc: "Not\u00edcias contadas como hist\u00f3rias envolventes e cativantes", icon: "\uD83D\uDCD6", color: "#8B5CF6" },
  { id: "estudo_biblico", name: "Estudo B\u00edblico", desc: "Reflex\u00f5es e ensinamentos com base b\u00edblica e aplica\u00e7\u00e3o pr\u00e1tica", icon: "\uD83D\uDCD5", color: "#D97706" },
  { id: "debate", name: "Debate", desc: "Hosts com posi\u00e7\u00f5es opostas debatendo os temas com argumentos", icon: "\u2694\uFE0F", color: "#DC2626" },
  { id: "entrevista", name: "Entrevista", desc: "Formato pergunta e resposta com especialista no assunto", icon: "\uD83C\uDFA4", color: "#7C3AED" },
  { id: "motivacional", name: "Motivacional", desc: "Conte\u00fado inspirador com li\u00e7\u00f5es pr\u00e1ticas para o dia a dia", icon: "\uD83D\uDD25", color: "#F97316" },
];

const plans = [
  { name: "Gratuito", price: "0", desc: "Para experimentar", features: ["1 podcast/dia", "3 fontes", "Voz padr\u00e3o", "Entrega no app", "Hist\u00f3rico 7 dias"], cta: "Come\u00e7ar gr\u00e1tis", featured: false },
  { name: "Starter", price: "120", desc: "Uso pessoal", features: ["1 podcast/dia", "5 fontes", "2 vozes premium", "Entrega via WhatsApp", "Hist\u00f3rico 30 dias", "Upload de arquivos"], cta: "Assinar Starter", featured: false },
  { name: "Pro", price: "200", desc: "Para profissionais", features: ["2 podcasts/dia", "10 fontes", "Todas as vozes", "WhatsApp + Email", "Hist\u00f3rico ilimitado", "Todos os 10 estilos", "Temas premium", "Suporte priorit\u00e1rio"], cta: "Assinar Pro", featured: true, badge: "Mais popular" },
  { name: "Business", price: "350", desc: "Equipes e empresas", features: ["3 podcasts/dia", "Fontes ilimitadas", "Todas as vozes", "Todos os canais", "API de integra\u00e7\u00e3o", "Multi-usu\u00e1rios", "Suporte dedicado", "Onboarding", "Prioridade na fila"], cta: "Falar com vendas", featured: false },
];

const faqs = [
  { q: "Como funciona a gera\u00e7\u00e3o do podcast?", a: "Nosso sistema coleta conte\u00fado das suas fontes configuradas (WhatsApp, RSS, YouTube, APIs, PDFs, etc), usa GPT-4o-mini para criar um roteiro no estilo que voc\u00ea escolher entre os 10 dispon\u00edveis, e o Gemini TTS gera \u00e1udio com vozes naturais em portugu\u00eas. Tudo autom\u00e1tico nos hor\u00e1rios que voc\u00ea definir. O podcast \u00e9 entregue direto no app ou via WhatsApp." },
  { q: "Posso escolher o estilo do podcast?", a: "Sim! Oferecemos 10 estilos diferentes: Conversa, Aula, Jornal\u00edstico, Resumo Executivo, Coment\u00e1rios, Storytelling, Estudo B\u00edblico, Debate, Entrevista e Motivacional. Cada estilo tem uma abordagem \u00fanica para apresentar o conte\u00fado, com tons e din\u00e2micas diferentes entre os hosts." },
  { q: "Quais fontes posso conectar?", a: "J\u00e1 suportamos WhatsApp (grupos), YouTube (canais e v\u00eddeos individuais com IA que assiste os v\u00eddeos), RSS Feeds, Not\u00edcias curadas por IA, CRM (FlwChat, HubSpot), Google Agenda (iCal), Passagens A\u00e9reas, Pre\u00e7os de Produtos, HTTP Request (APIs customizadas), Webhooks e Upload de arquivos (PDF, TXT, CSV, imagens). Em breve: Instagram, Twitter, Telegram e Email." },
  { q: "Como funciona a fonte do YouTube?", a: "Nossa IA (Gemini) literalmente assiste os v\u00eddeos dos canais que voc\u00ea configurar, extrai o conte\u00fado relevante e usa como fonte para o podcast. Voc\u00ea pode adicionar canais inteiros ou v\u00eddeos individuais." },
  { q: "Preciso ter conhecimento t\u00e9cnico?", a: "N\u00e3o! A interface \u00e9 intuitiva. Para WhatsApp, basta escanear um QR code. Para RSS e YouTube, cole a URL. Para arquivos, basta arrastar e soltar. Para APIs, basta informar a URL e headers." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim, sem multa e sem burocracia. Voc\u00ea mant\u00e9m acesso at\u00e9 o final do per\u00edodo pago." },
  { q: "Qual a dura\u00e7\u00e3o m\u00e9dia de um podcast?", a: "Depende do volume de conte\u00fado e do estilo escolhido. Podcasts costumam durar entre 3 e 15 minutos. A IA otimiza o conte\u00fado para n\u00e3o ser repetitivo e manter a qualidade." },
  { q: "Posso ouvir no celular?", a: "Sim! O PodcastIA \u00e9 uma PWA \u2014 voc\u00ea pode instalar como app no celular. O player tem controle de velocidade e o progresso \u00e9 salvo automaticamente. Al\u00e9m disso, voc\u00ea pode receber o \u00e1udio diretamente no WhatsApp." },
  { q: "Meus dados est\u00e3o seguros?", a: "Sim. Usamos criptografia em tr\u00e2nsito e em repouso. Nenhuma mensagem \u00e9 armazenada ap\u00f3s ser processada no podcast. N\u00e3o compartilhamos dados com terceiros." },
  { q: "Funciona em portugu\u00eas?", a: "Sim! Todas as vozes e scripts s\u00e3o gerados em portugu\u00eas brasileiro com vozes naturais do Gemini TTS. O sistema tamb\u00e9m processa fontes em ingl\u00eas e espanhol, traduzindo automaticamente." },
];

const steps = [
  { num: "1", title: "Conecte suas fontes", desc: "WhatsApp, YouTube, RSS, APIs, PDFs, webhooks \u2014 em menos de 2 minutos.", icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></svg>) },
  { num: "2", title: "Escolha o estilo", desc: "10 estilos: aula, jornal, debate, motivacional, storytelling e mais.", icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M3 12h18M5.63 5.63l12.73 12.73M18.36 5.63L5.63 18.36"/></svg>) },
  { num: "3", title: "IA processa tudo", desc: "GPT-4o-mini analisa e cria o roteiro. Gemini TTS gera \u00e1udio com vozes naturais.", icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>) },
  { num: "4", title: "Receba seu podcast", desc: "\u00c1udio entregue no WhatsApp, no app com player e controle de velocidade.", icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>) },
];

export default function LandingPage() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mobileNav, setMobileNav] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeTheme, setActiveTheme] = useState("conversa");

  const cycleTheme = () => {
    const order: Array<"dark" | "light" | "auto"> = ["dark", "light", "auto"];
    setTheme(order[(order.indexOf(theme) + 1) % order.length]);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href^='#']");
      if (!anchor) return;
      const id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-rotate themes
  useEffect(() => {
    const id = setInterval(() => {
      setActiveTheme(prev => {
        const idx = podcastThemes.findIndex(t => t.id === prev);
        return podcastThemes[(idx + 1) % podcastThemes.length].id;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="lp">
      {/* HEADER */}
      <header className="lp-header">
        <div className="lp-header-inner">
          <Link href="/" className="lp-logo">PodcastIA</Link>
          <nav className={`lp-nav ${mobileNav ? "open" : ""}`}>
            <a href="#como-funciona" onClick={() => setMobileNav(false)}>Como funciona</a>
            <a href="#estilos" onClick={() => setMobileNav(false)}>Estilos</a>
            <a href="#fontes" onClick={() => setMobileNav(false)}>Fontes</a>
            <a href="#planos" onClick={() => setMobileNav(false)}>Planos</a>
            <a href="#faq" onClick={() => setMobileNav(false)}>FAQ</a>
            <Link href="/login" className="btn btn-ghost" onClick={() => setMobileNav(false)}>Entrar</Link>
            <Link href="/register" className="btn btn-primary" onClick={() => setMobileNav(false)}>Come&#231;ar gr&#225;tis</Link>
          </nav>
          <div className="lp-header-right">
            <button className="theme-toggle" onClick={cycleTheme} title={`Tema: ${theme}`}>
              {resolvedTheme === "dark" ? (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>) : (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>)}
            </button>
            <button className="lp-hamburger" onClick={() => setMobileNav(!mobileNav)} aria-label="Menu">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileNav ? (<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>) : (<><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>)}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="lp-hero">
        <ParticleGrid />
        <Reveal><div className="lp-hero-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Novo: 10 estilos + 11 fontes + entrega via WhatsApp</div></Reveal>
        <h1 className="lp-hero-title lp-typewriter">Pare de ler. <span className="gradient-text">Ouça.</span></h1>
        <Reveal delay={200}><p className="lp-hero-sub">WhatsApp, RSS, YouTube, Not&#237;cias IA, CRM, Agenda, Passagens, Pre&#231;os &mdash; conecte suas fontes, escolha entre <strong>10 estilos de podcast</strong> e receba &#225;udio com vozes naturais direto no <strong>WhatsApp</strong> ou no app.</p></Reveal>
        <Reveal delay={400}>
          <div className="lp-hero-ctas">
            <Link href="/register" className="btn btn-primary btn-lg">Come&#231;ar gr&#225;tis<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></Link>
            <a href="#como-funciona" className="btn btn-secondary btn-lg">Ver como funciona</a>
          </div>
        </Reveal>
        <Reveal delay={500}><p className="lp-hero-note">Gr&#225;tis para sempre no plano Free. Sem cart&#227;o.</p></Reveal>
        <Reveal delay={600}><Waveform /></Reveal>
        <Reveal delay={650}><DemoPlayer /></Reveal>
        <Reveal delay={700}>
          <div className="lp-stats">
            <div className="lp-stat"><span className="lp-stat-val"><AnimatedNumber target={1247} /></span><span className="lp-stat-label">Podcasts gerados</span></div>
            <div className="lp-stat-sep" />
            <div className="lp-stat"><span className="lp-stat-val"><AnimatedNumber target={10} /></span><span className="lp-stat-label">Estilos de podcast</span></div>
            <div className="lp-stat-sep" />
            <div className="lp-stat"><span className="lp-stat-val"><AnimatedNumber target={15} suffix="+" /></span><span className="lp-stat-label">Tipos de fonte</span></div>
            <div className="lp-stat-sep" />
            <div className="lp-stat"><span className="lp-stat-val"><AnimatedNumber target={98} suffix="%" /></span><span className="lp-stat-label">Uptime</span></div>
          </div>
        </Reveal>
      </section>

      {/* PROBLEM */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <Reveal>
            <p className="lp-overline">O problema</p>
            <h2 className="lp-section-title">Voc&#234; n&#227;o tem tempo de ler tudo. <span className="lp-text-muted">Ningu&#233;m tem.</span></h2>
          </Reveal>
          <div className="lp-problem-grid">
            {[
              { icon: "\uD83D\uDCF1", title: "Dezenas de grupos no WhatsApp", desc: "Mensagens importantes se perdem em centenas de conversas di\u00e1rias." },
              { icon: "\uD83D\uDCF0", title: "Not\u00edcias fragmentadas", desc: "Abrir 10 sites por dia n\u00e3o \u00e9 produtivo. Voc\u00ea perde o contexto." },
              { icon: "\uD83C\uDFA5", title: "V\u00eddeos longos demais", desc: "Um v\u00eddeo de 40 min que poderia ser resumido em 3 minutos de \u00e1udio." },
              { icon: "\u23F0", title: "Informa\u00e7\u00e3o vira ru\u00eddo", desc: "Quanto mais fontes, mais dif\u00edcil separar o que realmente importa." },
            ].map((p, i) => (<Reveal key={p.title} delay={i * 100}><div className="lp-problem-card"><span className="lp-problem-icon">{p.icon}</span><h4>{p.title}</h4><p>{p.desc}</p></div></Reveal>))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className="lp-section lp-section-alt">
        <div className="lp-section-inner">
          <Reveal>
            <p className="lp-overline">Como funciona</p>
            <h2 className="lp-section-title">4 passos. 2 minutos. Pronto.</h2>
          </Reveal>
          <div className="lp-steps">
            {steps.map((s, i) => (<Reveal key={s.num} delay={i * 150}><div className="lp-step"><div className="lp-step-num">{s.num}</div><div className="lp-step-icon">{s.icon}</div><h3>{s.title}</h3><p>{s.desc}</p></div></Reveal>))}
          </div>
        </div>
      </section>

      {/* PODCAST THEMES */}
      <section id="estilos" className="lp-section">
        <div className="lp-section-inner">
          <Reveal>
            <p className="lp-overline">Estilos de podcast</p>
            <h2 className="lp-section-title">Seu podcast, do seu jeito</h2>
            <p className="lp-section-sub">Escolha entre 10 estilos diferentes. Cada um com abordagem, tom e din&#226;mica &#250;nicos entre os hosts. &#193;udio gerado pelo Gemini TTS com vozes naturais em portugu&#234;s.</p>
          </Reveal>
          <div className="lp-themes-grid">
            {podcastThemes.map((t, i) => (
              <Reveal key={t.id} delay={i * 60}>
                <button
                  className={`lp-theme-card${activeTheme === t.id ? " lp-theme-active" : ""}`}
                  onClick={() => setActiveTheme(t.id)}
                  style={{ "--theme-color": t.color } as React.CSSProperties}
                >
                  <span className="lp-theme-icon">{t.icon}</span>
                  <span className="lp-theme-name">{t.name}</span>
                  <span className="lp-theme-desc">{t.desc}</span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SOURCES */}
      <section id="fontes" className="lp-section lp-section-alt">
        <div className="lp-section-inner">
          <Reveal>
            <p className="lp-overline">Fontes suportadas</p>
            <h2 className="lp-section-title">Conecte qualquer fonte de informa&#231;&#227;o</h2>
            <p className="lp-section-sub">11 fontes ativas e mais chegando em breve. Envie dados via HTTP/Webhook, upload de arquivos ou conecte diretamente.</p>
          </Reveal>
          <div className="lp-sources-grid">
            {[
              { name: "WhatsApp", desc: "Grupos e contatos monitorados em tempo real", icon: sourceIcons.whatsapp, live: true },
              { name: "RSS Feeds", desc: "Blogs, portais de not\u00edcias, qualquer feed RSS/Atom", icon: sourceIcons.rss, live: true },
              { name: "YouTube", desc: "Canais + v\u00eddeos individuais. Gemini assiste os v\u00eddeos e extrai conte\u00fado", icon: sourceIcons.youtube, live: true },
              { name: "Not\u00edcias IA", desc: "Curadoria autom\u00e1tica por IA baseada nas suas prefer\u00eancias", icon: sourceIcons.news, live: true },
              { name: "CRM", desc: "FlwChat, HubSpot e CRMs customizados via API", icon: sourceIcons.crm, live: true },
              { name: "Google Agenda", desc: "Sincronize via iCal \u2014 resumo de compromissos e reuni\u00f5es", icon: sourceIcons.calendar, live: true },
              { name: "Passagens A\u00e9reas", desc: "Monitore ofertas de passagens por destino escolhido", icon: sourceIcons.passagens, live: true },
              { name: "Pre\u00e7os de Produtos", desc: "Google Shopping + promos \u2014 monitore pre\u00e7os em tempo real", icon: sourceIcons.shopping, live: true },
              { name: "HTTP Request", desc: "Consuma qualquer API \u2014 GET ou POST com headers customizados", icon: sourceIcons.http, live: true },
              { name: "Webhook", desc: "Receba dados de n8n, Zapier, Make ou qualquer sistema", icon: sourceIcons.webhook, live: true },
              { name: "Upload de Arquivos", desc: "Envie PDFs, TXT, CSV e imagens como fonte de conte\u00fado", icon: sourceIcons.file, live: true },
              { name: "Instagram", desc: "Monitore perfis e hashtags para conte\u00fado relevante", icon: sourceIcons.instagram, live: false },
              { name: "Twitter / X", desc: "Acompanhe perfis, listas e trending topics", icon: sourceIcons.twitter, live: false },
              { name: "Telegram", desc: "Canais e grupos monitorados automaticamente", icon: sourceIcons.telegram, live: false },
              { name: "Email", desc: "Newsletters e emails importantes viram podcast", icon: sourceIcons.email, live: false },
            ].map((s, i) => (
              <Reveal key={s.name} delay={i * 80}>
                <SourceCard>
                  <div className="lp-source-shine" />
                  <div className="lp-source-icon">{s.icon}</div>
                  <div>
                    <div className="lp-source-name">{s.name}{s.live ? <span className="lp-source-badge">Ativo</span> : <span className="lp-source-badge lp-badge-soon">Em breve</span>}</div>
                    <p className="lp-source-desc">{s.desc}</p>
                  </div>
                </SourceCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <Reveal>
            <p className="lp-overline">Recursos</p>
            <h2 className="lp-section-title">Tudo que voc&#234; precisa. Nada que n&#227;o precisa.</h2>
          </Reveal>
          <div className="lp-features-grid">
            {[
              { title: "10 estilos de podcast com IA", desc: "Conversa, aula, jornal, debate, motivacional, storytelling, entrevista e mais.", icon: "\uD83C\uDFAD" },
              { title: "\u00c1udio por Gemini TTS", desc: "Vozes naturais em portugu\u00eas que parecem humanas. Qualidade profissional.", icon: "\uD83C\uDFA4" },
              { title: "Entrega autom\u00e1tica via WhatsApp", desc: "Receba o \u00e1udio pronto direto no seu n\u00famero, nos hor\u00e1rios que definir.", icon: "\uD83D\uDCAC" },
              { title: "Player com controle de velocidade", desc: "Ou\u00e7a em 1x, 1.5x ou 2x. Ajuste como preferir.", icon: "\u25b6\ufe0f" },
              { title: "Progresso salvo automaticamente", desc: "Pause e continue de onde parou, em qualquer dispositivo.", icon: "\uD83D\uDCBE" },
              { title: "PWA \u2014 instale no celular", desc: "Funciona como app nativo. Instale direto do navegador.", icon: "\uD83D\uDCF2" },
              { title: "M\u00faltiplas fontes simult\u00e2neas", desc: "Combine WhatsApp + YouTube + RSS + APIs em um \u00fanico podcast.", icon: "\uD83D\uDD17" },
              { title: "Personaliza\u00e7\u00e3o por IA", desc: "A IA aprende suas prefer\u00eancias e filtra o que realmente importa.", icon: "\uD83E\uDD16" },
            ].map((f, i) => (<Reveal key={f.title} delay={i * 80}><div className="lp-feature-card"><span className="lp-feature-emoji">{f.icon}</span><h4>{f.title}</h4><p>{f.desc}</p></div></Reveal>))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="lp-section lp-section-alt">
        <div className="lp-section-inner">
          <Reveal>
            <p className="lp-overline">O que dizem</p>
            <h2 className="lp-section-title">Quem usa, recomenda</h2>
          </Reveal>
          <div className="lp-testimonials">
            {[
              { name: "Ricardo M.", role: "Empres\u00e1rio", text: "Recebia mais de 200 mensagens por dia em grupos. Agora recebo um podcast resumido no WhatsApp toda manh\u00e3 no caminho do trabalho. Uso o estilo Resumo Executivo e ganho 2 horas por dia." },
              { name: "Camila S.", role: "Jornalista", text: "Monitoro 12 feeds RSS e 3 canais do YouTube. A IA assiste os v\u00eddeos e transforma tudo em podcast jornal\u00edstico. Me poupa pelo menos 2 horas por dia." },
              { name: "Alex P.", role: "Dev / Maker", text: "O webhook \u00e9 genial. Conecto com meu n8n e recebo podcast das m\u00e9tricas do meu SaaS toda manh\u00e3. O estilo Conversa deixa tudo mais f\u00e1cil de absorver." },
              { name: "Pastor Marcos", role: "L\u00edder religioso", text: "Uso o estilo Estudo B\u00edblico com feeds de devocionais. Recebo reflex\u00f5es profundas toda manh\u00e3 no WhatsApp. A voz natural do Gemini \u00e9 impressionante." },
            ].map((t, i) => (
              <Reveal key={t.name} delay={i * 120}>
                <div className="lp-testimonial">
                  <div className="lp-testimonial-stars lp-stars-glow">{"\u2605\u2605\u2605\u2605\u2605"}</div>
                  <p className="lp-testimonial-text">&ldquo;{t.text}&rdquo;</p>
                  <div className="lp-testimonial-author">
                    <div className="lp-testimonial-avatar">{t.name.charAt(0)}</div>
                    <div><div className="lp-testimonial-name">{t.name}</div><div className="lp-testimonial-role">{t.role}</div></div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="planos" className="lp-section">
        <div className="lp-section-inner">
          <Reveal>
            <p className="lp-overline">Planos</p>
            <h2 className="lp-section-title">Simples, transparente, sem surpresas</h2>
            <p className="lp-section-sub">Cancele quando quiser. Todos os planos pagos incluem 7 dias gr&#225;tis.</p>
          </Reveal>
          <div className="lp-pricing-grid">
            {plans.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 100}>
                <div className={`lp-pricing-card${plan.featured ? " featured" : ""}`}>
                  {plan.featured && (<><div className="lp-pricing-glow-border" /><div className="lp-pricing-badge">{(plan as any).badge}</div></>)}
                  <h3>{plan.name}</h3>
                  <p className="lp-pricing-desc">{plan.desc}</p>
                  <div className="lp-pricing-price"><span className="lp-pricing-currency">R$</span><span className="lp-pricing-amount">{plan.price}</span><span className="lp-pricing-period">/m&#234;s</span></div>
                  <ul className="lp-pricing-features">{plan.features.map((f) => (<li key={f}><Check /> {f}</li>))}</ul>
                  <Link href="/register" className={`btn ${plan.featured ? "btn-primary" : "btn-secondary"}`} style={{ width: "100%", justifyContent: "center" }}>{plan.cta}</Link>
                </div>
              </Reveal>
            ))}
          </div>
          {/* Custom Plan Calculator */}
          <Reveal delay={500}>
            <CustomPlanCalculator />
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="lp-section lp-section-alt">
        <div className="lp-section-inner lp-section-narrow">
          <Reveal>
            <p className="lp-overline">D&#250;vidas frequentes</p>
            <h2 className="lp-section-title">FAQ</h2>
          </Reveal>
          <div className="lp-faq-list">
            {faqs.map((f, i) => (<Reveal key={f.q} delay={i * 60}><FaqItem q={f.q} a={f.a} /></Reveal>))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta-section lp-cta-animated-bg">
        <CtaParticles />
        <div className="lp-cta-inner">
          <Reveal><h2>Pronto para ouvir em vez de ler?</h2></Reveal>
          <Reveal delay={100}><p>Crie sua conta gr&#225;tis em 30 segundos. Sem cart&#227;o de cr&#233;dito.</p></Reveal>
          <Reveal delay={200}><Link href="/register" className="btn btn-primary btn-lg">Come&#231;ar gr&#225;tis agora<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></Link></Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand"><span className="lp-logo">PodcastIA</span><p>Pare de ler. Ouça. Podcasts personalizados com IA.</p></div>
          <div className="lp-footer-links">
            <div><h4>Produto</h4><a href="#como-funciona">Como funciona</a><a href="#estilos">Estilos</a><a href="#fontes">Fontes</a><a href="#planos">Planos</a><a href="#faq">FAQ</a></div>
            <div><h4>Conta</h4><Link href="/login">Entrar</Link><Link href="/register">Criar conta</Link></div>
          </div>
        </div>
        <div className="lp-footer-bottom">&copy; {new Date().getFullYear()} PodcastIA. Todos os direitos reservados.</div>
      </footer>

      {/* SCROLL TOP */}
      <button className={`lp-scroll-top${showScrollTop ? " lp-scroll-top-visible" : ""}`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Voltar ao topo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
      </button>
    </div>
  );
}
