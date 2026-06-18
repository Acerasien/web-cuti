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
      // Set to end of the day to capture leaves ending on this date
      endDate.setHours(23, 59, 59, 999);
      where.endDate = { lte: endDate };
    }
  }

  const leaves = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          department: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const getLeaveTypeLabel = (type: string): string => {
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
    "Jenis Cuti",
    "Tanggal Mulai",
    "Tanggal Selesai",
    "Total Hari",
    "Status",
    "Alasan",
    "Tanggal Pengajuan",
  ];

  const rows = leaves.map((leave) => [
    leave.id,
    leave.user.name,
    leave.user.email,
    leave.user.department || "-",
    getLeaveTypeLabel(leave.leaveType),
    leave.startDate.toISOString().substring(0, 10),
    leave.endDate.toISOString().substring(0, 10),
    leave.totalDays,
    leave.status,
    leave.reason,
    leave.createdAt.toISOString().substring(0, 10),
  ]);

  const csvContent =
    "\ufeff" + // UTF-8 BOM for Excel Excel compatibility
    [headers.join(","), ...rows.map((row) => row.map((val) => escapeCsv(String(val))).join(","))].join("\n");

  const response = new NextResponse(csvContent);
  response.headers.set("Content-Type", "text/csv; charset=utf-8");
  response.headers.set(
    "Content-Disposition",
    `attachment; filename="laporan_cuti_${new Date().toISOString().substring(0, 10)}.csv"`
  );

  return response;
}
