import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { KaryawanListClient } from "./KaryawanListClient";
import { getAccruedQuotaDays } from "@/lib/accrual";

export const metadata = {
  title: "Data Karyawan — Web Cuti",
  description: "Daftar dan Manajemen Profil Karyawan",
};

export default async function KaryawanListPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Fetch all sub-companies (Unit Bisnis)
  const subCompanies = await prisma.subCompany.findMany({
    orderBy: { name: "asc" },
  });

  // Fetch all users with their quotas, sub-company, and approved leave segments
  const users = await prisma.user.findMany({
    where: { role: "KARYAWAN" },
    include: {
      subCompany: {
        select: {
          name: true,
        },
      },
      annualQuotas: {
        orderBy: { cycleStart: "desc" },
      },
      leaveRequests: {
        where: {
          status: "APPROVED",
        },
        include: {
          segments: {
            where: {
              leaveType: "CUTI_TAHUNAN",
            },
            select: {
              annualQuotaId: true,
              totalDays: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();

  // Fetch Cuti Bersama holidays once to avoid N+1 query issue
  const cutiBersamaHolidays = await prisma.holiday.findMany({
    where: { isCutiBersama: true },
    select: { date: true },
  });

  const employeeData = users.map((user) => {
    // Find active quota covering today, or fallback to latest
    let activeQuota = user.annualQuotas.find(
      (q) => q.cycleStart <= now && q.cycleEnd >= now
    );
    if (!activeQuota && user.annualQuotas.length > 0) {
      activeQuota = user.annualQuotas[0];
    }

    let quotaText = "Belum diset";
    let balanceText = "—";

    if (activeQuota) {
      const cycleApproved = user.leaveRequests
        .flatMap((r) => r.segments)
        .filter((seg) => seg.annualQuotaId === activeQuota.id)
        .reduce((sum, seg) => sum + Number(seg.totalDays || 0), 0);

      const cycleCutiBersama = cutiBersamaHolidays.filter(
        (h) => h.date >= activeQuota.cycleStart && h.date <= now
      ).length;

      const accrued = getAccruedQuotaDays(activeQuota.cycleStart, activeQuota.totalDays, now);
      const remaining = Math.max(0, accrued - cycleApproved - cycleCutiBersama);
      quotaText = `${accrued} / ${activeQuota.totalDays} H`;
      balanceText = `${remaining} H`;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      nik: user.nik,
      level: user.level,
      department: user.department,
      position: user.position,
      joinDate: user.joinDate.toISOString(),
      isActive: user.isActive,
      subCompanyId: user.subCompanyId,
      subCompany: user.subCompany ? { name: user.subCompany.name } : null,
      quotaText,
      balanceText,
      activeQuota: activeQuota
        ? {
            id: activeQuota.id,
            cycleStart: activeQuota.cycleStart.toISOString(),
            cycleEnd: activeQuota.cycleEnd.toISOString(),
            totalDays: activeQuota.totalDays,
          }
        : null,
    };
  });

  return (
    <PageWrapper title="Data Karyawan">
      <KaryawanListClient
        initialEmployees={employeeData}
        subCompanies={subCompanies.map((sc) => ({ id: sc.id, name: sc.name }))}
      />
    </PageWrapper>
  );
}
