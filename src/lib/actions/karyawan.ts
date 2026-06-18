"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { getAccruedQuotaDays } from "@/lib/accrual";

export async function createKaryawanUser(prevState: any, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir. Silakan login kembali." };
    }

    const currentUserRole = session.user.role;
    if (currentUserRole !== "SUPERADMIN" && currentUserRole !== "ADMIN") {
      return { error: "Anda tidak memiliki akses untuk menambah karyawan baru." };
    }

    // Extract form data
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const roleInput = "KARYAWAN"; // New employees are strictly KARYAWAN
    const nik = formData.get("nik") as string;
    const level = formData.get("level") as string;
    const department = formData.get("department") as string;
    const position = formData.get("position") as string;
    const lokasiKerja = formData.get("lokasiKerja") as string;
    const namaAtasan = formData.get("namaAtasan") as string;
    const subCompanyId = formData.get("subCompanyId") as string;
    const joinDateInput = formData.get("joinDate") as string;

    if (!name || !password || !roleInput || !joinDateInput) {
      return { error: "Kolom Nama, Password, Role, dan Tanggal Bergabung wajib diisi." };
    }

    const emailTrim = email?.trim() || null;
    const usernameTrim = username?.trim() || null;

    if (!emailTrim && !usernameTrim) {
      return { error: "Salah satu dari Email atau Username wajib diisi agar karyawan dapat login." };
    }

    // Check if email already exists
    if (emailTrim) {
      const existingUser = await prisma.user.findUnique({
        where: { email: emailTrim },
      });

      if (existingUser) {
        return { error: "Email sudah digunakan oleh akun lain." };
      }
    }

    // Check if username already exists
    if (usernameTrim) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: usernameTrim },
      });

      if (existingUsername) {
        return { error: "Username sudah digunakan oleh akun lain." };
      }
    }

    // Check unique NIK if provided
    if (nik && nik.trim() !== "") {
      const existingNik = await prisma.user.findFirst({
        where: { nik: nik.trim() },
      });
      if (existingNik) {
        return { error: "NIK sudah digunakan oleh karyawan lain." };
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const joinDate = new Date(joinDateInput);

    if (isNaN(joinDate.getTime())) {
      return { error: "Format tanggal bergabung tidak valid." };
    }

    // Create User
    const user = await prisma.user.create({
      data: {
        name,
        email: emailTrim,
        username: usernameTrim,
        passwordHash,
        role: roleInput as Role,
        nik: nik?.trim() || null,
        level: level?.trim() || null,
        department: department?.trim() || null,
        position: position?.trim() || null,
        lokasiKerja: lokasiKerja?.trim() || null,
        namaAtasan: namaAtasan?.trim() || null,
        subCompanyId: subCompanyId || null,
        joinDate,
        isActive: true,
      },
    });

    // Auto-create initial Annual Leave Quota for Karyawan role
    if (roleInput === "KARYAWAN" || roleInput === "ADMIN") {
      const cycleStart = new Date(joinDate);
      const cycleEnd = new Date(cycleStart);
      cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
      cycleEnd.setDate(cycleEnd.getDate() - 1);

      // Fetch default leave quota from settings
      const companySettings = await prisma.companySetting.findFirst();
      const defaultDays = companySettings?.defaultAnnualDays ?? 12;

      await prisma.annualLeaveQuota.create({
        data: {
          userId: user.id,
          cycleStart,
          cycleEnd,
          totalDays: defaultDays,
          createdById: session.user.id,
        },
      });
    }

    revalidatePath("/karyawan");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating employee user:", error);
    return { error: "Terjadi kesalahan server saat menyimpan data karyawan." };
  }
}

export async function updateKaryawanUser(userId: string, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir." };
    }

    const currentUserRole = session.user.role;
    if (currentUserRole !== "SUPERADMIN" && currentUserRole !== "ADMIN") {
      return { error: "Anda tidak memiliki akses untuk menyunting data karyawan." };
    }

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const roleInput = "KARYAWAN";
    const nik = formData.get("nik") as string;
    const level = formData.get("level") as string;
    const department = formData.get("department") as string;
    const position = formData.get("position") as string;
    const lokasiKerja = formData.get("lokasiKerja") as string;
    const namaAtasan = formData.get("namaAtasan") as string;
    const subCompanyId = formData.get("subCompanyId") as string;
    const joinDateInput = formData.get("joinDate") as string;
    const isActiveInput = formData.get("isActive") as string;

    if (!name || !roleInput || !joinDateInput) {
      return { error: "Kolom Nama, Role, dan Tanggal Bergabung wajib diisi." };
    }

    const emailTrim = email?.trim() || null;
    const usernameTrim = username?.trim() || null;

    if (!emailTrim && !usernameTrim) {
      return { error: "Salah satu dari Email atau Username wajib diisi agar karyawan dapat login." };
    }

    const joinDate = new Date(joinDateInput);
    if (isNaN(joinDate.getTime())) {
      return { error: "Format tanggal bergabung tidak valid." };
    }

    // Check email uniqueness if modified
    if (emailTrim) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: emailTrim,
          id: { not: userId },
        },
      });

      if (existingUser) {
        return { error: "Email sudah digunakan oleh akun lain." };
      }
    }

    // Check username uniqueness if modified
    if (usernameTrim) {
      const existingUsername = await prisma.user.findFirst({
        where: {
          username: usernameTrim,
          id: { not: userId },
        },
      });

      if (existingUsername) {
        return { error: "Username sudah digunakan oleh akun lain." };
      }
    }

    // Check unique NIK if provided
    if (nik && nik.trim() !== "") {
      const existingNik = await prisma.user.findFirst({
        where: {
          nik: nik.trim(),
          id: { not: userId },
        },
      });
      if (existingNik) {
        return { error: "NIK sudah digunakan oleh karyawan lain." };
      }
    }

    const updateData: any = {
      name,
      email: emailTrim,
      username: usernameTrim,
      role: roleInput as Role,
      nik: nik?.trim() || null,
      level: level?.trim() || null,
      department: department?.trim() || null,
      position: position?.trim() || null,
      lokasiKerja: lokasiKerja?.trim() || null,
      namaAtasan: namaAtasan?.trim() || null,
      subCompanyId: subCompanyId || null,
      joinDate,
      isActive: isActiveInput === "true",
    };

    if (password && password.trim() !== "") {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    revalidatePath("/karyawan");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating employee user:", error);
    return { error: "Terjadi kesalahan server saat menyimpan perubahan." };
  }
}

export async function upsertAnnualLeaveQuota(
  userId: string,
  cycleStartInput: string,
  totalDays: number
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir." };
    }

    const currentUserRole = session.user.role;
    if (currentUserRole !== "SUPERADMIN" && currentUserRole !== "ADMIN") {
      return { error: "Anda tidak memiliki akses untuk mengelola kuota cuti." };
    }

    const cycleStart = new Date(cycleStartInput);
    if (isNaN(cycleStart.getTime())) {
      return { error: "Format tanggal mulai siklus tidak valid." };
    }

    // Calculate end of cycle (1 year anniversary - 1 day)
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
    cycleEnd.setDate(cycleEnd.getDate() - 1);

    // Look for existing quota in the exact cycle start
    const existingQuota = await prisma.annualLeaveQuota.findFirst({
      where: {
        userId,
        cycleStart,
      },
    });

    if (existingQuota) {
      await prisma.annualLeaveQuota.update({
        where: { id: existingQuota.id },
        data: {
          totalDays,
          cycleEnd,
          createdById: session.user.id,
        },
      });
    } else {
      await prisma.annualLeaveQuota.create({
        data: {
          userId,
          cycleStart,
          cycleEnd,
          totalDays,
          createdById: session.user.id,
        },
      });
    }

    revalidatePath("/karyawan");
    revalidatePath("/kuota-tahunan");
    return { success: true };
  } catch (error: any) {
    console.error("Error managing annual leave quota:", error);
    return { error: "Terjadi kesalahan server saat menyimpan kuota cuti." };
  }
}

export async function getKaryawanRemainingQuota(userId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir." };
    }

    const now = new Date();
    // Find active quota cycle for user
    let activeQuota = await prisma.annualLeaveQuota.findFirst({
      where: {
        userId,
        cycleStart: { lte: now },
        cycleEnd: { gte: now },
      },
    });

    // Fallback to latest cycle
    if (!activeQuota) {
      activeQuota = await prisma.annualLeaveQuota.findFirst({
        where: { userId },
        orderBy: { cycleStart: "desc" },
      });
    }

    if (!activeQuota) {
      return { quota: null };
    }

    // Sum approved cuti tahunan
    const approvedExcuses = await prisma.excuseRequest.aggregate({
      _sum: { totalDays: true },
      where: {
        userId,
        excuseType: "CUTI_TAHUNAN",
        annualQuotaId: activeQuota.id,
        status: "APPROVED",
      },
    });

    const usedDays = Number(approvedExcuses._sum.totalDays || 0);
    const accruedDays = getAccruedQuotaDays(activeQuota.cycleStart, activeQuota.totalDays, now);
    const remainingDays = accruedDays - usedDays;

    return {
      quota: {
        id: activeQuota.id,
        total: activeQuota.totalDays,
        accrued: accruedDays,
        used: usedDays,
        remaining: remainingDays,
        cycleStart: activeQuota.cycleStart.toISOString(),
        cycleEnd: activeQuota.cycleEnd.toISOString(),
        expired: activeQuota.cycleEnd < now,
      },
    };
  } catch (error: any) {
    console.error("Error fetching employee remaining quota:", error);
    return { error: "Gagal mengambil data sisa cuti." };
  }
}

export async function deleteKaryawanUser(userId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir. Silakan login kembali." };
    }

    const currentUserRole = session.user.role;
    if (currentUserRole !== "SUPERADMIN" && currentUserRole !== "ADMIN") {
      return { error: "Anda tidak memiliki akses untuk menghapus karyawan." };
    }

    // Verify target user has role KARYAWAN
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, name: true },
    });

    if (!userToDelete) {
      return { error: "Karyawan tidak ditemukan." };
    }

    if (userToDelete.role !== "KARYAWAN") {
      return { error: "Hanya akun dengan peran Karyawan yang dapat dihapus melalui menu ini." };
    }

    // Run cascade delete transaction
    await prisma.$transaction([
      prisma.leaveRequest.deleteMany({ where: { userId } }),
      prisma.excuseRequest.deleteMany({ where: { userId } }),
      prisma.annualLeaveQuota.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    revalidatePath("/karyawan");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting employee user:", error);
    return { error: "Terjadi kesalahan server saat menghapus data karyawan." };
  }
}


