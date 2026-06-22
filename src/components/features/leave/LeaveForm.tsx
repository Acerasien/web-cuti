"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLeaveRequest, getBookedLeaveDates } from "@/lib/actions/leave";
import { getKaryawanRemainingQuota } from "@/lib/actions/karyawan";
import { Calendar, FileText, Info, Loader2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

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

interface QuotaInfo {
  total: number;
  accrued: number;
  used: number;
  remaining: number;
  cycleStart: string;
  cycleEnd: string;
}

export function LeaveForm({ currentUser, employees, holidayDates = [] }: LeaveFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isAdmin = currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN";

  const [userId, setUserId] = useState(isAdmin ? "" : currentUser.id);
  const [selectedDates, setSelectedDates] = useState<Record<string, string>>({});
  const [activeBrushType, setActiveBrushType] = useState("CUTI_TAHUNAN");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [isFetchingBooked, startBookedTransition] = useTransition();
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const leaveTypes = [
    { value: "CUTI_TAHUNAN", label: "Cuti Tahunan", color: "selected-cuti", hex: "#3B82F6" },
    { value: "SAKIT", label: "Sakit (Surat Dokter)", color: "selected-sakit", hex: "#EF4444" },
    { value: "ISTRI_MELAHIRKAN", label: "Istri Melahirkan (2 Hari)", color: "selected-istri", hex: "#F97316" },
    { value: "PERNIKAHAN_KARYAWAN", label: "Pernikahan Karyawan (3 Hari)", color: "selected-other", hex: "#8B5CF6" },
    { value: "PERNIKAHAN_ANAK", label: "Pernikahan Anak (2 Hari)", color: "selected-other", hex: "#8B5CF6" },
    { value: "KHITAN_BAPTIS", label: "Khitan/Baptis Anak (2 Hari)", color: "selected-other", hex: "#8B5CF6" },
    { value: "KEMATIAN_KELUARGA", label: "Cuti Duka Cita (2 Hari)", color: "selected-other", hex: "#8B5CF6" },
    { value: "KARYAWATI_MELAHIRKAN", label: "Melahirkan (Karyawati) (3 Bln)", color: "selected-other", hex: "#8B5CF6" },
    { value: "KARYAWATI_KEGUGURAN", label: "Keguguran (Karyawati) (1.5 Bln)", color: "selected-other", hex: "#8B5CF6" },
    { value: "IZIN_LAINNYA", label: "Izin Lainnya", color: "selected-other", hex: "#64748B" },
  ];

  // Fetch booked dates and employee quota whenever the selected employee changes
  useEffect(() => {
    if (!userId) {
      setBookedDates(new Set());
      setQuotaInfo(null);
      return;
    }

    startBookedTransition(async () => {
      const dates = await getBookedLeaveDates(userId);
      setBookedDates(new Set(dates));

      const quotaRes = await getKaryawanRemainingQuota(userId);
      if (quotaRes?.quota) {
        setQuotaInfo(quotaRes.quota as any);
      } else {
        setQuotaInfo(null);
      }
    });
  }, [userId]);

  // Autocomplete end date for fixed-duration leave types
  useEffect(() => {
    if (!rangeStart) return;
    const computedEnd = calculateEndFromStart(rangeStart, activeBrushType);
    if (computedEnd) {
      setRangeEnd(computedEnd);
    }
  }, [rangeStart, activeBrushType]);

  const holidaySet = new Set(holidayDates);

  // Helper: check working days for a single date
  const isWorkingDay = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(dateStr);
    return !isWeekend && !isHoliday;
  };

  const calculateEndFromStart = (startDateStr: string, type: string): string => {
    if (!startDateStr) return "";
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return "";

    const checkWorking = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidaySet.has(dateStr);
      return !isWeekend && !isHoliday;
    };

    let workingDaysNeeded = 0;
    if (type === "ISTRI_MELAHIRKAN" || type === "PERNIKAHAN_ANAK" || type === "KHITAN_BAPTIS" || type === "KEMATIAN_KELUARGA") {
      workingDaysNeeded = 2;
    } else if (type === "PERNIKAHAN_KARYAWAN") {
      workingDaysNeeded = 3;
    }

    if (workingDaysNeeded > 0) {
      let current = new Date(start);
      let workingDaysFound = 0;
      
      while (workingDaysFound < workingDaysNeeded) {
        if (checkWorking(current)) {
          workingDaysFound++;
          if (workingDaysFound === workingDaysNeeded) {
            break;
          }
        }
        current.setDate(current.getDate() + 1);
      }
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    if (type === "KARYAWATI_MELAHIRKAN") {
      const end = new Date(start);
      end.setMonth(end.getMonth() + 3);
      end.setDate(end.getDate() - 1);
      const yyyy = end.getFullYear();
      const mm = String(end.getMonth() + 1).padStart(2, "0");
      const dd = String(end.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    if (type === "KARYAWATI_KEGUGURAN") {
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() + 14); // 1.5 Months
      const yyyy = end.getFullYear();
      const mm = String(end.getMonth() + 1).padStart(2, "0");
      const dd = String(end.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    return "";
  };

  // Helper: check contiguity between two sorted date strings
  const isContiguous = (d1: string, d2: string) => {
    const start = new Date(d1);
    const end = new Date(d2);
    const current = new Date(start);
    current.setDate(current.getDate() + 1);

    while (current < end) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split("T")[0];
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidaySet.has(dateStr);

      // If there is any unselected normal working day between them, they are not contiguous
      if (!isWeekend && !isHoliday && !selectedDates[dateStr]) {
        return false;
      }
      current.setDate(current.getDate() + 1);
    }
    return true;
  };

  // Group individual selected dates into segments
  const getSegments = () => {
    const sortedDates = Object.keys(selectedDates).sort();
    if (sortedDates.length === 0) return [];

    const segmentsList: { leaveType: string; startDate: string; endDate: string }[] = [];
    let currentSeg: { leaveType: string; startDate: string; endDate: string } | null = null;

    for (const dateStr of sortedDates) {
      const type = selectedDates[dateStr];
      if (!currentSeg) {
        currentSeg = { leaveType: type, startDate: dateStr, endDate: dateStr };
        continue;
      }

      const canExtend = currentSeg.leaveType === type && isContiguous(currentSeg.endDate, dateStr);

      if (canExtend) {
        currentSeg.endDate = dateStr;
      } else {
        segmentsList.push(currentSeg);
        currentSeg = { leaveType: type, startDate: dateStr, endDate: dateStr };
      }
    }

    if (currentSeg) {
      segmentsList.push(currentSeg);
    }

    return segmentsList;
  };

  // Sum total days for a segment
  const getSegmentDuration = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return 0;

    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      if (isWorkingDay(dateStr)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  const segments = getSegments();
  const totalDuration = segments.reduce((sum, seg) => sum + getSegmentDuration(seg.startDate, seg.endDate), 0);
  const selectedAnnualDays = segments
    .filter((seg) => seg.leaveType === "CUTI_TAHUNAN")
    .reduce((sum, seg) => sum + getSegmentDuration(seg.startDate, seg.endDate), 0);

  const hasSakit = Object.values(selectedDates).some((type) => type === "SAKIT");

  const handleDayClick = (dateStr: string) => {
    if (!userId) {
      setError("Silakan pilih karyawan terlebih dahulu.");
      return;
    }
    if (bookedDates.has(dateStr)) return; // disabled
    if (!isWorkingDay(dateStr)) return; // weekends/holidays

    const newSelected = { ...selectedDates };
    if (newSelected[dateStr] === activeBrushType) {
      delete newSelected[dateStr];
    } else {
      newSelected[dateStr] = activeBrushType;
    }
    setSelectedDates(newSelected);
  };

  const handleApplyRange = () => {
    if (!userId) {
      setError("Silakan pilih karyawan terlebih dahulu.");
      return;
    }
    if (!rangeStart || !rangeEnd) {
      setError("Silakan pilih Tanggal Mulai dan Tanggal Selesai terlebih dahulu.");
      return;
    }

    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError("Format tanggal tidak valid.");
      return;
    }

    if (start > end) {
      setError("Tanggal Mulai tidak boleh setelah Tanggal Selesai.");
      return;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
      setError("Rentang maksimal yang diperbolehkan adalah 1 tahun.");
      return;
    }

    const newSelected = { ...selectedDates };
    const current = new Date(start);

    while (current <= end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      if (isWorkingDay(dateStr) && !bookedDates.has(dateStr)) {
        newSelected[dateStr] = activeBrushType;
      }

      current.setDate(current.getDate() + 1);
    }

    setSelectedDates(newSelected);
    // Jump calendar view to rangeStart month
    setCurrentMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    setError("");
  };

  const handleClearAll = () => {
    setSelectedDates({});
    setError("");
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

    if (segments.length === 0) {
      setError("Tambahkan minimal satu tanggal cuti / izin pada kalender.");
      return;
    }

    if (!reason.trim()) {
      setError("Alasan pengajuan wajib diisi.");
      return;
    }

    if (hasSakit && !file) {
      setError("Pengajuan dengan jenis 'Sakit' wajib melampirkan Surat Keterangan Dokter.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("reason", reason);
      formData.append("segments", JSON.stringify(segments));
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

  // Render Calendar Grid
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...
    const padding = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: React.ReactNode[] = [];

    // Padding empty cells
    for (let i = 0; i < padding; i++) {
      cells.push(<div key={`pad-${i}`} className="calendar-day-cell disabled opacity-20" />);
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      // Format as YYYY-MM-DD local timezone consistent split
      const yyyy = currentDate.getFullYear();
      const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
      const dd = String(currentDate.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const isHoliday = holidaySet.has(dateStr);
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const isBooked = bookedDates.has(dateStr);
      const selectedType = selectedDates[dateStr];

      let cellClass = "calendar-day-cell";
      let tooltip = "";

      if (isWeekend) {
        cellClass += " disabled weekend";
      } else if (isHoliday) {
        cellClass += " disabled holiday";
        tooltip = "Hari Libur Nasional";
      } else if (isBooked) {
        cellClass += " disabled booked";
        tooltip = "Sudah ada pengajuan";
      }

      if (selectedType) {
        const typeObj = leaveTypes.find((t) => t.value === selectedType);
        if (typeObj) {
          cellClass += ` ${typeObj.color}`;
        }
      }

      if (dateStr === todayStr) {
        cellClass += " today";
      }

      cells.push(
        <div
          key={day}
          className={cellClass}
          onClick={() => handleDayClick(dateStr)}
          title={tooltip}
        >
          <span>{day}</span>
        </div>
      );
    }

    return cells;
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const activeBrushLabel = leaveTypes.find((t) => t.value === activeBrushType)?.label || activeBrushType;
  const currentMonthLabel = currentMonth.toLocaleString("id-ID", { month: "long", year: "numeric" });

  const getLeaveGuideline = (type: string) => {
    switch (type) {
      case "CUTI_TAHUNAN":
        return "Mengurangi kuota tahunan berjalan. Akrual dinamis.";
      case "PERNIKAHAN_KARYAWAN":
        return "Maksimal jatah: 3 Hari Kerja.";
      case "PERNIKAHAN_ANAK":
      case "KHITAN_BAPTIS":
      case "ISTRI_MELAHIRKAN":
      case "KEMATIAN_KELUARGA":
        return "Maksimal jatah: 2 Hari Kerja.";
      case "KARYAWATI_MELAHIRKAN":
        return "Maksimal jatah: 3 Bulan kalender.";
      case "KARYAWATI_KEGUGURAN":
        return "Maksimal jatah: 1.5 Bulan kalender.";
      case "SAKIT":
        return "Wajib melampirkan Surat Keterangan Dokter resmi.";
      case "IZIN_LAINNYA":
        return "Untuk izin di luar cuti tahunan dan izin khusus terdaftar.";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Back Link */}
      <a href="/cuti" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", gap: 6 }}>
        <ArrowLeft size={16} /> Kembali ke Daftar
      </a>

      {error && (
        <div className="form-error animate-scale" style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-danger-light)", borderRadius: "var(--radius-md)", border: "1px solid rgba(220,38,38,0.2)", fontSize: "var(--text-sm)", color: "var(--color-danger)" }}>
          {error}
        </div>
      )}

      {/* Main Two-Column Calendar Layout */}
      <div className="calendar-layout">
        
        {/* COLUMN 1: SIDEBAR (Employee Selector, Brush Picker, Summary) */}
        <div className="flex flex-col gap-4">
          
          {/* Details Card */}
          <div className="card-outer">
            <div className="card-inner">
              <h3 className="card-title mb-2">Metadata Pengajuan</h3>
              <p className="text-muted text-xs mb-4">Pilih karyawan (jika Admin/HR) dan isi alasan pengajuan.</p>

              <form onSubmit={onSubmit}>
                {/* Employee select */}
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
                ) : null}

                {/* Quota Tracker Panel */}
                {quotaInfo && (
                  <div className="card-outer mb-4" style={{ background: "rgba(0,0,0,0.01)", border: "1px dashed var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px" }}>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted">Kuota Tahunan Berjalan:</span>
                        <span className="text-primary">{quotaInfo.remaining} Hari</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted">Proyeksi Setelah Pengajuan:</span>
                        <span className={quotaInfo.remaining - selectedAnnualDays < 0 ? "text-danger" : "text-success"}>
                          {quotaInfo.remaining - selectedAnnualDays} Hari
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-light mt-1">
                        Siklus: {new Date(quotaInfo.cycleStart).toLocaleDateString("id-ID")} s/d {new Date(quotaInfo.cycleEnd).toLocaleDateString("id-ID")}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reason Textarea */}
                <div className="form-group">
                  <label htmlFor="reason" className="form-label required">
                    Alasan / Keterangan
                  </label>
                  <textarea
                    id="reason"
                    className="form-textarea"
                    placeholder="Tuliskan keterangan detail alasan pengajuan..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={isPending}
                    style={{ minHeight: "80px" }}
                  />
                </div>

                {/* Attachment Uploader */}
                <div className="form-group">
                  <label htmlFor="attachment" className="form-label">
                    Lampiran Dokumen {hasSakit && <span className="text-danger">*</span>}
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                      className="btn btn-outline btn-sm w-full"
                      onClick={() => document.getElementById("attachment")?.click()}
                      disabled={isPending}
                    >
                      <FileText size={14} /> {file ? "Ubah Lampiran" : "Pilih Lampiran"}
                    </button>
                    {file && (
                      <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                        {file.name} ({Math.round(file.size / 1024)} KB)
                      </span>
                    )}
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="btn btn-primary w-full mt-4"
                  disabled={isPending || isFetchingBooked}
                >
                  {isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    <>Kirim Pengajuan</>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Legend / Paint Brush Tool */}
          <div className="card-outer">
            <div className="card-inner">
              <h3 className="card-title mb-1">Kuas Jenis Cuti / Izin</h3>
              <p className="text-muted text-xs mb-3">Pilih warna di bawah, lalu klik tanggal di kalender.</p>
              
              <div className="brush-list">
                {leaveTypes.map((type) => {
                  const isActive = activeBrushType === type.value;
                  return (
                    <div
                      key={type.value}
                      className={`brush-item ${isActive ? "active" : ""}`}
                      onClick={() => setActiveBrushType(type.value)}
                    >
                      <div className="brush-dot" style={{ backgroundColor: type.hex }} />
                      <span>{type.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Guide guideline box for active brush */}
              <div style={{ display: "flex", gap: "6px", background: "var(--color-primary-light)", color: "var(--color-primary)", padding: "10px 12px", borderRadius: "var(--radius-md)", fontSize: "11px", alignItems: "center", fontWeight: 500, marginTop: 12 }}>
                <Info size={14} style={{ flexShrink: 0 }} />
                <span>{getLeaveGuideline(activeBrushType)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* COLUMN 2: CALENDAR GRID CONTAINER */}
        <div className="card-outer" style={{ height: "fit-content" }}>
          <div className="card-inner">
            <div className="flex justify-between items-center mb-4">
              <h2 className="card-title text-base" style={{ margin: 0 }}>Pilih Tanggal Pengajuan</h2>
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline btn-icon" onClick={prevMonth} title="Bulan Sebelumnya">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-bold flex items-center px-2 min-w-[120px] justify-center">
                  {currentMonthLabel}
                </span>
                <button type="button" className="btn btn-outline btn-icon" onClick={nextMonth} title="Bulan Selanjutnya">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Quick Range Selection */}
            <div className="mb-5 p-4 rounded-xl border border-slate-100 bg-slate-50/55 flex flex-col gap-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <Calendar size={14} className="text-primary" />
                  <span>Pilih Berdasarkan Rentang Tanggal</span>
                </div>
                {/* Fixed Duration Autocomplete Badge */}
                {(() => {
                  const hasFixed = ["ISTRI_MELAHIRKAN", "PERNIKAHAN_KARYAWAN", "PERNIKAHAN_ANAK", "KHITAN_BAPTIS", "KEMATIAN_KELUARGA", "KARYAWATI_MELAHIRKAN", "KARYAWATI_KEGUGURAN"].includes(activeBrushType);
                  if (!hasFixed) return null;
                  let text = "";
                  if (activeBrushType === "PERNIKAHAN_KARYAWAN") text = "3 Hari Kerja";
                  else if (activeBrushType === "KARYAWATI_MELAHIRKAN") text = "3 Bulan Kalender";
                  else if (activeBrushType === "KARYAWATI_KEGUGURAN") text = "1.5 Bulan Kalender";
                  else text = "2 Hari Kerja";
                  return (
                    <span className="badge badge-info" style={{ fontSize: "10px", padding: "2px 8px", background: "var(--color-info-light)", color: "var(--color-info)" }}>
                      Durasi Otomatis: {text}
                    </span>
                  );
                })()}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="rangeStart" className="block text-[10px] font-semibold text-slate-400 mb-1">TANGGAL MULAI</label>
                  <input
                    id="rangeStart"
                    type="date"
                    className="form-input w-full text-xs"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    disabled={isPending}
                    style={{ minHeight: "36px", padding: "6px 12px" }}
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="rangeEnd" className="block text-[10px] font-semibold text-slate-400 mb-1">TANGGAL SELESAI</label>
                  <input
                    id="rangeEnd"
                    type="date"
                    className="form-input w-full text-xs"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    disabled={isPending}
                    style={{ minHeight: "36px", padding: "6px 12px" }}
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm flex-1 sm:flex-none justify-center"
                    onClick={handleApplyRange}
                    disabled={isPending}
                    style={{ height: "36px", padding: "0 16px" }}
                  >
                    Terapkan Rentang
                  </button>
                  {Object.keys(selectedDates).length > 0 && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm flex-1 sm:flex-none justify-center"
                      onClick={handleClearAll}
                      disabled={isPending}
                      style={{ height: "36px", padding: "0 16px", color: "#EF4444", borderColor: "#FCA5A5" }}
                    >
                      Reset Pilihan
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                * Mengisi otomatis hari kerja di antara kedua tanggal dengan jenis kuas <span className="font-semibold text-primary">{activeBrushLabel}</span>.
              </p>
            </div>

            {/* Displaying Live Summary Tracker */}
            {totalDuration > 0 && (
              <div className="animate-scale mb-4" style={{ display: "flex", flexWrap: "wrap", gap: "6px", background: "rgba(124,58,237,0.03)", border: "1.5px solid var(--color-primary-light)", padding: "10px 12px", borderRadius: "var(--radius-md)", fontSize: "12px", fontWeight: 600 }}>
                <span className="text-primary mr-2">Total Terpilih: {totalDuration} Hari Kerja</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {segments.map((seg, idx) => {
                    const dur = getSegmentDuration(seg.startDate, seg.endDate);
                    const t = leaveTypes.find((x) => x.value === seg.leaveType);
                    return (
                      <span
                        key={idx}
                        className={`badge ${t?.color || "badge-neutral"}`}
                        style={{ border: `1px solid ${t?.hex || "#ccc"}` }}
                      >
                        {t?.label || seg.leaveType}: {dur} Hari
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Calendar grid */}
            <div className="calendar-grid">
              {/* Day Headers */}
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
                <div key={day} className="calendar-day-header">
                  {day}
                </div>
              ))}
              
              {/* Day cells */}
              {renderCalendar()}
            </div>
          </div>
        </div>

      </div>

      <style>{`
        .calendar-layout {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: var(--space-6);
        }
        @media (max-width: 860px) {
          .calendar-layout {
            grid-template-columns: 1fr;
          }
        }
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        .calendar-day-header {
          text-align: center;
          font-size: var(--text-xs);
          font-weight: 700;
          color: var(--color-text-light);
          padding: 4px 0;
          text-transform: uppercase;
        }
        .calendar-day-cell {
          aspect-ratio: 1.1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background: var(--color-bg-card);
          font-size: var(--text-sm);
          font-weight: 600;
          cursor: pointer;
          position: relative;
          transition: all var(--transition-fast);
          user-select: none;
        }
        .calendar-day-cell:hover:not(.disabled) {
          border-color: var(--color-primary-muted);
          background: var(--color-primary-light);
          color: var(--color-primary);
          transform: scale(1.04);
          z-index: 10;
        }
        .calendar-day-cell.disabled {
          background: #F1F5F9;
          border-color: #E2E8F0;
          color: var(--color-text-light);
          cursor: not-allowed;
          font-weight: 400;
          opacity: 0.8;
        }
        .calendar-day-cell.holiday {
          background: #FFF1F2;
          border-color: #FFE4E6;
          color: #E11D48;
        }
        .calendar-day-cell.weekend {
          background: #F8FAFC;
          border-color: #F1F5F9;
          color: #94A3B8;
        }
        .calendar-day-cell.booked {
          background: #E2E8F0;
          border-color: #CBD5E1;
          color: #64748B;
          text-decoration: line-through;
        }
        .calendar-day-cell.booked::after {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(148, 163, 184, 0.15) 8px, rgba(148, 163, 184, 0.15) 16px);
          border-radius: var(--radius-md);
        }
        .calendar-day-cell.today::before {
          content: '';
          position: absolute;
          bottom: 4px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: var(--color-primary);
        }
        .calendar-day-cell.selected-cuti {
          background: #EFF6FF !important;
          border-color: #3B82F6 !important;
          color: #1D4ED8 !important;
          box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
        .calendar-day-cell.selected-sakit {
          background: #FEF2F2 !important;
          border-color: #EF4444 !important;
          color: #B91C1C !important;
          box-shadow: inset 0 0 0 2px rgba(239, 68, 68, 0.2);
        }
        .calendar-day-cell.selected-istri {
          background: #FFF7ED !important;
          border-color: #F97316 !important;
          color: #C2410C !important;
          box-shadow: inset 0 0 0 2px rgba(249, 115, 22, 0.2);
        }
        .calendar-day-cell.selected-other {
          background: #FAF5FF !important;
          border-color: #8B5CF6 !important;
          color: #6D28D9 !important;
          box-shadow: inset 0 0 0 2px rgba(139, 92, 246, 0.2);
        }
        
        /* Brush styles */
        .brush-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
        }
        @media (max-width: 480px) {
          .brush-list {
            grid-template-columns: 1fr;
          }
        }
        .brush-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-size: 11px;
          font-weight: 600;
          background: var(--color-bg-card);
        }
        .brush-item:hover {
          border-color: var(--color-primary-muted);
          background: var(--color-bg);
        }
        .brush-item.active {
          border-color: var(--color-primary);
          background: var(--color-primary-light);
          color: var(--color-primary);
        }
        .brush-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
