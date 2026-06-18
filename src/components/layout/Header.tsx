"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";

interface HeaderProps {
  title?: string;
  onMenuToggle?: () => void;
  isSidebarOpen?: boolean;
}

export function Header({ title, onMenuToggle, isSidebarOpen = false }: HeaderProps) {
  const { data: session } = useSession();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`app-header${scrolled ? " scrolled" : ""}`}>
      {/* Mobile menu toggle with morphing hamburger icon */}
      <button
        className="btn btn-icon btn-ghost hamburger-btn"
        onClick={onMenuToggle}
        id="sidebar-toggle"
        aria-label="Toggle menu"
        style={{ display: "none" }}
      >
        <div className={`hamburger-icon${isSidebarOpen ? " open" : ""}`}>
          <span className="line line-1"></span>
          <span className="line line-2"></span>
          <span className="line line-3"></span>
        </div>
      </button>

      {/* Page title */}
      <div style={{ flex: 1 }}>
        {title && (
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
            }}
          >
            {title}
          </h1>
        )}
      </div>

      {/* Header actions */}
      <div className="flex items-center gap-3">
        <button className="btn btn-icon btn-ghost" aria-label="Notifikasi">
          <Bell size={18} />
        </button>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-muted)" }}>
          {session?.user?.name}
        </div>
      </div>
    </header>
  );
}

