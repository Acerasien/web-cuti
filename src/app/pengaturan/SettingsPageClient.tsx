"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  updateCompanySettings,
  createSubCompany,
  deleteSubCompany,
  createHoliday,
  deleteHoliday,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  triggerManualQuotaSync,
  assignEmployeesToSubCompanyAction,
} from "@/lib/actions/settings";
import {
  Building2,
  Save,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Building,
  Calendar,
  Shield,
  Users,
  Lock,
  Mail,
  Edit2,
  Activity,
  UserCheck,
  RefreshCw,
  GitBranch,
  Search,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { HierarchyTab, KaryawanForHierarchy } from "./HierarchyTab";

interface SubCompanyData {
  id: string;
  name: string;
  code?: string | null;
  createdAt: string;
}

interface HolidayData {
  id: string;
  date: string;
  description: string;
  isCutiBersama?: boolean;
}

interface AdminUserData {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  role: string;
  isActive: boolean;
}

interface SettingsPageClientProps {
  initialSettings: {
    companyName: string;
    defaultAnnualDays: number;
  };
  subCompanies: SubCompanyData[];
  holidays: HolidayData[];
  adminUsers?: AdminUserData[];
  currentUserId?: string;
  karyawanList?: KaryawanForHierarchy[];
}

export function SettingsPageClient({
  initialSettings,
  subCompanies,
  holidays = [],
  adminUsers = [],
  currentUserId = "",
  karyawanList = [],
}: SettingsPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"CONFIG" | "SUB_COMPANY" | "HOLIDAY" | "ADMINS" | "HIERARCHY">("CONFIG");

  // Company Settings Form State
  const [companyName, setCompanyName] = useState(initialSettings.companyName);
  const [defaultAnnualDays, setDefaultAnnualDays] = useState(
    initialSettings.defaultAnnualDays
  );
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  const unassignedCount = useMemo(() => {
    return karyawanList ? karyawanList.filter((k) => !k.atasanId).length : 0;
  }, [karyawanList]);

  // System Maintenance Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncSuccess, setSyncSuccess] = useState<number | null>(null);

  // Unit Bisnis Assignment State
  const [selectedSubCompanyId, setSelectedSubCompanyId] = useState<string>(
    subCompanies[0]?.id || ""
  );
  const [subCompanySearchQuery, setSubCompanySearchQuery] = useState("");
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [bulkCheckedIds, setBulkCheckedIds] = useState<Set<string>>(new Set());
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");

  const handleSyncQuotas = () => {
    setSyncError("");
    setSyncSuccess(null);
    setIsSyncing(true);

    startTransition(async () => {
      const res = await triggerManualQuotaSync();
      setIsSyncing(false);
      if (res?.error) {
        setSyncError(res.error);
      } else {
        setSyncSuccess(res.cyclesCreated ?? 0);
        router.refresh();
      }
    });
  };

  // Sub-Company Add State
  const [newSubCompanyName, setNewSubCompanyName] = useState("");
  const [subCompanyError, setSubCompanyError] = useState("");
  const [subCompanySuccess, setSubCompanySuccess] = useState(false);

  // Sub-Company Delete Action State
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

  // Holiday State
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayDesc, setNewHolidayDesc] = useState("");
  const [isCutiBersama, setIsCutiBersama] = useState(false);
  const [holidayError, setHolidayError] = useState("");
  const [holidaySuccess, setHolidaySuccess] = useState(false);
  const [deleteHolidayPendingId, setDeleteHolidayPendingId] = useState<string | null>(null);

  // Admin CRUD states
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUserData | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminRole, setAdminRole] = useState("ADMIN");
  const [adminIsActive, setAdminIsActive] = useState(true);
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState(false);

  const handleSaveAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    setAdminSuccess(false);

    if (!adminName.trim()) {
      setAdminError("Nama Lengkap wajib diisi.");
      return;
    }
    if (!adminEmail.trim() && !adminUsername.trim()) {
      setAdminError("Salah satu dari Email atau Username wajib diisi.");
      return;
    }
    if (!selectedAdmin && !adminPassword) {
      setAdminError("Password wajib diisi untuk Admin baru.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("name", adminName);
      formData.append("email", adminEmail);
      formData.append("username", adminUsername);
      formData.append("password", adminPassword);
      formData.append("role", adminRole);

      let res;
      if (selectedAdmin) {
        formData.append("isActive", String(adminIsActive));
        res = await updateAdminUser(selectedAdmin.id, formData);
      } else {
        res = await createAdminUser(null, formData);
      }

      if (res?.error) {
        setAdminError(res.error);
      } else {
        setAdminSuccess(true);
        setAdminName("");
        setAdminEmail("");
        setAdminUsername("");
        setAdminPassword("");
        setAdminRole("ADMIN");
        setSelectedAdmin(null);
        setIsFormOpen(false);
        router.refresh();
      }
    });
  };

  const handleEditClick = (admin: AdminUserData) => {
    setSelectedAdmin(admin);
    setAdminName(admin.name);
    setAdminEmail(admin.email || "");
    setAdminUsername(admin.username || "");
    setAdminPassword("");
    setAdminRole(admin.role);
    setAdminIsActive(admin.isActive);
    setAdminError("");
    setAdminSuccess(false);
    setIsFormOpen(true);
  };

  const handleAddClick = () => {
    setSelectedAdmin(null);
    setAdminName("");
    setAdminEmail("");
    setAdminUsername("");
    setAdminPassword("");
    setAdminRole("ADMIN");
    setAdminIsActive(true);
    setAdminError("");
    setAdminSuccess(false);
    setIsFormOpen(true);
  };

  const handleDeleteAdmin = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun administrator "${name}"?`)) {
      return;
    }

    setAdminError("");
    startTransition(async () => {
      const res = await deleteAdminUser(id);
      if (res?.error) {
        setAdminError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError("");
    setSettingsSuccess(false);

    if (!companyName.trim()) {
      setSettingsError("Nama Perusahaan wajib diisi.");
      return;
    }
    if (defaultAnnualDays <= 0) {
      setSettingsError("Jatah cuti tahunan default harus lebih besar dari 0 hari.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("companyName", companyName);
      formData.append("defaultAnnualDays", String(defaultAnnualDays));

      const res = await updateCompanySettings(formData);
      if (res?.error) {
        setSettingsError(res.error);
      } else {
        setSettingsSuccess(true);
        router.refresh();
      }
    });
  };

  const handleAddSubCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setSubCompanyError("");
    setSubCompanySuccess(false);

    if (!newSubCompanyName.trim()) {
      setSubCompanyError("Nama Unit Bisnis wajib diisi.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("name", newSubCompanyName);

      const res = await createSubCompany(null, formData);
      if (res?.error) {
        setSubCompanyError(res.error);
      } else {
        setSubCompanySuccess(true);
        setNewSubCompanyName("");
        router.refresh();
        // Hide success message after 3 seconds
        setTimeout(() => setSubCompanySuccess(false), 3000);
      }
    });
  };

  const handleDeleteSubCompany = async (id: string, name: string) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus Unit Bisnis "${name}"?\nKaryawan yang sudah terdaftar di unit ini harus dipindahkan terlebih dahulu.`
      )
    ) {
      return;
    }

    setSubCompanyError("");
    setDeletePendingId(id);

    const res = await deleteSubCompany(id);
    setDeletePendingId(null);

    if (res?.error) {
      setSubCompanyError(res.error);
    } else {
      router.refresh();
    }
  };

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    setHolidayError("");
    setHolidaySuccess(false);

    if (!newHolidayDate) {
      setHolidayError("Tanggal libur wajib diisi.");
      return;
    }
    if (!newHolidayDesc.trim()) {
      setHolidayError("Deskripsi hari libur wajib diisi.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("date", newHolidayDate);
      formData.append("description", newHolidayDesc);
      formData.append("isCutiBersama", String(isCutiBersama));

      const res = await createHoliday(null, formData);
      if (res?.error) {
        setHolidayError(res.error);
      } else {
        setHolidaySuccess(true);
        setNewHolidayDate("");
        setNewHolidayDesc("");
        setIsCutiBersama(false);
        router.refresh();
        setTimeout(() => setHolidaySuccess(false), 3000);
      }
    });
  };

  const handleDeleteHoliday = async (id: string, dateStr: string) => {
    const formattedDate = new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!confirm(`Apakah Anda yakin ingin menghapus hari libur pada tanggal ${formattedDate}?`)) {
      return;
    }

    setHolidayError("");
    setDeleteHolidayPendingId(id);

    const res = await deleteHoliday(id);
    setDeleteHolidayPendingId(null);

    if (res?.error) {
      setHolidayError(res.error);
    } else {
      router.refresh();
    }
  };

  // Unit Bisnis Memos
  const assignedEmployees = useMemo(() => {
    return karyawanList.filter((k) => k.subCompanyId === selectedSubCompanyId);
  }, [karyawanList, selectedSubCompanyId]);

  const filteredAssigned = useMemo(() => {
    if (!subCompanySearchQuery.trim()) return assignedEmployees;
    const query = subCompanySearchQuery.toLowerCase();
    return assignedEmployees.filter((k) =>
      k.name.toLowerCase().includes(query) ||
      (k.department && k.department.toLowerCase().includes(query)) ||
      (k.level && k.level.toLowerCase().includes(query))
    );
  }, [assignedEmployees, subCompanySearchQuery]);

  const otherEmployees = useMemo(() => {
    return karyawanList.filter((k) => k.subCompanyId !== selectedSubCompanyId);
  }, [karyawanList, selectedSubCompanyId]);

  const quickSearchResults = useMemo(() => {
    if (!quickSearchQuery.trim()) return [];
    const query = quickSearchQuery.toLowerCase();
    return otherEmployees.filter((k) =>
      k.name.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [otherEmployees, quickSearchQuery]);

  const filteredOther = useMemo(() => {
    if (!bulkSearchQuery.trim()) return otherEmployees;
    const query = bulkSearchQuery.toLowerCase();
    return otherEmployees.filter((k) =>
      k.name.toLowerCase().includes(query) ||
      (k.subCompanyName && k.subCompanyName.toLowerCase().includes(query))
    );
  }, [otherEmployees, bulkSearchQuery]);

  const handleAssignEmployees = (userIds: string[], targetSubCompanyId: string | null) => {
    setSubCompanyError("");
    setSubCompanySuccess(false);

    startTransition(async () => {
      const res = await assignEmployeesToSubCompanyAction(userIds, targetSubCompanyId);
      if (res?.error) {
        setSubCompanyError(res.error);
      } else {
        setSubCompanySuccess(true);
        setBulkCheckedIds(new Set());
        setBulkModalOpen(false);
        setQuickSearchQuery("");
        setQuickSearchOpen(false);
        router.refresh();
        setTimeout(() => setSubCompanySuccess(false), 3000);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Subtitle */}
      <div>
        <p className="page-subtitle" style={{ margin: 0 }}>
          Konfigurasi default jatah cuti perusahaan, manajemen Unit Bisnis (Sub-Company), hari libur nasional, dan akun Administrator.
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-2 overflow-x-auto pb-2"
        style={{
          borderBottom: "1px solid var(--color-border)",
          scrollbarWidth: "none",
        }}
      >
        <button
          onClick={() => setActiveTab("CONFIG")}
          className={`btn btn-sm ${activeTab === "CONFIG" ? "btn-primary" : "btn-ghost"}`}
          style={{
            whiteSpace: "nowrap",
            padding: "8px 16px",
            minHeight: 36,
            borderRadius: "var(--radius-md)",
          }}
        >
          <Building2 size={14} style={{ marginRight: 6 }} />
          Konfigurasi Perusahaan
        </button>

        <button
          onClick={() => setActiveTab("SUB_COMPANY")}
          className={`btn btn-sm ${activeTab === "SUB_COMPANY" ? "btn-primary" : "btn-ghost"}`}
          style={{
            whiteSpace: "nowrap",
            padding: "8px 16px",
            minHeight: 36,
            borderRadius: "var(--radius-md)",
          }}
        >
          <Building size={14} style={{ marginRight: 6 }} />
          Unit Bisnis ({subCompanies.length})
        </button>

        <button
          onClick={() => setActiveTab("HOLIDAY")}
          className={`btn btn-sm ${activeTab === "HOLIDAY" ? "btn-primary" : "btn-ghost"}`}
          style={{
            whiteSpace: "nowrap",
            padding: "8px 16px",
            minHeight: 36,
            borderRadius: "var(--radius-md)",
          }}
        >
          <Calendar size={14} style={{ marginRight: 6 }} />
          Hari Libur ({holidays.length})
        </button>

        <button
          onClick={() => setActiveTab("ADMINS")}
          className={`btn btn-sm ${activeTab === "ADMINS" ? "btn-primary" : "btn-ghost"}`}
          style={{
            whiteSpace: "nowrap",
            padding: "8px 16px",
            minHeight: 36,
            borderRadius: "var(--radius-md)",
          }}
        >
          <Shield size={14} style={{ marginRight: 6 }} />
          Kelola Admin ({adminUsers.length})
        </button>

        <button
          onClick={() => setActiveTab("HIERARCHY")}
          className={`btn btn-sm ${activeTab === "HIERARCHY" ? "btn-primary" : "btn-ghost"}`}
          style={{
            whiteSpace: "nowrap",
            padding: "8px 16px",
            minHeight: 36,
            borderRadius: "var(--radius-md)",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <GitBranch size={14} />
          <span>Atur Hierarki</span>
          {unassignedCount > 0 && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: "bold",
                background: "var(--color-warning)",
                color: "white",
                padding: "2px 6px",
                borderRadius: "var(--radius-full)",
                lineHeight: 1,
              }}
            >
              {unassignedCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "CONFIG" && (
        <div style={{ maxWidth: "600px" }}>
          <div className="card-outer">
            <div className="card-inner">
              <div className="flex items-center gap-2 mb-6">
                <Building2 size={20} className="text-primary" />
                <h3 className="card-title" style={{ margin: 0 }}>
                  Konfigurasi Perusahaan
                </h3>
              </div>

              {settingsError && (
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
                  {settingsError}
                </div>
              )}

              {settingsSuccess && (
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
                  Konfigurasi berhasil diperbarui!
                </div>
              )}

              <form onSubmit={handleUpdateSettings} className="flex flex-col gap-4">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="companyName" className="form-label required">
                    Nama Perusahaan Utama
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    className="form-input"
                    placeholder="PT. Maju Bersama"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={isPending}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="defaultAnnualDays" className="form-label required">
                    Batas Maksimum Cuti Tahunan Default (Hari)
                  </label>
                  <input
                    id="defaultAnnualDays"
                    type="number"
                    min="1"
                    max="90"
                    className="form-input"
                    value={defaultAnnualDays}
                    onChange={(e) => setDefaultAnnualDays(parseInt(e.target.value) || 0)}
                    disabled={isPending}
                  />
                  <span className="form-hint">
                    Batas akumulasi cuti tahunan default (misal 12 hari) untuk karyawan baru. Saldo cuti akan bertambah secara dinamis +1 hari per bulan.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="btn btn-primary mt-4 w-full"
                  style={{ minHeight: 46, gap: 8 }}
                >
                  {isPending && deletePendingId === null ? (
                    <>
                      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Simpan Pengaturan
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* System Maintenance & Sync Card */}
          <div className="card-outer mt-6">
            <div className="card-inner">
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw size={20} className="text-primary" />
                <h3 className="card-title" style={{ margin: 0 }}>
                  Pemeliharaan Sistem
                </h3>
              </div>
              
              <p className="text-sm text-muted mb-4" style={{ lineHeight: 1.4 }}>
                Gunakan menu ini untuk memperbarui dan membuat siklus kuota cuti tahunan baru secara otomatis bagi semua karyawan yang siklus lamanya telah berakhir.
              </p>

              {syncError && (
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
                  {syncError}
                </div>
              )}

              {syncSuccess !== null && (
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
                  Sinkronisasi berhasil! Sebanyak {syncSuccess} siklus kuota baru telah dibuat/diperbarui.
                </div>
              )}

              <button
                type="button"
                onClick={handleSyncQuotas}
                disabled={isSyncing}
                className="btn btn-outline w-full"
                style={{ minHeight: 46, gap: 8 }}
              >
                {isSyncing ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Menyelaraskan Kuota Karyawan...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Sinkronisasi Kuota Cuti Karyawan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "SUB_COMPANY" && (
        <div style={{ width: "100%" }}>
          <style>{`
            .subcompany-layout {
              display: flex;
              flex-direction: row;
              gap: var(--space-6);
              align-items: stretch;
              width: 100%;
            }
            .subcompany-sidebar {
              width: 320px;
              flex-shrink: 0;
            }
            .subcompany-detail {
              flex: 1;
              min-width: 0;
            }
            .subcompany-layout .full-height {
              height: 100%;
            }
            @media (max-width: 1024px) {
              .subcompany-layout {
                flex-direction: column;
              }
              .subcompany-sidebar {
                width: 100%;
              }
            }
          `}</style>
          <div className="subcompany-layout">
            {/* Left Column: Master List of Unit Bisnis */}
            <div className="subcompany-sidebar">
              <div className="card-outer full-height">
                <div className="card-inner full-height" style={{ padding: "var(--space-5)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Building size={18} className="text-accent" />
                    <h3 className="card-title" style={{ margin: 0, fontSize: "var(--text-md)" }}>
                      Daftar Unit Bisnis
                    </h3>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {subCompanies.map((sc) => {
                      const count = karyawanList.filter((k) => k.subCompanyId === sc.id).length;
                      const isActive = selectedSubCompanyId === sc.id;
                      return (
                        <div
                          key={sc.id}
                          onClick={() => {
                            setSelectedSubCompanyId(sc.id);
                            setSubCompanySearchQuery("");
                          }}
                          style={{
                            padding: "12px 16px",
                            background: isActive ? "var(--color-primary-light)" : "var(--color-bg)",
                            border: isActive
                              ? "1.5px solid var(--color-primary)"
                              : "1.5px solid var(--color-border)",
                            borderRadius: "var(--radius-md)",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: isActive ? "var(--color-primary-hover)" : "var(--color-text)" }}>
                              {sc.code || "—"}
                            </span>
                            <span style={{ fontSize: "11px", color: isActive ? "var(--color-primary-hover)" : "var(--color-text-muted)", maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {sc.name}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              fontWeight: 700,
                              padding: "4px 8px",
                              backgroundColor: isActive ? "var(--color-primary)" : "var(--color-border)",
                              color: isActive ? "#ffffff" : "var(--color-text-muted)",
                              borderRadius: "12px",
                            }}
                          >
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Detail Panel */}
            <div className="subcompany-detail">
              <div className="card-outer full-height">
                <div className="card-inner full-height" style={{ padding: "var(--space-6)" }}>
                  {(() => {
                    const activeSC = subCompanies.find((sc) => sc.id === selectedSubCompanyId);
                    if (!activeSC) {
                      return (
                        <div className="flex flex-col items-center justify-center py-20 text-muted">
                          <Building size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                          Pilih Unit Bisnis di sebelah kiri untuk mengelola karyawan.
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col full-height justify-between">
                        <div>
                          {/* Header */}
                          <div className="flex justify-between items-center mb-6 pb-4" style={{ borderBottom: "1.5px solid var(--color-border)" }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 700 }}>
                                {activeSC.name}
                              </h3>
                              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontWeight: 600 }}>
                                Kode Unit: {activeSC.code || "—"} • {assignedEmployees.length} Karyawan Terdaftar
                              </span>
                            </div>
                          </div>

                          {/* Error / Success */}
                          {subCompanyError && (
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
                              {subCompanyError}
                            </div>
                          )}

                          {subCompanySuccess && (
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
                              Perubahan Unit Bisnis berhasil disimpan!
                            </div>
                          )}

                          {/* Quick Add Search & Bulk Transfer Row */}
                          <div className="flex gap-4 mb-6" style={{ alignItems: "flex-end", width: "100%" }}>
                            {/* Quick Add Search Field Container */}
                            <div style={{ flex: 1, position: "relative" }}>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: "8px", display: "block" }}>
                                Tambah Karyawan (Cepat)
                              </label>
                              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                <Search size={14} className="text-light" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Cari nama karyawan untuk ditambahkan..."
                                  style={{ paddingLeft: 36, minHeight: 40, fontSize: "var(--text-sm)" }}
                                  value={quickSearchQuery}
                                  onChange={(e) => {
                                    setQuickSearchQuery(e.target.value);
                                    setQuickSearchOpen(true);
                                  }}
                                  onFocus={() => setQuickSearchOpen(true)}
                                  disabled={isPending}
                                />
                                {quickSearchQuery && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuickSearchQuery("");
                                      setQuickSearchOpen(false);
                                    }}
                                    style={{ position: "absolute", right: 12, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
                                  >
                                    <X size={14} style={{ color: "var(--color-text-light)" }} />
                                  </button>
                                )}
                              </div>

                              {/* Autocomplete suggestions */}
                              {quickSearchOpen && quickSearchResults.length > 0 && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    right: 0,
                                    zIndex: 10,
                                    backgroundColor: "#ffffff",
                                    border: "1.5px solid var(--color-border)",
                                    borderRadius: "var(--radius-md)",
                                    boxShadow: "var(--shadow-lg)",
                                    marginTop: 4,
                                    maxHeight: 200,
                                    overflowY: "auto",
                                  }}
                                >
                                  {quickSearchResults.map((emp) => (
                                    <div
                                      key={emp.id}
                                      onClick={() => handleAssignEmployees([emp.id], selectedSubCompanyId)}
                                      style={{
                                        padding: "10px 14px",
                                        cursor: "pointer",
                                        borderBottom: "1px solid var(--color-border)",
                                        transition: "background 0.2s",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                      }}
                                      className="autocomplete-item-hover"
                                    >
                                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{emp.name}</span>
                                      <span style={{ fontSize: "10px", color: "var(--color-text-light)" }}>
                                        {emp.subCompanyName || "Belum ada Unit"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {quickSearchOpen && quickSearchQuery.trim() && quickSearchResults.length === 0 && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    right: 0,
                                    zIndex: 10,
                                    backgroundColor: "#ffffff",
                                    border: "1.5px solid var(--color-border)",
                                    borderRadius: "var(--radius-md)",
                                    boxShadow: "var(--shadow-lg)",
                                    marginTop: 4,
                                    padding: "12px",
                                    fontSize: "var(--text-xs)",
                                    color: "var(--color-text-light)",
                                    textAlign: "center",
                                  }}
                                >
                                  Tidak ada karyawan yang cocok.
                                </div>
                              )}
                            </div>

                            {/* Bulk Move Button */}
                            <div>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ minHeight: 40, display: "inline-flex", gap: 6, fontSize: "var(--text-sm)" }}
                                onClick={() => {
                                  setBulkSearchQuery("");
                                  setBulkCheckedIds(new Set());
                                  setBulkModalOpen(true);
                                }}
                                disabled={isPending}
                              >
                                <UserPlus size={16} />
                                Pindahkan Masal
                              </button>
                            </div>
                          </div>

                          {/* List Search */}
                          <div style={{ position: "relative", marginBottom: 15 }}>
                            <Search size={14} className="text-light" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Cari karyawan terdaftar di unit ini..."
                              style={{ paddingLeft: 36, minHeight: 38, fontSize: "var(--text-xs)" }}
                              value={subCompanySearchQuery}
                              onChange={(e) => setSubCompanySearchQuery(e.target.value)}
                            />
                          </div>

                          {/* Assigned List Grid */}
                          <div style={{ maxHeight: 350, overflowY: "auto", border: "1.5px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                            {filteredAssigned.length === 0 ? (
                              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-text-light)", fontSize: "var(--text-xs)" }}>
                                {subCompanySearchQuery.trim() ? "Karyawan tidak ditemukan." : "Belum ada karyawan terdaftar di Unit Bisnis ini."}
                              </div>
                            ) : (
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
                                <thead>
                                  <tr style={{ background: "var(--color-bg)", borderBottom: "1.5px solid var(--color-border)" }}>
                                    <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 700 }}>Nama Karyawan</th>
                                    <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 700 }}>Departemen</th>
                                    <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 700 }}>Level</th>
                                    <th style={{ width: 60 }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredAssigned.map((emp) => (
                                    <tr key={emp.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                      <td style={{ padding: "10px 16px", fontWeight: 600 }}>{emp.name}</td>
                                      <td style={{ padding: "10px 16px", color: "var(--color-text-muted)" }}>{emp.department || "—"}</td>
                                      <td style={{ padding: "10px 16px", color: "var(--color-text-muted)" }}>{emp.level || "—"}</td>
                                      <td style={{ padding: "8px 16px", textAlign: "right" }}>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-sm"
                                          title="Lepaskan Karyawan"
                                          disabled={isPending}
                                          onClick={() => handleAssignEmployees([emp.id], null)}
                                          style={{
                                            color: "var(--color-danger)",
                                            padding: 6,
                                            minHeight: 28,
                                            width: 28,
                                            borderRadius: "50%",
                                          }}
                                        >
                                          <UserMinus size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "HOLIDAY" && (
        <div className="flex flex-col gap-4" style={{ width: "100%" }}>
          <style>{`
            .holiday-grid-layout {
              display: grid;
              grid-template-columns: 1fr 1.7fr;
              gap: 24px;
              align-items: start;
            }
            @media (max-width: 820px) {
              .holiday-grid-layout {
                grid-template-columns: 1fr;
              }
            }
            .date-badge {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: var(--color-bg);
              border: 1px solid var(--color-border);
              border-radius: var(--radius-md);
              width: 48px;
              height: 48px;
              flex-shrink: 0;
            }
            .holiday-row:hover {
              background-color: rgba(124, 58, 237, 0.02);
            }
          `}</style>
          
          <div className="holiday-grid-layout">
            {/* Column 1: Add Form */}
            <div className="card-outer">
              <div className="card-inner" style={{ padding: "20px" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={18} className="text-primary" />
                  <h3 className="card-title text-base" style={{ margin: 0 }}>
                    Tambah Hari Libur
                  </h3>
                </div>

                {holidayError && (
                  <div
                    className="form-error mb-4"
                    style={{
                      padding: "8px 12px",
                      background: "var(--color-danger-light)",
                      color: "var(--color-danger)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid rgba(220,38,38,0.15)",
                      fontSize: "11px",
                    }}
                  >
                    {holidayError}
                  </div>
                )}

                {holidaySuccess && (
                  <div
                    className="mb-4"
                    style={{
                      padding: "8px 12px",
                      background: "var(--color-success-light)",
                      color: "var(--color-success)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid rgba(22,163,74,0.15)",
                      fontSize: "11px",
                      fontWeight: 500,
                    }}
                  >
                    Hari libur berhasil ditambahkan!
                  </div>
                )}

                <form onSubmit={handleAddHoliday} className="flex flex-col gap-4">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="holidayDate" className="form-label required text-xs">
                      Tanggal Libur
                    </label>
                    <input
                      id="holidayDate"
                      type="date"
                      className="form-input w-full"
                      style={{ minHeight: 40, fontSize: "13px" }}
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      disabled={isPending}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="holidayDesc" className="form-label required text-xs">
                      Deskripsi Libur
                    </label>
                    <input
                      id="holidayDesc"
                      type="text"
                      className="form-input w-full"
                      placeholder="Contoh: Hari Kemerdekaan RI"
                      style={{ minHeight: 40, fontSize: "13px" }}
                      value={newHolidayDesc}
                      onChange={(e) => setNewHolidayDesc(e.target.value)}
                      disabled={isPending}
                    />
                  </div>

                  {/* Checkbox for Cuti Bersama */}
                  <div 
                    style={{ 
                      display: "flex", 
                      alignItems: "flex-start", 
                      gap: "12px", 
                      padding: "14px", 
                      borderRadius: "var(--radius-md)", 
                      border: "1.5px solid var(--color-border)", 
                      backgroundColor: "#F8FAFC",
                      marginTop: "4px",
                      marginBottom: "4px",
                    }}
                  >
                    <input
                      id="isCutiBersama"
                      type="checkbox"
                      checked={isCutiBersama}
                      onChange={(e) => setIsCutiBersama(e.target.checked)}
                      disabled={isPending}
                      style={{ 
                        width: "16px", 
                        height: "16px", 
                        marginTop: "3px", 
                        cursor: "pointer",
                        accentColor: "var(--color-primary)",
                      }}
                    />
                    <label 
                      htmlFor="isCutiBersama" 
                      style={{ 
                        cursor: "pointer", 
                        display: "flex", 
                        flexDirection: "column", 
                        gap: "4px",
                        fontFamily: "var(--font-body)",
                        userSelect: "none",
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)", lineHeight: 1.2 }}>
                        Cuti Bersama (Potong Cuti)
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                        Hari libur ini akan memotong jatah kuota cuti tahunan semua karyawan secara otomatis.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="btn btn-primary w-full mt-2"
                    style={{ minHeight: 40, gap: 6, fontSize: "13px" }}
                  >
                    {isPending && newHolidayDate && newHolidayDesc ? (
                      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                      <>
                        <Plus size={16} /> Tambah Hari Libur
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Column 2: List of Holidays */}
            <div className="card-outer flex-1">
              <div className="card-inner" style={{ padding: "20px" }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="card-title text-base" style={{ margin: 0 }}>
                    Daftar Hari Libur Nasional & Perusahaan
                  </h3>
                  <span className="badge badge-primary" style={{ fontSize: "10px" }}>
                    {holidays.length} Hari Terdaftar
                  </span>
                </div>

                <div
                  style={{
                    maxHeight: "440px",
                    overflowY: "auto",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  {holidays.length === 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "48px 0",
                        color: "var(--color-text-light)",
                        fontSize: "var(--text-xs)",
                      }}
                    >
                      <Calendar size={28} style={{ marginBottom: 8, opacity: 0.4 }} className="text-muted" />
                      <span>Belum ada hari libur terdaftar.</span>
                    </div>
                  ) : (
                    <table className="table" style={{ fontSize: "var(--text-xs)", margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: "40%" }}>Tanggal</th>
                          <th style={{ width: "45%" }}>Deskripsi / Tipe</th>
                          <th style={{ width: "15%", textAlign: "center" }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holidays.map((h) => {
                          const dateObj = new Date(h.date);
                          const monthStr = dateObj.toLocaleString("id-ID", { month: "short" });
                          const dayNum = dateObj.getDate();
                          const yearNum = dateObj.getFullYear();
                          const weekdayStr = dateObj.toLocaleString("id-ID", { weekday: "long" });

                          return (
                            <tr key={h.id} className="holiday-row">
                              <td>
                                <div className="flex items-center gap-3">
                                  <div className="date-badge">
                                    <span className="text-[9px] font-extrabold text-primary uppercase leading-none">
                                      {monthStr}
                                    </span>
                                    <span className="text-[16px] font-extrabold text-slate-700 leading-none mt-1">
                                      {dayNum}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] text-slate-400 font-semibold leading-none">{yearNum}</span>
                                    <span className="text-xs font-semibold text-slate-600 leading-none">{weekdayStr}</span>
                                  </div>
                                </div>
                              </td>
                              <td style={{ verticalAlign: "middle" }}>
                                <div className="flex flex-col gap-1.5 items-start">
                                  <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--color-text)" }}>
                                    {h.description}
                                  </span>
                                  {h.isCutiBersama ? (
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: "9px",
                                        padding: "1px 6px",
                                        background: "var(--color-warning-light)",
                                        color: "var(--color-warning)",
                                        border: "1px solid rgba(249,115,22,0.15)",
                                      }}
                                    >
                                      Cuti Bersama (Potong Kuota)
                                    </span>
                                  ) : (
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: "9px",
                                        padding: "1px 6px",
                                        background: "var(--color-primary-light)",
                                        color: "var(--color-primary)",
                                        border: "1px solid rgba(59,130,246,0.15)",
                                      }}
                                    >
                                      Libur Nasional
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                <button
                                  type="button"
                                  disabled={isPending || deleteHolidayPendingId !== null}
                                  onClick={() => handleDeleteHoliday(h.id, h.date)}
                                  className="btn btn-ghost btn-sm"
                                  style={{
                                    color: "var(--color-danger)",
                                    padding: 6,
                                    minHeight: 30,
                                    width: 30,
                                    borderRadius: "50%",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "all var(--transition-fast)",
                                  }}
                                  onMouseOver={(e) => {
                                    (e.currentTarget as any).style.backgroundColor = "var(--color-danger-light)";
                                  }}
                                  onMouseOut={(e) => {
                                    (e.currentTarget as any).style.backgroundColor = "transparent";
                                  }}
                                >
                                  {deleteHolidayPendingId === h.id ? (
                                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "ADMINS" && (
        <div className="flex flex-col gap-6" style={{ maxWidth: "800px" }}>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                Daftar Akun Administrator
              </h3>
              <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                Kelola akun Admin HR dan Super Admin yang dapat mengakses sistem ini.
              </p>
            </div>
            <button onClick={handleAddClick} className="btn btn-primary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36 }}>
              <Plus size={14} /> Tambah Administrator
            </button>
          </div>

          {adminError && (
            <div
              className="form-error"
              style={{
                padding: "10px 16px",
                background: "var(--color-danger-light)",
                color: "var(--color-danger)",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(220,38,38,0.2)",
                fontSize: "var(--text-sm)",
              }}
            >
              {adminError}
            </div>
          )}

          {adminSuccess && (
            <div
              style={{
                padding: "10px 16px",
                background: "var(--color-success-light)",
                color: "var(--color-success)",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(22,163,74,0.2)",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
              }}
            >
              Aksi berhasil disimpan!
            </div>
          )}

          <div className="card-outer">
            <div className="card-inner" style={{ padding: 0 }}>
              {adminUsers.length === 0 ? (
                <div className="empty-state">
                  <Users size={32} className="text-muted" />
                  <div className="empty-state-title">Tidak ada data administrator</div>
                </div>
              ) : (
                <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                  <table className="table" style={{ fontSize: "13px" }}>
                    <thead>
                      <tr>
                        <th>Nama Lengkap</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th style={{ textAlign: "center" }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((admin) => {
                        const initials = admin.name
                          .split(" ")
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase();
                        const isSelf = admin.id === currentUserId;

                        return (
                          <tr key={admin.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <div
                                  className="sidebar-avatar"
                                  style={{
                                    width: 32,
                                    height: 32,
                                    fontSize: "10px",
                                    background: admin.role === "SUPERADMIN" ? "rgba(249,115,22,0.1)" : "var(--color-primary-light)",
                                    color: admin.role === "SUPERADMIN" ? "var(--color-accent)" : "var(--color-primary)",
                                    margin: 0,
                                  }}
                                >
                                  {initials}
                                </div>
                                <div className="flex flex-col">
                                  <span style={{ fontWeight: 600 }}>
                                    {admin.name} {isSelf && <span className="badge badge-primary" style={{ fontSize: "8px", textTransform: "none", padding: "1px 4px" }}>Anda</span>}
                                  </span>
                                  <span className="text-xs text-muted">
                                    {admin.email || "—"} {admin.username ? `(@${admin.username})` : ""}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${admin.role === "SUPERADMIN" ? "badge-accent" : "badge-primary"}`} style={{ fontSize: "9px", fontWeight: 600 }}>
                                {admin.role === "SUPERADMIN" ? "Super Admin" : "Admin HR"}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${admin.isActive ? "badge-approved" : "badge-rejected"}`} style={{ fontSize: "9px" }}>
                                {admin.isActive ? "Aktif" : "Nonaktif"}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "inline-flex", gap: 6 }}>
                                <button
                                  onClick={() => handleEditClick(admin)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: "0 8px", minHeight: 28, fontSize: "11px", gap: 4 }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteAdmin(admin.id, admin.name)}
                                  disabled={isPending || isSelf}
                                  className="btn btn-ghost btn-sm"
                                  style={{
                                    padding: "0 8px",
                                    minHeight: 28,
                                    fontSize: "11px",
                                    color: isSelf ? "var(--color-text-muted)" : "var(--color-danger)",
                                    opacity: isSelf ? 0.4 : 1,
                                  }}
                                  title={isSelf ? "Anda tidak dapat menghapus akun Anda sendiri" : ""}
                                >
                                  Hapus
                                </button>
                              </div>
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

          {/* Modal Dialog Form */}
          {isFormOpen && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(15, 23, 42, 0.4)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "16px",
              }}
            >
              <div
                className="card-outer"
                style={{
                  width: "100%",
                  maxWidth: "500px",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                }}
              >
                <div className="card-inner">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h3 className="card-title" style={{ margin: 0 }}>
                      {selectedAdmin ? "Ubah Akun Admin" : "Tambah Admin Baru"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: 4, minWidth: 28, height: 28, borderRadius: "50%" }}
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveAdmin} className="flex flex-col gap-4">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="adminName" className="form-label required">
                        Nama Lengkap
                      </label>
                      <input
                        id="adminName"
                        type="text"
                        className="form-input"
                        placeholder="Nama Lengkap"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        disabled={isPending}
                      />
                    </div>

                    <div className="grid grid-2 gap-4">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label htmlFor="adminUsername" className="form-label">
                          Username
                        </label>
                        <input
                          id="adminUsername"
                          type="text"
                          className="form-input"
                          placeholder="username"
                          value={adminUsername}
                          onChange={(e) => setAdminUsername(e.target.value)}
                          disabled={isPending}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label htmlFor="adminEmail" className="form-label">
                          Email
                        </label>
                        <input
                          id="adminEmail"
                          type="email"
                          className="form-input"
                          placeholder="admin@perusahaan.com"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          disabled={isPending}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="adminPassword" className={selectedAdmin ? "form-label" : "form-label required"}>
                        Password
                      </label>
                      <input
                        id="adminPassword"
                        type="password"
                        className="form-input"
                        placeholder={selectedAdmin ? "•••••••• (kosongkan jika tidak diubah)" : "Password"}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        disabled={isPending}
                      />
                    </div>

                    <div className="grid grid-2 gap-4">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label htmlFor="adminRole" className="form-label required">
                          Role Akses
                        </label>
                        <select
                          id="adminRole"
                          className="form-select"
                          value={adminRole}
                          onChange={(e) => setAdminRole(e.target.value)}
                          disabled={isPending}
                        >
                          <option value="ADMIN">Admin HR</option>
                          <option value="SUPERADMIN">Super Admin</option>
                        </select>
                      </div>

                      {selectedAdmin ? (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="adminIsActive" className="form-label required">
                            Status Akun
                          </label>
                          <select
                            id="adminIsActive"
                            className="form-select"
                            value={String(adminIsActive)}
                            onChange={(e) => setAdminIsActive(e.target.value === "true")}
                            disabled={isPending || selectedAdmin.id === currentUserId}
                          >
                            <option value="true">Aktif</option>
                            <option value="false">Nonaktif</option>
                          </select>
                        </div>
                      ) : (
                        <div />
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                      <button
                        type="button"
                        onClick={() => setIsFormOpen(false)}
                        className="btn btn-ghost w-1/2"
                        disabled={isPending}
                        style={{ minHeight: 42 }}
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary w-1/2"
                        disabled={isPending}
                        style={{ minHeight: 42, display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6 }}
                      >
                        {isPending ? (
                          <>
                            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                            Menyimpan...
                          </>
                        ) : (
                          "Simpan"
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unit Bisnis Bulk Assignment Modal */}
      {bulkModalOpen && (
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
          <div
            style={{ position: "absolute", inset: 0 }}
            onClick={() => !isPending && setBulkModalOpen(false)}
          />

          <div
            className="card-outer animate-modal-scale"
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: 550,
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
                    Pindahkan Karyawan secara Masal
                  </h3>
                  {(() => {
                    const activeSC = subCompanies.find((sc) => sc.id === selectedSubCompanyId);
                    return (
                      <p className="text-xs text-muted mt-1">
                        Pilih karyawan untuk dipindahkan ke unit bisnis:{" "}
                        <strong style={{ color: "var(--color-primary-hover)" }}>
                          {activeSC?.name} ({activeSC?.code})
                        </strong>
                      </p>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
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

              {/* Search Bar */}
              <div style={{ position: "relative", marginBottom: 15 }}>
                <Search size={14} className="text-light" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Cari karyawan berdasarkan nama atau unit bisnis..."
                  style={{ paddingLeft: 36, minHeight: 38, fontSize: "var(--text-xs)" }}
                  value={bulkSearchQuery}
                  onChange={(e) => setBulkSearchQuery(e.target.value)}
                />
              </div>

              {/* Checklist list */}
              <div
                style={{
                  maxHeight: 250,
                  overflowY: "auto",
                  border: "1.5px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  marginBottom: 20,
                }}
              >
                {filteredOther.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-text-light)", fontSize: "var(--text-xs)" }}>
                    Tidak ada karyawan yang dapat dipindahkan.
                  </div>
                ) : (
                  <div>
                    {/* Header Select All */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 16px",
                        background: "var(--color-bg)",
                        borderBottom: "1.5px solid var(--color-border)",
                      }}
                    >
                      <input
                        type="checkbox"
                        id="selectAllBulk"
                        checked={
                          filteredOther.length > 0 &&
                          filteredOther.every((emp) => bulkCheckedIds.has(emp.id))
                        }
                        onChange={(e) => {
                          const newChecked = new Set(bulkCheckedIds);
                          if (e.target.checked) {
                            filteredOther.forEach((emp) => newChecked.add(emp.id));
                          } else {
                            filteredOther.forEach((emp) => newChecked.delete(emp.id));
                          }
                          setBulkCheckedIds(newChecked);
                        }}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                      <label
                        htmlFor="selectAllBulk"
                        style={{ fontSize: "var(--text-xs)", fontWeight: 700, cursor: "pointer", userSelect: "none" }}
                      >
                        Pilih Semua ({filteredOther.length})
                      </label>
                    </div>

                    {/* Employee Checklist Rows */}
                    {filteredOther.map((emp) => {
                      const isChecked = bulkCheckedIds.has(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => {
                            const newChecked = new Set(bulkCheckedIds);
                            if (newChecked.has(emp.id)) {
                              newChecked.delete(emp.id);
                            } else {
                              newChecked.add(emp.id);
                            }
                            setBulkCheckedIds(newChecked);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 16px",
                            borderBottom: "1px solid var(--color-border)",
                            cursor: "pointer",
                            transition: "background 0.2s",
                          }}
                          className="autocomplete-item-hover"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by row click
                            style={{ width: 15, height: 15, cursor: "pointer" }}
                          />
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>{emp.name}</span>
                            <span style={{ fontSize: "10px", color: "var(--color-text-light)" }}>
                              Unit Saat Ini: {emp.subCompanyName || "Belum ada Unit Bisnis"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div
                className="flex justify-end gap-3 pt-4"
                style={{ borderTop: "1.5px solid var(--color-border)" }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setBulkModalOpen(false)}
                  disabled={isPending}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isPending || bulkCheckedIds.size === 0}
                  onClick={() =>
                    handleAssignEmployees(Array.from(bulkCheckedIds), selectedSubCompanyId)
                  }
                  style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Memindahkan...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Pindahkan ({bulkCheckedIds.size}) Karyawan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "HIERARCHY" && (
        <HierarchyTab initialKaryawan={karyawanList} />
      )}

      <style jsx global>{`
        .autocomplete-item-hover:hover {
          background-color: var(--color-bg) !important;
        }
      `}</style>
    </div>
  );
}
