import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  }

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";
  if (!isAdmin) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const where: any = {};

  if (start) {
    const startDate = new Date(start);
    if (!isNaN(startDate.getTime())) {
      where.startDate = { gte: startDate };
    }
  }
  if (end) {
    const endDate = new Date(end);
    if (!isNaN(endDate.getTime())) {
      endDate.setHours(23, 59, 59, 999);
      where.endDate = { lte: endDate };
    }
  }

  const segments = await prisma.leaveSegment.findMany({
    where,
    include: {
      leaveRequest: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              department: true,
            },
          },
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  const getLeaveTypeLabel = (type: string): string => {
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
  };

  const escapeCsv = (str: string | null | undefined) => {
    if (!str) return '""';
    return `"${str.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  };

  // CSV Generation
  const headers = [
    "ID Pengajuan",
    "Nama Karyawan",
    "Email",
    "Departemen",
    "Jenis Cuti/Izin",
    "Tanggal Mulai",
    "Tanggal Selesai",
    "Total Hari",
    "Status Approval",
    "Alasan",
    "Tanggal Pengajuan",
  ];

  const rows = segments.map((seg) => [
    seg.leaveRequest.id,
    seg.leaveRequest.user.name,
    seg.leaveRequest.user.email,
    seg.leaveRequest.user.department || "-",
    getLeaveTypeLabel(seg.leaveType),
    seg.startDate.toISOString().substring(0, 10),
    seg.endDate.toISOString().substring(0, 10),
    Number(seg.totalDays),
    seg.leaveRequest.status,
    seg.leaveRequest.reason,
    seg.leaveRequest.createdAt.toISOString().substring(0, 10),
  ]);

  const csvContent =
    "\ufeff" + // UTF-8 BOM for Excel compatibility
    [headers.join(","), ...rows.map((row) => row.map((val) => escapeCsv(String(val))).join(","))].join("\n");

  const response = new NextResponse(csvContent);
  response.headers.set("Content-Type", "text/csv; charset=utf-8");
  response.headers.set(
    "Content-Disposition",
    `attachment; filename="laporan_cuti_izin_${new Date().toISOString().substring(0, 10)}.csv"`
  );

  return response;
}
