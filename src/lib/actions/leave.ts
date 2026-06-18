"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/upload";
import { LeaveType, RequestStatus } from "@prisma/client";
import { calculateWorkingDays } from "@/lib/date";

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
    const leaveTypeInput = formData.get("leaveType") as string;
    const startDateInput = formData.get("startDate") as string;
    const endDateInput = formData.get("endDate") as string;
    const reason = formData.get("reason") as string;
    const file = formData.get("attachment") as File | null;

    if (!targetUserId || !leaveTypeInput || !startDateInput || !endDateInput || !reason) {
      return { error: "Semua kolom wajib diisi." };
    }

    // Role guard: Karyawan can only submit for themselves
    if (!isAdmin && targetUserId !== currentUserId) {
      return { error: "Anda tidak memiliki akses untuk mengajukan cuti atas nama karyawan lain." };
    }

    // Parse dates
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { error: "Format tanggal tidak valid." };
    }

    if (startDate > endDate) {
      return { error: "Tanggal mulai tidak boleh setelah tanggal berakhir." };
    }

    // Fetch holidays within the date range
    const holidayRecords = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { date: true },
    });

    const holidaySet = new Set(
      holidayRecords.map((h) => h.date.toISOString().split("T")[0])
    );

    // Calculate total working days (skipping weekends and holidays)
    const totalDays = calculateWorkingDays(startDate, endDate, holidaySet);

    if (totalDays === 0) {
      return { error: "Tidak ada hari kerja (weekday non-libur) dalam rentang tanggal yang dipilih." };
    }

    // Handle file upload
    let attachmentUrl: string | null = null;
    if (file) {
      attachmentUrl = await uploadFile(file);
    }

    // Insert leave request
    await prisma.leaveRequest.create({
      data: {
        userId: targetUserId,
        leaveType: leaveTypeInput as LeaveType,
        startDate,
        endDate,
        totalDays,
        reason,
        attachmentUrl,
        status: RequestStatus.PENDING,
        submittedById: targetUserId === currentUserId ? null : currentUserId,
      },
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
