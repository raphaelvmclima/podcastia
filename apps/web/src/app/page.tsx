"use client";

import Link from "next/link";
import { useTheme } from "@/components/theme-provider";

function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

const features = [
  {
    title: "WhatsApp",
    description: "Receba seus resumos diretamente no WhatsApp de forma automática.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    title: "Instagram",
    description: "Acompanhe perfis e receba resumos dos conteúdos mais relevantes.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Notícias",
    description: "Fique por dentro das notícias do dia sem precisar ler dezenas de sites.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
        <line x1="6" y1="8" x2="18" y2="8" />
        <line x1="6" y1="12" x2="14" y2="12" />
        <line x1="6" y1="16" x2="10" y2="16" />
      </svg>
    ),
  },
  {
    title: "Podcast",
    description: "Transforme qualquer conteúdo em áudio com vozes naturais de IA.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    ),
  },
];

const plans = [
  {
    name: "Free",
    price: "R$0",
    period: "/mes",
    description: "Para experimentar o basico",
    features: ["1 fonte", "1 resumo por dia", "Voz padrao", "Entrega no app"],
    cta: "Começar grátis",
    featured: false,
  },
  {
    name: "Starter",
    price: "R$49",
    period: "/mes",
    description: "Para uso pessoal",
    features: ["5 fontes", "3 resumos por dia", "2 vozes", "WhatsApp + Email", "Histórico 30 dias"],
    cta: "Assinar Starter",
    featured: false,
  },
  {
    name: "Pro",
    price: "R$149",
    period: "/mes",
    description: "Para profissionais",
    features: ["20 fontes", "Resumos ilimitados", "Todas as vozes", "Todos os canais", "Histórico ilimitado", "Estilos customizados"],
    cta: "Assinar Pro",
    featured: true,
  },
  {
    name: "Business",
    price: "R$499",
    period: "/mes",
    description: "Para equipes e empresas",
    features: ["Fontes ilimitadas", "Resumos ilimitados", "Vozes premium", "API de integracao", "Suporte prioritario", "Multi-usuários"],
    cta: "Falar com vendas",
    featured: false,
  },
];

export default function LandingPage() {
  const { resolvedTheme, setTheme, theme } = useTheme();

  const cycleTheme = () => {
    const order: Array<"dark" | "light" | "auto"> = ["dark", "light", "auto"];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  return (
    <div>
      {/* Header */}
      <header className="landing-header">
        <Link href="/" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.03em" }}>
          PodcastIA
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="theme-toggle" onClick={cycleTheme} title={`Tema: ${theme}`}>
            {resolvedTheme === "dark" ? <IconMoon /> : <IconSun />}
          </button>
          <Link href="/login" className="btn btn-ghost" style={{ fontSize: "var(--text-sm)" }}>
            Entrar
          </Link>
          <Link href="/register" className="btn btn-primary">
            Começar grátis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 24 }}>
            Suas fontes,{" "}
            <span className="gradient-text">resumidas em áudio</span>
          </h1>
          <p style={{ fontSize: "var(--text-lg)", color: "var(--fg-secondary)", maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.7 }}>
            Transforme WhatsApp, Instagram, notícias e muito mais em podcasts personalizados com inteligência artificial.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" className="btn btn-primary btn-lg">
              Começar grátis
            </Link>
            <Link href="#features" className="btn btn-secondary btn-lg">
              Saiba mais
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ marginBottom: 12 }}>Suas fontes favoritas, um so lugar</h2>
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-muted)", maxWidth: 480, margin: "0 auto" }}>
            Conecte diferentes fontes de informação e receba tudo resumido em áudio.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {features.map((feature) => (
            <div key={feature.title} className="card card-hover" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--primary-subtle)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {feature.icon}
              </div>
              <div>
                <h4 style={{ marginBottom: 8 }}>{feature.title}</h4>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: "80px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ marginBottom: 12 }}>Planos simples e transparentes</h2>
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-muted)" }}>
            Escolha o plano ideal para você. Cancele quando quiser.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, alignItems: "start" }}>
          {plans.map((plan) => (
            <div key={plan.name} className={`pricing-card ${plan.featured ? "featured" : ""}`}>
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ marginBottom: 4 }}>{plan.name}</h4>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)", marginBottom: 16 }}>{plan.description}</p>
                <div className="pricing-price">
                  {plan.price}
                  <span>{plan.period}</span>
                </div>
              </div>
              <ul style={{ listStyle: "none", padding: 0, marginBottom: 24, flex: 1 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)", color: "var(--fg-secondary)", padding: "6px 0" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20,6 9,17 4,12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className={`btn ${plan.featured ? "btn-primary" : "btn-secondary"}`} style={{ width: "100%", textAlign: "center" }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--text-base)", marginBottom: 4 }}>PodcastIA</div>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>Resumos inteligentes em áudio.</p>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: "var(--text-sm)" }}>
            <Link href="#features" style={{ color: "var(--fg-muted)" }}>Recursos</Link>
            <Link href="#pricing" style={{ color: "var(--fg-muted)" }}>Planos</Link>
            <Link href="/login" style={{ color: "var(--fg-muted)" }}>Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
