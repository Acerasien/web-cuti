"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  CalendarOff,
  Calendar,
  Settings,
  LogOut,
  History,
} from "lucide-react";
import { signOut } from "next-auth/react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={18} />,
    roles: ["SUPERADMIN", "ADMIN", "KARYAWAN"],
  },
  {
    href: "/karyawan",
    label: "Data Karyawan",
    icon: <Users size={18} />,
    roles: ["SUPERADMIN", "ADMIN"],
  },
  {
    href: "/cuti",
    label: "Cuti & Izin",
    icon: <CalendarOff size={18} />,
    roles: ["SUPERADMIN", "ADMIN", "KARYAWAN"],
  },
  {
    href: "/kalender",
    label: "Kalender Bersama",
    icon: <Calendar size={18} />,
    roles: ["SUPERADMIN", "ADMIN", "KARYAWAN"],
  },
  {
    href: "/kuota-tahunan",
    label: "Kuota Cuti Tahunan",
    icon: <Calendar size={18} />,
    roles: ["SUPERADMIN", "ADMIN"],
  },
  {
    href: "/riwayat-tahunan",
    label: "Riwayat Tahunan",
    icon: <History size={18} />,
    roles: ["SUPERADMIN", "ADMIN"],
  },
  {
    href: "/pengaturan",
    label: "Pengaturan",
    icon: <Settings size={18} />,
    roles: ["SUPERADMIN"],
  },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    SUPERADMIN: "Super Admin",
    ADMIN: "Admin HR",
    KARYAWAN: "Karyawan",
  };
  return map[role] ?? role;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className={`app-sidebar${isOpen ? " open" : ""}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-text">Web Cuti</div>
        <div className="sidebar-logo-sub">Manajemen Cuti Karyawan</div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Menu Utama</div>
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item${isActive ? " active" : ""}`}
              onClick={onClose}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {getInitials(session?.user?.name ?? "?")}
          </div>
          <div className="sidebar-user-info min-w-0">
            <div className="sidebar-user-name">{session?.user?.name}</div>
            <div className="sidebar-user-role">{getRoleLabel(role)}</div>
          </div>
          <button
            className="btn btn-icon btn-ghost"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Keluar"
            style={{ color: "rgba(196,181,253,0.7)", minWidth: 36 }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
