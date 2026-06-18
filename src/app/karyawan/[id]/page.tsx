import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccruedQuotaDays } from "@/lib/accrual";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { KaryawanForm } from "@/components/features/karyawan/KaryawanForm";
import { KaryawanQuotaPanel } from "@/components/features/karyawan/KaryawanQuotaPanel";
import { User, Calendar, Settings, Shield, Edit2, CalendarOff, ClipboardList, CheckCircle, Clock, XCircle, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    SUPERADMIN: "Super Admin",
    ADMIN: "Admin HR",
    KARYAWAN: "Karyawan",
  };
  return map[role] ?? role;
}

export default async function KaryawanDetailPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const isEditing = resolvedSearchParams.edit === "true";

  // Fetch employee details, quotas, history, and sub-company
  const employee = await prisma.user.findUnique({
    where: { id },
    include: {
      annualQuotas: {
        orderBy: { cycleStart: "desc" },
      },
      leaveRequests: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      excuseRequests: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      subCompany: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!employee) {
    notFound();
  }

  const subCompanies = await prisma.subCompany.findMany({
    orderBy: { name: "asc" },
  });

  if (isEditing) {
    return (
      <PageWrapper title={`Ubah Karyawan - ${employee.name}`}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <KaryawanForm
            initialData={{
              id: employee.id,
              name: employee.name,
              email: employee.email,
              username: employee.username,
              role: employee.role,
              nik: employee.nik,
              level: employee.level,
              department: employee.department,
              position: employee.position,
              lokasiKerja: employee.lokasiKerja,
              namaAtasan: employee.namaAtasan,
              subCompanyId: employee.subCompanyId,
              joinDate: employee.joinDate.toISOString(),
              isActive: employee.isActive,
            }}
            subCompanies={subCompanies.map((sc) => ({ id: sc.id, name: sc.name }))}
          />
        </div>
      </PageWrapper>
    );
  }

  const now = new Date();

  // Quotas calculations
  const quotaHistory = employee.annualQuotas.map((quota) => {
    // Sum approved cuti tahunan for this cycle
    const cycleApproved = employee.excuseRequests
      .filter((r) => r.excuseType === "CUTI_TAHUNAN" && r.annualQuotaId === quota.id && r.status === "APPROVED")
      .reduce((sum, r) => sum + Number(r.totalDays || 0), 0);

    const accrued = getAccruedQuotaDays(quota.cycleStart, quota.totalDays, now);
    const remaining = Math.max(0, accrued - cycleApproved);
    const isExpired = quota.cycleEnd < now;

    return {
      ...quota,
      accrued,
      used: cycleApproved,
      remaining,
      isExpired,
    };
  });

  const activeQuota = quotaHistory.find((q) => q.cycleStart <= now && q.cycleEnd >= now) || quotaHistory[0];

  return (
    <PageWrapper title="Profil Karyawan">
      <div style={{ maxWidth: "1000px", margin: "0 auto" }} className="flex flex-col gap-6">
        {/* Back Link */}
        <Link href="/karyawan" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", gap: 6 }}>
          <ArrowLeft size={16} /> Kembali ke Daftar
        </Link>

        <div className="grid grid-3 gap-6">
          {/* Left Block: Profile Info & Request History (Spans 2 columns) */}
          <div style={{ gridColumn: "span 2" }} className="flex flex-col gap-6">
            {/* Profile Detail */}
            <div className="card-outer">
              <div className="card-inner">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="sidebar-avatar" style={{ width: 56, height: 56, fontSize: "var(--text-lg)" }}>
                      {employee.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                    </div>
                    <div>
                      <h2 className="card-title" style={{ fontSize: "var(--text-xl)", margin: 0 }}>{employee.name}</h2>
                      <p className="text-xs text-muted" style={{ marginTop: "2px" }}>{employee.position || "Staff"} • {employee.department || "No Dept"}</p>
                    </div>
                  </div>
                  <Link href={`/karyawan/${employee.id}?edit=true`} className="btn btn-outline btn-sm" style={{ gap: 6 }}>
                    <Edit2 size={14} /> Edit Profil
                  </Link>
                </div>

                <div className="grid grid-2 gap-4 text-sm" style={{ marginTop: 12 }}>
                  <div>
                    <span className="text-muted text-xs" style={{ display: "block", marginBottom: 4 }}>NIK</span>
                    <span style={{ fontWeight: 600 }}>{employee.nik || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ display: "block", marginBottom: 4 }}>Username</span>
                    <span style={{ fontWeight: 600 }}>{employee.username ? `@${employee.username}` : "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ display: "block", marginBottom: 4 }}>Email Perusahaan</span>
                    <span style={{ fontWeight: 600 }}>{employee.email || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ display: "block", marginBottom: 4 }}>Akses System (Role)</span>
                    <span style={{ fontWeight: 600 }}>{getRoleLabel(employee.role)}</span>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ display: "block", marginBottom: 4 }}>Level Karyawan</span>
                    <span style={{ fontWeight: 600 }}>{employee.level || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ display: "block", marginBottom: 4 }}>Unit Bisnis (Sub-Company)</span>
                    <span style={{ fontWeight: 600 }}>{employee.subCompany?.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ display: "block", marginBottom: 4 }}>Lokasi Kerja</span>
                    <span style={{ fontWeight: 600 }}>{employee.lokasiKerja || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ display: "block", marginBottom: 4 }}>Nama Atasan Langsung</span>
                    <span style={{ fontWeight: 600 }}>{employee.namaAtasan || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ display: "block", marginBottom: 4 }}>Tanggal Bergabung</span>
                    <span style={{ fontWeight: 600 }}>{formatDate(employee.joinDate)}</span>
                  </div>
                  <div>
                    <span className="text-muted text-xs" style={{ display: "block", marginBottom: 4 }}>Status Akun</span>
                    <span className={`badge ${employee.isActive ? "badge-approved" : "badge-rejected"}`}>
                      {employee.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Request History */}
            <div className="card-outer">
              <div className="card-inner">
                <h3 className="card-title mb-4">Pengajuan Cuti Khusus & Sakit Terbaru</h3>
                {employee.leaveRequests.length === 0 ? (
                  <p className="text-muted text-sm">Belum ada riwayat pengajuan cuti khusus.</p>
                ) : (
                  <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                    <table className="table" style={{ fontSize: "var(--text-xs)" }}>
                      <thead>
                        <tr>
                          <th>Jenis Cuti</th>
                          <th>Tanggal</th>
                          <th>Durasi</th>
                          <th>Status</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employee.leaveRequests.map((req) => (
                          <tr key={req.id}>
                            <td>{req.leaveType.replace(/_/g, " ")}</td>
                            <td>{formatDate(req.startDate)}</td>
                            <td>{req.totalDays} Hari</td>
                            <td><span className={`badge badge-${req.status.toLowerCase()}`}>{req.status}</span></td>
                            <td><Link href={`/cuti/${req.id}`} className="text-primary font-semibold">Lihat</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="card-outer">
              <div className="card-inner">
                <h3 className="card-title mb-4">Pengajuan Izin & Keterangan Terbaru</h3>
                {employee.excuseRequests.length === 0 ? (
                  <p className="text-muted text-sm">Belum ada riwayat pengajuan izin.</p>
                ) : (
                  <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                    <table className="table" style={{ fontSize: "var(--text-xs)" }}>
                      <thead>
                        <tr>
                          <th>Jenis Izin</th>
                          <th>Tanggal Kejadian</th>
                          <th>Durasi</th>
                          <th>Status</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employee.excuseRequests.map((req) => (
                          <tr key={req.id}>
                            <td>{req.excuseType.replace(/_/g, " ")}</td>
                            <td>{formatDate(req.dateFrom)}</td>
                            <td>{Number(req.totalDays || 0)} Hari</td>
                            <td><span className={`badge badge-${req.status.toLowerCase()}`}>{req.status}</span></td>
                            <td><Link href={`/izin/${req.id}`} className="text-primary font-semibold">Lihat</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Block: Quota Balance Info & Quota Settings (Spans 1 column) */}
          <div style={{ gridColumn: "span 1" }} className="flex flex-col gap-6">
            {/* Active Quota summary */}
            <div className="card-outer">
              <div className="card-inner">
                <h3 className="card-title mb-4">Kuota Cuti Tahunan</h3>
                {activeQuota ? (
                  <div className="flex flex-col gap-3">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                      <div>
                        <span className="text-muted text-xs" title="Maksimum jatah per tahun">Maks:</span>
                        <p style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>{activeQuota.totalDays} H</p>
                      </div>
                      <div>
                        <span className="text-muted text-xs" title="Jumlah jatah cuti yang terkumpul hingga saat ini">Akrual:</span>
                        <p style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>{activeQuota.accrued} H</p>
                      </div>
                      <div>
                        <span className="text-muted text-xs" title="Sudah terpakai">Dipakai:</span>
                        <p style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>{activeQuota.used} H</p>
                      </div>
                      <div>
                        <span className="text-muted text-xs" title="Sisa dari jatah yang terkumpul">Sisa:</span>
                        <p style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--color-primary)" }}>{activeQuota.remaining} H</p>
                      </div>
                    </div>
                    <div className="divider" style={{ margin: "4px 0" }} />
                    <div style={{ fontSize: "11px", opacity: 0.8 }}>
                      Siklus Aktif:<br />
                      {formatDate(activeQuota.cycleStart)} s/d {formatDate(activeQuota.cycleEnd)}
                      {activeQuota.isExpired && <span style={{ color: "var(--color-danger)", fontWeight: 700, marginLeft: 4 }}>(Expired)</span>}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted text-sm">Belum ada kuota aktif dikonfigurasi.</p>
                )}
              </div>
            </div>

            {/* Quota Cycle History */}
            <div className="card-outer">
              <div className="card-inner">
                <h3 className="card-title mb-4">Riwayat Siklus Kuota</h3>
                {quotaHistory.length === 0 ? (
                  <p className="text-muted text-sm">Belum ada riwayat kuota.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {quotaHistory.map((q) => (
                      <div key={q.id} style={{ display: "flex", justifyContent: "between", alignItems: "start", borderBottom: "1px solid var(--color-border)", paddingBottom: 8, fontSize: "11px" }} className="justify-between">
                        <div className="flex flex-col">
                          <span style={{ fontWeight: 600 }}>{formatDate(q.cycleStart)}</span>
                          <span className="text-muted">s/d {formatDate(q.cycleEnd)}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 700, fontSize: "12px", color: q.isExpired ? "inherit" : "var(--color-primary)" }}>
                            Akrual: {q.accrued} / {q.totalDays} H
                          </span>
                          <br />
                          <span className="text-muted">Sisa: {q.remaining} H</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Edit Quota trigger */}
            {isAdmin && (
              <KaryawanQuotaPanel userId={employee.id} defaultCycleStart={employee.joinDate.toISOString()} />
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
