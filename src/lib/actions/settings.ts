"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncAllEmployeeQuotas } from "@/lib/quota";
import { logAuditEvent } from "@/lib/audit";
import bcrypt from "bcryptjs";

// Manage global settings
export async function updateCompanySettings(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPERADMIN") {
      return { error: "Akses ditolak. Hanya Super Admin yang dapat mengubah pengaturan." };
    }

    const companyName = formData.get("companyName") as string;
    const defaultAnnualDaysInput = formData.get("defaultAnnualDays") as string;

    if (!companyName || !companyName.trim()) {
      return { error: "Nama Perusahaan wajib diisi." };
    }

    const defaultAnnualDays = parseInt(defaultAnnualDaysInput);
    if (isNaN(defaultAnnualDays) || defaultAnnualDays <= 0) {
      return { error: "Jatah cuti tahunan default tidak valid." };
    }

    const setting = await prisma.companySetting.findFirst();

    if (setting) {
      await prisma.companySetting.update({
        where: { id: setting.id },
        data: {
          companyName: companyName.trim(),
          defaultAnnualDays,
        },
      });

      await logAuditEvent({
        actionType: "SETTING_UPDATE",
        description: `Updated global company settings: ${companyName.trim()}`,
        actorId: session.user.id,
        actorName: session.user.name,
        beforeState: { companyName: setting.companyName, defaultAnnualDays: setting.defaultAnnualDays },
        afterState: { companyName: companyName.trim(), defaultAnnualDays },
      });
    } else {
      await prisma.companySetting.create({
        data: {
          companyName: companyName.trim(),
          defaultAnnualDays,
        },
      });

      await logAuditEvent({
        actionType: "SETTING_UPDATE",
        description: `Initialized global company settings: ${companyName.trim()}`,
        actorId: session.user.id,
        actorName: session.user.name,
        afterState: { companyName: companyName.trim(), defaultAnnualDays },
      });
    }

    revalidatePath("/pengaturan");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating company settings:", error);
    return { error: "Terjadi kesalahan server saat menyimpan pengaturan." };
  }
}

// Sub-Company Actions
export async function createSubCompany(prevState: any, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPERADMIN") {
      return { error: "Akses ditolak." };
    }

    const name = formData.get("name") as string;

    if (!name || !name.trim()) {
      return { error: "Nama Unit Bisnis wajib diisi." };
    }

    // Check unique name
    const existing = await prisma.subCompany.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return { error: "Unit Bisnis / Sub-Perusahaan dengan nama ini sudah terdaftar." };
    }

    const subCompany = await prisma.subCompany.create({
      data: { name: name.trim() },
    });

    await logAuditEvent({
      actionType: "SUBCOMPANY_CREATE",
      description: `Created new sub-company / business unit: ${name.trim()}`,
      actorId: session.user.id,
      actorName: session.user.name,
      targetId: subCompany.id,
      targetName: subCompany.name,
      afterState: { name: name.trim() },
    });

    revalidatePath("/pengaturan");
    revalidatePath("/karyawan");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating sub-company:", error);
    return { error: "Gagal menyimpan Unit Bisnis baru." };
  }
}

export async function deleteSubCompany(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPERADMIN") {
      return { error: "Akses ditolak." };
    }

    // Check if any employees are linked to this subcompany
    const linkedUsers = await prisma.user.count({
      where: { subCompanyId: id },
    });

    if (linkedUsers > 0) {
      return { error: `Tidak dapat menghapus. Ada ${linkedUsers} karyawan yang masih terdaftar di Unit Bisnis ini.` };
    }

    const existingSubComp = await prisma.subCompany.findUnique({
      where: { id },
    });

    await prisma.subCompany.delete({
      where: { id },
    });

    await logAuditEvent({
      actionType: "SUBCOMPANY_DELETE",
      description: `Deleted sub-company / business unit: ${existingSubComp?.name || "Unknown"}`,
      actorId: session.user.id,
      actorName: session.user.name,
      targetId: id,
      targetName: existingSubComp?.name,
      beforeState: { name: existingSubComp?.name },
    });

    revalidatePath("/pengaturan");
    revalidatePath("/karyawan");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting sub-company:", error);
    return { error: "Gagal menghapus Unit Bisnis." };
  }
}

// Holiday Actions
export async function createHoliday(prevState: any, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPERADMIN") {
      return { error: "Akses ditolak. Hanya Super Admin yang dapat menambahkan hari libur." };
    }

    const dateInput = formData.get("date") as string;
    const description = formData.get("description") as string;
    const isCutiBersama = formData.get("isCutiBersama") === "true";

    if (!dateInput || !description || !description.trim()) {
      return { error: "Tanggal dan Deskripsi wajib diisi." };
    }

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return { error: "Format tanggal tidak valid." };
    }

    // Check unique holiday date
    const existing = await prisma.holiday.findUnique({
      where: { date },
    });

    if (existing) {
      return { error: "Tanggal libur ini sudah terdaftar." };
    }

    const holiday = await prisma.holiday.create({
      data: {
        date,
        description: description.trim(),
        isCutiBersama,
      },
    });

    await logAuditEvent({
      actionType: "HOLIDAY_CREATE",
      description: `Created new holiday: ${description.trim()} (${date.toLocaleDateString()})`,
      actorId: session.user.id,
      actorName: session.user.name,
      targetId: holiday.id,
      targetName: description.trim(),
      afterState: { date, description: description.trim(), isCutiBersama },
    });

    revalidatePath("/pengaturan");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating holiday:", error);
    return { error: "Gagal menyimpan hari libur baru." };
  }
}

export async function deleteHoliday(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPERADMIN") {
      return { error: "Akses ditolak." };
    }

    const existingHoliday = await prisma.holiday.findUnique({
      where: { id },
    });

    await prisma.holiday.delete({
      where: { id },
    });

    await logAuditEvent({
      actionType: "HOLIDAY_DELETE",
      description: `Deleted holiday: ${existingHoliday?.description || "Unknown"} (${existingHoliday?.date.toLocaleDateString() || "Unknown"})`,
      actorId: session.user.id,
      actorName: session.user.name,
      targetId: id,
      targetName: existingHoliday?.description,
      beforeState: { date: existingHoliday?.date, description: existingHoliday?.description, isCutiBersama: existingHoliday?.isCutiBersama },
    });

    revalidatePath("/pengaturan");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting holiday:", error);
    return { error: "Gagal menghapus hari libur." };
  }
}

// Admin User Actions
export async function createAdminUser(prevState: any, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPERADMIN") {
      return { error: "Akses ditolak. Hanya Super Admin yang dapat menambahkan Admin/Superadmin." };
    }

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as string;

    if (!name || !password || !role) {
      return { error: "Kolom Nama, Password, dan Akses wajib diisi." };
    }

    if (role !== "ADMIN" && role !== "SUPERADMIN") {
      return { error: "Role tidak valid." };
    }

    const emailTrim = email?.trim() || null;
    const usernameTrim = username?.trim() || null;

    if (!emailTrim && !usernameTrim) {
      return { error: "Salah satu dari Email atau Username wajib diisi agar Admin dapat login." };
    }

    // Check unique email
    if (emailTrim) {
      const existing = await prisma.user.findUnique({ where: { email: emailTrim } });
      if (existing) return { error: "Email sudah terdaftar." };
    }

    // Check unique username
    if (usernameTrim) {
      const existing = await prisma.user.findUnique({ where: { username: usernameTrim } });
      if (existing) return { error: "Username sudah terdaftar." };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: emailTrim,
        username: usernameTrim,
        passwordHash,
        role: role as any,
        joinDate: new Date(),
        isActive: true,
      },
    });

    await logAuditEvent({
      actionType: "USER_CREATE",
      description: `Created new admin/superadmin user: ${name.trim()} (Role: ${role})`,
      actorId: session.user.id,
      actorName: session.user.name,
      targetId: user.id,
      targetName: user.name,
      afterState: { name: name.trim(), email: emailTrim, username: usernameTrim, role },
    });

    revalidatePath("/pengaturan");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating admin user:", error);
    return { error: "Gagal menyimpan akun administrator." };
  }
}

export async function updateAdminUser(userId: string, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPERADMIN") {
      return { error: "Akses ditolak. Hanya Super Admin yang dapat mengubah Admin/Superadmin." };
    }

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as string;
    const isActiveInput = formData.get("isActive") as string;

    if (!name || !role) {
      return { error: "Kolom Nama dan Akses wajib diisi." };
    }

    if (role !== "ADMIN" && role !== "SUPERADMIN") {
      return { error: "Role tidak valid." };
    }

    const emailTrim = email?.trim() || null;
    const usernameTrim = username?.trim() || null;

    if (!emailTrim && !usernameTrim) {
      return { error: "Salah satu dari Email atau Username wajib diisi agar Admin dapat login." };
    }

    // Check unique email
    if (emailTrim) {
      const existing = await prisma.user.findFirst({
        where: { email: emailTrim, id: { not: userId } },
      });
      if (existing) return { error: "Email sudah terdaftar." };
    }

    // Check unique username
    if (usernameTrim) {
      const existing = await prisma.user.findFirst({
        where: { username: usernameTrim, id: { not: userId } },
      });
      if (existing) return { error: "Username sudah terdaftar." };
    }

    const updateData: any = {
      name: name.trim(),
      email: emailTrim,
      username: usernameTrim,
      role: role as any,
      isActive: isActiveInput === "true",
    };

    if (password && password.trim() !== "") {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { id: userId },
    });

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    await logAuditEvent({
      actionType: "USER_UPDATE",
      description: `Updated administrator account: ${name.trim()} (Role: ${role})`,
      actorId: session.user.id,
      actorName: session.user.name,
      targetId: userId,
      targetName: name.trim(),
      beforeState: existingAdmin ? { name: existingAdmin.name, email: existingAdmin.email, username: existingAdmin.username, role: existingAdmin.role, isActive: existingAdmin.isActive } : null,
      afterState: { name: name.trim(), email: emailTrim, username: usernameTrim, role, isActive: isActiveInput === "true" },
    });

    revalidatePath("/pengaturan");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating admin user:", error);
    return { error: "Gagal menyimpan perubahan akun administrator." };
  }
}

export async function deleteAdminUser(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPERADMIN") {
      return { error: "Akses ditolak." };
    }

    // Cannot delete yourself
    if (session.user.id === id) {
      return { error: "Anda tidak dapat menghapus akun Anda sendiri." };
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { id },
    });

    await prisma.user.delete({
      where: { id },
    });

    await logAuditEvent({
      actionType: "USER_DELETE",
      description: `Deleted administrator account: ${existingAdmin?.name || "Unknown"} (Role: ${existingAdmin?.role || "Unknown"})`,
      actorId: session.user.id,
      actorName: session.user.name,
      targetId: id,
      targetName: existingAdmin?.name,
      beforeState: { name: existingAdmin?.name, email: existingAdmin?.email, role: existingAdmin?.role },
    });

    revalidatePath("/pengaturan");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting admin user:", error);
    return { error: "Gagal menghapus akun administrator." };
  }
}

export async function triggerManualQuotaSync() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
      return { error: "Akses ditolak. Hanya Administrator yang dapat memicu sinkronisasi." };
    }

    const cyclesCreated = await syncAllEmployeeQuotas(session.user.id);

    await logAuditEvent({
      actionType: "QUOTA_ROLLOVER",
      description: `Manually triggered annual leave quota sync (Rolled over/created ${cyclesCreated} new cycles)`,
      actorId: session.user.id,
      actorName: session.user.name,
      afterState: { cyclesCreated },
    });

    revalidatePath("/karyawan");
    revalidatePath("/kuota-tahunan");
    revalidatePath("/pengaturan");
    return { success: true, cyclesCreated };
  } catch (error: any) {
    console.error("Error triggering manual quota sync:", error);
    return { error: "Gagal menjalankan sinkronisasi kuota cuti karyawan." };
  }
}

export async function assignEmployeesToSubCompanyAction(
  employeeIds: string[],
  subCompanyId: string | null
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
      return { error: "Akses ditolak. Anda tidak memiliki akses untuk mengatur Unit Bisnis karyawan." };
    }

    if (!Array.isArray(employeeIds)) {
      return { error: "Daftar ID karyawan tidak valid." };
    }

    const targetSubCompany = subCompanyId
      ? await prisma.subCompany.findUnique({ where: { id: subCompanyId }, select: { name: true } })
      : null;

    const employees = await prisma.user.findMany({
      where: { id: { in: employeeIds } },
      select: { name: true },
    });

    await prisma.user.updateMany({
      where: {
        id: { in: employeeIds },
      },
      data: {
        subCompanyId,
      },
    });

    await logAuditEvent({
      actionType: "USER_UPDATE",
      description: `Assigned ${employeeIds.length} employees to Unit Bisnis: ${targetSubCompany?.name || "None / Unassigned"}`,
      actorId: session.user.id,
      actorName: session.user.name,
      afterState: {
        subCompanyId,
        subCompanyName: targetSubCompany?.name || "None",
        employeeNames: employees.map((e) => e.name),
      },
    });

    revalidatePath("/pengaturan");
    revalidatePath("/karyawan");
    return { success: true };
  } catch (error: any) {
    console.error("Error in assignEmployeesToSubCompanyAction:", error);
    return { error: "Terjadi kesalahan server saat memperbarui Unit Bisnis karyawan." };
  }
}

