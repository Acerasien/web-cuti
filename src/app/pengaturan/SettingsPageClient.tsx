"use client";

import { useState, useTransition } from "react";
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
} from "lucide-react";
import { useSession } from "next-auth/react";

interface SubCompanyData {
  id: string;
  name: string;
  createdAt: string;
}

interface HolidayData {
  id: string;
  date: string;
  description: string;
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
}

export function SettingsPageClient({
  initialSettings,
  subCompanies,
  holidays = [],
  adminUsers = [],
  currentUserId = "",
}: SettingsPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"CONFIG" | "SUB_COMPANY" | "HOLIDAY" | "ADMINS">("CONFIG");

  // Company Settings Form State
  const [companyName, setCompanyName] = useState(initialSettings.companyName);
  const [defaultAnnualDays, setDefaultAnnualDays] = useState(
    initialSettings.defaultAnnualDays
  );
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Sub-Company Add State
  const [newSubCompanyName, setNewSubCompanyName] = useState("");
  const [subCompanyError, setSubCompanyError] = useState("");
  const [subCompanySuccess, setSubCompanySuccess] = useState(false);

  // Sub-Company Delete Action State
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

  // Holiday State
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayDesc, setNewHolidayDesc] = useState("");
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

      const res = await createHoliday(null, formData);
      if (res?.error) {
        setHolidayError(res.error);
      } else {
        setHolidaySuccess(true);
        setNewHolidayDate("");
        setNewHolidayDesc("");
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
        </div>
      )}

      {activeTab === "SUB_COMPANY" && (
        <div style={{ maxWidth: "700px" }}>
          <div className="card-outer">
            <div className="card-inner">
              <div className="flex items-center gap-2 mb-6">
                <Building size={20} className="text-accent" />
                <h3 className="card-title" style={{ margin: 0 }}>
                  Daftar Unit Bisnis (Sub-Company)
                </h3>
              </div>

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
                  Unit Bisnis berhasil ditambahkan!
                </div>
              )}

              {/* Inline Add Form */}
              <form onSubmit={handleAddSubCompany} className="flex gap-2 mb-6">
                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder="Tambah Unit Bisnis baru..."
                  style={{ minHeight: 40 }}
                  value={newSubCompanyName}
                  onChange={(e) => setNewSubCompanyName(e.target.value)}
                  disabled={isPending}
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn btn-accent btn-sm"
                  style={{ minHeight: 40, width: 40, padding: 0 }}
                >
                  {isPending && newSubCompanyName ? (
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Plus size={18} />
                  )}
                </button>
              </form>

              {/* List */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  maxHeight: 400,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {subCompanies.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "24px 0",
                      color: "var(--color-text-light)",
                      fontSize: "var(--text-xs)",
                      border: "1px dashed var(--color-border)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <Building size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
                    Belum ada Unit Bisnis terdaftar.
                  </div>
                ) : (
                  subCompanies.map((sc) => (
                    <div
                      key={sc.id}
                      className="flex justify-between items-center"
                      style={{
                        padding: "10px 16px",
                        background: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                      }}
                    >
                      <div className="flex flex-col">
                        <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                          {sc.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isPending || deletePendingId !== null}
                        onClick={() => handleDeleteSubCompany(sc.id, sc.name)}
                        className="btn btn-ghost btn-sm"
                        style={{
                          color: "var(--color-danger)",
                          padding: 6,
                          minHeight: 30,
                          width: 30,
                          borderRadius: "50%",
                        }}
                      >
                        {deletePendingId === sc.id ? (
                          <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "HOLIDAY" && (
        <div className="card-outer" style={{ width: "100%", maxWidth: "800px" }}>
          <div className="card-inner">
            <div className="flex items-center gap-2 mb-6">
              <Calendar size={20} className="text-primary" />
              <h3 className="card-title" style={{ margin: 0 }}>
                Daftar Hari Libur Nasional & Perusahaan
              </h3>
            </div>

            {holidayError && (
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
                {holidayError}
              </div>
            )}

            {holidaySuccess && (
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
                Hari libur berhasil ditambahkan!
              </div>
            )}

            {/* Inline Add Form */}
            <form onSubmit={handleAddHoliday} className="flex gap-4 flex-wrap items-end mb-6">
              <div className="form-group flex-1 min-w-[200px]" style={{ marginBottom: 0 }}>
                <label htmlFor="holidayDate" className="form-label required" style={{ fontSize: "var(--text-xs)" }}>
                  Tanggal Libur
                </label>
                <input
                  id="holidayDate"
                  type="date"
                  className="form-input w-full"
                  style={{ minHeight: 40 }}
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="form-group flex-2 min-w-[300px]" style={{ marginBottom: 0, flexGrow: 2 }}>
                <label htmlFor="holidayDesc" className="form-label required" style={{ fontSize: "var(--text-xs)" }}>
                  Deskripsi Libur
                </label>
                <input
                  id="holidayDesc"
                  type="text"
                  className="form-input w-full"
                  placeholder="Contoh: Hari Kemerdekaan RI"
                  style={{ minHeight: 40 }}
                  value={newHolidayDesc}
                  onChange={(e) => setNewHolidayDesc(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="btn btn-primary"
                style={{ minHeight: 40, padding: "0 20px", gap: 6 }}
              >
                {isPending && newHolidayDate && newHolidayDesc ? (
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <>
                    <Plus size={16} /> Tambah Libur
                  </>
                )}
              </button>
            </form>

            {/* Holiday List Grid/Table */}
            <div
              style={{
                maxHeight: 400,
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
                    padding: "32px 0",
                    color: "var(--color-text-light)",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  <Calendar size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
                  Belum ada hari libur terdaftar.
                </div>
              ) : (
                <table className="table" style={{ fontSize: "var(--text-xs)", margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: "25%" }}>Tanggal</th>
                      <th style={{ width: "60%" }}>Deskripsi</th>
                      <th style={{ width: "15%", textAlign: "center" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map((h) => {
                      const formattedDate = new Date(h.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      });
                      return (
                        <tr key={h.id}>
                          <td style={{ fontWeight: 600 }}>{formattedDate}</td>
                          <td>{h.description}</td>
                          <td style={{ textAlign: "center" }}>
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
    </div>
  );
}
