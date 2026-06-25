"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  FileSpreadsheet,
  Upload,
  Download,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";
import { importLeaveHistoryAction } from "@/lib/actions/leave";

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoryRow {
  id: string;
  nik: string;
  employeeName: string;
  types: string;
  periodStr: string;
  totalDays: number;
  status: string;
}

interface Employee {
  id: string;
  name: string;
  nik: string;
}

interface RiwayatTahunanClientProps {
  rows: HistoryRow[];
  employees: Employee[];
  availableYears: number[];
  selectedYear: number;
  selectedUserId: string;
  selectedLeaveType: string;
  selectedStatus: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  totalApprovedDays: number;
}

// ─── Leave type options ───────────────────────────────────────────────────────

const LEAVE_TYPE_OPTIONS = [
  { value: "ALL", label: "Semua Jenis" },
  { value: "CUTI_TAHUNAN", label: "Cuti Tahunan" },
  { value: "SAKIT", label: "Sakit dengan Surat Dokter" },
  { value: "PERNIKAHAN_KARYAWAN", label: "Pernikahan Karyawan" },
  { value: "PERNIKAHAN_ANAK", label: "Pernikahan Anak" },
  { value: "KHITAN_BAPTIS", label: "Khitan/Baptis Anak" },
  { value: "ISTRI_MELAHIRKAN", label: "Istri Melahirkan" },
  { value: "KEMATIAN_KELUARGA", label: "Cuti Duka Cita" },
  { value: "KARYAWATI_MELAHIRKAN", label: "Melahirkan (Karyawati)" },
  { value: "KARYAWATI_KEGUGURAN", label: "Keguguran (Karyawati)" },
  { value: "IZIN_LAINNYA", label: "Izin Lainnya" },
];

const LEAVE_TYPE_REF = LEAVE_TYPE_OPTIONS.filter((o) => o.value !== "ALL");

// ─── Preview row type ─────────────────────────────────────────────────────────

interface PreviewRow {
  rowNum: number;
  nik: string;
  resolvedName: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  valid: boolean;
  errorMessage: string | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RiwayatTahunanClient({
  rows,
  employees,
  availableYears,
  selectedYear,
  selectedUserId,
  selectedLeaveType,
  selectedStatus,
  currentPage,
  totalPages,
  totalCount,
  totalApprovedDays,
}: RiwayatTahunanClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Import modal state ───────────────────────────────────────────────
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<
    "idle" | "parsing" | "preview" | "importing" | "complete" | "error"
  >("idle");
  const [importMessage, setImportMessage] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importResults, setImportResults] = useState<{
    successCount: number;
    failedCount: number;
    errors: { row: number; nik: string; error: string }[];
  } | null>(null);

  // ── Filter helpers ───────────────────────────────────────────────────

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    params.set("year", String(selectedYear));
    params.set("userId", selectedUserId);
    params.set("leaveType", selectedLeaveType);
    params.set("status", selectedStatus);
    params.set("page", String(currentPage));
    Object.entries(overrides).forEach(([k, v]) => params.set(k, v));
    return `/riwayat-tahunan?${params.toString()}`;
  }

  function navigate(overrides: Record<string, string>) {
    startTransition(() => router.push(buildUrl(overrides)));
  }

  // ── Template download ────────────────────────────────────────────────

  const handleDownloadTemplate = async () => {
    try {
      const xlsx = await import("xlsx");

      // Sheet 1: Data template
      const headers = [["NIK", "Jenis Cuti", "Tanggal Mulai (YYYY-MM-DD)", "Tanggal Selesai (YYYY-MM-DD)", "Total Hari"]];
      const sample = [["12345678", "CUTI_TAHUNAN", "2025-03-10", "2025-03-12", "3"]];
      const ws1 = xlsx.utils.aoa_to_sheet([...headers, ...sample]);

      // Set column widths
      ws1["!cols"] = [{ wch: 14 }, { wch: 25 }, { wch: 28 }, { wch: 28 }, { wch: 12 }];

      // Sheet 2: Leave type reference
      const refHeaders = [["Nilai Jenis Cuti (isi persis di Sheet 1)", "Keterangan"]];
      const refData = LEAVE_TYPE_REF.map((t) => [t.value, t.label]);
      const ws2 = xlsx.utils.aoa_to_sheet([...refHeaders, ...refData]);
      ws2["!cols"] = [{ wch: 30 }, { wch: 30 }];

      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws1, "Data Riwayat Cuti");
      xlsx.utils.book_append_sheet(wb, ws2, "Referensi Jenis Cuti");
      xlsx.writeFile(wb, "Template_Import_Riwayat_Cuti.xlsx");
    } catch (err: any) {
      alert("Gagal mengunduh template: " + (err.message || err));
    }
  };

  // ── Excel parse & NIK resolve ────────────────────────────────────────

  const processFile = async (file: File) => {
    setImportStatus("parsing");
    setImportMessage("Membaca file Excel...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const xlsx = await import("xlsx");
      const workbook = xlsx.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });

      if (rawRows.length === 0) {
        setImportStatus("error");
        setImportMessage("File Excel kosong atau tidak memiliki baris data.");
        return;
      }

      setImportMessage(`Memvalidasi ${rawRows.length} baris...`);

      // Resolve each row's NIK via API
      const resolved: PreviewRow[] = await Promise.all(
        rawRows.map(async (row, idx) => {
          const nik = String(row["NIK"] ?? row["nik"] ?? "").trim();
          const leaveType = String(row["Jenis Cuti"] ?? row["jenis_cuti"] ?? row["leaveType"] ?? "").trim();
          const startDate = String(row["Tanggal Mulai (YYYY-MM-DD)"] ?? row["startDate"] ?? row["Tanggal Mulai"] ?? "").trim();
          const endDate = String(row["Tanggal Selesai (YYYY-MM-DD)"] ?? row["endDate"] ?? row["Tanggal Selesai"] ?? "").trim();
          const totalDays = String(row["Total Hari"] ?? row["totalDays"] ?? "").trim();

          // Validate locally first
          if (!nik) {
            return { rowNum: idx + 1, nik: "—", resolvedName: null, leaveType, startDate, endDate, totalDays, valid: false, errorMessage: "NIK tidak boleh kosong." };
          }

          const leaveTypeUpper = leaveType.toUpperCase();
          if (!LEAVE_TYPE_REF.some((t) => t.value === leaveTypeUpper)) {
            return { rowNum: idx + 1, nik, resolvedName: null, leaveType, startDate, endDate, totalDays, valid: false, errorMessage: `Jenis cuti "${leaveType}" tidak valid. Lihat sheet Referensi.` };
          }

          if (!startDate || isNaN(new Date(startDate).getTime())) {
            return { rowNum: idx + 1, nik, resolvedName: null, leaveType, startDate, endDate, totalDays, valid: false, errorMessage: `Format tanggal mulai tidak valid: "${startDate}".` };
          }

          if (!endDate || isNaN(new Date(endDate).getTime())) {
            return { rowNum: idx + 1, nik, resolvedName: null, leaveType, startDate, endDate, totalDays, valid: false, errorMessage: `Format tanggal selesai tidak valid: "${endDate}".` };
          }

          if (new Date(startDate) > new Date(endDate)) {
            return { rowNum: idx + 1, nik, resolvedName: null, leaveType, startDate, endDate, totalDays, valid: false, errorMessage: "Tanggal mulai tidak boleh setelah tanggal selesai." };
          }

          const days = Number(totalDays);
          if (isNaN(days) || days <= 0) {
            return { rowNum: idx + 1, nik, resolvedName: null, leaveType, startDate, endDate, totalDays, valid: false, errorMessage: `Total hari tidak valid: "${totalDays}".` };
          }

          // Resolve NIK via API
          try {
            const res = await fetch(`/api/employees/lookup-nik?nik=${encodeURIComponent(nik)}`);
            if (!res.ok) {
              const data = await res.json();
              return { rowNum: idx + 1, nik, resolvedName: null, leaveType, startDate, endDate, totalDays, valid: false, errorMessage: data.error ?? `NIK "${nik}" tidak ditemukan.` };
            }
            const emp = await res.json();
            return { rowNum: idx + 1, nik, resolvedName: emp.name, leaveType, startDate, endDate, totalDays, valid: true, errorMessage: null };
          } catch {
            return { rowNum: idx + 1, nik, resolvedName: null, leaveType, startDate, endDate, totalDays, valid: false, errorMessage: "Gagal memvalidasi NIK. Coba lagi." };
          }
        })
      );

      setPreviewRows(resolved);
      setImportStatus("preview");
      setImportMessage("");
    } catch (err: any) {
      setImportStatus("error");
      setImportMessage(`Gagal memproses file: ${err.message || err}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Commit import ────────────────────────────────────────────────────

  const handleConfirmImport = async () => {
    const validRows = previewRows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setImportStatus("importing");
    setImportMessage(`Mengimpor ${validRows.length} baris...`);

    const payload = validRows.map((r) => ({
      nik: r.nik,
      leaveType: r.leaveType.toUpperCase(),
      startDate: r.startDate,
      endDate: r.endDate,
      totalDays: Number(r.totalDays),
    }));

    try {
      const res = await importLeaveHistoryAction(payload);
      if (res.error) {
        setImportStatus("error");
        setImportMessage(res.error);
      } else {
        setImportResults(res.results ?? null);
        setImportStatus("complete");
      }
    } catch (err: any) {
      setImportStatus("error");
      setImportMessage(`Kesalahan server: ${err.message || err}`);
    }
  };

  const resetImport = () => {
    setImportStatus("idle");
    setImportMessage("");
    setPreviewRows([]);
    setImportResults(null);
  };

  const openImport = () => {
    resetImport();
    setIsImportOpen(true);
  };

  const closeImport = () => {
    if (importStatus === "importing") return;
    setIsImportOpen(false);
    if (importStatus === "complete") {
      startTransition(() => router.refresh());
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  const invalidCount = previewRows.filter((r) => !r.valid).length;
  const validCount = previewRows.filter((r) => r.valid).length;
  const canConfirm = importStatus === "preview" && invalidCount === 0 && validCount > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Top Action Bar ─────────────────────────────────────────── */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <History size={20} style={{ color: "var(--color-primary)" }} />
          <div>
            <h2 className="page-title" style={{ fontSize: "var(--text-xl)", margin: 0 }}>
              Riwayat Cuti &amp; Izin
            </h2>
            <p className="text-xs text-muted">Data historis pengajuan cuti seluruh karyawan</p>
          </div>
        </div>
        <button
          onClick={openImport}
          className="btn btn-ghost"
          style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}
        >
          <Upload size={16} />
          Impor Riwayat Excel
        </button>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <div className="card-outer">
        <div className="card-inner" style={{ padding: "var(--space-4)" }}>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Year */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted font-semibold">Tahun</label>
              <select
                className="form-input"
                style={{ minHeight: 40, minWidth: 110 }}
                value={selectedYear}
                onChange={(e) => navigate({ year: e.target.value, page: "1" })}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Employee */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted font-semibold">Karyawan</label>
              <select
                className="form-input"
                style={{ minHeight: 40, minWidth: 200 }}
                value={selectedUserId}
                onChange={(e) => navigate({ userId: e.target.value, page: "1" })}
              >
                <option value="ALL">Semua Karyawan</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}{e.nik ? ` (${e.nik})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Leave type */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted font-semibold">Jenis Cuti</label>
              <select
                className="form-input"
                style={{ minHeight: 40, minWidth: 180 }}
                value={selectedLeaveType}
                onChange={(e) => navigate({ leaveType: e.target.value, page: "1" })}
              >
                {LEAVE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted font-semibold">Status</label>
              <select
                className="form-input"
                style={{ minHeight: 40, minWidth: 140 }}
                value={selectedStatus}
                onChange={(e) => navigate({ status: e.target.value, page: "1" })}
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Menunggu</option>
                <option value="APPROVED">Disetujui</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 flex-wrap" style={{ fontSize: "var(--text-sm)" }}>
        <span className="text-muted">
          Ditemukan <span style={{ fontWeight: 700, color: "var(--color-text)" }}>{totalCount}</span> pengajuan
        </span>
        <span className="text-muted">
          Total hari disetujui:{" "}
          <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>{totalApprovedDays} hari</span>
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="card-outer">
        <div className="card-inner" style={{ padding: 0 }}>
          {rows.length === 0 ? (
            <div className="empty-state">
              <History size={32} className="text-muted" />
              <div className="empty-state-title">Tidak ada data untuk filter ini</div>
              <p>Coba ubah tahun, karyawan, atau jenis cuti yang dipilih.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              <table className="table" style={{ fontSize: "var(--text-xs)" }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>NIK</th>
                    <th>Nama Karyawan</th>
                    <th>Jenis Cuti</th>
                    <th>Periode</th>
                    <th>Hari</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="text-muted">{(currentPage - 1) * 20 + idx + 1}</td>
                      <td>
                        <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{row.nik}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{row.employeeName}</td>
                      <td>{row.types}</td>
                      <td className="text-muted">{row.periodStr}</td>
                      <td style={{ fontWeight: 700 }}>{row.totalDays}</td>
                      <td>
                        <span className={`badge badge-${row.status.toLowerCase()}`}>
                          {row.status === "APPROVED" ? "Disetujui" : row.status === "PENDING" ? "Menunggu" : "Ditolak"}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/cuti/${row.id}`}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "0 8px", minHeight: 28, gap: 4, fontSize: "11px" }}
                        >
                          Lihat
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center flex-wrap gap-4" style={{ fontSize: "var(--text-sm)" }}>
          <span className="text-muted">
            Halaman {currentPage} dari {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => navigate({ page: String(currentPage - 1) })}
              className="btn btn-ghost btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 36 }}
            >
              <ChevronLeft size={14} /> Sebelumnya
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => navigate({ page: String(currentPage + 1) })}
              className="btn btn-ghost btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 36 }}
            >
              Berikutnya <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          IMPORT MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {isImportOpen && (
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
          }}
        >
          {/* Backdrop */}
          <div style={{ position: "absolute", inset: 0 }} onClick={closeImport} />

          <div
            className="card-outer animate-modal-scale"
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: importStatus === "preview" ? 760 : 540,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--color-border)",
              overflow: "hidden",
            }}
          >
            <div
              className="card-inner"
              style={{
                padding: 0,
                display: "flex",
                flexDirection: "column",
                flex: 1,
                maxHeight: "100%",
                overflow: "hidden",
              }}
            >
              {/* Modal Header */}
            <div
              style={{
                padding: "var(--space-5) var(--space-6) var(--space-4)",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexShrink: 0,
              }}
            >
              <div>
                <h3
                  className="card-title"
                  style={{ margin: 0, fontSize: "var(--text-lg)", display: "flex", alignItems: "center", gap: 8 }}
                >
                  <FileSpreadsheet className="text-primary" size={20} />
                  Impor Riwayat Cuti via Excel
                </h3>
                <p className="text-xs text-muted mt-1">
                  Unggah file .xlsx untuk mengimpor data historis cuti sebagai catatan APPROVED.
                </p>
              </div>
              <button
                type="button"
                onClick={closeImport}
                disabled={importStatus === "importing"}
                className="btn btn-ghost btn-sm"
                style={{ minHeight: 32, width: 32, padding: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "var(--space-5) var(--space-6)", overflowY: "auto", flex: 1 }}>

              {/* ── IDLE: Upload zone ──────────────────────────── */}
              {importStatus === "idle" && (
                <div className="flex flex-col gap-4">
                  {/* Template download */}
                  <div
                    style={{
                      background: "var(--color-bg)",
                      padding: "12px 16px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div className="flex flex-col">
                      <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>Belum punya template?</span>
                      <span className="text-xs text-muted font-light">
                        Unduh template dengan kolom yang sesuai + referensi jenis cuti.
                      </span>
                    </div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="btn btn-sm btn-ghost"
                      style={{ color: "var(--color-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Download size={14} />
                      Unduh Template
                    </button>
                  </div>

                  {/* Drag-drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById("riwayat-file-input")?.click()}
                    style={{
                      border: dragOver ? "2px dashed var(--color-primary)" : "2px dashed var(--color-border)",
                      borderRadius: "var(--radius-lg)",
                      padding: "40px var(--space-4)",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      background: dragOver ? "var(--color-primary-light)" : "transparent",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Upload className="text-muted" size={32} />
                    <div className="flex flex-col">
                      <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                        Tarik &amp; lepas file di sini, atau klik untuk memilih
                      </span>
                      <span className="text-xs text-muted mt-1 font-light">Format .xlsx atau .xls</span>
                    </div>
                    <input
                      id="riwayat-file-input"
                      type="file"
                      accept=".xlsx,.xls"
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                  </div>
                </div>
              )}

              {/* ── PARSING: Spinner ───────────────────────────── */}
              {(importStatus === "parsing" || importStatus === "importing") && (
                <div
                  style={{
                    padding: "40px 24px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "var(--color-primary-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        border: "3px solid var(--color-primary)",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        display: "block",
                      }}
                    />
                  </div>
                  <span style={{ fontWeight: 600 }}>{importMessage || "Memproses..."}</span>
                </div>
              )}

              {/* ── PREVIEW: Validation table ──────────────────── */}
              {importStatus === "preview" && (
                <div className="flex flex-col gap-4">
                  {/* Summary badges */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      style={{
                        background: validCount > 0 ? "var(--color-success-light)" : "var(--color-bg)",
                        color: validCount > 0 ? "var(--color-success)" : "var(--color-text-muted)",
                        border: `1px solid ${validCount > 0 ? "rgba(22,163,74,0.3)" : "var(--color-border)"}`,
                        borderRadius: "var(--radius-md)",
                        padding: "4px 12px",
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                      }}
                    >
                      ✓ {validCount} baris valid
                    </span>
                    {invalidCount > 0 && (
                      <span
                        style={{
                          background: "var(--color-danger-light)",
                          color: "var(--color-danger)",
                          border: "1px solid rgba(220,38,38,0.3)",
                          borderRadius: "var(--radius-md)",
                          padding: "4px 12px",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                        }}
                      >
                        ✗ {invalidCount} baris error — perbaiki file sebelum mengimpor
                      </span>
                    )}
                  </div>

                  {/* Preview table */}
                  <div className="table-wrapper" style={{ maxHeight: 360 }}>
                    <table className="table" style={{ fontSize: "11px" }}>
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>Baris</th>
                          <th>NIK</th>
                          <th>Nama Karyawan</th>
                          <th>Jenis Cuti</th>
                          <th>Tgl Mulai</th>
                          <th>Tgl Selesai</th>
                          <th>Hari</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => (
                          <tr
                            key={row.rowNum}
                            style={{
                              background: row.valid ? undefined : "rgba(220,38,38,0.04)",
                            }}
                          >
                            <td className="text-muted">{row.rowNum}</td>
                            <td style={{ fontFamily: "monospace" }}>{row.nik}</td>
                            <td style={{ fontWeight: row.valid ? 600 : 400, color: row.valid ? undefined : "var(--color-text-muted)" }}>
                              {row.resolvedName ?? "—"}
                            </td>
                            <td>{row.leaveType}</td>
                            <td>{row.startDate}</td>
                            <td>{row.endDate}</td>
                            <td>{row.totalDays}</td>
                            <td>
                              {row.valid ? (
                                <span style={{ color: "var(--color-success)", fontWeight: 600, fontSize: "10px" }}>✓ Valid</span>
                              ) : (
                                <span
                                  title={row.errorMessage ?? ""}
                                  style={{
                                    color: "var(--color-danger)",
                                    fontWeight: 600,
                                    fontSize: "10px",
                                    cursor: "help",
                                    textDecoration: "underline dotted",
                                  }}
                                >
                                  ✗ Error
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Inline error messages */}
                  {invalidCount > 0 && (
                    <div
                      style={{
                        background: "var(--color-danger-light)",
                        border: "1px solid rgba(220,38,38,0.2)",
                        borderRadius: "var(--radius-md)",
                        padding: "12px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--color-danger)", fontSize: "var(--text-xs)" }}>
                        Detail Error:
                      </span>
                      {previewRows
                        .filter((r) => !r.valid)
                        .map((r) => (
                          <div key={r.rowNum} style={{ fontSize: "11px", color: "var(--color-danger)" }}>
                            <span style={{ fontWeight: 600 }}>Baris {r.rowNum} (NIK: {r.nik}):</span> {r.errorMessage}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── ERROR state ────────────────────────────────── */}
              {importStatus === "error" && (
                <div className="flex flex-col gap-4">
                  <div
                    style={{
                      background: "var(--color-danger-light)",
                      padding: "16px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid rgba(220,38,38,0.2)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <AlertCircle className="text-danger" size={24} style={{ flexShrink: 0 }} />
                    <div className="flex flex-col">
                      <span style={{ fontWeight: 600, color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
                        Terjadi Kesalahan
                      </span>
                      <span className="text-xs text-muted mt-0.5">{importMessage}</span>
                    </div>
                  </div>
                  <button onClick={resetImport} className="btn btn-ghost w-full">
                    Coba File Lain
                  </button>
                </div>
              )}

              {/* ── COMPLETE state ─────────────────────────────── */}
              {importStatus === "complete" && importResults && (
                <div className="flex flex-col gap-4">
                  <div
                    style={{
                      background: "var(--color-bg)",
                      padding: "20px",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle2 style={{ color: "var(--color-success)" }} size={24} />
                      <span style={{ fontWeight: 600, fontSize: "var(--text-md)" }}>Proses Impor Selesai</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div
                        style={{
                          background: "var(--color-success-light)",
                          padding: "12px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid rgba(22,163,74,0.2)",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-success)", fontWeight: 600 }}>
                          Berhasil Diimpor
                        </div>
                        <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-success)", marginTop: 4 }}>
                          {importResults.successCount}
                        </div>
                      </div>
                      <div
                        style={{
                          background: importResults.failedCount > 0 ? "var(--color-danger-light)" : "var(--color-bg)",
                          padding: "12px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--color-border)",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "var(--text-xs)",
                            color: importResults.failedCount > 0 ? "var(--color-danger)" : "var(--color-text-muted)",
                            fontWeight: 600,
                          }}
                        >
                          Gagal / Tidak Valid
                        </div>
                        <div
                          style={{
                            fontSize: "28px",
                            fontWeight: 700,
                            color: importResults.failedCount > 0 ? "var(--color-danger)" : "inherit",
                            marginTop: 4,
                          }}
                        >
                          {importResults.failedCount}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "var(--space-4) var(--space-6)",
                borderTop: "1px solid var(--color-border)",
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
                flexShrink: 0,
              }}
            >
              {importStatus === "preview" && (
                <>
                  <button
                    type="button"
                    onClick={resetImport}
                    className="btn btn-ghost"
                    style={{ minHeight: 40 }}
                  >
                    Ganti File
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={!canConfirm}
                    className="btn btn-primary"
                    style={{ minHeight: 40 }}
                  >
                    Konfirmasi Import ({validCount} baris)
                  </button>
                </>
              )}
              {importStatus === "complete" && (
                <button
                  type="button"
                  onClick={closeImport}
                  className="btn btn-primary"
                  style={{ minHeight: 40, minWidth: 120 }}
                >
                  Selesai &amp; Refresh
                </button>
              )}
              {(importStatus === "idle" || importStatus === "error") && (
                <button
                  type="button"
                  onClick={closeImport}
                  className="btn btn-ghost"
                  style={{ minHeight: 40 }}
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
