"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { api } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  plan?: string;
}

const navItems = [
  {
    label: "Inicio",
    href: "/dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Fontes",
    href: "/dashboard/fontes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
        <line x1="12" y1="6" x2="12" y2="11" />
        <line x1="12" y1="13" x2="12" y2="18" />
        <line x1="6" y1="12" x2="11" y2="12" />
        <line x1="13" y1="12" x2="18" y2="12" />
      </svg>
    ),
  },
  {
    label: "Noticias",
    href: "/dashboard/noticias",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <line x1="10" y1="6" x2="18" y2="6" />
        <line x1="10" y1="10" x2="18" y2="10" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
  },
  {
    label: "Resumos",
    href: "/dashboard/resumos",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
  {
    label: "Configuracoes",
    href: "/dashboard/configuracoes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const AutoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("podcastia_session");
    if (!session) {
      router.replace("/login");
      return;
    }

    api("/api/auth/me")
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem("podcastia_session");
        router.replace("/login");
      });
  }, [router]);

  const cycleTheme = () => {
    if (theme === "dark") setTheme("light");
    else if (theme === "light") setTheme("auto");
    else setTheme("dark");
  };

  const getThemeIcon = () => {
    if (theme === "dark") return <MoonIcon />;
    if (theme === "light") return <SunIcon />;
    return <AutoIcon />;
  };

  const handleLogout = () => {
    localStorage.removeItem("podcastia_session");
    router.replace("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--bg)",
          color: "var(--fg-muted)",
          fontSize: "var(--text-base)",
        }}
      >
        <div className="skeleton" style={{ width: 200, height: 24, borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  const sidebarContent = (
    <>
      {/* Logo + Theme toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 16px 24px",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            background: "linear-gradient(135deg, var(--primary), var(--success))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-0.02em",
          }}
        >
          PodcastIA
        </span>
        <button
          className="btn-icon"
          onClick={cycleTheme}
          style={{
            color: "var(--fg-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 6,
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title={`Tema: ${theme}`}
        >
          {getThemeIcon()}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "nav-item-active" : "nav-item"}
            onClick={(e) => {
              e.preventDefault();
              router.push(item.href);
              setMobileMenuOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              color: isActive(item.href) ? "var(--primary)" : "var(--fg-muted)",
              background: isActive(item.href) ? "var(--primary-subtle)" : "transparent",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      {/* User section */}
      {user && (
        <div
          style={{
            padding: "16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--primary-subtle)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              flexShrink: 0,
            }}
          >
            {user.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--fg)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.name}
            </div>
            <span
              className="badge"
              style={{
                fontSize: "var(--text-xs)",
                marginTop: 2,
                display: "inline-block",
              }}
            >
              {user.plan || "Free"}
            </span>
          </div>
          <button
            className="btn-icon"
            onClick={handleLogout}
            style={{
              color: "var(--fg-faint)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            title="Sair"
          >
            <LogoutIcon />
          </button>
        </div>
      )}
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Desktop sidebar */}
      <aside
        className="sidebar"
        style={{
          width: 240,
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border)",
          zIndex: 40,
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 49,
            display: "none",
          }}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className="sidebar"
        style={{
          width: 280,
          height: "100vh",
          position: "fixed",
          top: 0,
          left: mobileMenuOpen ? 0 : -280,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border)",
          zIndex: 50,
          transition: "left 0.25s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 12px 0" }}>
          <button
            className="btn-icon"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              color: "var(--fg-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              display: "flex",
              alignItems: "center",
            }}
          >
            <CloseIcon />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        {/* Mobile header */}
        <header
          style={{
            display: "none",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          <button
            className="btn-icon"
            onClick={() => setMobileMenuOpen(true)}
            style={{
              color: "var(--fg)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <MenuIcon />
          </button>
          <span
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              background: "linear-gradient(135deg, var(--primary), var(--success))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            PodcastIA
          </span>
          <button
            className="btn-icon"
            onClick={cycleTheme}
            style={{
              color: "var(--fg-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            {getThemeIcon()}
          </button>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            padding: 24,
            paddingBottom: 100,
            maxWidth: 960,
            width: "100%",
            margin: "0 auto",
          }}
        >
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="bottom-nav"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            display: "none",
            justifyContent: "space-around",
            alignItems: "center",
            padding: "8px 0",
            background: "var(--bg-secondary)",
            borderTop: "1px solid var(--border)",
            zIndex: 30,
          }}
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                router.push(item.href);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 10,
                borderRadius: "var(--radius-md)",
                color: isActive(item.href) ? "var(--primary)" : "var(--fg-faint)",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
            >
              {item.icon}
            </a>
          ))}
        </nav>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar { display: none !important; }
          aside.sidebar[style*="position: fixed"][style*="transition"] {
            display: flex !important;
          }
          header[style*="display: none"] {
            display: flex !important;
          }
          nav.bottom-nav {
            display: flex !important;
          }
          main {
            padding: 16px !important;
            padding-bottom: 80px !important;
            margin-left: 0 !important;
          }
        }
        @media (min-width: 769px) {
          aside.sidebar[style*="transition"] {
            display: none !important;
          }
          div[style*="rgba(0,0,0,0.5)"] {
            display: none !important;
          }
          main {
            margin-left: 240px;
          }
        }
      `}</style>
    </div>
  );
}
