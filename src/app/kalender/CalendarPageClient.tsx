"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Calendar,
  Building2,
  Users,
  ExternalLink,
  Info,
} from "lucide-react";

interface CalendarEvent {
  id: string;
  userId: string;
  userName: string;
  department: string;
  subCompanyId: string;
  subCompanyName: string;
  category: "LEAVE" | "EXCUSE";
  type: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason: string | null;
  attachmentUrl: string | null;
}

interface CalendarPageClientProps {
  initialEvents: CalendarEvent[];
  subCompanies: { id: string; name: string }[];
  departments: string[];
  userRole: string;
}

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAYS_OF_WEEK = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function getLeaveTypeLabel(type: string): string {
  const map: Record<string, string> = {
    PERNIKAHAN_KARYAWAN: "Pernikahan Karyawan",
    PERNIKAHAN_ANAK: "Pernikahan Anak",
    KHITAN_BAPTIS: "Khitan/Baptis Anak",
    ISTRI_MELAHIRKAN: "Istri Melahirkan",
    KEMATIAN_KELUARGA: "Cuti Duka Cita",
    KARYAWATI_MELAHIRKAN: "Melahirkan (Karyawati)",
    KARYAWATI_KEGUGURAN: "Keguguran (Karyawati)",
    SAKIT: "Sakit dengan Surat Dokter",
    CUTI_TAHUNAN: "Cuti Tahunan",
    TIDAK_ABSEN_MASUK: "Tidak Absen Masuk",
    TIDAK_ABSEN_PULANG: "Tidak Absen Pulang",
    DATANG_TERLAMBAT: "Datang Terlambat",
    IZIN_LAINNYA: "Izin Lainnya",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function getEventStyle(category: "LEAVE" | "EXCUSE", type: string) {
  if (type === "SAKIT") {
    return {
      bg: "#FEF2F2",
      border: "1px solid #FCA5A5",
      text: "#991B1B",
    };
  }
  if (type === "CUTI_TAHUNAN") {
    return {
      bg: "#EFF6FF",
      border: "1px solid #93C5FD",
      text: "#1E40AF",
    };
  }
  if (category === "LEAVE") {
    return {
      bg: "#FFF7ED",
      border: "1px solid #FDBA74",
      text: "#9A3412",
    };
  }
  return {
    bg: "#F0FDF4",
    border: "1px solid #86EFAC",
    text: "#166534",
  };
}

export function CalendarPageClient({
  initialEvents = [],
  subCompanies = [],
  departments = [],
  userRole,
}: CalendarPageClientProps) {
  const router = useRouter();
  const isAdmin = userRole === "SUPERADMIN" || userRole === "ADMIN";

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedSubCompany, setSelectedSubCompany] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  
  // Modals state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [overflowDate, setOverflowDate] = useState<Date | null>(null);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Safe formatting local date YYYY-MM-DD
  const formatDateLocal = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Generate grid cells
  const gridDates = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    // Convert Sunday = 0 to index 6, Monday = 1 to index 0...
    const startPaddingCount = firstDay === 0 ? 6 : firstDay - 1;

    const totalDaysCurrent = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dates: Date[] = [];

    // Previous month padding
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startPaddingCount - 1; i >= 0; i--) {
      dates.push(new Date(prevYear, prevMonth, prevMonthLastDay - i));
    }

    // Current month days
    for (let i = 1; i <= totalDaysCurrent; i++) {
      dates.push(new Date(currentYear, currentMonth, i));
    }

    // Next month padding to fill grid (always 42 cells for visual consistency)
    const totalCells = 42;
    const nextPaddingCount = totalCells - dates.length;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    for (let i = 1; i <= nextPaddingCount; i++) {
      dates.push(new Date(nextYear, nextMonth, i));
    }

    return dates;
  }, [currentMonth, currentYear]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return initialEvents.filter((event) => {
      const matchSub = selectedSubCompany === "all" || event.subCompanyId === selectedSubCompany;
      const matchDept = selectedDepartment === "all" || event.department === selectedDepartment;
      return matchSub && matchDept;
    });
  }, [initialEvents, selectedSubCompany, selectedDepartment]);

  // Map events to date key for constant time lookup
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    
    // Scan each grid date and associate matching events
    gridDates.forEach((date) => {
      const dateStr = formatDateLocal(date);
      const matching = filteredEvents.filter((e) => e.startDate <= dateStr && e.endDate >= dateStr);
      if (matching.length > 0) {
        map[dateStr] = matching;
      }
    });

    return map;
  }, [gridDates, filteredEvents]);

  const overflowEvents = useMemo(() => {
    if (!overflowDate) return [];
    return eventsByDate[formatDateLocal(overflowDate)] || [];
  }, [overflowDate, eventsByDate]);

  return (
    <div className="flex flex-col gap-6" style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Calendar Header with Navigation Controls */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="stat-icon primary" style={{ width: 40, height: 40 }}>
            <Calendar size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, margin: 0 }}>Kalender Cuti Bersama</h2>
            <p className="text-muted text-xs">Jadwal absensi & cuti karyawan terverifikasi</p>
          </div>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={handleToday} style={{ border: "1px solid var(--color-border)" }}>
            Hari Ini
          </button>
          <div className="flex items-center" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-full)", background: "var(--color-bg-card)" }}>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={handlePrevMonth} style={{ minHeight: 32, minWidth: 32, padding: 0 }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, minWidth: 120, textAlign: "center", padding: "0 8px" }}>
              {MONTHS[currentMonth]} {currentYear}
            </span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={handleNextMonth} style={{ minHeight: 32, minWidth: 32, padding: 0 }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Controls Panel */}
      <div className="card-outer">
        <div className="card-inner" style={{ padding: "var(--space-4)" }}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-muted font-semibold">
              <Filter size={16} />
              <span>Saring Tampilan:</span>
            </div>

            {/* Sub-Company Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="filter-subcompany" className="text-xs font-semibold text-muted" style={{ display: "none" }}>Unit Bisnis</label>
              <select
                id="filter-subcompany"
                className="form-select"
                style={{ minHeight: 36, padding: "6px 36px 6px 12px", fontSize: "var(--text-xs)", minWidth: 180 }}
                value={selectedSubCompany}
                onChange={(e) => setSelectedSubCompany(e.target.value)}
              >
                <option value="all">Semua Unit Bisnis</option>
                {subCompanies.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="filter-dept" className="text-xs font-semibold text-muted" style={{ display: "none" }}>Departemen</label>
              <select
                id="filter-dept"
                className="form-select"
                style={{ minHeight: 36, padding: "6px 36px 6px 12px", fontSize: "var(--text-xs)", minWidth: 180 }}
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="all">Semua Departemen</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* The Calendar Grid Container */}
      <div className="card-outer" style={{ padding: 2 }}>
        <div className="card-inner" style={{ padding: 0, overflow: "hidden" }}>
          {/* Days Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg)",
            }}
          >
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                style={{
                  textAlign: "center",
                  padding: "12px 8px",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  color: "var(--color-text-muted)",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Day Cells */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              backgroundColor: "var(--color-border)",
              gap: "1px",
            }}
          >
            {gridDates.map((date, idx) => {
              const dateStr = formatDateLocal(date);
              const isCurrentMonth = date.getMonth() === currentMonth;
              const isToday = formatDateLocal(new Date()) === dateStr;
              const dateEvents = eventsByDate[dateStr] || [];

              return (
                <div
                  key={idx}
                  className="calendar-day-cell"
                  onClick={() => {
                    // On mobile (or desktop cell click), open daily events list modal
                    if (dateEvents.length > 0) {
                      setOverflowDate(date);
                    }
                  }}
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    minHeight: "110px",
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    opacity: isCurrentMonth ? 1 : 0.45,
                    transition: "background-color 0.2s ease, transform 0.1s ease",
                    cursor: dateEvents.length > 0 ? "pointer" : "default",
                  }}
                  onMouseEnter={(e) => {
                    if (dateEvents.length > 0) {
                      e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.02)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--color-bg-card)";
                  }}
                >
                  {/* Day number */}
                  <div className="flex justify-between items-center mb-1">
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: 700,
                        color: isToday ? "#FFFFFF" : isCurrentMonth ? "var(--color-text)" : "var(--color-text-light)",
                        backgroundColor: isToday ? "var(--color-primary)" : "transparent",
                        width: isToday ? 22 : "auto",
                        height: isToday ? 22 : "auto",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Day events badges stack (Desktop) */}
                  <div className="flex flex-col gap-1 flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                    {dateEvents.slice(0, 3).map((event) => {
                      const style = getEventStyle(event.category, event.type);
                      return (
                        <button
                          key={event.id}
                          className="calendar-event-pill"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent opening daily list modal
                            setSelectedEvent(event);
                          }}
                          style={{
                            backgroundColor: style.bg,
                            border: style.border,
                            color: style.text,
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "var(--radius-sm)",
                            textAlign: "left",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            cursor: "pointer",
                            width: "100%",
                            display: "block",
                            transition: "transform 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-1px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "none";
                          }}
                        >
                          {event.userName}
                        </button>
                      );
                    })}

                    {/* Overflow label link (Desktop) */}
                    {dateEvents.length > 3 && (
                      <button
                        className="calendar-overflow-label"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent double trigger
                          setOverflowDate(date);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--color-primary)",
                          fontSize: "10px",
                          fontWeight: 700,
                          textAlign: "left",
                          padding: "2px 4px",
                          cursor: "pointer",
                          display: "inline-block",
                        }}
                      >
                        + {dateEvents.length - 3} Lainnya
                      </button>
                    )}
                  </div>

                  {/* Dot indicators for mobile view */}
                  <div className="calendar-event-dots">
                    {dateEvents.slice(0, 5).map((event) => {
                      const style = getEventStyle(event.category, event.type);
                      return (
                        <span
                          key={event.id}
                          className="calendar-event-dot"
                          style={{
                            backgroundColor: style.text,
                          }}
                        />
                      );
                    })}
                    {dateEvents.length > 5 && (
                      <span
                        style={{
                          fontSize: "7px",
                          fontWeight: 800,
                          color: "var(--color-primary)",
                          lineHeight: 1,
                        }}
                      >
                        +
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 1. Modal Detail Event (Cuti / Izin) */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal animate-scale" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={18} className="text-primary" /> Rincian Absensi Karyawan
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedEvent(null)} style={{ minHeight: 32, minWidth: 32, padding: 0 }}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Profile Card Header */}
              <div className="flex items-center gap-3" style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 16 }}>
                <div className="sidebar-avatar" style={{ width: 44, height: 44, fontSize: "var(--text-base)" }}>
                  {selectedEvent.userName.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: "var(--text-base)" }}>{selectedEvent.userName}</h4>
                  <p className="text-xs text-muted">{selectedEvent.department} • {selectedEvent.subCompanyName}</p>
                </div>
              </div>

              {/* Leave detail properties */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "var(--text-sm)" }}>
                <div>
                  <span className="text-muted text-xs" style={{ display: "block", marginBottom: 2 }}>Jenis Pengajuan</span>
                  <span style={{ fontWeight: 600 }} className="badge badge-info">
                    {getLeaveTypeLabel(selectedEvent.type)}
                  </span>
                </div>
                <div>
                  <span className="text-muted text-xs" style={{ display: "block", marginBottom: 2 }}>Durasi Cuti</span>
                  <span style={{ fontWeight: 700 }}>{selectedEvent.totalDays} Hari Kerja</span>
                </div>
                <div>
                  <span className="text-muted text-xs" style={{ display: "block", marginBottom: 2 }}>Tanggal Mulai</span>
                  <span style={{ fontWeight: 600 }}>
                    {new Date(selectedEvent.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                <div>
                  <span className="text-muted text-xs" style={{ display: "block", marginBottom: 2 }}>Tanggal Selesai</span>
                  <span style={{ fontWeight: 600 }}>
                    {new Date(selectedEvent.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
              </div>

              {/* Role-based details visibility */}
              {isAdmin ? (
                <div
                  style={{
                    backgroundColor: "var(--color-bg)",
                    padding: "12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    marginTop: 4,
                  }}
                  className="flex flex-col gap-3"
                >
                  <div>
                    <span className="text-muted text-xs" style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <Info size={12} /> Alasan Pengajuan (Admin Only)
                    </span>
                    <p style={{ fontSize: "var(--text-xs)", margin: 0, lineHeight: 1.4, color: "var(--color-text)" }}>
                      {selectedEvent.reason || "Tidak ada alasan terlampir."}
                    </p>
                  </div>

                  {selectedEvent.attachmentUrl && (
                    <div>
                      <span className="text-muted text-xs" style={{ display: "block", marginBottom: 2 }}>Dokumen Lampiran</span>
                      <a
                        href={selectedEvent.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: "var(--text-xs)", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}
                      >
                        Lihat Lampiran <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: "rgba(124, 58, 237, 0.03)",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px dotted rgba(124, 58, 237, 0.2)",
                    fontSize: "11px",
                    color: "var(--color-text-muted)",
                    textAlign: "center",
                  }}
                >
                  Catatan detail dan lampiran disembunyikan untuk menjaga privasi.
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ borderTop: "1px solid var(--color-border)", padding: "12px var(--space-6)" }}>
              {isAdmin && (
                <a
                  href={selectedEvent.category === "LEAVE" ? `/cuti/${selectedEvent.id}` : `/izin/${selectedEvent.id}`}
                  className="btn btn-outline btn-sm"
                  style={{ marginRight: "auto" }}
                >
                  Buka Pengajuan <ExternalLink size={12} />
                </a>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedEvent(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Overflow List (+X Lainnya) */}
      {overflowDate && (
        <div className="modal-overlay" onClick={() => setOverflowDate(null)}>
          <div className="modal animate-scale" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
            <div className="modal-header">
              <h3 className="modal-title">
                Absensi Tanggal {overflowDate.getDate()} {MONTHS[overflowDate.getMonth()]} {overflowDate.getFullYear()}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setOverflowDate(null)} style={{ minHeight: 32, minWidth: 32, padding: 0 }}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: "350px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {overflowEvents.map((event) => {
                const style = getEventStyle(event.category, event.type);
                return (
                  <div
                    key={event.id}
                    onClick={() => {
                      setSelectedEvent(event);
                      setOverflowDate(null);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-bg-card)",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                    className="hover:bg-gray-50"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--color-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--color-bg-card)";
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "var(--text-sm)" }}>{event.userName}</p>
                      <p className="text-muted" style={{ fontSize: "10px", margin: 0 }}>{event.department}</p>
                    </div>
                    <span
                      style={{
                        backgroundColor: style.bg,
                        border: style.border,
                        color: style.text,
                        fontSize: "9px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "var(--radius-full)",
                      }}
                    >
                      {getLeaveTypeLabel(event.type)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setOverflowDate(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Desktop/Default Event Dots container */
        .calendar-event-dots {
          display: none;
        }

        /* Mobile specific style overrides */
        @media (max-width: 768px) {
          .calendar-day-cell {
            min-height: 58px !important;
            padding: 4px !important;
            justify-content: space-between;
          }
          .calendar-event-pill {
            display: none !important;
          }
          .calendar-overflow-label {
            display: none !important;
          }
          .calendar-event-dots {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            justify-content: center;
            margin-top: auto;
            width: 100%;
            padding-bottom: 2px;
          }
          .calendar-event-dot {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            display: inline-block;
          }
        }
      `}</style>
    </div>
  );
}
