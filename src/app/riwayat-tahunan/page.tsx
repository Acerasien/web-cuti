import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { RiwayatTahunanClient } from "./RiwayatTahunanClient";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

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
    IZIN_LAINNYA: "Izin Lainnya",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

const PAGE_SIZE = 20;

export default async function RiwayatTahunanPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const resolvedParams = await searchParams;

  const currentYear = new Date().getFullYear();
  const yearParam = resolvedParams.year as string | undefined;
  const selectedYear = yearParam ? parseInt(yearParam, 10) : currentYear;

  const userIdParam = resolvedParams.userId as string | undefined;
  const leaveTypeParam = resolvedParams.leaveType as string | undefined;
  const statusParam = resolvedParams.status as string | undefined;
  const pageParam = resolvedParams.page as string | undefined;
  const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

  // --- Fetch distinct years that have leave segments ---
  const allSegments = await prisma.leaveSegment.findMany({
    select: { startDate: true },
  });
  const yearSet = new Set<number>();
  allSegments.forEach((s) => yearSet.add(new Date(s.startDate).getFullYear()));
  yearSet.add(currentYear); // always include current year
  const availableYears = Array.from(yearSet).sort((a, b) => b - a);

  // --- Build date range for selected year ---
  const yearStart = new Date(selectedYear, 0, 1);
  const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);

  // --- Build Prisma where clause ---
  const whereClause: any = {
    segments: {
      some: {
        startDate: { gte: yearStart, lte: yearEnd },
        ...(leaveTypeParam && leaveTypeParam !== "ALL"
          ? { leaveType: leaveTypeParam as any }
          : {}),
      },
    },
    ...(userIdParam && userIdParam !== "ALL" ? { userId: userIdParam } : {}),
    ...(statusParam && statusParam !== "ALL" ? { status: statusParam as any } : {}),
  };

  // --- Count total for pagination ---
  const totalCount = await prisma.leaveRequest.count({ where: whereClause });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  // --- Fetch paginated requests ---
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, name: true, nik: true } },
      segments: {
        where: {
          startDate: { gte: yearStart, lte: yearEnd },
          ...(leaveTypeParam && leaveTypeParam !== "ALL"
            ? { leaveType: leaveTypeParam as any }
            : {}),
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // --- Compute approved days total ---
  const allApprovedForYear = await prisma.leaveSegment.aggregate({
    _sum: { totalDays: true },
    where: {
      startDate: { gte: yearStart, lte: yearEnd },
      leaveRequest: { status: "APPROVED" },
      ...(userIdParam && userIdParam !== "ALL"
        ? { leaveRequest: { status: "APPROVED", userId: userIdParam } }
        : {}),
    },
  });
  const totalApprovedDays = Number(allApprovedForYear._sum.totalDays || 0);

  // --- Map requests to display rows ---
  const rows = leaveRequests.map((req) => {
    const startDates = req.segments.map((s) => new Date(s.startDate).getTime());
    const endDates = req.segments.map((s) => new Date(s.endDate).getTime());
    const earliest = startDates.length > 0 ? new Date(Math.min(...startDates)) : null;
    const latest = endDates.length > 0 ? new Date(Math.max(...endDates)) : null;
    const totalDays = req.segments.reduce((sum, s) => sum + Number(s.totalDays || 0), 0);
    const types = Array.from(new Set(req.segments.map((s) => s.leaveType)))
      .map((t) => getLeaveTypeLabel(t))
      .join(", ");

    const periodStr =
      earliest && latest
        ? `${earliest.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} s/d ${latest.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
        : "—";

    return {
      id: req.id,
      nik: req.user.nik ?? "—",
      employeeName: req.user.name,
      types,
      periodStr,
      totalDays,
      status: req.status,
    };
  });

  // --- All employees for filter dropdown ---
  const employees = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, nik: true },
    orderBy: { name: "asc" },
  });

  return (
    <PageWrapper title="Riwayat Cuti & Izin Tahunan">
      <RiwayatTahunanClient
        rows={rows}
        employees={employees.map((e) => ({ id: e.id, name: e.name, nik: e.nik ?? "" }))}
        availableYears={availableYears}
        selectedYear={selectedYear}
        selectedUserId={userIdParam ?? "ALL"}
        selectedLeaveType={leaveTypeParam ?? "ALL"}
        selectedStatus={statusParam ?? "ALL"}
        currentPage={safePage}
        totalPages={totalPages}
        totalCount={totalCount}
        totalApprovedDays={totalApprovedDays}
      />
    </PageWrapper>
  );
}
