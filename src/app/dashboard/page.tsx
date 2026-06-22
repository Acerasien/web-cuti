import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccruedQuotaDays } from "@/lib/accrual";
import {
  CalendarOff,
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  User,
} from "lucide-react";
import Link from "next/link";

function getLeaveTypeLabel(type: string): string {
  const map: Record<string, string> = {
    PERNIKAHAN_KARYAWAN: "Pernikahan Karyawan",
    PERNIKAHAN_ANAK: "Pernikahan Anak",
    KHITAN_BAPTIS: "Khitan/Baptis Anak",
    ISTRI_MELAHIRKAN: "Istri Melahirkan",
    KEMATIAN_KELUARGA: "Cuti Duka Cita",
    KARYAWATI_MELAHIRKAN: "Melahirkan (Karyawati)",
    KARYAWATI_KEGUGURAN: "Keguguran (Karyawati)",
    SAKIT: "Sakit (Surat Dokter)",
    CUTI_TAHUNAN: "Cuti Tahunan",
    IZIN_LAINNYA: "Izin Lainnya",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";
  const userId = session.user.id;

  const now = new Date();

  // Define date ranges for current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 1. Compute Stats
  let totalPending = 0;
  let totalApproved = 0;
  let totalRejected = 0;
  let remainingCuti = 0;
  let accruedCuti = 0;
  let usedCuti = 0;
  let cutiBersamaCount = 0;
  let activeQuota: any = null;
  let quotaWarning: string | null = null;
  let totalEmployees = 0;

  if (isAdmin) {
    // Admin company-wide statistics
    totalPending = await prisma.leaveRequest.count({ where: { status: "PENDING" } });
    totalApproved = await prisma.leaveRequest.count({
      where: { status: "APPROVED", createdAt: { gte: startOfMonth, lte: endOfMonth } },
    });
    totalRejected = await prisma.leaveRequest.count({
      where: { status: "REJECTED", createdAt: { gte: startOfMonth, lte: endOfMonth } },
    });
    totalEmployees = await prisma.user.count({ where: { isActive: true } });
  } else {
    // Employee self-only statistics
    totalPending = await prisma.leaveRequest.count({ where: { userId, status: "PENDING" } });
    totalApproved = await prisma.leaveRequest.count({
      where: { userId, status: "APPROVED", createdAt: { gte: startOfMonth, lte: endOfMonth } },
    });
    totalRejected = await prisma.leaveRequest.count({
      where: { userId, status: "REJECTED", createdAt: { gte: startOfMonth, lte: endOfMonth } },
    });

    // Fetch active quota cycle
    activeQuota = await prisma.annualLeaveQuota.findFirst({
      where: {
        userId,
        cycleStart: { lte: now },
        cycleEnd: { gte: now },
      },
    });

    // Fallback to latest cycle if no active covers today
    if (!activeQuota) {
      activeQuota = await prisma.annualLeaveQuota.findFirst({
        where: { userId },
        orderBy: { cycleStart: "desc" },
      });
    }

    if (activeQuota) {
      const cycleApproved = await prisma.leaveSegment.aggregate({
        _sum: { totalDays: true },
        where: {
          leaveRequest: {
            userId,
            status: "APPROVED",
          },
          leaveType: "CUTI_TAHUNAN",
          annualQuotaId: activeQuota.id,
        },
      });

      usedCuti = Number(cycleApproved._sum.totalDays || 0);
      accruedCuti = getAccruedQuotaDays(activeQuota.cycleStart, activeQuota.totalDays, now);

      cutiBersamaCount = await prisma.holiday.count({
        where: {
          isCutiBersama: true,
          date: {
            gte: activeQuota.cycleStart,
            lte: now,
          },
        },
      });

      remainingCuti = Math.max(0, accruedCuti - usedCuti - cutiBersamaCount);

      const cycleEndDate = new Date(activeQuota.cycleEnd);
      const diffTime = cycleEndDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        quotaWarning = `Siklus cuti tahunan Anda telah berakhir pada ${formatDate(cycleEndDate)}. Hubungi HR untuk memperbaharui kuota Anda.`;
      } else if (diffDays <= 30) {
        quotaWarning = `Siklus cuti tahunan Anda akan berakhir dalam ${diffDays} hari (${formatDate(cycleEndDate)}). Jatah cuti tersisa ${remainingCuti} hari akan hangus.`;
      }
    }
  }

  // 2. Fetch Recent Activities (Top 5)
  const recentLeaves = await prisma.leaveRequest.findMany({
    where: isAdmin ? {} : { userId },
    include: {
      user: { select: { name: true } },
      segments: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const recentActivities = recentLeaves.map((req) => {
    const startDates = req.segments.map((s) => new Date(s.startDate).getTime());
    const endDates = req.segments.map((s) => new Date(s.endDate).getTime());
    const earliestStart = startDates.length > 0 ? new Date(Math.min(...startDates)) : null;
    const latestEnd = endDates.length > 0 ? new Date(Math.max(...endDates)) : null;

    const title = Array.from(new Set(req.segments.map((s) => s.leaveType)))
      .map((t) => getLeaveTypeLabel(t))
      .join(", ");

    const range = earliestStart && latestEnd
      ? `${formatDate(earliestStart)} s/d ${formatDate(latestEnd)}`
      : "—";

    return {
      id: req.id,
      title,
      range,
      status: req.status,
      createdAt: req.createdAt,
      userName: req.user.name,
    };
  });

  return (
    <div>
      {/* Expiry / Configuration Warning Banner */}
      {!isAdmin && quotaWarning && (
        <div style={{ display: "flex", gap: "12px", background: "var(--color-danger-light)", color: "var(--color-danger)", padding: "16px", borderRadius: "var(--radius-md)", marginBottom: "var(--space-5)", fontSize: "var(--text-sm)", alignItems: "flex-start", fontWeight: 500, border: "1px solid rgba(220,38,38,0.15)" }}>
          <AlertTriangle size={18} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{quotaWarning}</span>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="card-outer mb-6">
        <div className="card-inner" style={{ background: "linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(249, 115, 22, 0.02) 100%)" }}>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="badge badge-primary">Web Cuti v1.0</span>
                <span className="text-xs text-muted flex items-center gap-1" style={{ fontWeight: 500 }}>
                  <Sparkles size={12} style={{ color: "var(--color-accent)" }} /> Sistem Absensi & Cuti
                </span>
              </div>
              <h1 className="page-title" style={{ fontSize: "var(--text-3xl)", fontWeight: 800, letterSpacing: "-0.03em" }}>
                Selamat datang, {session.user.name.split(" ")[0]}! 👋
              </h1>
              <p className="page-subtitle" style={{ marginTop: "4px" }}>
                {isAdmin
                  ? "Berikut ringkasan aktivitas cuti dan izin karyawan hari ini."
                  : "Berikut status cuti dan izin Anda."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="bento-grid">
        {/* Left Column: Quick Actions & Recent Activities */}
        <div className="bento-col-2 flex flex-col gap-6">
          {/* Quick Actions */}
          <div className="grid grid-2 gap-6">
            <div className="card-outer">
              <div className="card-inner flex flex-col justify-between h-full" style={{ minHeight: "180px" }}>
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="card-title">Cuti & Izin</h3>
                    <CalendarOff size={24} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                  </div>
                  <p className="card-subtitle mb-4">
                    Ajukan cuti tahunan, sakit, pernikahan, melahirkan, khitan/baptis, duka cita, atau izin lainnya.
                  </p>
                </div>
                <a href="/cuti/new" className="btn btn-primary w-full">
                  Buat Pengajuan
                  <span className="btn-icon-circle">
                    <ArrowRight size={14} />
                  </span>
                </a>
              </div>
            </div>

            <div className="card-outer">
              <div className="card-inner flex flex-col justify-between h-full" style={{ minHeight: "180px" }}>
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="card-title">Kalender Bersama</h3>
                    <Calendar size={24} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                  </div>
                  <p className="card-subtitle mb-4">
                    Lihat jadwal cuti, sakit, dan izin karyawan lain secara real-time untuk koordinasi kerja.
                  </p>
                </div>
                <a href="/kalender" className="btn btn-accent w-full">
                  Buka Kalender
                  <span className="btn-icon-circle">
                    <ArrowRight size={14} />
                  </span>
                </a>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card-outer">
            <div className="card-inner">
              <div className="card-header">
                <h3 className="card-title">Aktivitas Pengajuan Terbaru</h3>
              </div>
              
              {recentActivities.length === 0 ? (
                <div className="empty-state">
                  <CalendarOff />
                  <div className="empty-state-title">Belum ada pengajuan</div>
                  <p>Semua aktivitas pengajuan cuti dan izin akan muncul di sini</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {recentActivities.map((act) => {
                    return (
                      <Link
                        key={act.id}
                        href={`/cuti/${act.id}`}
                        className="activity-row-link"
                      >
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <div className="stat-icon primary" style={{ width: 36, height: 36, borderRadius: "50%" }}>
                            <CalendarOff size={16} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 600 }}>
                              {isAdmin ? `${act.userName} — ` : ""}{act.title}
                            </span>
                            <span className="text-xs text-muted">Tanggal: {act.range}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span className={`badge badge-${act.status.toLowerCase()}`} style={{ fontSize: "10px" }}>
                            {act.status}
                          </span>
                          <div className="text-primary activity-arrow-icon" style={{ display: "flex", alignItems: "center" }}>
                            <ArrowRight size={14} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Key Metrics Stack */}
        <div className="bento-col-1 flex flex-col gap-4">
          {/* Stats 1 */}
          <div className="card-outer">
            <div className="card-inner" style={{ padding: "var(--space-4)" }}>
              <div className="flex items-center gap-4">
                <div className="stat-icon warning">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="stat-label">Menunggu Approval</div>
                  <div className="stat-value" style={{ fontSize: "var(--text-xl)" }}>{totalPending}</div>
                  <div className="stat-change">Perlu ditindaklanjuti</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats 2 */}
          <div className="card-outer">
            <div className="card-inner" style={{ padding: "var(--space-4)" }}>
              <div className="flex items-center gap-4">
                <div className="stat-icon success">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <div className="stat-label">Disetujui Bulan Ini</div>
                  <div className="stat-value" style={{ fontSize: "var(--text-xl)" }}>{totalApproved}</div>
                  <div className="stat-change">Bulan ini</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats 3 */}
          <div className="card-outer">
            <div className="card-inner" style={{ padding: "var(--space-4)" }}>
              <div className="flex items-center gap-4">
                <div className="stat-icon danger">
                  <XCircle size={20} />
                </div>
                <div>
                  <div className="stat-label">Ditolak Bulan Ini</div>
                  <div className="stat-value" style={{ fontSize: "var(--text-xl)" }}>{totalRejected}</div>
                  <div className="stat-change">Bulan ini</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats 4 (Dynamic: Total Employees for Admin, Quota for Karyawan) */}
          <div className="card-outer">
            <div className="card-inner" style={{ padding: "var(--space-4)" }}>
              {isAdmin ? (
                <div className="flex items-center gap-4">
                  <div className="stat-icon primary">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="stat-label">Total Karyawan Aktif</div>
                    <div className="stat-value" style={{ fontSize: "var(--text-xl)" }}>{totalEmployees}</div>
                    <div className="stat-change">Akun terdaftar aktif</div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <div className="stat-icon primary">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <div className="stat-label">Sisa Cuti Tahunan</div>
                      <div className="stat-value" style={{ fontSize: "var(--text-xl)" }}>{remainingCuti} Hari</div>
                    </div>
                  </div>
                  
                  {activeQuota && (
                    <div className="quota-bar-wrapper" style={{ marginTop: 2 }}>
                      <div className="quota-bar-track" style={{ height: "6px" }}>
                        <div
                          className={`quota-bar-fill ${remainingCuti <= 2 ? "danger" : remainingCuti <= 4 ? "warning" : ""}`}
                          style={{
                            width: `${accruedCuti > 0 ? (remainingCuti / accruedCuti) * 100 : 0}%`,
                            background: remainingCuti <= 2 ? "var(--color-danger)" : remainingCuti <= 4 ? "var(--color-warning)" : "var(--color-primary)",
                          }}
                        ></div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginTop: 4, color: "var(--color-text-muted)" }}>
                        <span>Terpakai: {usedCuti} hari {cutiBersamaCount > 0 && `(+ ${cutiBersamaCount} Cuti Bersama)`}</span>
                        <span>Sisa: {remainingCuti} / {accruedCuti} Hari (Maks: {activeQuota.totalDays} Hari)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
