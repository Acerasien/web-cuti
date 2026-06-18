import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ClipboardList, Plus, Eye } from "lucide-react";
import Link from "next/link";
import { ExportCsvPanel } from "@/components/features/reports/ExportCsvPanel";


function getExcuseTypeLabel(type: string): string {
  const map: Record<string, string> = {
    TIDAK_ABSEN_MASUK: "Tidak Absen Masuk",
    TIDAK_ABSEN_PULANG: "Tidak Absen Pulang",
    DATANG_TERLAMBAT: "Datang Terlambat / Pulang Awal",
    CUTI_TAHUNAN: "Cuti Tahunan",
    IZIN_LAINNYA: "Izin Lainnya",
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

export default async function ExcuseListPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";

  // Fetch excuse requests
  const excuses = await prisma.excuseRequest.findMany({
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
    <PageWrapper title="Izin & Keterangan">
      <div className="flex flex-col gap-6">
        {/* Top Header Actions */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <p className="page-subtitle" style={{ margin: 0 }}>
              {isAdmin
                ? "Daftar pengajuan izin dan keterangan seluruh karyawan."
                : "Daftar pengajuan izin dan keterangan Anda."}
            </p>
          </div>
          <Link href="/izin/new" className="btn btn-accent">
            <Plus size={16} />
            Ajukan Izin
          </Link>
        </div>

        {isAdmin && <ExportCsvPanel type="izin" />}

        {/* List Table */}
        <div className="card-outer">
          <div className="card-inner" style={{ padding: 0 }}>
            {excuses.length === 0 ? (
              <div className="empty-state">
                <ClipboardList />
                <div className="empty-state-title">Belum ada pengajuan izin</div>
                <p>Silakan buat pengajuan izin atau keterangan baru.</p>
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      {isAdmin && <th>Karyawan</th>}
                      <th>Jenis Izin</th>
                      <th>Tanggal Kejadian</th>
                      <th>Durasi</th>
                      <th>Status</th>
                      <th>Tanggal Pengajuan</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excuses.map((excuse) => {
                      const isSingle = excuse.dateFrom.getTime() === excuse.dateTo.getTime();
                      return (
                        <tr key={excuse.id}>
                          {isAdmin && (
                            <td>
                              <div className="flex flex-col">
                                <span style={{ fontWeight: 600 }}>{excuse.user.name}</span>
                                <span className="text-xs text-muted">
                                  {excuse.user.department || "No Dept"}
                                </span>
                              </div>
                            </td>
                          )}
                          <td>
                            <span style={{ fontWeight: 500 }}>{getExcuseTypeLabel(excuse.excuseType)}</span>
                          </td>
                          <td>
                            {isSingle ? (
                              <span className="text-sm">{formatDate(excuse.dateFrom)}</span>
                            ) : (
                              <div className="flex flex-col text-sm">
                                <span>{formatDate(excuse.dateFrom)}</span>
                                <span className="text-xs text-muted">s/d {formatDate(excuse.dateTo)}</span>
                              </div>
                            )}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{Number(excuse.totalDays || 0)} Hari</span>
                          </td>
                          <td>
                            <span className={`badge badge-${excuse.status.toLowerCase()}`}>
                              {excuse.status}
                            </span>
                          </td>
                          <td>
                            <span className="text-muted text-sm">{formatDate(excuse.createdAt)}</span>
                          </td>
                          <td>
                            <Link href={`/izin/${excuse.id}`} className="btn btn-ghost btn-sm" style={{ padding: "0 8px", minHeight: 32, gap: 4 }}>
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
      </div>
    </PageWrapper>
  );
}
