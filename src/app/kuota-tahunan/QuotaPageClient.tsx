"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertAnnualLeaveQuota } from "@/lib/actions/karyawan";
import {
  Search,
  Calendar,
  AlertTriangle,
  Loader2,
  X,
  Edit2,
  User,
  Users,
} from "lucide-react";

interface EmployeeQuotaData {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  role: string;
  department: string | null;
  position: string | null;
  joinDate: string;
  isActive: boolean;
  activeQuota: {
    id: string;
    cycleStart: string;
    cycleEnd: string;
    totalDays: number;
  } | null;
  usedDays: number;
  accruedDays: number;
  remainingDays: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysToExpiry: number | null;
}

interface QuotaPageClientProps {
  initialEmployees: EmployeeQuotaData[];
}

export function QuotaPageClient({ initialEmployees }: QuotaPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State
  const [editingEmployee, setEditingEmployee] = useState<EmployeeQuotaData | null>(
    null
  );
  const [formCycleStart, setFormCycleStart] = useState("");
  const [formTotalDays, setFormTotalDays] = useState(12);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);

  const openEditModal = (emp: EmployeeQuotaData) => {
    setEditingEmployee(emp);
    setFormError("");
    setFormSuccess(false);

    // Default values for form inputs
    if (emp.activeQuota) {
      setFormCycleStart(emp.activeQuota.cycleStart.substring(0, 10));
      setFormTotalDays(emp.activeQuota.totalDays);
    } else {
      // Default to join date or today
      setFormCycleStart(emp.joinDate.substring(0, 10));
      setFormTotalDays(12);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    setFormError("");
    setFormSuccess(false);

    if (!formCycleStart) {
      setFormError("Tanggal mulai siklus wajib diisi.");
      return;
    }
    if (formTotalDays <= 0) {
      setFormError("Jumlah jatah cuti harus lebih besar dari 0 hari.");
      return;
    }

    startTransition(async () => {
      const res = await upsertAnnualLeaveQuota(
        editingEmployee.id,
        formCycleStart,
        formTotalDays
      );

      if (res?.error) {
        setFormError(res.error);
      } else {
        setFormSuccess(true);
        // Refresh data page
        router.refresh();
        // Give a short delay before closing modal on success
        setTimeout(() => {
          setEditingEmployee(null);
        }, 800);
      }
    });
  };

  // Filter and Search logic
  const filteredEmployees = initialEmployees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.email && emp.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.username && emp.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.department &&
        emp.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.position &&
        emp.position.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === "ALL") return true;
    if (statusFilter === "NO_QUOTA") return emp.activeQuota === null;
    if (statusFilter === "EXPIRED") return emp.isExpired;
    if (statusFilter === "EXPIRING_SOON") return emp.isExpiringSoon;
    if (statusFilter === "ACTIVE")
      return emp.activeQuota !== null && !emp.isExpired && !emp.isExpiringSoon;

    return true;
  });

  const formatDateLabel = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search & Filter Bar */}
      <div className="card-outer">
        <div className="card-inner flex flex-wrap gap-4 items-center justify-between" style={{ padding: "var(--space-4)" }}>
          <div className="flex flex-1 min-w-[280px] relative items-center">
            <Search
              size={18}
              className="text-muted"
              style={{ position: "absolute", left: 16, pointerEvents: "none" }}
            />
            <input
              type="text"
              placeholder="Cari nama, email, departemen, atau jabatan..."
              className="form-input w-full"
              style={{ paddingLeft: 44, minHeight: 46 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              Filter Status:
            </span>
            <select
              className="form-input"
              style={{ minHeight: 46, minWidth: 200, padding: "8px 16px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Semua Siklus</option>
              <option value="ACTIVE">Aktif (Berjalan)</option>
              <option value="EXPIRING_SOON">Siklus Akan Berakhir (&lt; 30 Hari)</option>
              <option value="EXPIRED">Siklus Kedaluwarsa</option>
              <option value="NO_QUOTA">Belum Diset / Tidak Ada Kuota</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quota Management List */}
      <div className="card-outer">
        <div className="card-inner" style={{ padding: 0 }}>
          {filteredEmployees.length === 0 ? (
            <div className="empty-state">
              <Users size={32} className="text-muted" />
              <div className="empty-state-title">Tidak ada data karyawan ditemukan</div>
              <p>Coba ubah filter status atau kata kunci pencarian Anda.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Dept / Jabatan</th>
                    <th>Siklus Kuota Aktif</th>
                    <th style={{ textAlign: "center" }}>Total Kuota</th>
                    <th style={{ textAlign: "center" }}>Akrual</th>
                    <th style={{ textAlign: "center" }}>Terpakai</th>
                    <th style={{ textAlign: "center" }}>Sisa Saldo</th>
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
                                {emp.email || (emp.username ? `@${emp.username}` : "—")}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span style={{ fontWeight: 500 }}>
                              {emp.position || "—"}
                            </span>
                            <span className="text-xs text-muted">
                              {emp.department || "—"}
                            </span>
                          </div>
                        </td>
                        <td>
                          {emp.activeQuota ? (
                            <div className="flex flex-col">
                              <span style={{ fontWeight: 500 }}>
                                {formatDateLabel(emp.activeQuota.cycleStart)}
                              </span>
                              <span className="text-xs text-muted">
                                s.d. {formatDateLabel(emp.activeQuota.cycleEnd)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-light" style={{ fontStyle: "italic" }}>
                              Belum Dikonfigurasi
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>
                          {emp.activeQuota ? `${emp.activeQuota.totalDays} Hari` : "—"}
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 600, color: "var(--color-text-muted)" }}>
                          {emp.activeQuota ? `${emp.accruedDays} Hari` : "—"}
                        </td>
                        <td style={{ textAlign: "center", color: "var(--color-warning)", fontWeight: 600 }}>
                          {emp.activeQuota ? `${emp.usedDays} Hari` : "—"}
                        </td>
                        <td style={{ textAlign: "center", color: "var(--color-primary)", fontWeight: 700 }}>
                          {emp.activeQuota ? `${emp.remainingDays} Hari` : "—"}
                        </td>
                        <td>
                          {emp.activeQuota ? (
                            emp.isExpired ? (
                              <span className="badge badge-rejected">
                                Siklus Kedaluwarsa
                              </span>
                            ) : emp.isExpiringSoon ? (
                              <span
                                className="badge"
                                style={{
                                  background: "var(--color-warning-light)",
                                  color: "var(--color-warning)",
                                }}
                              >
                                Akan Berakhir ({emp.daysToExpiry} H)
                              </span>
                            ) : (
                              <span className="badge badge-approved">Siklus Aktif</span>
                            )
                          ) : (
                            <span className="badge badge-neutral">Belum Diset</span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => openEditModal(emp)}
                            className="btn btn-ghost btn-sm"
                            style={{
                              padding: "0 10px",
                              minHeight: 32,
                              gap: 6,
                              fontSize: "var(--text-xs)",
                            }}
                          >
                            <Edit2 size={12} /> Kelola
                          </button>
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

      {/* Custom Overlay Dialog Modal (Soft Structuralism Design) */}
      {editingEmployee && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-4)",
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            transition: "all 0.3s ease",
          }}
        >
          {/* Backdrop Closer */}
          <div
            style={{ position: "absolute", inset: 0 }}
            onClick={() => !isPending && setEditingEmployee(null)}
          />

          <div
            className="card-outer animate-modal-scale"
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: 480,
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="card-inner" style={{ padding: "var(--space-6)" }}>
              {/* Header */}
              <div
                className="flex justify-between items-start mb-6"
                style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 16 }}
              >
                <div>
                  <h3 className="card-title" style={{ margin: 0, fontSize: "var(--text-lg)" }}>
                    Kelola Kuota Cuti Tahunan
                  </h3>
                  <div className="flex flex-col mt-2">
                    <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                      {editingEmployee.name}
                    </span>
                    <span className="text-xs text-muted">
                      {editingEmployee.email || (editingEmployee.username ? `@${editingEmployee.username}` : "")}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  disabled={isPending}
                  className="btn btn-ghost btn-sm"
                  style={{
                    minHeight: 32,
                    width: 32,
                    padding: 0,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Status Messages */}
              {formError && (
                <div
                  className="form-error mb-4"
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    background: "var(--color-danger-light)",
                    color: "var(--color-danger)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid rgba(220,38,38,0.2)",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div
                  className="mb-4"
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    background: "var(--color-success-light)",
                    color: "var(--color-success)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid rgba(22,163,74,0.2)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 500,
                  }}
                >
                  Kuota cuti berhasil diperbarui!
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="modalCycleStart" className="form-label required" style={{ fontSize: "var(--text-xs)" }}>
                    Tanggal Mulai Siklus Baru
                  </label>
                  <input
                    id="modalCycleStart"
                    type="date"
                    className="form-input"
                    value={formCycleStart}
                    onChange={(e) => setFormCycleStart(e.target.value)}
                    disabled={isPending}
                    style={{ minHeight: 40, padding: "8px 12px", fontSize: "var(--text-sm)" }}
                  />
                  <p className="text-xs text-muted mt-1" style={{ fontSize: 11 }}>
                    Siklus berakhir otomatis 1 tahun setelah tanggal mulai (dikurangi 1 hari).
                    Join date karyawan: {formatDateLabel(editingEmployee.joinDate)}.
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="modalTotalDays" className="form-label required" style={{ fontSize: "var(--text-xs)" }}>
                    Total Jatah Cuti (Hari)
                  </label>
                  <input
                    id="modalTotalDays"
                    type="number"
                    min="1"
                    max="90"
                    className="form-input"
                    value={formTotalDays}
                    onChange={(e) => setFormTotalDays(parseInt(e.target.value) || 0)}
                    disabled={isPending}
                    style={{ minHeight: 40, padding: "8px 12px", fontSize: "var(--text-sm)" }}
                  />
                </div>

                {editingEmployee.activeQuota && (
                  <div
                    style={{
                      background: "var(--color-bg)",
                      padding: "12px 16px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                      <span>Siklus Terkini:</span>
                      <span style={{ fontWeight: 600 }}>
                        {formatDateLabel(editingEmployee.activeQuota.cycleStart)} - {formatDateLabel(editingEmployee.activeQuota.cycleEnd)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>
                      <span>Jatah Terkumpul (Akrual):</span>
                      <span style={{ fontWeight: 600 }}>{editingEmployee.accruedDays} Hari</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>
                      <span>Penggunaan Cuti Disetujui:</span>
                      <span style={{ fontWeight: 600 }}>{editingEmployee.usedDays} Hari</span>
                    </div>
                  </div>
                )}

                <div
                  className="flex gap-3 justify-end mt-4 pt-4"
                  style={{ borderTop: "1px solid var(--color-border)" }}
                >
                  <button
                    type="button"
                    onClick={() => setEditingEmployee(null)}
                    disabled={isPending}
                    className="btn btn-ghost"
                    style={{ minHeight: 40 }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="btn btn-primary"
                    style={{ minHeight: 40, gap: 8 }}
                  >
                    {isPending ? (
                      <>
                        <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                        Menyimpan...
                      </>
                    ) : (
                      "Simpan Kuota"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes modalScale {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-scale {
          animation: modalScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
