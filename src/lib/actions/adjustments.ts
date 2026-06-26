"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Guard helper to check if current user is admin
async function checkAdminAccess() {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Sesi Anda telah berakhir. Silakan login kembali.");
  }
  
  const role = session.user.role;
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";
  if (!isAdmin) {
    throw new Error("Anda tidak memiliki akses untuk melakukan tindakan ini.");
  }
  
  return session.user.id;
}

export async function createAdjustment(prevState: any, formData: FormData) {
  try {
    const adminId = await checkAdminAccess();

    const quotaId = formData.get("quotaId") as string;
    const userId = formData.get("userId") as string;
    const daysStr = formData.get("days") as string;
    const reason = formData.get("reason") as string;
    const effectiveOnStr = formData.get("effectiveOn") as string;

    if (!quotaId || !userId || !daysStr || !reason || !effectiveOnStr) {
      return { error: "Semua kolom (jumlah hari, alasan, tanggal efektif) wajib diisi." };
    }

    const days = parseFloat(daysStr);
    if (isNaN(days) || days === 0) {
      return { error: "Jumlah hari harus berupa angka dan tidak boleh nol." };
    }

    const effectiveOn = new Date(effectiveOnStr);
    if (isNaN(effectiveOn.getTime())) {
      return { error: "Format tanggal efektif tidak valid." };
    }

    // Verify quota exists and belongs to the correct user
    const quota = await prisma.annualLeaveQuota.findFirst({
      where: { id: quotaId, userId },
    });

    if (!quota) {
      return { error: "Siklus kuota tidak ditemukan." };
    }

    await prisma.leaveAdjustment.create({
      data: {
        quotaId,
        userId,
        createdById: adminId,
        days: new Prisma.Decimal(days),
        reason: reason.trim(),
        effectiveOn,
      },
    });

    revalidatePath(`/karyawan/${userId}`);
    revalidatePath("/kuota-tahunan");

    return { success: true };
  } catch (error: any) {
    console.error("Error creating leave adjustment:", error);
    const msg = error.message;
    if (msg === "Sesi Anda telah berakhir. Silakan login kembali." || msg === "Anda tidak memiliki akses untuk melakukan tindakan ini.") {
      return { error: msg };
    }
    return { error: "Gagal membuat penyesuaian kuota." };
  }
}

export async function updateAdjustment(prevState: any, formData: FormData) {
  try {
    await checkAdminAccess();

    const id = formData.get("id") as string;
    const daysStr = formData.get("days") as string;
    const reason = formData.get("reason") as string;
    const effectiveOnStr = formData.get("effectiveOn") as string;

    if (!id || !daysStr || !reason || !effectiveOnStr) {
      return { error: "Semua kolom wajib diisi." };
    }

    const days = parseFloat(daysStr);
    if (isNaN(days) || days === 0) {
      return { error: "Jumlah hari harus berupa angka dan tidak boleh nol." };
    }

    const effectiveOn = new Date(effectiveOnStr);
    if (isNaN(effectiveOn.getTime())) {
      return { error: "Format tanggal efektif tidak valid." };
    }

    const existingAdjustment = await prisma.leaveAdjustment.findUnique({
      where: { id },
    });

    if (!existingAdjustment) {
      return { error: "Penyesuaian kuota tidak ditemukan." };
    }

    await prisma.leaveAdjustment.update({
      where: { id },
      data: {
        days: new Prisma.Decimal(days),
        reason: reason.trim(),
        effectiveOn,
      },
    });

    revalidatePath(`/karyawan/${existingAdjustment.userId}`);
    revalidatePath("/kuota-tahunan");

    return { success: true };
  } catch (error: any) {
    console.error("Error updating leave adjustment:", error);
    const msg = error.message;
    if (msg === "Sesi Anda telah berakhir. Silakan login kembali." || msg === "Anda tidak memiliki akses untuk melakukan tindakan ini.") {
      return { error: msg };
    }
    return { error: "Gagal mengubah penyesuaian kuota." };
  }
}

export async function deleteAdjustment(id: string) {
  try {
    await checkAdminAccess();

    const existingAdjustment = await prisma.leaveAdjustment.findUnique({
      where: { id },
    });

    if (!existingAdjustment) {
      return { error: "Penyesuaian kuota tidak ditemukan." };
    }

    await prisma.leaveAdjustment.delete({
      where: { id },
    });

    revalidatePath(`/karyawan/${existingAdjustment.userId}`);
    revalidatePath("/kuota-tahunan");

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting leave adjustment:", error);
    const msg = error.message;
    if (msg === "Sesi Anda telah berakhir. Silakan login kembali." || msg === "Anda tidak memiliki akses untuk melakukan tindakan ini.") {
      return { error: msg };
    }
    return { error: "Gagal menghapus penyesuaian kuota." };
  }
}
