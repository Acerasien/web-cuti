"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExcuseRequest } from "@/lib/actions/excuse";
import { getKaryawanRemainingQuota } from "@/lib/actions/karyawan";
import { Calendar, FileText, Info, Loader2, ArrowLeft } from "lucide-react";

interface Employee {
  id: string;
  name: string;
}

interface ExcuseFormProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
  employees: Employee[];
  holidayDates?: string[];
}

interface QuotaInfo {
  id: string;
  total: number;
  accrued: number;
  used: number;
  remaining: number;
  cycleStart: string;
  cycleEnd: string;
  expired: boolean;
}

export function ExcuseForm({ currentUser, employees, holidayDates = [] }: ExcuseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isAdmin = currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN";

  const [userId, setUserId] = useState(isAdmin ? "" : currentUser.id);
  const [excuseType, setExcuseType] = useState("");
  
  // Dates
  const [singleDate, setSingleDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  // Live quota info
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(false);

  const excuseTypes = [
    { value: "TIDAK_ABSEN_MASUK", label: "Tidak Absen Masuk (1 Hari)" },
    { value: "TIDAK_ABSEN_PULANG", label: "Tidak Absen Pulang (1 Hari)" },
    { value: "DATANG_TERLAMBAT", label: "Datang Terlambat / Pulang Awal (1 Hari)" },
    { value: "CUTI_TAHUNAN", label: "Cuti Tahunan (Potong Quota)" },
    { value: "IZIN_LAINNYA", label: "Izin Lainnya" },
  ];

  const isSingleDateType =
    excuseType === "TIDAK_ABSEN_MASUK" ||
    excuseType === "TIDAK_ABSEN_PULANG" ||
    excuseType === "DATANG_TERLAMBAT";

  // Fetch quota info when user and excuseType are set to CUTI_TAHUNAN
  useEffect(() => {
    if (userId && excuseType === "CUTI_TAHUNAN") {
      setLoadingQuota(true);
      setError("");
      getKaryawanRemainingQuota(userId)
        .then((res) => {
          if (res?.error) {
            setError(res.error);
            setQuotaInfo(null);
          } else if (res?.quota) {
            setQuotaInfo(res.quota);
          } else {
            setQuotaInfo(null);
            setError("Karyawan ini belum dikonfigurasi kuota cuti tahunannya.");
          }
        })
        .catch(() => {
          setError("Gagal memuat informasi kuota.");
        })
        .finally(() => {
          setLoadingQuota(false);
        });
    } else {
      setQuotaInfo(null);
    }
  }, [userId, excuseType]);

  // Calculate duration (working days only: skipping weekends and holidays)
  const getDuration = () => {
    if (isSingleDateType) {
      return singleDate ? 1 : 0;
    }
    if (!dateFrom || !dateTo) return 0;
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

    const holidaySet = new Set(holidayDates);
    let count = 0;
    const current = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );
    const endNormalized = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate()
    );

    while (current <= endNormalized) {
      const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const day = String(current.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;

      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidaySet.has(dateString);

      if (!isWeekend && !isHoliday) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  const duration = getDuration();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const formatDateLabel = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!userId) {
      setError("Pilih karyawan terlebih dahulu.");
      return;
    }
    if (!excuseType) {
      setError("Pilih jenis izin/keterangan.");
      return;
    }

    // Set dates based on single vs range
    const finalDateFrom = isSingleDateType ? singleDate : dateFrom;
    const finalDateTo = isSingleDateType ? singleDate : dateTo;

    if (!finalDateFrom || !finalDateTo) {
      setError("Tanggal wajib diisi.");
      return;
    }
    if (new Date(finalDateFrom) > new Date(finalDateTo)) {
      setError("Tanggal mulai tidak boleh melebihi tanggal berakhir.");
      return;
    }
    if (!reason.trim()) {
      setError("Alasan pengajuan wajib diisi.");
      return;
    }

    if (excuseType === "CUTI_TAHUNAN") {
      if (!quotaInfo) {
        setError("Kuota cuti tahunan belum diset untuk karyawan ini.");
        return;
      }
      if (quotaInfo.expired) {
        setError("Siklus kuota cuti tahunan karyawan ini telah kedaluwarsa.");
        return;
      }
      if (quotaInfo.remaining < duration) {
        setError(`Sisa kuota cuti tidak mencukupi (Tersisa: ${quotaInfo.remaining} hari, diajukan: ${duration} hari).`);
        return;
      }
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("excuseType", excuseType);
      formData.append("dateFrom", finalDateFrom);
      formData.append("dateTo", finalDateTo);
      formData.append("reason", reason);
      if (file) {
        formData.append("attachment", file);
      }

      const res = await createExcuseRequest(null, formData);
      if (res?.error) {
        setError(res.error);
      } else {
        router.push("/izin");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      <a href="/dashboard" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", gap: 6 }}>
        <ArrowLeft size={16} /> Kembali
      </a>

      {/* Form Container */}
      <div className="card-outer">
        <div className="card-inner">
          <h2 className="card-title mb-6">Formulir Pengajuan Izin & Keterangan</h2>

          {error && (
            <div className="form-error" style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-danger-light)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", border: "1px solid rgba(220,38,38,0.2)", marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
              {error}
            </div>
          )}

          <form onSubmit={onSubmit}>
            {/* Employee Select (Admin only) */}
            {isAdmin ? (
              <div className="form-group">
                <label htmlFor="userId" className="form-label required">
                  Pilih Karyawan
                </label>
                <select
                  id="userId"
                  className="form-select"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={isPending}
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="userId" value={userId} />
            )}

            {/* Excuse Type */}
            <div className="form-group">
              <label htmlFor="excuseType" className="form-label required">
                Jenis Izin / Keterangan
              </label>
              <select
                id="excuseType"
                className="form-select"
                value={excuseType}
                onChange={(e) => setExcuseType(e.target.value)}
                disabled={isPending}
              >
                <option value="">-- Pilih Jenis Izin --</option>
                {excuseTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quota Info Box for Cuti Tahunan */}
            {loadingQuota && (
              <div style={{ display: "flex", gap: "8px", background: "rgba(15,23,42,0.03)", padding: "12px 16px", borderRadius: "var(--radius-md)", marginBottom: "var(--space-4)", fontSize: "var(--text-sm)", alignItems: "center" }}>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                <span>Memuat kuota cuti tahunan...</span>
              </div>
            )}

            {!loadingQuota && quotaInfo && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "var(--color-primary-light)", color: "var(--color-primary)", padding: "16px", borderRadius: "var(--radius-md)", marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                  <Info size={16} />
                  <span>Informasi Kuota Cuti Tahunan</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 4 }}>
                  <div>
                    <span className="text-muted text-xs" style={{ color: "rgba(124, 58, 237, 0.7)" }}>Maks:</span>
                    <p style={{ fontWeight: 700, fontSize: "14px" }}>{quotaInfo.total} Hari</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ color: "rgba(124, 58, 237, 0.7)" }}>Akrual:</span>
                    <p style={{ fontWeight: 700, fontSize: "14px" }}>{quotaInfo.accrued} Hari</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ color: "rgba(124, 58, 237, 0.7)" }}>Dipakai:</span>
                    <p style={{ fontWeight: 700, fontSize: "14px" }}>{quotaInfo.used} Hari</p>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ color: "rgba(124, 58, 237, 0.7)" }}>Sisa:</span>
                    <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--color-primary)" }}>{quotaInfo.remaining} Hari</p>
                  </div>
                </div>
                <div style={{ marginTop: 4, fontSize: "11px", borderTop: "1px solid rgba(124, 58, 237, 0.2)", paddingTop: 6, opacity: 0.8 }}>
                  Siklus: {formatDateLabel(quotaInfo.cycleStart)} s/d {formatDateLabel(quotaInfo.cycleEnd)}
                  {quotaInfo.expired && <span style={{ color: "var(--color-danger)", marginLeft: 6, fontWeight: 700 }}>(EXPIRED)</span>}
                </div>
              </div>
            )}

            {/* Date Selection */}
            {excuseType && (
              isSingleDateType ? (
                <div className="form-group">
                  <label htmlFor="singleDate" className="form-label required">
                    Tanggal Kejadian
                  </label>
                  <input
                    id="singleDate"
                    type="date"
                    className="form-input"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              ) : (
                <div className="grid grid-2 gap-4">
                  <div className="form-group">
                    <label htmlFor="dateFrom" className="form-label required">
                      Tanggal Mulai
                    </label>
                    <input
                      id="dateFrom"
                      type="date"
                      className="form-input"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      disabled={isPending}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="dateTo" className="form-label required">
                      Tanggal Berakhir
                    </label>
                    <input
                      id="dateTo"
                      type="date"
                      className="form-input"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                </div>
              )
            )}

            {/* Computed duration label */}
            {duration > 0 && (
              <div style={{ display: "flex", gap: "8px", background: "rgba(15,23,42,0.03)", border: "1px solid var(--color-border)", padding: "12px 16px", borderRadius: "var(--radius-md)", marginBottom: "var(--space-4)", fontSize: "var(--text-sm)", alignItems: "center" }}>
                <Calendar size={16} className="text-muted" />
                <span style={{ fontWeight: 600 }}>Durasi Pengajuan: {duration} Hari Kerja</span>
              </div>
            )}

            {/* Reason */}
            <div className="form-group">
              <label htmlFor="reason" className="form-label required">
                Alasan / Keterangan
              </label>
              <textarea
                id="reason"
                className="form-textarea"
                placeholder="Tuliskan keterangan detail pengajuan Anda..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* File upload */}
            <div className="form-group">
              <label htmlFor="attachment" className="form-label">
                Lampiran Dokumen Pendukung (Optional)
              </label>
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  id="attachment"
                  type="file"
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.pdf"
                  disabled={isPending}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => document.getElementById("attachment")?.click()}
                  disabled={isPending}
                  style={{ alignSelf: "flex-start", width: "100%" }}
                >
                  <FileText size={16} /> {file ? "Ubah Lampiran" : "Pilih File (PDF, Image)"}
                </button>
                {file && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                  </span>
                )}
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="btn btn-primary w-full mt-6"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                  Mengirim Pengajuan...
                </>
              ) : (
                <>Kirim Pengajuan</>
              )}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
