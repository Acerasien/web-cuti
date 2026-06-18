"use client";

import { useState, useMemo } from "react";
import { Search, Users, Building, Eye, Plus } from "lucide-react";
import Link from "next/link";

interface EmployeeData {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  role: string;
  nik: string | null;
  level: string | null;
  department: string | null;
  position: string | null;
  joinDate: string;
  isActive: boolean;
  subCompanyId: string | null;
  subCompany: {
    name: string;
  } | null;
  quotaText: string;
  balanceText: string;
  activeQuota: {
    id: string;
    cycleStart: string;
    cycleEnd: string;
    totalDays: number;
  } | null;
}

interface SubCompany {
  id: string;
  name: string;
}

interface KaryawanListClientProps {
  initialEmployees: EmployeeData[];
  subCompanies: SubCompany[];
}

export function KaryawanListClient({
  initialEmployees,
  subCompanies,
}: KaryawanListClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("ALL"); // "ALL", "UNASSIGNED", or subcompany ID

  const getRoleLabel = (role: string): string => {
    const map: Record<string, string> = {
      SUPERADMIN: "Super Admin",
      ADMIN: "Admin HR",
      KARYAWAN: "Karyawan",
    };
    return map[role] ?? role;
  };

  const formatDateLabel = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Filter list by search query
  const searchedEmployees = useMemo(() => {
    return initialEmployees.filter((emp) => {
      const query = searchQuery.toLowerCase();
      return (
        emp.name.toLowerCase().includes(query) ||
        (emp.email && emp.email.toLowerCase().includes(query)) ||
        (emp.username && emp.username.toLowerCase().includes(query)) ||
        (emp.nik && emp.nik.toLowerCase().includes(query)) ||
        (emp.department && emp.department.toLowerCase().includes(query)) ||
        (emp.position && emp.position.toLowerCase().includes(query)) ||
        (emp.subCompany && emp.subCompany.name.toLowerCase().includes(query))
      );
    });
  }, [initialEmployees, searchQuery]);

  // Count employees for each group (based on searched result or full list? Full list is better for tab labels!)
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: initialEmployees.length,
      UNASSIGNED: initialEmployees.filter((e) => !e.subCompanyId).length,
    };

    subCompanies.forEach((sc) => {
      counts[sc.id] = initialEmployees.filter((e) => e.subCompanyId === sc.id).length;
    });

    return counts;
  }, [initialEmployees, subCompanies]);

  // Filter by active tab
  const filteredEmployees = useMemo(() => {
    if (activeTab === "ALL") return searchedEmployees;
    if (activeTab === "UNASSIGNED") return searchedEmployees.filter((e) => !e.subCompanyId);
    return searchedEmployees.filter((e) => e.subCompanyId === activeTab);
  }, [searchedEmployees, activeTab]);

  return (
    <div className="flex flex-col gap-6">
      {/* Search & Actions Bar */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex-1 min-w-[280px] max-w-[500px] relative items-center flex">
          <Search
            size={18}
            className="text-muted"
            style={{ position: "absolute", left: 16, pointerEvents: "none" }}
          />
          <input
            type="text"
            placeholder="Cari nama, email, NIK, jabatan..."
            className="form-input w-full"
            style={{ paddingLeft: 44, minHeight: 42 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Link href="/karyawan/new" className="btn btn-primary">
          <Plus size={16} />
          Tambah Karyawan
        </Link>
      </div>

      {/* Tabbed Navigation for Sub-Companies */}
      <div
        className="flex gap-2 overflow-x-auto pb-2"
        style={{
          borderBottom: "1px solid var(--color-border)",
          scrollbarWidth: "none",
        }}
      >
        {/* All Tab */}
        <button
          onClick={() => setActiveTab("ALL")}
          className={`btn btn-sm ${activeTab === "ALL" ? "btn-primary" : "btn-ghost"}`}
          style={{
            whiteSpace: "nowrap",
            padding: "8px 16px",
            minHeight: 36,
            borderRadius: "var(--radius-md)",
          }}
        >
          Semua Karyawan ({tabCounts.ALL})
        </button>

        {/* Sub-Company Tabs */}
        {subCompanies.map((sc) => (
          <button
            key={sc.id}
            onClick={() => setActiveTab(sc.id)}
            className={`btn btn-sm ${activeTab === sc.id ? "btn-primary" : "btn-ghost"}`}
            style={{
              whiteSpace: "nowrap",
              padding: "8px 16px",
              minHeight: 36,
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Building size={14} />
            {sc.name} ({tabCounts[sc.id] || 0})
          </button>
        ))}

        {/* Unassigned Tab */}
        {tabCounts.UNASSIGNED > 0 && (
          <button
            onClick={() => setActiveTab("UNASSIGNED")}
            className={`btn btn-sm ${activeTab === "UNASSIGNED" ? "btn-primary" : "btn-ghost"}`}
            style={{
              whiteSpace: "nowrap",
              padding: "8px 16px",
              minHeight: 36,
              borderRadius: "var(--radius-md)",
            }}
          >
            Belum Diset ({tabCounts.UNASSIGNED})
          </button>
        )}
      </div>

      {/* Employee List Table */}
      <div className="card-outer">
        <div className="card-inner" style={{ padding: 0 }}>
          {filteredEmployees.length === 0 ? (
            <div className="empty-state">
              <Users size={32} className="text-muted" />
              <div className="empty-state-title">Tidak ada data karyawan</div>
              <p>Silakan buat akun karyawan baru atau ubah kata kunci pencarian.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nama Karyawan</th>
                    <th>Unit Bisnis / Jabatan</th>
                    <th>Role</th>
                    <th>Tanggal Bergabung</th>
                    <th>Jatah Cuti</th>
                    <th>Sisa Cuti</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const initials = emp.name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase();

                    return (
                      <tr key={emp.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              className="sidebar-avatar"
                              style={{
                                width: 34,
                                height: 34,
                                fontSize: "var(--text-xs)",
                                background: "var(--color-primary-light)",
                                color: "var(--color-primary)",
                                margin: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <div className="flex flex-col">
                              <span style={{ fontWeight: 600 }}>{emp.name}</span>
                              <span className="text-xs text-muted">
                                {emp.nik ? `NIK: ${emp.nik} • ` : ""}
                                {emp.email || "—"}{emp.username ? ` (@${emp.username})` : ""}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span style={{ fontWeight: 500 }}>
                              {emp.subCompany?.name || "—"}
                            </span>
                            <span className="text-xs text-muted">
                              {emp.position || "—"}{" "}
                              {emp.department ? `(${emp.department})` : ""}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{getRoleLabel(emp.role)}</span>
                        </td>
                        <td>
                          <span className="text-sm">{formatDateLabel(emp.joinDate)}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{emp.quotaText}</span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              color: emp.activeQuota ? "var(--color-primary)" : "inherit",
                            }}
                          >
                            {emp.balanceText}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              emp.isActive ? "badge-approved" : "badge-rejected"
                            }`}
                          >
                            {emp.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/karyawan/${emp.id}`}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "0 8px", minHeight: 32, gap: 4 }}
                          >
                            <Eye size={14} /> Detail
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
