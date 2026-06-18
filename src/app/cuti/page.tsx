import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { CalendarOff, Plus, Eye } from "lucide-react";
import Link from "next/link";
import { ExportCsvPanel } from "@/components/features/reports/ExportCsvPanel";


function getLeaveTypeLabel(type: string): string {
  const map: Record<string, string> = {
    PERNIKAHAN_KARYAWAN: "Pernikahan Karyawan",
    PERNIKAHAN_ANAK: "Pernikahan Anak Kandung",
    KHITAN_BAPTIS: "Khitan / Baptis Anak Kandung",
    ISTRI_MELAHIRKAN: "Istri Melahirkan / Keguguran",
    KEMATIAN_KELUARGA: "Kematian Keluarga",
    KARYAWATI_MELAHIRKAN: "Karyawati Melahirkan",
    KARYAWATI_KEGUGURAN: "Karyawati Keguguran",
    SAKIT: "Sakit (Surat Dokter)",
  };
  return map[type] ?? type;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function LeaveListPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";

  // Fetch leave requests
  const leaves = await prisma.leaveRequest.findMany({
    where: isAdmin ? {} : { userId: session.user.id },
    include: {
      user: {
        select: {
          name: true,
          department: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PageWrapper title="Cuti Khusus & Sakit">
      <div className="flex flex-col gap-6">
        {/* Top Header Actions */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <p className="page-subtitle" style={{ margin: 0 }}>
              {isAdmin
                ? "Daftar pengajuan cuti khusus dan sakit seluruh karyawan."
                : "Daftar pengajuan cuti khusus dan sakit Anda."}
            </p>
          </div>
          <Link href="/cuti/new" className="btn btn-primary">
            <Plus size={16} />
            Ajukan Cuti
          </Link>
        </div>

        {isAdmin && <ExportCsvPanel type="cuti" />}

        {/* List Table */}
        <div className="card-outer">
          <div className="card-inner" style={{ padding: 0 }}>
            {leaves.length === 0 ? (
              <div className="empty-state">
                <CalendarOff />
                <div className="empty-state-title">Belum ada pengajuan cuti</div>
                <p>Silakan buat pengajuan cuti khusus atau sakit baru.</p>
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      {isAdmin && <th>Karyawan</th>}
                      <th>Jenis Cuti</th>
                      <th>Tanggal</th>
                      <th>Durasi</th>
                      <th>Status</th>
                      <th>Tanggal Pengajuan</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((leave) => (
                      <tr key={leave.id}>
                        {isAdmin && (
                          <td>
                            <div className="flex flex-col">
                              <span style={{ fontWeight: 600 }}>{leave.user.name}</span>
                              <span className="text-xs text-muted">
                                {leave.user.department || "No Dept"}
                              </span>
                            </div>
                          </td>
                        )}
                        <td>
                          <span style={{ fontWeight: 500 }}>{getLeaveTypeLabel(leave.leaveType)}</span>
                        </td>
                        <td>
                          <div className="flex flex-col text-sm">
                            <span>{formatDate(leave.startDate)}</span>
                            <span className="text-xs text-muted">s/d {formatDate(leave.endDate)}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{leave.totalDays} Hari</span>
                        </td>
                        <td>
                          <span className={`badge badge-${leave.status.toLowerCase()}`}>
                            {leave.status}
                          </span>
                        </td>
                        <td>
                          <span className="text-muted text-sm">{formatDate(leave.createdAt)}</span>
                        </td>
                        <td>
                          <Link href={`/cuti/${leave.id}`} className="btn btn-ghost btn-sm" style={{ padding: "0 8px", minHeight: 32, gap: 4 }}>
                            <Eye size={14} /> Detail
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
      </div>
    </PageWrapper>
  );
}
