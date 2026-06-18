"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLeaveRequest } from "@/lib/actions/leave";
import { Calendar, FileText, Info, Loader2, ArrowLeft } from "lucide-react";

interface Employee {
  id: string;
  name: string;
}

interface LeaveFormProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
  employees: Employee[];
  holidayDates?: string[];
}

export function LeaveForm({ currentUser, employees, holidayDates = [] }: LeaveFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isAdmin = currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN";

  const [userId, setUserId] = useState(isAdmin ? "" : currentUser.id);
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const leaveTypes = [
    { value: "PERNIKAHAN_KARYAWAN", label: "Pernikahan Karyawan (3 Hari)" },
    { value: "PERNIKAHAN_ANAK", label: "Pernikahan Anak Kandung (2 Hari)" },
    { value: "KHITAN_BAPTIS", label: "Khitan / Baptis Anak Kandung (2 Hari)" },
    { value: "ISTRI_MELAHIRKAN", label: "Istri Melahirkan / Keguguran (2 Hari)" },
    { value: "KEMATIAN_KELUARGA", label: "Kematian Keluarga (2 Hari)" },
    { value: "KARYAWATI_MELAHIRKAN", label: "Karyawati Melahirkan (3 Bulan)" },
    { value: "KARYAWATI_KEGUGURAN", label: "Karyawati Keguguran (1.5 Bulan)" },
    { value: "SAKIT", label: "Sakit (Dengan Surat Dokter)" },
  ];

  // Calculate duration in days (working days: skipping weekends and holidays)
  const calculateDuration = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
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

  const duration = calculateDuration();

  const getLeaveGuideline = (type: string) => {
    switch (type) {
      case "PERNIKAHAN_KARYAWAN":
        return "Maksimal jatah: 3 Hari Kerja.";
      case "PERNIKAHAN_ANAK":
      case "KHITAN_BAPTIS":
      case "ISTRI_MELAHIRKAN":
      case "KEMATIAN_KELUARGA":
        return "Maksimal jatah: 2 Hari Kerja.";
      case "KARYAWATI_MELAHIRKAN":
        return "Maksimal jatah: 3 Bulan.";
      case "KARYAWATI_KEGUGURAN":
        return "Maksimal jatah: 1.5 Bulan.";
      case "SAKIT":
        return "Wajib melampirkan Surat Keterangan Dokter resmi.";
      default:
        return "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!userId) {
      setError("Pilih karyawan terlebih dahulu.");
      return;
    }
    if (!leaveType) {
      setError("Pilih jenis cuti.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Tanggal mulai dan berakhir wajib diisi.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError("Tanggal mulai tidak boleh melebihi tanggal berakhir.");
      return;
    }
    if (!reason.trim()) {
      setError("Alasan pengajuan wajib diisi.");
      return;
    }
    if (leaveType === "SAKIT" && !file) {
      setError("Pengajuan sakit wajib melampirkan Surat Keterangan Dokter.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("leaveType", leaveType);
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);
      formData.append("reason", reason);
      if (file) {
        formData.append("attachment", file);
      }

      const res = await createLeaveRequest(null, formData);
      if (res?.error) {
        setError(res.error);
      } else {
        router.push("/cuti");
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
          <h2 className="card-title mb-6">Formulir Pengajuan Cuti Khusus / Sakit</h2>

          {error && (
            <div className="form-error" style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-danger-light)", borderRadius: "var(--radius-md)", border: "1px solid rgba(220,38,38,0.2)", marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
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

            {/* Leave Type */}
            <div className="form-group">
              <label htmlFor="leaveType" className="form-label required">
                Jenis Cuti Khusus / Sakit
              </label>
              <select
                id="leaveType"
                className="form-select"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                disabled={isPending}
              >
                <option value="">-- Pilih Jenis Cuti --</option>
                {leaveTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Guidelines box */}
            {leaveType && (
              <div style={{ display: "flex", gap: "8px", background: "var(--color-primary-light)", color: "var(--color-primary)", padding: "12px 16px", borderRadius: "var(--radius-md)", marginBottom: "var(--space-4)", fontSize: "var(--text-sm)", alignItems: "flex-start", fontWeight: 500 }}>
                <Info size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{getLeaveGuideline(leaveType)}</span>
              </div>
            )}

            {/* Date Range Picker */}
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label htmlFor="startDate" className="form-label required">
                  Tanggal Mulai
                </label>
                <input
                  id="startDate"
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="form-group">
                <label htmlFor="endDate" className="form-label required">
                  Tanggal Berakhir
                </label>
                <input
                  id="endDate"
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Calculated duration label */}
            {duration > 0 && (
              <div style={{ display: "flex", gap: "8px", background: "rgba(15,23,42,0.03)", border: "1px solid var(--color-border)", padding: "12px 16px", borderRadius: "var(--radius-md)", marginBottom: "var(--space-4)", fontSize: "var(--text-sm)", alignItems: "center" }}>
                <Calendar size={16} className="text-muted" />
                <span style={{ fontWeight: 600 }}>Durasi Pengajuan: {duration} Hari Kerja</span>
              </div>
            )}

            {/* Reason */}
            <div className="form-group">
              <label htmlFor="reason" className="form-label required">
                Alasan / Penjelasan
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
                Lampiran Dokumen / Surat Dokter {leaveType === "SAKIT" && <span className="text-danger">*</span>}
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
