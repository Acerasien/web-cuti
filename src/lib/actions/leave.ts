"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/upload";
import { LeaveType, RequestStatus } from "@prisma/client";
import { calculateWorkingDays } from "@/lib/date";
import { getAccruedQuotaDays } from "@/lib/accrual";

async function getRemainingQuotaForCycle(
  userId: string,
  quotaId: string,
  cycleStart: Date,
  totalDaysLimit: number
): Promise<number> {
  const approvedSegments = await prisma.leaveSegment.aggregate({
    _sum: { totalDays: true },
    where: {
      leaveRequest: {
        userId,
        status: "APPROVED",
      },
      leaveType: "CUTI_TAHUNAN",
      annualQuotaId: quotaId,
    },
  });
  const usedDays = Number(approvedSegments._sum.totalDays || 0);
  const now = new Date();
  const accruedDays = getAccruedQuotaDays(cycleStart, totalDaysLimit, now);

  // Count Cuti Bersama holidays that have occurred during the active cycle
  const cutiBersamaCount = await prisma.holiday.count({
    where: {
      isCutiBersama: true,
      date: {
        gte: cycleStart,
        lte: now,
      },
    },
  });

  return Math.max(0, accruedDays - usedDays - cutiBersamaCount);
}

export async function createLeaveRequest(prevState: any, formData: FormData) {
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
    const reason = formData.get("reason") as string;
    const file = formData.get("attachment") as File | null;
    const segmentsJson = formData.get("segments") as string;

    if (!targetUserId || !reason || !segmentsJson) {
      return { error: "Semua kolom wajib diisi." };
    }

    // Role guard: Karyawan can only submit for themselves
    if (!isAdmin && targetUserId !== currentUserId) {
      return { error: "Anda tidak memiliki akses untuk mengajukan cuti atas nama karyawan lain." };
    }

    let segments: { leaveType: LeaveType; startDate: string; endDate: string }[] = [];
    try {
      segments = JSON.parse(segmentsJson);
    } catch (e) {
      return { error: "Format segments tidak valid." };
    }

    if (segments.length === 0) {
      return { error: "Pengajuan harus memiliki minimal satu periode cuti/izin." };
    }

    // Check for overlaps in the input segments
    for (let i = 0; i < segments.length; i++) {
      const s1 = new Date(segments[i].startDate);
      const e1 = new Date(segments[i].endDate);
      if (isNaN(s1.getTime()) || isNaN(e1.getTime())) {
        return { error: "Format tanggal tidak valid." };
      }
      if (s1 > e1) {
        return { error: "Tanggal mulai tidak boleh setelah tanggal berakhir." };
      }
      for (let j = i + 1; j < segments.length; j++) {
        const s2 = new Date(segments[j].startDate);
        const e2 = new Date(segments[j].endDate);
        if (s1 <= e2 && e1 >= s2) {
          return { error: "Periode cuti/izin tidak boleh saling tumpang tindih." };
        }
      }
    }

    // Fetch all existing approved or pending segments for this user
    const existingSegments = await prisma.leaveSegment.findMany({
      where: {
        leaveRequest: {
          userId: targetUserId,
          status: { not: "REJECTED" },
        },
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    for (const seg of segments) {
      const s = new Date(seg.startDate);
      const e = new Date(seg.endDate);
      for (const ext of existingSegments) {
        if (s <= ext.endDate && e >= ext.startDate) {
          return { error: `Tanggal ${seg.startDate} s/d ${seg.endDate} tumpang tindih dengan pengajuan lain yang sudah ada.` };
        }
      }
    }

    // Pre-calculate holidays
    const allHolidays = await prisma.holiday.findMany({
      select: { date: true },
    });
    const holidaySet = new Set(
      allHolidays.map((h) => h.date.toISOString().split("T")[0])
    );

    const quotaTracker: Record<string, { remaining: number; quotaId: string }> = {};
    const computedSegments: {
      leaveType: LeaveType;
      startDate: Date;
      endDate: Date;
      totalDays: number;
      annualQuotaId: string | null;
    }[] = [];

    for (const seg of segments) {
      const sDate = new Date(seg.startDate);
      const eDate = new Date(seg.endDate);
      const totalDays = calculateWorkingDays(sDate, eDate, holidaySet);

      if (totalDays === 0) {
        return { error: `Tidak ada hari kerja dalam rentang tanggal ${seg.startDate} s/d ${seg.endDate}.` };
      }

      let annualQuotaId: string | null = null;

      if (seg.leaveType === "CUTI_TAHUNAN") {
        const quota = await prisma.annualLeaveQuota.findFirst({
          where: {
            userId: targetUserId,
            cycleStart: { lte: sDate },
            cycleEnd: { gte: sDate },
          },
        }) || await prisma.annualLeaveQuota.findFirst({
          where: { userId: targetUserId },
          orderBy: { cycleStart: "desc" },
        });

        if (!quota) {
          return { error: "Karyawan tidak memiliki kuota cuti tahunan yang aktif." };
        }

        annualQuotaId = quota.id;

        if (!quotaTracker[quota.id]) {
          const remaining = await getRemainingQuotaForCycle(targetUserId, quota.id, quota.cycleStart, quota.totalDays);
          quotaTracker[quota.id] = { remaining, quotaId: quota.id };
        }

        quotaTracker[quota.id].remaining -= totalDays;

        if (quotaTracker[quota.id].remaining < 0) {
          return { error: "Sisa kuota cuti tahunan tidak mencukupi untuk pengajuan ini." };
        }
      }

      computedSegments.push({
        leaveType: seg.leaveType,
        startDate: sDate,
        endDate: eDate,
        totalDays,
        annualQuotaId,
      });
    }

    // Handle file upload
    let attachmentUrl: string | null = null;
    if (file && file.size > 0) {
      attachmentUrl = await uploadFile(file);
    }

    // Insert leave request and segments in a transaction
    await prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.create({
        data: {
          userId: targetUserId,
          reason,
          attachmentUrl,
          status: RequestStatus.PENDING,
          submittedById: targetUserId === currentUserId ? null : currentUserId,
        },
      });

      // Create segments
      await tx.leaveSegment.createMany({
        data: computedSegments.map((seg) => ({
          leaveRequestId: request.id,
          leaveType: seg.leaveType,
          startDate: seg.startDate,
          endDate: seg.endDate,
          totalDays: seg.totalDays,
          annualQuotaId: seg.annualQuotaId,
        })),
      });
    });

    revalidatePath("/cuti");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating leave request:", error);
    return { error: "Terjadi kesalahan server saat menyimpan pengajuan." };
  }
}

export async function reviewLeaveRequest(
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

    if (status === "APPROVED") {
      const request = await prisma.leaveRequest.findUnique({
        where: { id: requestId },
        include: { segments: true },
      });

      if (!request) {
        return { error: "Pengajuan tidak ditemukan." };
      }

      const quotaTracker: Record<string, { remaining: number; requested: number }> = {};

      for (const seg of request.segments) {
        if (seg.leaveType === "CUTI_TAHUNAN" && seg.annualQuotaId) {
          if (!quotaTracker[seg.annualQuotaId]) {
            const quota = await prisma.annualLeaveQuota.findUnique({
              where: { id: seg.annualQuotaId },
            });
            if (!quota) {
              return { error: "Kuota cuti tahunan tidak ditemukan." };
            }
            const remaining = await getRemainingQuotaForCycle(
              request.userId,
              quota.id,
              quota.cycleStart,
              quota.totalDays
            );
            quotaTracker[seg.annualQuotaId] = { remaining, requested: 0 };
          }
          quotaTracker[seg.annualQuotaId].requested += Number(seg.totalDays);
        }
      }

      for (const quotaId in quotaTracker) {
        const { remaining, requested } = quotaTracker[quotaId];
        if (requested > remaining) {
          return { error: "Sisa kuota cuti tahunan karyawan tidak mencukupi untuk menyetujui pengajuan ini." };
        }
      }
    }

    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: status as RequestStatus,
        reviewedById: currentUserId,
        reviewedAt: new Date(),
        rejectionNote: status === "REJECTED" ? rejectionNote : null,
      },
    });

    revalidatePath("/cuti");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error reviewing leave request:", error);
    return { error: "Terjadi kesalahan server saat memproses pengajuan." };
  }
}

export async function getBookedLeaveDates(userId: string): Promise<string[]> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return [];
    }

    // Query APPROVED or PENDING leave segments for this user
    const segments = await prisma.leaveSegment.findMany({
      where: {
        leaveRequest: {
          userId,
          status: { in: [RequestStatus.APPROVED, RequestStatus.PENDING] },
        },
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    const bookedDates = new Set<string>();

    for (const seg of segments) {
      const current = new Date(seg.startDate);
      const end = new Date(seg.endDate);
      while (current <= end) {
        const dateStr = current.toISOString().split("T")[0];
        bookedDates.add(dateStr);
        current.setDate(current.getDate() + 1);
      }
    }

    return Array.from(bookedDates);
  } catch (error) {
    console.error("Error fetching booked leave dates:", error);
    return [];
  }
}

