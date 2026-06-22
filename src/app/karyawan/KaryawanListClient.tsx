"use client";

import { useState, useMemo } from "react";
import { Search, Users, Building, Eye, Plus, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { importKaryawanAction } from "@/lib/actions/karyawan";

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

  const router = useRouter();

  // Import Excel States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importState, setImportState] = useState<{
    status: "idle" | "parsing" | "ready" | "importing" | "error" | "complete";
    message: string;
    results?: {
      successCount: number;
      failedCount: number;
      errors: { row: number; name: string; error: string }[];
    };
  }>({ status: "idle", message: "" });
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      const xlsx = await import("xlsx");
      const headers = [
        [
          "Nama Lengkap",
          "NIK",
          "Email",
          "Username",
          "Tanggal Bergabung (YYYY-MM-DD)",
          "Unit Bisnis",
          "Departemen",
          "Jabatan",
          "Level",
          "Lokasi Kerja",
          "Password"
        ]
      ];
      
      const sampleData = [
        [
          "Budi Santoso",
          "12345678",
          "budi@company.com",
          "budi.santoso",
          "2026-01-15",
          subCompanies[0]?.name || "Unit Bisnis A",
          "IT",
          "Software Engineer",
          "Staff",
          "Jakarta",
          "Password123"
        ]
      ];

      const ws = xlsx.utils.aoa_to_sheet([...headers, ...sampleData]);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Template Karyawan");
      xlsx.writeFile(wb, "Template_Import_Karyawan.xlsx");
    } catch (err: any) {
      alert("Gagal mengunduh template: " + (err.message || err));
    }
  };

  const processExcelFile = async (file: File) => {
    setImportState({ status: "parsing", message: "Membaca file Excel..." });
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = evt.target?.result;
          const xlsx = await import("xlsx");
          const workbook = xlsx.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = xlsx.utils.sheet_to_json(sheet);
          
          if (rows.length === 0) {
            setImportState({ status: "error", message: "File Excel kosong atau tidak memiliki baris data." });
            return;
          }

          setParsedRows(rows);
          setImportState({ status: "ready", message: `Berhasil membaca ${rows.length} baris data.` });
        } catch (err: any) {
          setImportState({ status: "error", message: `Gagal memproses sheet Excel: ${err.message || err}` });
        }
      };
      reader.onerror = () => {
        setImportState({ status: "error", message: "Gagal membaca file dari disk." });
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setImportState({ status: "error", message: `Gagal membaca file: ${err.message || err}` });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleStartImport = async () => {
    if (parsedRows.length === 0) return;
    setImportState({ status: "importing", message: "Mengunggah dan memproses data..." });
    
    try {
      const res = await importKaryawanAction(parsedRows);
      if (res.error) {
        setImportState({ status: "error", message: res.error });
      } else {
        setImportState({
          status: "complete",
          message: "Proses impor selesai.",
          results: res.results
        });
      }
    } catch (err: any) {
      setImportState({ status: "error", message: `Kesalahan server: ${err.message || err}` });
    }
  };

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsImportOpen(true);
              setImportState({ status: "idle", message: "" });
              setParsedRows([]);
            }}
            className="btn btn-ghost"
            style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}
          >
            <Upload size={16} />
            Impor Excel
          </button>
          <Link href="/karyawan/new" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}>
            <Plus size={16} />
            Tambah Karyawan
          </Link>
        </div>
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

      {/* Import Excel Modal */}
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
          {/* Backdrop Closer */}
          <div
            style={{ position: "absolute", inset: 0 }}
            onClick={() => importState.status !== "importing" && setIsImportOpen(false)}
          />

          <div
            className="card-outer animate-modal-scale"
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: 540,
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="card-inner" style={{ padding: "var(--space-6)" }}>
              {/* Header */}
              <div
                className="flex justify-between items-start mb-4"
                style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 16 }}
              >
                <div>
                  <h3 className="card-title" style={{ margin: 0, fontSize: "var(--text-lg)", display: "flex", alignItems: "center", gap: 8 }}>
                    <FileSpreadsheet className="text-primary" size={20} />
                    Impor Massal Karyawan via Excel
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    Unggah file Excel (.xlsx atau .xls) untuk mendaftarkan banyak karyawan sekaligus.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  disabled={importState.status === "importing"}
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

              {/* Body */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {importState.status === "idle" && (
                  <div className="flex flex-col gap-4">
                    {/* Template Download Link */}
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
                        <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>Belum punya template Excel?</span>
                        <span className="text-xs text-muted font-light">Unduh template Excel dengan struktur kolom yang sesuai.</span>
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

                    {/* Drag and Drop Zone */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      style={{
                        border: dragOver ? "2px dashed var(--color-primary)" : "2px dashed var(--color-border)",
                        borderRadius: "var(--radius-lg)",
                        padding: "32px var(--space-4)",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        cursor: "pointer",
                        background: dragOver ? "var(--color-primary-light)" : "transparent",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => document.getElementById("excel-file-input")?.click()}
                    >
                      <Upload className="text-muted" size={32} />
                      <div className="flex flex-col">
                        <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>Tarik & lepas file di sini, atau klik untuk memilih</span>
                        <span className="text-xs text-muted mt-1 font-light">Mendukung format .xlsx, .xls</span>
                      </div>
                      <input
                        id="excel-file-input"
                        type="file"
                        accept=".xlsx, .xls"
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                      />
                    </div>
                  </div>
                )}

                {/* Parsing / Ready to Import */}
                {(importState.status === "parsing" || importState.status === "ready" || importState.status === "importing") && (
                  <div
                    style={{
                      background: "var(--color-bg)",
                      padding: "24px",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--color-border)",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {importState.status === "parsing" || importState.status === "importing" ? (
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
                          }}
                        />
                      </div>
                    ) : (
                      <CheckCircle2 className="text-primary" size={48} />
                    )}

                    <div className="flex flex-col">
                      <span style={{ fontWeight: 600 }}>{importState.message}</span>
                      {importState.status === "ready" && (
                        <span className="text-xs text-muted mt-1 font-light">Silakan klik "Mulai Impor" di bawah untuk memproses data.</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Error State */}
                {importState.status === "error" && (
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
                        <span style={{ fontWeight: 600, color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>Terjadi Kesalahan</span>
                        <span className="text-xs text-muted mt-0.5 font-light">{importState.message}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setImportState({ status: "idle", message: "" })}
                      className="btn btn-ghost w-full"
                    >
                      Coba File Lain
                    </button>
                  </div>
                )}

                {/* Complete / Summary State */}
                {importState.status === "complete" && (
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
                        <CheckCircle2 className="text-success" size={24} />
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
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-success)", fontWeight: 600 }}>Berhasil Disimpan</div>
                          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-success)", marginTop: 4 }}>
                            {importState.results?.successCount || 0}
                          </div>
                        </div>

                        <div
                          style={{
                            background: importState.results?.failedCount && importState.results.failedCount > 0 ? "var(--color-danger-light)" : "var(--color-bg)",
                            padding: "12px",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--color-border)",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: "var(--text-xs)", color: importState.results?.failedCount && importState.results.failedCount > 0 ? "var(--color-danger)" : "var(--color-text-muted)", fontWeight: 600 }}>Gagal / Tidak Valid</div>
                          <div style={{ fontSize: "28px", fontWeight: 700, color: importState.results?.failedCount && importState.results.failedCount > 0 ? "var(--color-danger)" : "inherit", marginTop: 4 }}>
                            {importState.results?.failedCount || 0}
                          </div>
                        </div>
                      </div>

                      {/* Error List */}
                      {importState.results?.errors && importState.results.errors.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 8 }}>
                            Daftar Kesalahan Baris ({importState.results.errors.length}):
                          </div>
                          <div
                            style={{
                              maxHeight: 200,
                              overflowY: "auto",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-md)",
                              background: "var(--color-bg)",
                            }}
                          >
                            {importState.results.errors.map((err, idx) => (
                              <div
                                key={idx}
                                style={{
                                  fontSize: "var(--text-xs)",
                                  borderBottom: idx < importState.results!.errors.length - 1 ? "1px solid var(--color-border)" : "none",
                                  padding: "8px 12px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                }}
                              >
                                <span style={{ fontWeight: 600 }}>
                                  Baris {err.row}: {err.name}
                                </span>
                                <span className="text-danger" style={{ color: "var(--color-danger)" }}>
                                  {err.error}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className="flex gap-3 justify-end mt-6 pt-4"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                {importState.status === "ready" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setImportState({ status: "idle", message: "" })}
                      className="btn btn-ghost"
                      style={{ minHeight: 40 }}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleStartImport}
                      className="btn btn-primary"
                      style={{ minHeight: 40 }}
                    >
                      Mulai Impor
                    </button>
                  </>
                )}

                {importState.status === "complete" && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsImportOpen(false);
                      router.refresh();
                    }}
                    className="btn btn-primary"
                    style={{ minHeight: 40, minWidth: 100 }}
                  >
                    Selesai
                  </button>
                )}

                {importState.status !== "ready" && importState.status !== "complete" && (
                  <button
                    type="button"
                    onClick={() => setIsImportOpen(false)}
                    disabled={importState.status === "importing" || importState.status === "parsing"}
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
