"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/upload";
import { ExcuseType, RequestStatus } from "@prisma/client";
import { calculateWorkingDays } from "@/lib/date";
import { getAccruedQuotaDays } from "@/lib/accrual";

export async function createExcuseRequest(prevState: any, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir. Silakan login kembali." };
    }

    const currentUserId = session.user.id;
    const currentUserRole = session.user.role;
    const isAdmin = currentUserRole === "ADMIN" || currentUserRole === "SUPERADMIN";

    // Extract form data
    const targetUserId = formData.get("userId") as string;
    const excuseTypeInput = formData.get("excuseType") as string;
    const dateFromInput = formData.get("dateFrom") as string;
    const dateToInput = formData.get("dateTo") as string;
    const reason = formData.get("reason") as string;
    const file = formData.get("attachment") as File | null;

    if (!targetUserId || !excuseTypeInput || !dateFromInput || !dateToInput || !reason) {
      return { error: "Semua kolom wajib diisi." };
    }

    // Role guard: Karyawan can only submit for themselves
    if (!isAdmin && targetUserId !== currentUserId) {
      return { error: "Anda tidak memiliki akses untuk mengajukan izin atas nama karyawan lain." };
    }

    // Parse dates
    const dateFrom = new Date(dateFromInput);
    const dateTo = new Date(dateToInput);

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return { error: "Format tanggal tidak valid." };
    }

    if (dateFrom > dateTo) {
      return { error: "Tanggal mulai tidak boleh setelah tanggal berakhir." };
    }

    // Fetch holidays within the date range
    const holidayRecords = await prisma.holiday.findMany({
      where: {
        date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      select: { date: true },
    });

    const holidaySet = new Set(
      holidayRecords.map((h) => h.date.toISOString().split("T")[0])
    );

    // Calculate total working days (skipping weekends and holidays)
    const totalDays = calculateWorkingDays(dateFrom, dateTo, holidaySet);

    if (totalDays === 0) {
      return { error: "Tidak ada hari kerja (weekday non-libur) dalam rentang tanggal yang dipilih." };
    }

    let annualQuotaId: string | null = null;

    // Quota validation for Cuti Tahunan
    if (excuseTypeInput === "CUTI_TAHUNAN") {
      // Find the active quota cycle for the employee
      const activeQuota = await prisma.annualLeaveQuota.findFirst({
        where: {
          userId: targetUserId,
          cycleStart: { lte: dateFrom },
          cycleEnd: { gte: dateTo },
        },
      });

      if (!activeQuota) {
        return {
          error: "Tidak ada kuota cuti tahunan aktif yang mencakup rentang tanggal tersebut. Silakan hubungi HR untuk membuat kuota.",
        };
      }

      // Calculate already approved days in this cycle
      const approvedExcuses = await prisma.excuseRequest.aggregate({
        _sum: { totalDays: true },
        where: {
          userId: targetUserId,
          excuseType: "CUTI_TAHUNAN",
          annualQuotaId: activeQuota.id,
          status: RequestStatus.APPROVED,
        },
      });

      const accruedLimit = getAccruedQuotaDays(activeQuota.cycleStart, activeQuota.totalDays, new Date());
      const usedDays = Number(approvedExcuses._sum.totalDays || 0);
      const remainingDays = accruedLimit - usedDays;

      if (remainingDays < totalDays) {
        return {
          error: `Sisa kuota cuti tahunan tidak mencukupi. Tersisa yang diakru: ${remainingDays} hari (Maks: ${activeQuota.totalDays} hari), diajukan: ${totalDays} hari.`,
        };
      }

      annualQuotaId = activeQuota.id;
    }

    // Handle file upload
    let attachmentUrl: string | null = null;
    if (file) {
      attachmentUrl = await uploadFile(file);
    }

    // Insert excuse request
    await prisma.excuseRequest.create({
      data: {
        userId: targetUserId,
        excuseType: excuseTypeInput as ExcuseType,
        dateFrom,
        dateTo,
        totalDays,
        reason,
        attachmentUrl,
        annualQuotaId,
        status: RequestStatus.PENDING,
        submittedById: targetUserId === currentUserId ? null : currentUserId,
      },
    });

    revalidatePath("/izin");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating excuse request:", error);
    return { error: "Terjadi kesalahan server saat menyimpan pengajuan." };
  }
}

export async function reviewExcuseRequest(
  requestId: string,
  status: "APPROVED" | "REJECTED",
  rejectionNote?: string
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir." };
    }

    const currentUserId = session.user.id;
    const currentUserRole = session.user.role;
    const isAdmin = currentUserRole === "ADMIN" || currentUserRole === "SUPERADMIN";

    if (!isAdmin) {
      return { error: "Hanya Admin HR atau Superadmin yang dapat memproses pengajuan." };
    }

    if (status === "REJECTED" && !rejectionNote?.trim()) {
      return { error: "Catatan penolakan wajib diisi jika pengajuan ditolak." };
    }

    // Fetch details to double check quota balance for approval
    const request = await prisma.excuseRequest.findUnique({
      where: { id: requestId },
      include: { annualQuota: true },
    });

    if (!request) {
      return { error: "Pengajuan tidak ditemukan." };
    }

    if (status === "APPROVED" && request.excuseType === "CUTI_TAHUNAN" && request.annualQuota) {
      const activeQuota = request.annualQuota;

      // Calculate approved days in this cycle (excluding this request if it's already approved somehow)
      const approvedExcuses = await prisma.excuseRequest.aggregate({
        _sum: { totalDays: true },
        where: {
          id: { not: requestId },
          userId: request.userId,
          excuseType: "CUTI_TAHUNAN",
          annualQuotaId: activeQuota.id,
          status: RequestStatus.APPROVED,
        },
      });

      const accruedLimit = getAccruedQuotaDays(activeQuota.cycleStart, activeQuota.totalDays, new Date());
      const usedDays = Number(approvedExcuses._sum.totalDays || 0);
      const remainingDays = accruedLimit - usedDays;
      const requestedDays = Number(request.totalDays || 0);

      if (remainingDays < requestedDays) {
        return {
          error: `Persetujuan gagal. Sisa kuota cuti tahunan tidak mencukupi. Tersisa yang diakru: ${remainingDays} hari (Maks: ${activeQuota.totalDays} hari), diajukan: ${requestedDays} hari.`,
        };
      }
    }

    await prisma.excuseRequest.update({
      where: { id: requestId },
      data: {
        status: status as RequestStatus,
        reviewedById: currentUserId,
        reviewedAt: new Date(),
        rejectionNote: status === "REJECTED" ? rejectionNote : null,
      },
    });

    revalidatePath("/izin");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error reviewing excuse request:", error);
    return { error: "Terjadi kesalahan server saat memproses pengajuan." };
  }
}
