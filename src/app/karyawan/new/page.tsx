import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { KaryawanForm } from "@/components/features/karyawan/KaryawanForm";

export default async function NewKaryawanPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const subCompanies = await prisma.subCompany.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <PageWrapper title="Tambah Karyawan Baru">
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <KaryawanForm subCompanies={subCompanies.map((sc) => ({ id: sc.id, name: sc.name }))} />
      </div>
    </PageWrapper>
  );
}
