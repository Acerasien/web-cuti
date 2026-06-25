import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { QuotaPageClient } from "./QuotaPageClient";
import { getAccruedQuotaDays } from "@/lib/accrual";

export const metadata = {
  title: "Kuota Cuti Tahunan — Web Cuti",
  description: "Manajemen Kuota Cuti Tahunan Karyawan",
};

export default async function QuotaManagementPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Fetch all employees (ADMIN or KARYAWAN) with their quotas and approved leave count
  const users = await prisma.user.findMany({
    where: {
      role: { in: ["KARYAWAN", "ADMIN"] },
    },
    include: {
      annualQuotas: {
        orderBy: { cycleStart: "desc" },
        include: {
          segments: {
            where: {
              leaveType: "CUTI_TAHUNAN",
              leaveRequest: {
                status: "APPROVED",
              },
            },
            select: {
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

  const employees = users.map((user) => {
    // Find active quota cycle covering today, or fallback to the latest one
    let activeQuota = user.annualQuotas.find(
      (q) => q.cycleStart <= now && q.cycleEnd >= now
    );
    if (!activeQuota && user.annualQuotas.length > 0) {
      activeQuota = user.annualQuotas[0];
    }

    let usedDays = 0;
    let accruedDays = 0;
    let remainingDays = 0;
    let isExpired = false;
    let isExpiringSoon = false;
    let daysToExpiry = null;

    if (activeQuota) {
      usedDays = activeQuota.segments.reduce((sum, r) => sum + Number(r.totalDays || 0), 0);
      accruedDays = getAccruedQuotaDays(activeQuota.cycleStart, activeQuota.totalDays, now);
      
      const cycleCutiBersama = cutiBersamaHolidays.filter(
        (h) => h.date >= activeQuota.cycleStart && h.date <= now
      ).length;

      remainingDays = accruedDays - usedDays - cycleCutiBersama;

      const timeDiff = activeQuota.cycleEnd.getTime() - now.getTime();
      daysToExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

      isExpired = activeQuota.cycleEnd < now;
      isExpiringSoon = !isExpired && daysToExpiry >= 0 && daysToExpiry <= 30;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      department: user.department,
      position: user.position,
      joinDate: user.joinDate.toISOString(),
      isActive: user.isActive,
      activeQuota: activeQuota
        ? {
            id: activeQuota.id,
            cycleStart: activeQuota.cycleStart.toISOString(),
            cycleEnd: activeQuota.cycleEnd.toISOString(),
            totalDays: activeQuota.totalDays,
          }
        : null,
      usedDays,
      accruedDays,
      remainingDays,
      isExpired,
      isExpiringSoon,
      daysToExpiry,
    };
  });

  return (
    <PageWrapper title="Kuota Cuti Tahunan">
      <QuotaPageClient initialEmployees={employees} />
    </PageWrapper>
  );
}
