import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ExcuseForm } from "@/components/features/excuse/ExcuseForm";

export default async function NewExcusePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";

  // If Admin, fetch all active employees to populate the "on behalf of" dropdown
  let employees: { id: string; name: string }[] = [];
  if (isAdmin) {
    employees = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  // Fetch holidays to pass to the client for live working-days calculation
  const holidays = await prisma.holiday.findMany({
    select: { date: true },
  });
  const holidayDates = holidays.map((h) => h.date.toISOString().split("T")[0]);

  return (
    <PageWrapper title="Ajukan Izin / Keterangan">
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <ExcuseForm
          currentUser={{
            id: session.user.id,
            name: session.user.name,
            role: session.user.role,
          }}
          employees={employees}
          holidayDates={holidayDates}
        />
      </div>
    </PageWrapper>
  );
}
