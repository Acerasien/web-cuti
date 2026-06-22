"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RequestStatus } from "@prisma/client";

export async function getCalendarEvents(startDateInput?: string, endDateInput?: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Session expired. Please log in again." };
    }

    const currentRole = session.user.role;
    const isKaryawan = currentRole === "KARYAWAN";

    let start = startDateInput ? new Date(startDateInput) : new Date();
    let end = endDateInput ? new Date(endDateInput) : new Date();

    if (!startDateInput || !endDateInput) {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // Query APPROVED leave segments that overlap with the range
    const leaveSegments = await prisma.leaveSegment.findMany({
      where: {
        leaveRequest: {
          status: RequestStatus.APPROVED,
        },
        AND: [
          { startDate: { lte: end } },
          { endDate: { gte: start } },
        ],
      },
      include: {
        leaveRequest: {
          include: {
            user: {
              select: {
                name: true,
                role: true,
                department: true,
                subCompanyId: true,
                subCompany: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Map segments to unified event schema
    const mappedLeaves = leaveSegments.map((seg) => ({
      id: seg.leaveRequestId, // Navigate to the parent LeaveRequest detail page
      userId: seg.leaveRequest.userId,
      userName: seg.leaveRequest.user.name,
      department: seg.leaveRequest.user.department || "Tidak Ada Departemen",
      subCompanyId: seg.leaveRequest.user.subCompanyId || "no-subcompany",
      subCompanyName: seg.leaveRequest.user.subCompany?.name || "Tidak Ada Unit Bisnis",
      category: "LEAVE" as const,
      type: seg.leaveType,
      startDate: seg.startDate.toISOString().substring(0, 10),
      endDate: seg.endDate.toISOString().substring(0, 10),
      totalDays: Number(seg.totalDays),
      reason: isKaryawan ? null : seg.leaveRequest.reason,
      attachmentUrl: isKaryawan ? null : seg.leaveRequest.attachmentUrl,
    }));

    // Query holidays that overlap with the range
    const holidays = await prisma.holiday.findMany({
      where: {
        AND: [
          { date: { lte: end } },
          { date: { gte: start } },
        ],
      },
    });

    // Map holidays to unified event schema
    const mappedHolidays = holidays.map((h) => ({
      id: h.id,
      userId: "system-holiday",
      userName: "Hari Libur Nasional",
      department: "Semua Departemen",
      subCompanyId: "all",
      subCompanyName: "Semua Unit Bisnis",
      category: "HOLIDAY" as const,
      type: "HARI_LIBUR",
      startDate: h.date.toISOString().substring(0, 10),
      endDate: h.date.toISOString().substring(0, 10),
      totalDays: 1,
      reason: h.description,
      attachmentUrl: null,
    }));

    const events = [...mappedLeaves, ...mappedHolidays];

    return { events };
  } catch (error: any) {
    console.error("Error fetching calendar events:", error);
    return { error: "Internal server error fetching calendar data." };
  }
}
