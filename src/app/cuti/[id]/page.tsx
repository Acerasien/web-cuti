import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { LeaveReviewPanel } from "@/components/features/leave/LeaveReviewPanel";
import { Calendar, User, FileText, ArrowLeft, Download, CheckCircle, Clock, XCircle, Building, Mail } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "@/components/layout/PrintButton";
import { DownloadDocxButton } from "@/components/layout/DownloadDocxButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

function getLeaveTypeLabel(type: string): string {
  const map: Record<string, string> = {
    PERNIKAHAN_KARYAWAN: "Pernikahan Karyawan",
    PERNIKAHAN_ANAK: "Pernikahan Anak Kandung",
    KHITAN_BAPTIS: "Khitan / Baptis Anak Kandung",
    ISTRI_MELAHIRKAN: "Istri Melahirkan / Keguguran",
    KEMATIAN_KELUARGA: "Kematian Keluarga",
    KARYAWATI_MELAHIRKAN: "Karyawati Melahirkan",
    KARYAWATI_KEGUGURAN: "Karyawati Keguguran",
    SAKIT: "Sakit (Dengan Surat Dokter)",
  };
  return map[type] ?? type;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function LeaveDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  // Fetch leave details
  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          position: true,
          nik: true,
          username: true,
          level: true,
          lokasiKerja: true,
          namaAtasan: true,
          subCompany: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!leave) {
    notFound();
  }

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";

  // Access guard: Karyawan can only view their own leave requests
  if (!isAdmin && leave.userId !== session.user.id) {
    redirect("/cuti");
  }

  // Fetch reviewer details if reviewed
  let reviewerName = "";
  if (leave.reviewedById) {
    const reviewer = await prisma.user.findUnique({
      where: { id: leave.reviewedById },
      select: { name: true },
    });
    reviewerName = reviewer?.name ?? "";
  }

  const isSingle = leave.startDate.getTime() === leave.endDate.getTime();

  return (
    <PageWrapper title="Detail Pengajuan Cuti">
      {/* Screen-Only Container */}
      <div className="screen-only-container">
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Header Row: Back Link & Action Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <Link href="/cuti" className="btn btn-ghost btn-sm" style={{ display: "inline-flex", gap: 6 }}>
              <ArrowLeft size={16} /> Kembali ke Daftar
            </Link>
            <div style={{ display: "flex", gap: 8 }}>
              <PrintButton />
              <DownloadDocxButton type="leave" data={JSON.parse(JSON.stringify(leave))} reviewerName={reviewerName} />
            </div>
          </div>

          {/* Top Section: Employee Profile & Status Summary Card */}
          <div className="card-outer mb-6">
            <div className="card-inner" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
              {/* Employee info */}
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <div style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "var(--color-primary-light)",
                  color: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {leave.user.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                    {leave.user.name}
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "2px 0 6px 0", fontWeight: 500 }}>
                    {leave.user.position || "Staff"}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span className="badge badge-primary" style={{ fontSize: "10px", textTransform: "uppercase", padding: "2px 8px", fontWeight: 600 }}>
                      {leave.user.role === "SUPERADMIN" ? "Super Admin" : leave.user.role === "ADMIN" ? "Admin" : "Karyawan"}
                    </span>
                    <span style={{ color: "var(--color-border)", fontSize: "12px" }}>|</span>
                    <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 500 }}>
                      {leave.user.department || "—"}
                    </span>
                    <span style={{ color: "var(--color-border)", fontSize: "12px" }}>|</span>
                    <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 500 }}>
                      {leave.user.level || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status block */}
              <div style={{
                background: leave.status === "APPROVED" ? "var(--color-success-light)" : leave.status === "REJECTED" ? "var(--color-danger-light)" : "var(--color-warning-light)",
                border: leave.status === "APPROVED" ? "1px solid rgba(22, 163, 74, 0.15)" : leave.status === "REJECTED" ? "1px solid rgba(220, 38, 38, 0.15)" : "1px solid rgba(217, 119, 6, 0.15)",
                borderRadius: "var(--radius-md)",
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                minWidth: "260px"
              }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: leave.status === "APPROVED" ? "rgba(22, 163, 74, 0.1)" : leave.status === "REJECTED" ? "rgba(220, 38, 38, 0.1)" : "rgba(217, 119, 6, 0.1)",
                  color: leave.status === "APPROVED" ? "var(--color-success)" : leave.status === "REJECTED" ? "var(--color-danger)" : "var(--color-warning)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  {leave.status === "APPROVED" && <CheckCircle size={18} />}
                  {leave.status === "REJECTED" && <XCircle size={18} />}
                  {leave.status === "PENDING" && <Clock size={18} />}
                </div>
                <div>
                  <span className={`badge badge-${leave.status.toLowerCase()}`} style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", padding: "1px 6px", marginBottom: "4px" }}>
                    {leave.status}
                  </span>
                  <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>
                    {leave.status === "APPROVED" && <>Disetujui pada <strong>{formatDate(leave.reviewedAt || new Date())}</strong> oleh <strong>{reviewerName || "System"}</strong></>}
                    {leave.status === "REJECTED" && <>Ditolak pada <strong>{formatDate(leave.reviewedAt || new Date())}</strong> oleh <strong>{reviewerName || "System"}</strong></>}
                    {leave.status === "PENDING" && <>Menunggu peninjauan oleh HRD / Atasan</>}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-3 gap-6">
            {/* Column 1: Informasi Pengajuan */}
            <div style={{ gridColumn: "span 1" }} className="flex flex-col gap-6">
              <div className="card-outer" style={{ height: "100%" }}>
                <div className="card-inner" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--color-border)", paddingBottom: "12px" }}>
                    <div style={{ color: "var(--color-primary)" }}><FileText size={18} /></div>
                    <h3 className="card-title" style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Informasi Pengajuan</h3>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
                    <div>
                      <span className="text-muted" style={{ display: "block", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Jenis Cuti</span>
                      <span style={{ fontWeight: 700, color: "var(--color-accent)", fontSize: "14px" }}>
                        {getLeaveTypeLabel(leave.leaveType)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted" style={{ display: "block", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Durasi Cuti</span>
                      <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                        {leave.totalDays} Hari Kerja
                      </span>
                    </div>

                    <div>
                      <span className="text-muted" style={{ display: "block", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Rentang Tanggal</span>
                      <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                        {isSingle ? formatDate(leave.startDate) : `${formatDate(leave.startDate)} - ${formatDate(leave.endDate)}`}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted" style={{ display: "block", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Alasan / Penjelasan</span>
                      <div style={{
                        background: "var(--color-bg)",
                        padding: "10px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                        fontSize: "13px",
                        color: "var(--color-text)",
                        lineHeight: "1.5",
                        whiteSpace: "pre-line"
                      }}>
                        {leave.reason}
                      </div>
                    </div>


                    <div style={{ height: "1px", background: "var(--color-border)", margin: "4px 0" }} />

                    <div>
                      <span className="text-muted" style={{ display: "block", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Diajukan Pada</span>
                      <span style={{ fontWeight: 500, color: "var(--color-text)" }}>
                        {new Date(leave.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric"
                        })} {new Date(leave.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted" style={{ display: "block", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Diajukan Oleh</span>
                      <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                        {leave.user.username ? `@${leave.user.username}` : leave.user.name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Riwayat Persetujuan */}
            <div style={{ gridColumn: "span 1" }} className="flex flex-col gap-6">
              <div className="card-outer" style={{ height: "100%" }}>
                <div className="card-inner" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--color-border)", paddingBottom: "12px" }}>
                    <div style={{ color: "var(--color-primary)" }}><Clock size={18} /></div>
                    <h3 className="card-title" style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Riwayat Persetujuan</h3>
                  </div>

                  {/* Timeline Container */}
                  <div style={{ position: "relative", padding: "10px 0", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ position: "relative" }}>
                      {/* Vertical line connecting the steps */}
                      <div style={{
                        position: "absolute",
                        left: "15px",
                        top: "16px",
                        bottom: "16px",
                        width: "2px",
                        background: "var(--color-border)",
                        zIndex: 0
                      }} />

                      {/* Step 1: Diajukan */}
                      <div style={{ display: "flex", gap: "16px", position: "relative", zIndex: 1, marginBottom: "24px" }}>
                        <div style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: "var(--color-success-light)",
                          color: "var(--color-success)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          <CheckCircle size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>Diajukan</h4>
                          <p style={{ fontSize: "11px", color: "var(--color-text-light)", margin: "2px 0" }}>
                            {new Date(leave.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} {new Date(leave.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>
                            oleh {leave.user.name} ({leave.user.username ? `@${leave.user.username}` : "—"})
                          </p>
                        </div>
                      </div>

                      {/* Step 2: Ditinjau */}
                      <div style={{ display: "flex", gap: "16px", position: "relative", zIndex: 1, marginBottom: "24px" }}>
                        <div style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: leave.status !== "PENDING" ? "var(--color-primary-light)" : "var(--color-warning-light)",
                          color: leave.status !== "PENDING" ? "var(--color-primary)" : "var(--color-warning)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          <User size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>Ditinjau</h4>
                          <p style={{ fontSize: "11px", color: "var(--color-text-light)", margin: "2px 0" }}>
                            {leave.status !== "PENDING" && leave.reviewedAt
                              ? `${new Date(leave.reviewedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} ${new Date(leave.reviewedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                              : "Sedang diproses"
                            }
                          </p>
                          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>
                            oleh {reviewerName || "Atasan / HRD"}
                          </p>
                        </div>
                      </div>

                      {/* Step 3: Keputusan (Disetujui / Ditolak / Menunggu) */}
                      <div style={{ display: "flex", gap: "16px", position: "relative", zIndex: 1 }}>
                        <div style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: leave.status === "APPROVED" 
                            ? "var(--color-success-light)" 
                            : leave.status === "REJECTED" 
                              ? "var(--color-danger-light)" 
                              : "var(--color-border)",
                          color: leave.status === "APPROVED" 
                            ? "var(--color-success)" 
                            : leave.status === "REJECTED" 
                              ? "var(--color-danger)" 
                              : "var(--color-text-light)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          {leave.status === "APPROVED" && <CheckCircle size={16} />}
                          {leave.status === "REJECTED" && <XCircle size={16} />}
                          {leave.status === "PENDING" && <Clock size={16} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                            {leave.status === "APPROVED" ? "Disetujui" : leave.status === "REJECTED" ? "Ditolak" : "Persetujuan"}
                          </h4>
                          <p style={{ fontSize: "11px", color: "var(--color-text-light)", margin: "2px 0" }}>
                            {leave.status !== "PENDING" && leave.reviewedAt
                              ? `${new Date(leave.reviewedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} ${new Date(leave.reviewedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                              : "Menunggu keputusan"
                            }
                          </p>
                          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>
                            oleh {reviewerName || "Atasan / HRD"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Status Banner */}
                    <div style={{
                      marginTop: "24px",
                      background: leave.status === "APPROVED" 
                        ? "var(--color-success-light)" 
                        : leave.status === "REJECTED" 
                          ? "var(--color-danger-light)" 
                          : "var(--color-warning-light)",
                      border: leave.status === "APPROVED" 
                        ? "1px solid rgba(22, 163, 74, 0.15)" 
                        : leave.status === "REJECTED" 
                          ? "1px solid rgba(220, 38, 38, 0.15)" 
                          : "1px solid rgba(217, 119, 6, 0.15)",
                      borderRadius: "var(--radius-md)",
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: leave.status === "APPROVED" 
                        ? "var(--color-success)" 
                        : leave.status === "REJECTED" 
                          ? "var(--color-danger)" 
                          : "var(--color-warning)"
                    }}>
                      {leave.status === "APPROVED" && <CheckCircle size={14} />}
                      {leave.status === "REJECTED" && <XCircle size={14} />}
                      {leave.status === "PENDING" && <Clock size={14} />}
                      <span>
                        {leave.status === "APPROVED" && "Permohonan cuti ini telah disetujui."}
                        {leave.status === "REJECTED" && "Permohonan cuti ini telah ditolak."}
                        {leave.status === "PENDING" && "Permohonan cuti sedang dalam proses."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Dokumen Pendukung */}
            <div style={{ gridColumn: "span 1" }} className="flex flex-col gap-6">
              <div className="card-outer" style={{ height: "100%" }}>
                <div className="card-inner" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--color-border)", paddingBottom: "12px" }}>
                    <div style={{ color: "var(--color-primary)" }}><FileText size={18} /></div>
                    <h3 className="card-title" style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Dokumen Pendukung</h3>
                  </div>

                  {leave.attachmentUrl ? (() => {
                    const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(leave.attachmentUrl);
                    const isPdf = /\.pdf$/i.test(leave.attachmentUrl);

                    if (isImage) {
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
                          <div style={{
                            position: "relative",
                            background: "#F8FAFC",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-md)",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "320px",
                            flex: 1
                          }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={leave.attachmentUrl}
                              alt="Pratinjau Dokumen Pendukung"
                              style={{
                                maxWidth: "100%",
                                maxHeight: "400px",
                                objectFit: "contain",
                                borderRadius: "var(--radius-sm)"
                              }}
                            />
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <a
                              href={leave.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline btn-sm"
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                            >
                              Buka di Tab Baru
                            </a>
                            <a
                              href={leave.attachmentUrl}
                              download
                              className="btn btn-primary btn-sm"
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                            >
                              <Download size={14} /> Unduh
                            </a>
                          </div>
                        </div>
                      );
                    }

                    if (isPdf) {
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
                          <div style={{
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-md)",
                            overflow: "hidden",
                            flex: 1,
                            minHeight: "400px",
                            background: "#F8FAFC"
                          }}>
                            <iframe
                              src={leave.attachmentUrl}
                              title="Pratinjau PDF"
                              style={{
                                width: "100%",
                                height: "100%",
                                border: "none",
                                minHeight: "400px"
                              }}
                            />
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <a
                              href={leave.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline btn-sm"
                              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                            >
                              Buka di Tab Baru
                            </a>
                            <a
                              href={leave.attachmentUrl}
                              download
                              className="btn btn-primary btn-sm"
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                            >
                              <Download size={14} /> Unduh
                            </a>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        minHeight: "300px",
                        border: "1px dashed var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "24px",
                        textAlign: "center",
                        gap: "16px"
                      }}>
                        <div style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          background: "var(--color-primary-light)",
                          color: "var(--color-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          <FileText size={24} />
                        </div>
                        <div>
                          <h4 style={{ fontWeight: 600, color: "var(--color-text)", margin: "0 0 4px 0" }}>Unduh Dokumen</h4>
                          <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: 0 }}>
                            Format file ini tidak dapat ditampilkan secara langsung.
                          </p>
                        </div>
                        <a
                          href={leave.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-sm"
                          style={{ width: "100%", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
                        >
                          <Download size={14} /> Unduh File Lampiran
                        </a>
                      </div>
                    );
                  })() : (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      minHeight: "350px",
                      border: "2px dashed rgba(148, 163, 184, 0.15)",
                      borderRadius: "var(--radius-lg)",
                      padding: "32px 24px",
                      textAlign: "center",
                      gap: "16px",
                      background: "rgba(248, 250, 252, 0.5)"
                    }}>
                      <div style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "50%",
                        background: "#F1F5F9",
                        color: "#94A3B8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <FileText size={28} />
                      </div>
                      <div style={{ maxWidth: "240px" }}>
                        <h4 style={{ fontWeight: 700, color: "#475569", margin: "0 0 6px 0", fontSize: "14px" }}>
                          Tidak Ada Dokumen
                        </h4>
                        <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0, lineHeight: "1.6" }}>
                          Karyawan tidak melampirkan dokumen pendukung pada pengajuan ini.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Approval Action Trigger Panel */}
          {leave.status === "PENDING" && isAdmin && (
            <div style={{ marginTop: "24px" }}>
              <LeaveReviewPanel requestId={leave.id} />
            </div>
          )}
        </div>
      </div>

      {/* Print-Only Document */}
      <div className="print-only-container">
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Form Pengajuan Cuti Karyawan</h2>
          <p style={{ fontSize: "12px", color: "#666", marginTop: "4px", margin: 0 }}>Sistem Manajemen Cuti & Izin — Web Cuti</p>
          <hr style={{ border: "0", borderTop: "2px double #333", marginTop: "12px", marginBottom: "20px" }} />
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ textAlign: "left", fontSize: "14px", borderBottom: "1px solid #333", paddingBottom: "6px", textTransform: "uppercase", fontWeight: 700 }}>Data Karyawan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ width: "30%", padding: "8px 0", fontSize: "14px" }}>Nama Lengkap</td>
              <td style={{ padding: "8px 0", fontSize: "14px", fontWeight: 600 }}>: {leave.user.name}</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", fontSize: "14px" }}>Jabatan / Posisi</td>
              <td style={{ padding: "8px 0", fontSize: "14px" }}>: {leave.user.position || "—"}</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", fontSize: "14px" }}>Departemen</td>
              <td style={{ padding: "8px 0", fontSize: "14px" }}>: {leave.user.department || "—"}</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", fontSize: "14px" }}>Email</td>
              <td style={{ padding: "8px 0", fontSize: "14px" }}>: {leave.user.email || "—"}</td>
            </tr>
          </tbody>
        </table>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ textAlign: "left", fontSize: "14px", borderBottom: "1px solid #333", paddingBottom: "6px", textTransform: "uppercase", fontWeight: 700 }}>Detail Pengajuan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ width: "30%", padding: "8px 0", fontSize: "14px" }}>Jenis Cuti</td>
              <td style={{ padding: "8px 0", fontSize: "14px", fontWeight: 600 }}>: {getLeaveTypeLabel(leave.leaveType)}</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", fontSize: "14px" }}>Tanggal Cuti</td>
              <td style={{ padding: "8px 0", fontSize: "14px" }}>
                : {formatDate(leave.startDate)} s/d {formatDate(leave.endDate)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", fontSize: "14px" }}>Durasi Cuti</td>
              <td style={{ padding: "8px 0", fontSize: "14px" }}>: {leave.totalDays} Hari Kerja</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", fontSize: "14px", verticalAlign: "top" }}>Alasan / Penjelasan</td>
              <td style={{ padding: "8px 0", fontSize: "14px", whiteSpace: "pre-wrap" }}>: {leave.reason}</td>
            </tr>
          </tbody>
        </table>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ textAlign: "left", fontSize: "14px", borderBottom: "1px solid #333", paddingBottom: "6px", textTransform: "uppercase", fontWeight: 700 }}>Status Approval</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ width: "30%", padding: "8px 0", fontSize: "14px" }}>Status Pengajuan</td>
              <td style={{ padding: "8px 0", fontSize: "14px", fontWeight: 600 }}>: {leave.status}</td>
            </tr>
            {leave.status !== "PENDING" && (
              <>
                <tr>
                  <td style={{ padding: "8px 0", fontSize: "14px" }}>Diproses Oleh</td>
                  <td style={{ padding: "8px 0", fontSize: "14px" }}>: {reviewerName || "System"}</td>
                </tr>
                {leave.reviewedAt && (
                  <tr>
                    <td style={{ padding: "8px 0", fontSize: "14px" }}>Waktu Proses</td>
                    <td style={{ padding: "8px 0", fontSize: "14px" }}>: {formatDate(leave.reviewedAt)}</td>
                  </tr>
                )}
                {leave.rejectionNote && (
                  <tr>
                    <td style={{ padding: "8px 0", fontSize: "14px" }}>Catatan Penolakan</td>
                    <td style={{ padding: "8px 0", fontSize: "14px", color: "red" }}>: {leave.rejectionNote}</td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "60px" }}>
          <div style={{ textAlign: "center", width: "40%" }}>
            <p style={{ fontSize: "14px", marginBottom: "60px", margin: "0 0 60px 0" }}>Yang Mengajukan,</p>
            <p style={{ fontSize: "14px", fontWeight: 600, textDecoration: "underline", margin: 0 }}>{leave.user.name}</p>
            <p style={{ fontSize: "12px", color: "#666", marginTop: "4px", margin: "4px 0 0 0" }}>Karyawan</p>
          </div>
          <div style={{ textAlign: "center", width: "40%" }}>
            <p style={{ fontSize: "14px", marginBottom: "60px", margin: "0 0 60px 0" }}>Menyetujui / Mengetahui,</p>
            <p style={{ fontSize: "14px", fontWeight: 600, textDecoration: "underline", margin: 0 }}>{reviewerName || "( _____________________ )"}</p>
            <p style={{ fontSize: "12px", color: "#666", marginTop: "4px", margin: "4px 0 0 0" }}>HRD / Atasan</p>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

