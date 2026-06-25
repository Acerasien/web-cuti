import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { SettingsPageClient } from "./SettingsPageClient";

export const metadata = {
  title: "Pengaturan Sistem — Web Cuti",
  description: "Manajemen Unit Bisnis dan Konfigurasi Default Perusahaan",
};

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Settings are Superadmin only
  if (session.user.role !== "SUPERADMIN") {
    redirect("/dashboard");
  }

  // Fetch current company settings
  let companySettings = await prisma.companySetting.findFirst();

  // If no settings exist, initialize with default values
  if (!companySettings) {
    companySettings = {
      id: "default",
      companyName: "Perusahaan",
      defaultAnnualDays: 12,
      updatedAt: new Date(),
    };
  }

  // Fetch all sub-companies (Unit Bisnis)
  const subCompanies = await prisma.subCompany.findMany({
    orderBy: { name: "asc" },
  });

  // Fetch all holidays
  const holidays = await prisma.holiday.findMany({
    orderBy: { date: "asc" },
  });

  // Fetch all admin/superadmin users
  const adminUsers = await prisma.user.findMany({
    where: {
      role: {
        in: ["ADMIN", "SUPERADMIN"],
      },
    },
    orderBy: { name: "asc" },
  });

  // Fetch all active KARYAWAN users for hierarchy management
  const karyawanList = await prisma.user.findMany({
    where: {
      role: "KARYAWAN",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      level: true,
      department: true,
      lokasiKerja: true,
      atasanId: true,
      subCompanyId: true,
      atasan: {
        select: {
          name: true,
        },
      },
      subCompany: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <PageWrapper title="Pengaturan Sistem">
      <SettingsPageClient
        initialSettings={{
          companyName: companySettings.companyName,
          defaultAnnualDays: companySettings.defaultAnnualDays,
        }}
        subCompanies={subCompanies.map((sc) => ({
          id: sc.id,
          name: sc.name,
          code: sc.code,
          createdAt: sc.createdAt.toISOString(),
        }))}
        holidays={holidays.map((h) => ({
          id: h.id,
          date: h.date.toISOString(),
          description: h.description,
          isCutiBersama: h.isCutiBersama,
        }))}
        adminUsers={adminUsers.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
        }))}
        karyawanList={karyawanList.map((emp) => ({
          id: emp.id,
          name: emp.name,
          level: emp.level,
          department: emp.department,
          lokasiKerja: emp.lokasiKerja,
          atasanId: emp.atasanId,
          atasanName: emp.atasan?.name ?? null,
          subCompanyId: emp.subCompanyId,
          subCompanyName: emp.subCompany?.name ?? null,
        }))}
      />
    </PageWrapper>
  );
}
