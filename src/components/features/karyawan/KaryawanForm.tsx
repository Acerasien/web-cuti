"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createKaryawanUser, updateKaryawanUser, deleteKaryawanUser } from "@/lib/actions/karyawan";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Award,
  Loader2,
  ArrowLeft,
  Briefcase,
  MapPin,
  UserCheck,
  Hash,
  Building,
  Lock,
  Layers,
  Activity,
  Trash2,
  AlertTriangle,
} from "lucide-react";

interface KaryawanFormProps {
  initialData?: {
    id: string;
    name: string;
    email: string | null;
    username?: string | null;
    role: string;
    nik: string | null;
    level: string | null;
    department: string | null;
    position: string | null;
    lokasiKerja: string | null;
    namaAtasan: string | null;
    subCompanyId: string | null;
    joinDate: string;
    isActive: boolean;
  };
  subCompanies?: { id: string; name: string }[];
}

export function KaryawanForm({ initialData, subCompanies = [] }: KaryawanFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isEditMode = !!initialData;

  const [name, setName] = useState(initialData?.name ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [username, setUsername] = useState(initialData?.username ?? "");
  const [password, setPassword] = useState("");
  const role = "KARYAWAN";
  const [nik, setNik] = useState(initialData?.nik ?? "");
  const [level, setLevel] = useState(initialData?.level ?? "");
  const [department, setDepartment] = useState(initialData?.department ?? "");
  const [position, setPosition] = useState(initialData?.position ?? "");
  const [lokasiKerja, setLokasiKerja] = useState(initialData?.lokasiKerja ?? "");
  const [namaAtasan, setNamaAtasan] = useState(initialData?.namaAtasan ?? "");
  const [subCompanyId, setSubCompanyId] = useState(initialData?.subCompanyId ?? "");

  // Format initial join date to YYYY-MM-DD
  const formatJoinDateInitial = () => {
    if (!initialData?.joinDate) return "";
    return initialData.joinDate.substring(0, 10);
  };
  const [joinDate, setJoinDate] = useState(formatJoinDateInitial());
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const [error, setError] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, startDeleteTransition] = useTransition();

  const handleDelete = () => {
    if (!initialData) return;
    setDeleteError("");
    startDeleteTransition(async () => {
      const res = await deleteKaryawanUser(initialData.id);
      if (res?.error) {
        setDeleteError(res.error);
      } else {
        setIsDeleteModalOpen(false);
        router.push("/karyawan");
        router.refresh();
      }
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Nama wajib diisi.");
      return;
    }
    if (!email.trim() && !username.trim()) {
      setError("Email atau Username wajib diisi agar karyawan dapat login.");
      return;
    }
    if (!isEditMode && !password) {
      setError("Password wajib diisi untuk karyawan baru.");
      return;
    }
    if (!joinDate) {
      setError("Tanggal bergabung wajib diisi.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("username", username);
      formData.append("password", password);
      formData.append("role", role);
      formData.append("nik", nik);
      formData.append("level", level);
      formData.append("department", department);
      formData.append("position", position);
      formData.append("lokasiKerja", lokasiKerja);
      formData.append("namaAtasan", namaAtasan);
      formData.append("subCompanyId", subCompanyId);
      formData.append("joinDate", joinDate);

      if (isEditMode) {
        formData.append("isActive", String(isActive));
        const res = await updateKaryawanUser(initialData!.id, formData);
        if (res?.error) {
          setError(res.error);
        } else {
          router.push(`/karyawan/${initialData!.id}`);
          router.refresh();
        }
      } else {
        const res = await createKaryawanUser(null, formData);
        if (res?.error) {
          setError(res.error);
        } else {
          router.push("/karyawan");
          router.refresh();
        }
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Back button */}
      <a
        href={isEditMode ? `/karyawan/${initialData!.id}` : "/karyawan"}
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: "flex-start", gap: 6 }}
      >
        <ArrowLeft size={16} /> Kembali
      </a>

      {/* Form Card */}
      <div className="card-outer">
        <div className="card-inner">
          <h2 className="card-title mb-6">
            {isEditMode ? "Ubah Data Karyawan" : "Tambah Karyawan Baru"}
          </h2>

          {error && (
            <div
              className="form-error"
              style={{
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-danger-light)",
                color: "var(--color-danger)",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(220,38,38,0.2)",
                marginBottom: "var(--space-4)",
                fontSize: "var(--text-sm)",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={onSubmit}>
            {/* NIK & Name */}
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label htmlFor="nik" className="form-label">
                  NIK (Nomor Induk Karyawan)
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Hash
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <input
                    id="nik"
                    type="text"
                    className="form-input w-full"
                    style={{ paddingLeft: 38 }}
                    placeholder="Contoh: NIK12345"
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="name" className="form-label required">
                  Nama Lengkap
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <User
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <input
                    id="name"
                    type="text"
                    className="form-input w-full"
                    style={{ paddingLeft: 38 }}
                    placeholder="Budi Santoso"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            {/* Username & Email */}
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label htmlFor="username" className="form-label">
                  Username
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <User
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <input
                    id="username"
                    type="text"
                    className="form-input w-full"
                    style={{ paddingLeft: 38 }}
                    placeholder="Contoh: budis"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Perusahaan
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Mail
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <input
                    id="email"
                    type="email"
                    className="form-input w-full"
                    style={{ paddingLeft: 38 }}
                    placeholder="budi@perusahaan.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label
                  htmlFor="password"
                  className={isEditMode ? "form-label" : "form-label required"}
                >
                  Password
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Lock
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <input
                    id="password"
                    type="password"
                    className="form-input w-full"
                    style={{ paddingLeft: 38 }}
                    placeholder={isEditMode ? "••••••••" : "Masukkan password awal"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                {isEditMode && (
                  <span className="form-hint" style={{ marginTop: 4, display: "block" }}>
                    Kosongkan jika tidak ingin mengubah password.
                  </span>
                )}
              </div>
              <div />
            </div>

            {/* Level & Department */}
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label htmlFor="level" className="form-label">
                  Level Karyawan
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Award
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <select
                    id="level"
                    className="form-select w-full"
                    style={{ paddingLeft: 38 }}
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    disabled={isPending}
                  >
                    <option value="">Pilih Level Karyawan...</option>
                    <option value="Non Staff - Clerk">Non Staff - Clerk</option>
                    <option value="Non Staff - Operator">Non Staff - Operator</option>
                    <option value="Non Staff - Mekanik">Non Staff - Mekanik</option>
                    <option value="Non Staff - Non Skill">Non Staff - Non Skill</option>
                    <option value="Staff - Superintendent">Staff - Superintendent</option>
                    <option value="Staff - Supervisor">Staff - Supervisor</option>
                    <option value="Staff - Foreman">Staff - Foreman</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="department" className="form-label">
                  Departemen
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Layers
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <input
                    id="department"
                    type="text"
                    className="form-input w-full"
                    style={{ paddingLeft: 38 }}
                    placeholder="Engineering"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            {/* Jabatan/Posisi & Unit Bisnis */}
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label htmlFor="position" className="form-label">
                  Jabatan / Posisi
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Briefcase
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <input
                    id="position"
                    type="text"
                    className="form-input w-full"
                    style={{ paddingLeft: 38 }}
                    placeholder="Software Engineer"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="subCompanyId" className="form-label">
                  Unit Bisnis (Sub-Company)
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Building
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <select
                    id="subCompanyId"
                    className="form-select w-full"
                    style={{ paddingLeft: 38 }}
                    value={subCompanyId}
                    onChange={(e) => setSubCompanyId(e.target.value)}
                    disabled={isPending}
                  >
                    <option value="">Pilih Unit Bisnis / Sub-Company...</option>
                    {subCompanies.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Lokasi Kerja & Nama Atasan */}
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label htmlFor="lokasiKerja" className="form-label">
                  Lokasi Kerja
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <MapPin
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <input
                    id="lokasiKerja"
                    type="text"
                    className="form-input w-full"
                    style={{ paddingLeft: 38 }}
                    placeholder="Contoh: Head Office / Site Jakarta"
                    value={lokasiKerja}
                    onChange={(e) => setLokasiKerja(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="namaAtasan" className="form-label">
                  Nama Atasan Langsung
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <UserCheck
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <input
                    id="namaAtasan"
                    type="text"
                    className="form-input w-full"
                    style={{ paddingLeft: 38 }}
                    placeholder="Contoh: John Doe"
                    value={namaAtasan}
                    onChange={(e) => setNamaAtasan(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            {/* Join Date & Status Akun */}
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label htmlFor="joinDate" className="form-label required">
                  Tanggal Bergabung (Join Date)
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Calendar
                    size={16}
                    className="text-light"
                    style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                  />
                  <input
                    id="joinDate"
                    type="date"
                    className="form-input w-full"
                    style={{ paddingLeft: 38 }}
                    value={joinDate}
                    onChange={(e) => setJoinDate(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <span className="form-hint">
                  Siklus cuti tahunan didasarkan pada tanggal bergabung ini.
                </span>
              </div>

              {isEditMode ? (
                <div className="form-group">
                  <label htmlFor="isActive" className="form-label required">
                    Status Akun
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <Activity
                      size={16}
                      className="text-light"
                      style={{ position: "absolute", left: 12, pointerEvents: "none" }}
                    />
                    <select
                      id="isActive"
                      className="form-select w-full"
                      style={{ paddingLeft: 38 }}
                      value={String(isActive)}
                      onChange={(e) => setIsActive(e.target.value === "true")}
                      disabled={isPending}
                    >
                      <option value="true">Aktif (Dapat Login)</option>
                      <option value="false">Nonaktif (Akses Dikunci)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div />
              )}
            </div>

            {/* Submit & Delete Actions */}
            <div className="flex flex-col gap-3 mt-6">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isPending || isDeleting}
                style={{ minHeight: 46 }}
              >
                {isPending ? (
                  <>
                    <Loader2 size={18} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} />
                    Menyimpan Data...
                  </>
                ) : (
                  <>{isEditMode ? "Simpan Perubahan" : "Simpan Data Karyawan"}</>
                )}
              </button>

              {isEditMode && (
                <button
                  type="button"
                  className="w-full"
                  disabled={isPending || isDeleting}
                  onClick={() => {
                    setDeleteError("");
                    setIsDeleteModalOpen(true);
                  }}
                  style={{
                    minHeight: 46,
                    borderColor: "var(--color-danger)",
                    color: "var(--color-danger)",
                    backgroundColor: "transparent",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: (isPending || isDeleting) ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: "var(--text-sm)",
                    transition: "all 0.2s ease",
                    opacity: (isPending || isDeleting) ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isPending && !isDeleting) {
                      e.currentTarget.style.backgroundColor = "var(--color-danger-light)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Trash2 size={16} /> Hapus Karyawan
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-4)",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            className="card-outer animate-scale"
            style={{
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div className="card-inner" style={{ padding: "var(--space-6)" }}>
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    color: "rgb(239, 68, 68)",
                    padding: "10px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3
                    className="card-title"
                    style={{
                      margin: 0,
                      fontSize: "var(--text-lg)",
                      fontWeight: 700,
                      color: "var(--color-text)",
                    }}
                  >
                    Hapus Akun Karyawan
                  </h3>
                  <p
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text-muted)",
                      marginTop: "8px",
                      lineHeight: "1.5",
                    }}
                  >
                    Apakah Anda yakin ingin menghapus <strong>{name}</strong>? Seluruh data riwayat cuti, izin, dan kuota cuti tahunan karyawan ini akan dihapus secara permanen dari database.
                  </p>
                  <p
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-danger)",
                      fontWeight: 600,
                      marginTop: "8px",
                      padding: "6px 10px",
                      backgroundColor: "var(--color-danger-light)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    Tindakan ini bersifat destruktif dan tidak dapat dibatalkan.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div
                  className="form-error"
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    background: "var(--color-danger-light)",
                    color: "var(--color-danger)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid rgba(220,38,38,0.2)",
                    marginTop: "var(--space-4)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  {deleteError}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                  marginTop: "var(--space-6)",
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={isDeleting}
                  onClick={() => setIsDeleteModalOpen(false)}
                  style={{ minWidth: 100 }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  style={{
                    minWidth: 140,
                    backgroundColor: "var(--color-danger)",
                    borderColor: "var(--color-danger)",
                    color: "white",
                  }}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} />
                      Menghapus...
                    </>
                  ) : (
                    "Hapus Karyawan"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-scale {
          animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
