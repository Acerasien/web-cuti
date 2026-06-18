import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { CalendarPageClient } from "./CalendarPageClient";
import { getCalendarEvents } from "@/lib/actions/calendar";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Pre-load a 6-month window (3 months in past, 3 months in future) for smooth navigation
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0);

  const [subCompanies, departmentsData, eventsRes] = await Promise.all([
    prisma.subCompany.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: {
        department: { not: null },
      },
      select: { department: true },
      distinct: ["department"],
    }),
    getCalendarEvents(rangeStart.toISOString(), rangeEnd.toISOString()),
  ]);

  const departments = departmentsData
    .map((d) => d.department)
    .filter((dept): dept is string => typeof dept === "string" && dept.trim() !== "")
    .sort();

  const events = (eventsRes.events || []).map((ev: any) => ({
    ...ev,
    // Ensure values are safe to pass to Client Component
    reason: ev.reason || null,
    attachmentUrl: ev.attachmentUrl || null,
  }));

  return (
    <PageWrapper title="Kalender Absensi">
      <CalendarPageClient
        initialEvents={events}
        subCompanies={subCompanies}
        departments={departments}
        userRole={session.user.role}
      />
    </PageWrapper>
  );
}
