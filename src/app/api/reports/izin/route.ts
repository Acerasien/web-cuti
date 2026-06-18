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
      where.dateFrom = { gte: startDate };
    }
  }
  if (end) {
    const endDate = new Date(end);
    if (!isNaN(endDate.getTime())) {
      // Set to end of the day to capture excuses ending on this date
      endDate.setHours(23, 59, 59, 999);
      where.dateTo = { lte: endDate };
    }
  }

  const excuses = await prisma.excuseRequest.findMany({
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

  const getExcuseTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      TIDAK_ABSEN_MASUK: "Tidak Absen Masuk",
      TIDAK_ABSEN_PULANG: "Tidak Absen Pulang",
      DATANG_TERLAMBAT: "Datang Terlambat / Pulang Awal",
      CUTI_TAHUNAN: "Cuti Tahunan",
      IZIN_LAINNYA: "Izin Lainnya",
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
    "Jenis Izin",
    "Tanggal Mulai / Kejadian",
    "Tanggal Selesai",
    "Total Hari",
    "Status",
    "Alasan",
    "Tanggal Pengajuan",
  ];

  const rows = excuses.map((excuse) => [
    excuse.id,
    excuse.user.name,
    excuse.user.email,
    excuse.user.department || "-",
    getExcuseTypeLabel(excuse.excuseType),
    excuse.dateFrom.toISOString().substring(0, 10),
    excuse.dateTo.toISOString().substring(0, 10),
    Number(excuse.totalDays || 0),
    excuse.status,
    excuse.reason,
    excuse.createdAt.toISOString().substring(0, 10),
  ]);

  const csvContent =
    "\ufeff" + // UTF-8 BOM for Excel compatibility
    [headers.join(","), ...rows.map((row) => row.map((val) => escapeCsv(String(val))).join(","))].join("\n");

  const response = new NextResponse(csvContent);
  response.headers.set("Content-Type", "text/csv; charset=utf-8");
  response.headers.set(
    "Content-Disposition",
    `attachment; filename="laporan_izin_${new Date().toISOString().substring(0, 10)}.csv"`
  );

  return response;
}
