"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface PageWrapperProps {
  children: React.ReactNode;
  title?: string;
}

export function PageWrapper({ children, title }: PageWrapperProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Sidebar with open state and close trigger */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Overlay backdrop for mobile when drawer is open */}
      {sidebarOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 25, /* just below sidebar (sticky is 30) */
            animation: "fadeIn 200ms ease"
          }}
        />
      )}

      <main className="app-main">
        <Header title={title} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} isSidebarOpen={sidebarOpen} />
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}

