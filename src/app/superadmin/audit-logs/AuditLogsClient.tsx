"use client";

import React, { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  Calendar,
  RefreshCcw,
  X,
  ShieldCheck,
  Globe,
  Monitor,
  User,
  ArrowRight,
  Terminal,
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface AuditLogClientRow {
  id: string;
  actionType: string;
  description: string;
  actorId: string | null;
  actorName: string | null;
  targetId: string | null;
  targetName: string | null;
  beforeState: any;
  afterState: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogsClientProps {
  initialLogs: AuditLogClientRow[];
  actionTypes: string[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  filters: {
    q: string;
    actionType: string;
    start: string;
    end: string;
  };
}

function getActionBadgeColor(type: string): string {
  const map: Record<string, string> = {
    // Approved / Success
    LOGIN_SUCCESS: "badge-approved",
    LEAVE_APPROVE: "badge-approved",
    SUBCOMPANY_CREATE: "badge-approved",
    HOLIDAY_CREATE: "badge-approved",
    
    // Rejected / Danger
    LOGIN_FAILURE: "badge-rejected",
    LEAVE_REJECT: "badge-rejected",
    USER_DELETE: "badge-rejected",
    SUBCOMPANY_DELETE: "badge-rejected",
    HOLIDAY_DELETE: "badge-rejected",
    
    // Primary / Info
    USER_CREATE: "badge-primary",
    QUOTA_CREATE: "badge-primary",
    LEAVE_SUBMIT: "badge-info",
    QUOTA_ROLLOVER: "badge-info",
    
    // Pending / Warning
    USER_UPDATE: "badge-pending",
    QUOTA_ADJUST: "badge-pending",
    SETTING_UPDATE: "badge-pending",
  };
  return map[type] ?? "badge-neutral";
}

function getActionLabel(type: string): string {
  return type.replace(/_/g, " ");
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AuditLogsClient({
  initialLogs,
  actionTypes,
  totalCount,
  totalPages,
  currentPage,
  filters,
}: AuditLogsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Local state for filters
  const [searchVal, setSearchVal] = useState(filters.q);
  const [typeVal, setTypeVal] = useState(filters.actionType);
  const [startVal, setStartVal] = useState(filters.start);
  const [endVal, setEndVal] = useState(filters.end);

  // Local state for sliding drawer drawer
  const [selectedLog, setSelectedLog] = useState<AuditLogClientRow | null>(null);

  // Stats
  const failureCount = initialLogs.filter((l) => l.actionType === "LOGIN_FAILURE").length;

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    if (searchVal) params.set("q", searchVal);
    if (typeVal && typeVal !== "ALL") params.set("actionType", typeVal);
    if (startVal) params.set("start", startVal);
    if (endVal) params.set("end", endVal);
    params.set("page", "1"); // Default to page 1 on filter changes
    
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === "" || v === "ALL") {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    });

    return `${pathname}?${params.toString()}`;
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      router.push(buildUrl({}));
    });
  }

  function handleResetFilters() {
    setSearchVal("");
    setTypeVal("ALL");
    setStartVal("");
    setEndVal("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    startTransition(() => {
      router.push(buildUrl({ page: String(newPage) }));
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* KPI Stats Cards */}
      <div className="grid grid-3 gap-6">
        <div className="card-outer">
          <div className="card-inner" style={{ padding: "var(--space-4)" }}>
            <div className="flex items-center gap-4">
              <div className="stat-icon primary">
                <Activity size={20} />
              </div>
              <div>
                <div className="stat-label">Total Log Aktivitas</div>
                <div className="stat-value" style={{ fontSize: "var(--text-xl)" }}>
                  {totalCount}
                </div>
                <div className="stat-change">Seluruh riwayat sistem</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-outer">
          <div className="card-inner" style={{ padding: "var(--space-4)" }}>
            <div className="flex items-center gap-4">
              <div className="stat-icon danger">
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="stat-label">Percobaan Gagal (Halaman Ini)</div>
                <div className="stat-value" style={{ fontSize: "var(--text-xl)" }}>
                  {failureCount}
                </div>
                <div className="stat-change">Gagal login terdeteksi</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-outer">
          <div className="card-inner" style={{ padding: "var(--space-4)" }}>
            <div className="flex items-center gap-4">
              <div className="stat-icon success">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="stat-label">Status Audit</div>
                <div className="stat-value" style={{ fontSize: "var(--text-xl)", color: "var(--color-success)" }}>
                  Aktif
                </div>
                <div className="stat-change">Proteksi data 100%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Form */}
      <div className="card-outer">
        <div className="card-inner">
          <form onSubmit={handleFilterSubmit} className="flex flex-col gap-4">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              {/* Search */}
              <div className="form-group mb-0">
                <label className="form-label">Cari Pengguna / Deskripsi</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nama, NIK, deskripsi..."
                    value={searchVal}
                    onChange={(e) => setSearchVal(e.target.value)}
                    style={{ paddingLeft: "36px" }}
                  />
                  <Search
                    size={16}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--color-text-muted)",
                    }}
                  />
                </div>
              </div>

              {/* Action Type */}
              <div className="form-group mb-0">
                <label className="form-label">Tipe Aktivitas</label>
                <select
                  className="form-input form-select"
                  value={typeVal}
                  onChange={(e) => setTypeVal(e.target.value)}
                >
                  <option value="ALL">Semua Aktivitas</option>
                  {actionTypes.map((type) => (
                    <option key={type} value={type}>
                      {getActionLabel(type)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div className="form-group mb-0">
                <label className="form-label">Tanggal Mulai</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="date"
                    className="form-input"
                    value={startVal}
                    onChange={(e) => setStartVal(e.target.value)}
                    style={{ paddingLeft: "36px" }}
                  />
                  <Calendar
                    size={16}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--color-text-muted)",
                    }}
                  />
                </div>
              </div>

              {/* End Date */}
              <div className="form-group mb-0">
                <label className="form-label">Tanggal Selesai</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="date"
                    className="form-input"
                    value={endVal}
                    onChange={(e) => setEndVal(e.target.value)}
                    style={{ paddingLeft: "36px" }}
                  />
                  <Calendar
                    size={16}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--color-text-muted)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-2" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleResetFilters}
                disabled={isPending}
              >
                <RefreshCcw size={14} style={{ marginRight: 6 }} />
                Reset
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                <Search size={14} style={{ marginRight: 6 }} />
                {isPending ? "Memproses..." : "Terapkan Filter"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Data Table */}
      <div className="card-outer">
        <div className="card-inner" style={{ padding: 0 }}>
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table className={`table ${isPending ? "opacity-60" : ""}`} style={{ minWidth: "900px" }}>
              <thead>
                <tr>
                  <th style={{ width: "160px" }}>Aktivitas</th>
                  <th>Deskripsi</th>
                  <th style={{ width: "160px" }}>Aktor</th>
                  <th style={{ width: "160px" }}>Target</th>
                  <th style={{ width: "180px" }}>Waktu</th>
                  <th style={{ width: "120px" }}>Alamat IP</th>
                  <th style={{ width: "60px", textAlign: "center" }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {initialLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px" }}>
                      <div className="empty-state">
                        <Terminal size={40} style={{ color: "var(--color-text-muted)", marginBottom: 12 }} />
                        <div className="empty-state-title">Tidak ada log aktivitas</div>
                        <p>Sesuaikan filter pencarian atau pastikan sistem merekam aktivitas baru.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  initialLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td>
                        <span className={`badge ${getActionBadgeColor(log.actionType)}`}>
                          {getActionLabel(log.actionType)}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{log.description}</td>
                      <td>
                        {log.actorName ? (
                          <div className="flex items-center gap-2">
                            <User size={14} style={{ color: "var(--color-primary)" }} />
                            <span className="truncate" style={{ maxWidth: "130px" }}>{log.actorName}</span>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {log.targetName ? (
                          <div className="flex items-center gap-2">
                            <User size={14} style={{ color: "var(--color-text-light)" }} />
                            <span className="truncate" style={{ maxWidth: "130px" }}>{log.targetName}</span>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td style={{ color: "var(--color-text-muted)" }}>
                        {formatDate(log.createdAt)}
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-text-muted)" }}>
                        {log.ipAddress}
                      </td>
                      <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-icon btn-ghost"
                          onClick={() => setSelectedLog(log)}
                          title="Lihat Detail JSON"
                          style={{ margin: "0 auto" }}
                        >
                          <ArrowRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div
              className="flex justify-between items-center"
              style={{
                padding: "16px var(--space-6)",
                borderTop: "1px solid var(--color-border)",
                fontSize: "var(--text-sm)",
              }}
            >
              <div style={{ color: "var(--color-text-muted)" }}>
                Menampilkan halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> (Total: {totalCount} log)
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isPending}
                  style={{ padding: "6px 12px" }}
                >
                  <ChevronLeft size={16} style={{ marginRight: 4 }} />
                  Sebelumnya
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || isPending}
                  style={{ padding: "6px 12px" }}
                >
                  Berikutnya
                  <ChevronRight size={16} style={{ marginLeft: 4 }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Side Drawer Component */}
      <div
        className={`drawer-overlay ${selectedLog ? "open" : ""}`}
        onClick={() => setSelectedLog(null)}
      />
      <div className={`drawer ${selectedLog ? "open" : ""}`}>
        <div className="drawer-header">
          <h3 className="card-title flex items-center gap-2">
            <Terminal size={18} style={{ color: "var(--color-primary)" }} />
            Detail Log Aktivitas
          </h3>
          <button
            className="btn btn-icon btn-ghost"
            onClick={() => setSelectedLog(null)}
            style={{ padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {selectedLog && (
          <div className="drawer-body flex flex-col gap-6">
            {/* Meta Table */}
            <div style={{ background: "#F8FAFC", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", padding: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: "12px", fontSize: "var(--text-sm)" }}>
                <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Aktivitas:</span>
                <div>
                  <span className={`badge ${getActionBadgeColor(selectedLog.actionType)}`}>
                    {getActionLabel(selectedLog.actionType)}
                  </span>
                </div>

                <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Deskripsi:</span>
                <span style={{ fontWeight: 500 }}>{selectedLog.description}</span>

                <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Aktor:</span>
                <span>{selectedLog.actorName ? `${selectedLog.actorName} (ID: ${selectedLog.actorId})` : "Sistem / Tamu"}</span>

                <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Target:</span>
                <span>{selectedLog.targetName ? `${selectedLog.targetName} (ID: ${selectedLog.targetId})` : "—"}</span>

                <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Waktu:</span>
                <span>{formatDate(selectedLog.createdAt)}</span>

                <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Alamat IP:</span>
                <span className="flex items-center gap-1">
                  <Globe size={14} style={{ color: "var(--color-text-muted)" }} />
                  <code style={{ fontSize: "12px" }}>{selectedLog.ipAddress}</code>
                </span>

                <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>User Agent:</span>
                <span className="flex items-start gap-1" style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                  <Monitor size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span className="break-all">{selectedLog.userAgent}</span>
                </span>
              </div>
            </div>

            {/* State Diffs */}
            {(selectedLog.beforeState || selectedLog.afterState) && (
              <div className="flex flex-col gap-4">
                <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  Perubahan State Data
                </h4>
                
                <div style={{ display: "grid", gridTemplateColumns: selectedLog.beforeState && selectedLog.afterState ? "1fr 1fr" : "1fr", gap: "16px" }}>
                  {/* Before */}
                  {selectedLog.beforeState && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Sebelum Perubahan</span>
                      <pre className="json-container" style={{ background: "#FEF2F2", color: "#991B1B", border: "1px solid #FCA5A5" }}>
                        {JSON.stringify(selectedLog.beforeState, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* After */}
                  {selectedLog.afterState && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Sesudah Perubahan</span>
                      <pre className="json-container" style={{ background: "#F0FDF4", color: "#166534", border: "1px solid #86EFAC" }}>
                        {JSON.stringify(selectedLog.afterState, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
